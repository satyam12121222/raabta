import { createServer } from "node:http";
import {
  randomUUID,
  randomInt,
  createHmac,
  randomBytes,
  createHash,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { Store } from "./store.mjs";
import { publicPage } from "./pages.mjs";
import { makeMailer, makeModerator } from "./services.mjs";
import { makeAI } from "./ai.mjs";
import {
  AppError,
  check,
  text,
  validateProfile,
  validateCard,
  compatible,
  publicProfile,
} from "./domain.mjs";
const derive = promisify(scrypt),
  hash = (x) => createHash("sha256").update(x).digest("hex");
async function passwordHash(p) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + Buffer.from(await derive(p, salt, 64)).toString("hex");
}
async function passwordOK(p, h) {
  const [salt, key] = h.split(":");
  return timingSafeEqual(
    Buffer.from(key, "hex"),
    Buffer.from(await derive(p, salt, 64)),
  );
}
async function readBody(req) {
  let parts = [],
    size = 0;
  for await (const c of req) {
    size += c.length;
    check(size <= 16384, "Request too large.", 413);
    parts.push(c);
  }
  try {
    const b = JSON.parse(Buffer.concat(parts).toString() || "{}");
    check(
      b && typeof b === "object" && !Array.isArray(b),
      "Expected a JSON object.",
    );
    return b;
  } catch {
    throw new AppError(400, "Invalid JSON object.");
  }
}
const iso = () => new Date().toISOString();
const day = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function createApp(config = {}) {
  const store =
    config.store ||
    new Store(config.dbPath || "data/raabta.db", config.dataKey);
  const ai = config.ai || makeAI({ key: config.aiKey, model: config.aiModel });
  const mailer = config.mailer || makeMailer({ key: config.mailKey, from: config.mailFrom });
  const moderate = config.moderate || (config.moderationEnabled ? makeModerator({ key: config.aiKey }) : async () => {});
  const policyVersion = "2026-10-01";
  const emailHash = value => createHmac("sha256", store.key).update(value).digest("hex");
  const normalizeEmail = value => {
    const v = text(value, "Email", 5, 254).toLowerCase();
    check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email address.");
    return v;
  };
  const consent = (id, kind, accepted) => store.run(
    "INSERT INTO consent_events(user_id,kind,version,accepted,created) VALUES(?,?,?,?,?)",
    id, kind, policyVersion, accepted ? 1 : 0, iso());
  const contact = id => store.get("SELECT * FROM contacts WHERE user_id=?", id);
  const assertVerified = u => check(!config.requireVerification || contact(u.id)?.verified, "Verify your email in You before continuing.", 403);
  const challengeLocks = new Set();
  async function sendCode(u, purpose) {
    const c = contact(u.id);
    check(c, "Add your recovery email in You first.", 400);
    check(!challengeLocks.has(u.id), "A code is being sent. Please wait.", 409);
    limit("email-user:" + u.id, 4);
    limit("email-global", config.globalHourlyEmails ?? 100, 3600000);
    challengeLocks.add(u.id);
    const code = String(randomInt(10000000, 100000000));
    const digest = emailHash(u.id + purpose + code);
    try {
      store.run("INSERT INTO challenges(user_id,purpose,token,expires,attempts) VALUES(?,?,?,?,0) ON CONFLICT(user_id,purpose) DO UPDATE SET token=excluded.token,expires=excluded.expires,attempts=0", u.id, purpose, digest, Date.now() + 600000);
      await mailer({ email: store.open(c.email), code, purpose });
    } catch (e) {
      store.run("DELETE FROM challenges WHERE user_id=? AND purpose=? AND token=?", u.id, purpose, digest);
      throw e;
    } finally { challengeLocks.delete(u.id); }
  }
  function verifyCode(id, purpose, code) {
    const c = store.get("SELECT * FROM challenges WHERE user_id=? AND purpose=?", id, purpose);
    check(c && c.expires > Date.now() && c.attempts < 5, "Code is invalid or expired. Request a new code.", 400);
    store.run("UPDATE challenges SET attempts=attempts+1 WHERE user_id=? AND purpose=?", id, purpose);
    check(timingSafeEqual(Buffer.from(c.token, 'hex'), Buffer.from(emailHash(id + purpose + text(code, "Code", 8, 8)), 'hex')), "Code is invalid or expired.", 400);
    store.run("DELETE FROM challenges WHERE user_id=? AND purpose=?", id, purpose);
  }
  const inFlight = new Set(),
    requiredDays = 7;
  for (const n of [config.dailyMessages ?? 30, config.globalDailyCalls ?? 500, config.globalHourlyEmails ?? 100])
    check(
      Number.isSafeInteger(n) && n > 0,
      "Daily AI limits must be positive integers.",
      500,
    );
  check(
    typeof config.inviteCode === "string" && config.inviteCode.length >= 12,
    "Configure an invite code of at least 12 characters.",
    500,
  );
  function limit(key, n, ms = 3600000) {
    check(
      store.consume(key, n, ms),
      "Too many requests. Please try again later.",
      429,
    );
  }
  function session(token) {
    const r = store.get(
      "SELECT * FROM sessions WHERE token=? AND expires>?",
      hash(token),
      Date.now(),
    );
    const u = r && store.user(r.user_id);
    check(u && !u.suspended, "Please sign in again.", 401);
    return u;
  }
  function issue(id) {
    const token = randomBytes(32).toString("base64url");
    store.run("DELETE FROM sessions WHERE expires<?", Date.now());
    store.run(
      "INSERT INTO sessions VALUES(?,?,?)",
      hash(token),
      id,
      Date.now() + 7 * 86400000,
    );
    return token;
  }
  function progress(u) {
    return store.progress(u.id, requiredDays);
  }
  function me(u) {
    return {
      email: contact(u.id) ? store.open(contact(u.id).email) : "",
      emailVerified: !!contact(u.id)?.verified,
      verificationRequired: !!config.requireVerification,
      policyVersion,
      id: u.id,
      handle: u.handle,
      profile: u.profile,
      card: u.card,
      approved: !!u.approved,
      aiConsent: !!u.ai_consent,
      progress: progress(u),
      aiConfigured: !!config.ai || !!(config.aiKey && config.aiModel),
    };
  }
  function eligible(u) {
    return !!u && !u.suspended && !!u.approved && (!config.requireVerification || !!contact(u.id)?.verified) && progress(u).ready;
  }
  function pair(a, b) {
    return [a, b].sort();
  }
  function relevant(id, target) {
    return store.get(
      "SELECT * FROM intros WHERE (a=? AND b=?) OR (a=? AND b=?)",
      id,
      target,
      target,
      id,
    );
  }
  function introFor(id, u, chat = false) {
    const i = store.get("SELECT * FROM intros WHERE id=?", id);
    check(
      i && (i.a === u.id || i.b === u.id) && !i.closed,
      "Introduction not available.",
      404,
    );
    const other = store.user(i.a === u.id ? i.b : i.a);
    check(
      other && !other.suspended && !store.blocked(u.id, other.id),
      "Introduction not available.",
      404,
    );
    if (chat)
      check(
        i.a_yes && i.b_yes,
        "Both people must accept before messaging.",
        403,
      );
    return { i, other };
  }
  function introView(i, u) {
    const other = store.user(i.a === u.id ? i.b : i.a);
    if (!other || other.suspended || store.blocked(u.id, other.id) || i.closed)
      return null;
    return {
      id: i.id,
      person: publicProfile(other),
      acceptedByMe: !!(i.a === u.id ? i.a_yes : i.b_yes),
      connected: !!(i.a_yes && i.b_yes),
      comparison: compatible(u, other),
      unread: store.get("SELECT count(*) AS n FROM messages WHERE intro_id=? AND sender<>? AND id>COALESCE((SELECT last_id FROM message_reads WHERE user_id=? AND intro_id=?),0)", i.id, u.id, u.id, i.id).n,
    };
  }
  async function route(req) {
    const path = new URL(req.url, "http://localhost").pathname,
      method = req.method;
    if (path === "/health" && method === "GET")
      return { ok: true, service: "raabta", version: "0.2.0" };
    if (path === "/config" && method === "GET") return {
      inviteRequired: config.registrationMode !== "open", verificationRequired: !!config.requireVerification,
      policyVersion, privacyUrl: config.privacyUrl || "", termsUrl: config.termsUrl || "", supportEmail: config.supportEmail || "",
    };
    // Only trust the immediate proxy when explicitly configured. Caddy overwrites X-Real-IP.
    const ip = config.trustProxy && typeof req.headers['x-real-ip'] === 'string'
      ? req.headers['x-real-ip'].slice(0, 80) : req.socket.remoteAddress || "unknown";
    limit("http:" + ip, 600, 60000);
    if (path === "/auth/register" && method === "POST") {
      limit("register:" + ip, 10);
      const b = await readBody(req);
      check(
        config.registrationMode === "open" || b.inviteCode === config.inviteCode,
        "This pilot requires a valid invitation.",
        403,
      );
      const handle = text(b.handle, "Username", 3, 30).toLowerCase();
      check(
        /^[a-z0-9_]+$/.test(handle),
        "Use letters, numbers and underscores for username.",
      );
      const email = b.email ? normalizeEmail(b.email) : null;
      check(!config.requireVerification || email, "Email is required for account recovery.");
      check(!config.requireVerification || b.termsConsent === true, "Accept the terms and privacy notice.");
      if (email) check(!store.get("SELECT 1 FROM contacts WHERE email_hash=?", emailHash(email)), "Unable to create account with these details. Try signing in or recovering your account.", 409);
      const p = text(b.password, "Password", 12, 128);
      const profile = validateProfile(b.profile);
      check(b.adultConsent === true, "Confirm that you are an adult.");
      const pw = await passwordHash(p),
        id = randomUUID();
      check(
        !store.get("SELECT 1 FROM users WHERE handle=?", handle),
        "This username is unavailable.",
        409,
      );
      store.transaction(() => {
      store.run(
        "INSERT INTO users(id,handle,password,profile,ai_consent,created) VALUES(?,?,?,?,?,?)",
        id,
        handle,
        pw,
        store.seal(profile),
        b.aiConsent === true ? 1 : 0,
        iso(),
      );
      if (email) store.run("INSERT INTO contacts(user_id,email_hash,email) VALUES(?,?,?)", id, emailHash(email), store.seal(email));
      consent(id, "terms", b.termsConsent === true);
      consent(id, "ai", b.aiConsent === true);
      });
      const u = store.user(id);
      return { token: issue(id), user: me(u) };
    }
    if (path === "/auth/login" && method === "POST") {
      limit("login:" + ip, 30, 900000);
      const b = await readBody(req),
        handle = text(b.handle, "Username", 3, 30).toLowerCase();
      limit("login-user:" + hash(handle), 10, 900000);
      const p = text(b.password, "Password", 1, 128),
        r = store.get(
          "SELECT id,password,suspended FROM users WHERE handle=?",
          handle,
        );
      // Run a costly derivation even for unknown users to reduce timing disclosure.
      const valid = await passwordOK(
        p,
        r?.password || "00000000000000000000000000000000:" + "00".repeat(64),
      );
      check(
        r && valid && !r.suspended,
        "Username or password is incorrect.",
        401,
      );
      return { token: issue(r.id), user: me(store.user(r.id)) };
    }
    if (path === "/auth/recovery" && method === "POST") {
      limit("recovery-ip:" + ip, 8, 900000);
      const b = await readBody(req), email = normalizeEmail(b.email);
      limit("recovery-email:" + emailHash(email), 4);
      const c = store.get("SELECT * FROM contacts WHERE email_hash=? AND verified=1", emailHash(email));
      // Do not disclose existence or delivery status to unauthenticated clients.
      if (c && !store.user(c.user_id)?.suspended) {
        try { await sendCode(store.user(c.user_id), "reset"); } catch { /* generic response */ }
      }
      return { ok: true, message: "If a verified account exists, a code will arrive shortly." };
    }
    if (path === "/auth/reset" && method === "POST") {
      limit("reset-ip:" + ip, 20, 900000);
      const b = await readBody(req), email = normalizeEmail(b.email);
      const c = store.get("SELECT * FROM contacts WHERE email_hash=? AND verified=1", emailHash(email));
      check(c && !store.user(c.user_id)?.suspended, "Code is invalid or expired.");
      const p = text(b.password, "New password", 12, 128);
      // Derive before consuming code, then check and commit synchronously so two requests cannot reuse it.
      const pw = await passwordHash(p);
      verifyCode(c.user_id, "reset", b.code);
      store.transaction(() => {
        store.run("UPDATE users SET password=? WHERE id=?", pw, c.user_id);
        store.run("DELETE FROM sessions WHERE user_id=?", c.user_id);
      });
      return { ok: true };
    }
    const token = (req.headers.authorization || "").replace(/^Bearer /, "");
    check(token.length > 20, "Sign in to continue.", 401);
    const u = session(token);
    if (path === "/auth/logout" && method === "POST") {
      store.run("DELETE FROM sessions WHERE token=?", hash(token));
      return { ok: true };
    }
    if (path === "/auth/email" && method === "PUT") {
      const b = await readBody(req);
      check(!contact(u.id), "This account already has a recovery email. Contact support to change it.", 409);
      check(await passwordOK(text(b.password, "Password", 1, 128), u.password), "Password is incorrect.", 403);
      const email = normalizeEmail(b.email);
      check(!store.get("SELECT 1 FROM contacts WHERE email_hash=?", emailHash(email)), "Email is unavailable.", 409);
      store.run("INSERT INTO contacts(user_id,email_hash,email) VALUES(?,?,?)", u.id, emailHash(email), store.seal(email));
      return me(store.user(u.id));
    }
    if (path === "/auth/verify/send" && method === "POST") {
      check(!contact(u.id)?.verified, "Email is already verified.");
      await sendCode(u, "verify"); return { ok: true };
    }
    if (path === "/auth/verify" && method === "POST") {
      const b = await readBody(req);
      verifyCode(u.id, "verify", b.code);
      store.run("UPDATE contacts SET verified=1 WHERE user_id=?", u.id);
      return me(store.user(u.id));
    }
    if (path === "/auth/password" && method === "PUT") {
      limit("password:" + u.id, 5, 900000);
      const b = await readBody(req);
      check(await passwordOK(text(b.currentPassword, "Current password", 1, 128), u.password), "Password is incorrect.", 403);
      const pw = await passwordHash(text(b.password, "New password", 12, 128));
      // Reject a stale session after an overlapping reset or password change.
      session(token);
      check(store.user(u.id).password === u.password, "Password changed. Sign in again.", 401);
      store.transaction(() => {
        store.run("UPDATE users SET password=? WHERE id=?", pw, u.id);
        store.run("DELETE FROM sessions WHERE user_id=?", u.id);
      });
      return { token: issue(u.id), user: me(store.user(u.id)) };
    }
    if (path === "/auth/logout-all" && method === "POST") {
      store.run("DELETE FROM sessions WHERE user_id=?", u.id); return { ok: true };
    }
    if (path === "/me/memory" && method === "GET") return { memory: u.memory || "" };
    if (path === "/me/memory" && method === "PUT") {
      const b = await readBody(req);
      check(!inFlight.has(u.id), "Wait for the current AI response.", 409);
      const memory = text(b.memory, "Memory", 0, 12000);
      store.run("UPDATE users SET memory=? WHERE id=?", store.seal(memory), u.id);
      return { memory };
    }
    if (path === "/blocks" && method === "GET") return { people: store.all("SELECT target FROM blocks WHERE owner=?", u.id).map(b => ({ id: b.target, name: store.user(b.target)?.profile.name || "Former member" })) };
    if (path === "/blocks" && method === "DELETE") {
      const b = await readBody(req);
      store.run("DELETE FROM blocks WHERE owner=? AND target=?", u.id, text(b.target, "Person", 1, 80));
      return { ok: true }; // Unblocking never reopens an old conversation.
    }
    if (path === "/me" && method === "GET") return me(u);
    if (path === "/me" && method === "PUT") {
      const b = await readBody(req),
        p = validateProfile(b.profile);
      check(!inFlight.has(u.id), "Wait for the current AI response.", 409);
      store.transaction(() => {
        store.run(
          "UPDATE users SET profile=?,approved=0 WHERE id=?",
          store.seal(p),
          u.id,
        );
        store.run(
          "UPDATE intros SET closed=1 WHERE (a=? OR b=?) AND NOT(a_yes=1 AND b_yes=1)",
          u.id,
          u.id,
        );
      });
      return me(store.user(u.id));
    }
    if (path === "/me/consent" && method === "PUT") {
      const b = await readBody(req);
      check(typeof b.aiConsent === "boolean", "Consent must be yes or no.");
      check(!inFlight.has(u.id), "Wait for the current AI response.", 409);
      store.run(
        "UPDATE users SET ai_consent=? WHERE id=?",
        b.aiConsent ? 1 : 0,
        u.id,
      );
      consent(u.id, "ai", b.aiConsent);
      return me(store.user(u.id));
    }
    if (path === "/me" && method === "DELETE") {
      limit("delete:" + u.id, 5, 900000);
      const b = await readBody(req);
      check(b.confirm === "DELETE", "Type DELETE to confirm.");
      check(!inFlight.has(u.id), "Wait for the current AI response.", 409);
      check(
        await passwordOK(text(b.password, "Password", 1, 128), u.password),
        "Password is incorrect.",
        403,
      );
      store.transaction(() => {
        store.run("DELETE FROM limits WHERE k LIKE ?", `ai:${u.id}:%`);
        store.run("DELETE FROM users WHERE id=?", u.id);
      });
      return { ok: true };
    }
    if (path === "/ai/reports" && method === "POST") {
      limit("ai-reports:" + u.id, 10);
      const b = await readBody(req);
      check(Number.isSafeInteger(b.messageId), "Select an AI reply.");
      const turn = store.get("SELECT id FROM turns WHERE id=? AND user_id=? AND role='assistant'", b.messageId, u.id);
      check(turn, "Reply not available.", 404);
      store.run("INSERT INTO ai_reports(id,user_id,turn_id,reason,created) VALUES(?,?,?,?,?)", randomUUID(), u.id, b.messageId, store.seal(text(b.reason, "Reason", 10, 2000)), iso());
      return { ok: true };
    }
    if (path === "/ai/history" && method === "GET") {
      const raw = new URL(req.url, "http://localhost").searchParams.get("before");
      const before = raw === null ? Number.MAX_SAFE_INTEGER : Number(raw);
      check(Number.isSafeInteger(before) && before > 0, "Invalid history cursor.");
      const turns = store.recentTurns(u.id, 101, before);
      return { messages: turns.slice(-100).map(t => ({ id: t.id, role: t.role, text: t.text, created: t.created })),
        hasMore: turns.length > 100, progress: progress(u) };
    }
    if (path === "/ai/history" && method === "DELETE") {
      check(!inFlight.has(u.id), "Wait for the current AI response.", 409);
      store.transaction(() => {
        store.run("DELETE FROM turns WHERE user_id=?", u.id);
        store.run(
          "UPDATE users SET memory=NULL,card=NULL,approved=0 WHERE id=?",
          u.id,
        );
        store.run(
          "UPDATE intros SET closed=1 WHERE (a=? OR b=?) AND NOT(a_yes=1 AND b_yes=1)",
          u.id,
          u.id,
        );
      });
      return me(store.user(u.id));
    }
    if (path === "/ai/chat" && method === "POST") {
      assertVerified(u);
      check(u.ai_consent, "Enable AI processing in your profile first.", 403);
      const b = await readBody(req),
        message = text(b.message, "Message", 1, 2000),
        requestId = text(b.requestId, "Request ID", 8, 80);
      const cached = store.get(
        "SELECT body FROM turns WHERE user_id=? AND request_id=? AND role='assistant'",
        u.id,
        requestId,
      );
      if (cached)
        return { reply: store.open(cached.body), progress: progress(u) };
      check(!inFlight.has(u.id), "Please wait for the current reply.", 409);
      limit("ai:" + u.id + ":" + day(), config.dailyMessages || 30, 86400000);
      limit("ai:global:" + day(), config.globalDailyCalls || 500, 86400000);
      inFlight.add(u.id);
      try {
        await moderate(message, "reflection");
        const r = await ai.chat(u, store.recentTurns(u.id, 18), message);
        await moderate(r.reply, "public");
        check(
          typeof r.reply === "string" &&
            r.reply.length > 0 &&
            r.reply.length <= 6000 &&
            typeof r.memory === "string" &&
            r.memory.length <= 12000,
          "Invalid AI response.",
          503,
        );
        session(token);
        check(
          store.user(u.id) && !store.user(u.id).suspended,
          "Account no longer available.",
          403,
        );
        store.transaction(() => {
          for (const [role, body] of [
            ["user", message],
            ["assistant", r.reply],
          ])
            store.run(
              "INSERT INTO turns(user_id,role,body,day,created,request_id) VALUES(?,?,?,?,?,?)",
              u.id,
              role,
              store.seal(body),
              day(),
              iso(),
              requestId,
            );
          store.run(
            "UPDATE users SET memory=? WHERE id=?",
            store.seal(r.memory),
            u.id,
          );
        });
        return { reply: r.reply, progress: progress(u) };
      } finally {
        inFlight.delete(u.id);
      }
    }
    if (path === "/profile/draft" && method === "POST") {
      assertVerified(u);
      check(u.ai_consent, "Enable AI processing first.", 403);
      check(
        progress(u).ready,
        "Complete conversations on 7 different days first.",
        403,
      );
      check(!inFlight.has(u.id), "Wait for the current AI response.", 409);
      limit("ai:" + u.id + ":draft:" + day(), 3, 86400000);
      limit("ai:global:" + day(), config.globalDailyCalls || 500, 86400000);
      inFlight.add(u.id);
      try {
        const card = validateCard(await ai.draft(u, store.recentTurns(u.id, 30)));
        await moderate(card.about, "public");
        return { card };
      } finally {
        inFlight.delete(u.id);
      }
    }
    if (path === "/profile/approve" && method === "POST") {
      const b = await readBody(req);
      check(
        progress(u).ready,
        "Complete conversations on 7 different days first.",
        403,
      );
      check(b.consent === true, "Approve sharing this profile for matching.");
      assertVerified(u);
      const card = validateCard(b.card);
      limit("profile:" + u.id, 20);
      await moderate(card.about, "public");
      const fresh = session(token);
      check(progress(fresh).ready, "Learning progress changed. Refresh your profile.", 409);
      store.transaction(() => {
        store.run(
          "UPDATE users SET card=?,approved=1 WHERE id=?",
          store.seal(card),
          u.id,
        );
        store.run(
          "UPDATE intros SET closed=1 WHERE (a=? OR b=?) AND NOT(a_yes=1 AND b_yes=1)",
          u.id,
          u.id,
        );
      });
      consent(u.id, "matching", true);
      return me(store.user(u.id));
    }
    if (path === "/profile/pause" && method === "POST") {
      store.transaction(() => {
        store.run("UPDATE users SET approved=0 WHERE id=?", u.id);
        store.run(
          "UPDATE intros SET closed=1 WHERE (a=? OR b=?) AND NOT(a_yes=1 AND b_yes=1)",
          u.id,
          u.id,
        );
      });
      return me(store.user(u.id));
    }
    if (path === "/matches" && method === "GET") {
      if (!eligible(u))
        return {
          people: [],
          reason: "Review and approve your profile after 7 conversation days.",
        };
      const people = store
        .all(
          "SELECT id FROM users WHERE approved=1 AND suspended=0 AND id<>?",
          u.id,
        )
        .map((r) => store.user(r.id))
        .filter(
          (v) =>
            eligible(v) && !store.blocked(u.id, v.id) && !relevant(u.id, v.id),
        )
        .map((v) => ({
          person: publicProfile(v),
          comparison: compatible(u, v),
        }))
        .filter((v) => v.comparison)
        .sort((a, b) => b.comparison.rank - a.comparison.rank)
        .slice(0, 3)
        .map(({ person, comparison: { rank, ...comparison } }) => ({
          person,
          comparison,
        }));
      return {
        people,
        reason: people.length
          ? ""
          : "No compatible people in the pilot yet. We will not invent a match.",
      };
    }
    if (path === "/intros" && method === "GET")
      return {
        intros: store
          .all(
            "SELECT * FROM intros WHERE (a=? OR b=?) AND closed=0 ORDER BY created DESC",
            u.id,
            u.id,
          )
          .map((i) => introView(i, u))
          .filter(Boolean),
      };
    if (path === "/intros" && method === "POST") {
      limit("intros:" + u.id, 10, 86400000);
      const b = await readBody(req),
        target = text(b.target, "Person", 1, 80);
      check(target !== u.id, "Choose another person.");
      const v = store.user(target);
      check(
        eligible(u) &&
          eligible(v) &&
          !store.blocked(u.id, target) &&
          compatible(u, v),
        "This person is no longer available for matching.",
        409,
      );
      const existing = relevant(u.id, target);
      check(!existing, "An introduction already exists.", 409);
      const [a, bb] = pair(u.id, target),
        id = randomUUID();
      store.run(
        "INSERT INTO intros(id,a,b,a_yes,b_yes,created) VALUES(?,?,?,?,?,?)",
        id,
        a,
        bb,
        a === u.id ? 1 : 0,
        bb === u.id ? 1 : 0,
        iso(),
      );
      return { id };
    }
    const im = path.match(/^\/intros\/([^/]+)\/(accept|decline|messages|read)$/);
    if (im) {
      const { i, other } = introFor(im[1], u, im[2] === "messages" || im[2] === "read");
      if (im[2] === "accept" && method === "POST") {
        check(
          eligible(u) && eligible(other) && compatible(u, other),
          "Profiles changed. A new review is needed.",
          409,
        );
        store.run(
          `UPDATE intros SET ${i.a === u.id ? "a_yes" : "b_yes"}=1 WHERE id=?`,
          i.id,
        );
        return { ok: true };
      }
      if (im[2] === "decline" && method === "POST") {
        store.run("UPDATE intros SET closed=1 WHERE id=?", i.id);
        return { ok: true };
      }
      if (im[2] === "read" && method === "POST") {
        const b = await readBody(req);
        check(Number.isSafeInteger(b.lastId) && b.lastId >= 0, "Invalid read cursor.");
        check(b.lastId === 0 || store.get("SELECT 1 FROM messages WHERE intro_id=? AND id=?", i.id, b.lastId), "Invalid read cursor.");
        store.run("INSERT INTO message_reads VALUES(?,?,?) ON CONFLICT(user_id,intro_id) DO UPDATE SET last_id=MAX(last_id,excluded.last_id)", u.id, i.id, b.lastId);
        return { ok: true };
      }
      if (im[2] === "messages" && method === "GET") {
        const raw =
          new URL(req.url, "http://localhost").searchParams.get("after") || "0";
        const after = Number(raw);
        check(
          Number.isSafeInteger(after) && after >= 0,
          "Invalid message cursor.",
        );
        return {
          messages: store
            .all(
              "SELECT * FROM messages WHERE intro_id=? AND id>? ORDER BY id LIMIT 100",
              i.id,
              after,
            )
            .map((m) => ({
              id: m.id,
              sender: m.sender,
              text: store.open(m.body),
              created: m.created,
            })),
        };
      }
      if (im[2] === "messages" && method === "POST") {
        limit("chat:" + u.id, 60, 60000);
        const b = await readBody(req),
          message = text(b.message, "Message", 1, 2000),
          requestId = text(b.requestId, "Request ID", 8, 80);
        const old = store.get(
          "SELECT id,intro_id FROM messages WHERE sender=? AND request_id=?",
          u.id,
          requestId,
        );
        if (old) {
          check(old.intro_id === i.id, "Request ID already used.", 409);
          return { id: old.id };
        }
        await moderate(message, "public");
        session(token);
        introFor(i.id, u, true); // Recheck block/deletion while moderation was in flight.
        const duplicate = store.get("SELECT id,intro_id FROM messages WHERE sender=? AND request_id=?", u.id, requestId);
        if (duplicate) { check(duplicate.intro_id === i.id, "Request ID already used.", 409); return { id: duplicate.id }; }
        const result = store.run(
          "INSERT INTO messages(intro_id,sender,body,created,request_id) VALUES(?,?,?,?,?)",
          i.id,
          u.id,
          store.seal(message),
          iso(),
          requestId,
        );
        return { id: Number(result.lastInsertRowid) };
      }
    }
    if ((path === "/blocks" || path === "/reports") && method === "POST") {
      const b = await readBody(req),
        target = text(b.target, "Person", 1, 80);
      check(
        target !== u.id && store.user(target),
        "Person not available.",
        404,
      );
      check(
        relevant(u.id, target) ||
          (eligible(u) &&
            eligible(store.user(target)) &&
            compatible(u, store.user(target))),
        "Person not available.",
        404,
      );
      if (path === "/reports") {
        limit("reports:" + u.id, 10);
        const reason = text(b.reason, "Report", 10, 2000);
        store.run(
          "INSERT INTO reports(id,reporter,target,body,created) VALUES(?,?,?,?,?)",
          randomUUID(),
          u.id,
          target,
          store.seal(reason),
          iso(),
        );
      }
      store.transaction(() => {
        store.run("INSERT OR IGNORE INTO blocks VALUES(?,?)", u.id, target);
        store.run(
          "UPDATE intros SET closed=1 WHERE (a=? AND b=?) OR (a=? AND b=?)",
          u.id,
          target,
          target,
          u.id,
        );
      });
      return { ok: true };
    }
    throw new AppError(404, "Not found.");
  }
  const server = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Request-ID", randomUUID());
    if (req.method === "GET") {
      const page = publicPage(new URL(req.url, "http://localhost").pathname, config);
      if (page) {
        res.setHeader("Content-Type", page[0] + "; charset=utf-8");
        res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
        res.end(page[1]); return;
      }
    }
    const origin = req.headers.origin;
    if (origin) {
      if (!config.allowedOrigin || origin !== config.allowedOrigin) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: "Origin not allowed." }));
        return;
      }
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type,Authorization",
      );
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,DELETE,OPTIONS",
      );
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    try {
      res.end(JSON.stringify(await route(req)));
    } catch (e) {
      const status = e instanceof AppError ? e.status : 500;
      res.writeHead(status);
      res.end(
        JSON.stringify({
          error: status === 500 ? "Internal error. Please retry." : e.message,
        }),
      );
      if (status === 500) console.error("Internal request error:", e.name);
    }
  });
  server.requestTimeout = 60000;
  server.headersTimeout = 15000;
  return { server, store };
}
