import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createApp } from "../src/app.mjs";
import { Store } from "../src/store.mjs";
import { qualify, compatible, validateProfile } from "../src/domain.mjs";
import { makeAI } from "../src/ai.mjs";
const profile = {
  name: "Asha",
  dob: "2000-01-01",
  city: "Pune",
  gender: "Woman",
  seeking: ["Man"],
  minAge: 22,
  maxAge: 35,
  localOnly: true,
  children: "Undecided",
  smoking: "No",
  noSmoking: true,
};
const card = {
  about: "I enjoy a quiet weekend and honest conversations.",
  values: ["Kindness", "Honesty"],
  interests: ["Books", "Coffee"],
  communication: "Talk it through",
};
const inviteCode = "test-invitation-123456";
async function fixture(t, ai) {
  const store = new Store(":memory:", randomBytes(32).toString("base64"));
  const { server } = createApp({
    store,
    inviteCode,
    ai: ai || {
      chat: async () => ({
        reply: "What does a meaningful weekend look like for you?",
        memory: "Enjoys books.",
      }),
      draft: async () => card,
    },
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((r) => server.close(r));
    store.close();
  });
  async function api(path, method = "GET", body, token) {
    const r = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, body: await r.json() };
  }
  async function register(handle, p = profile) {
    const r = await api("/auth/register", "POST", {
      handle,
      password: "correct-horse-2026",
      profile: p,
      inviteCode,
      adultConsent: true,
      aiConsent: true,
    });
    assert.equal(r.status, 200);
    return r.body;
  }
  function mature(id) {
    for (let d = 1; d <= 7; d++)
      for (let n = 0; n < 2; n++)
        store.run(
          "INSERT INTO turns(user_id,role,body,day,created,request_id) VALUES(?,?,?,?,?,?)",
          id,
          "user",
          store.seal(
            "I value kindness and honesty and really enjoy reading books over a calm weekend.",
          ),
          `2026-09-${String(d).padStart(2, "0")}`,
          new Date().toISOString(),
          randomUUID(),
        );
  }
  async function approved(handle, p) {
    const u = await register(handle, p);
    mature(u.user.id);
    const r = await api(
      "/profile/approve",
      "POST",
      { card, consent: true },
      u.token,
    );
    assert.equal(r.status, 200);
    return u;
  }
  return { store, api, register, mature, approved };
}
test("server rejects underage, fake dates and invalid preference ranges", () => {
  assert.throws(() => validateProfile({ ...profile, dob: "2020-01-01" }));
  assert.throws(() => validateProfile({ ...profile, dob: "2000-02-31" }));
  assert.throws(() => validateProfile({ ...profile, minAge: 16 }));
});
test("7 days means meaningful exchanges on separate server dates", () => {
  const turns = Array.from({ length: 50 }, () => ({
    role: "user",
    day: "2026-09-01",
    text: "x".repeat(80),
  }));
  assert.equal(qualify(turns).completed, 1);
  assert.equal(qualify(turns).ready, false);
  assert.equal(qualify([{ role: "user", day: "a", text: "hi" }]).completed, 0);
});
test("matching preferences are bilateral, children and smoking are hard filters", () => {
  const a = { profile, card, approved: 1 };
  const b = {
    profile: { ...profile, gender: "Man", seeking: ["Woman"] },
    card,
    approved: 1,
  };
  assert.ok(compatible(a, b));
  assert.equal(
    compatible(a, { ...b, profile: { ...b.profile, seeking: ["Man"] } }),
    null,
  );
  assert.equal(
    compatible(a, { ...b, profile: { ...b.profile, smoking: "Yes" } }),
    null,
  );
  assert.equal(
    compatible(
      { ...a, profile: { ...a.profile, children: "Want children" } },
      { ...b, profile: { ...b.profile, children: "Do not want children" } },
    ),
    null,
  );
});
test("auth, invite gating, session logout and encrypted private fields", async (t) => {
  const { api, register, store } = await fixture(t);
  assert.equal((await api("/me")).status, 401);
  assert.equal(
    (await api("/auth/register", "POST", { inviteCode: "wrong" })).status,
    403,
  );
  const u = await register("asha");
  assert.equal(
    (
      await api("/auth/login", "POST", {
        handle: "asha",
        password: "wrong-password",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await api("/auth/login", "POST", {
        handle: "asha",
        password: "correct-horse-2026",
      })
    ).status,
    200,
  );
  const raw = store.get("SELECT * FROM users WHERE id=?", u.user.id);
  assert.ok(!raw.profile.includes("Pune"));
  assert.ok(!raw.password.includes("correct-horse"));
  await api("/auth/logout", "POST", {}, u.token);
  assert.equal((await api("/me", "GET", undefined, u.token)).status, 401);
});
test("AI private history, idempotency, explicit consent and gate", async (t) => {
  const { api, register, store } = await fixture(t);
  const a = await register("asha"),
    b = await register("neha");
  const message = {
    message:
      "I really appreciate honesty and calm conversations after a difficult day.",
    requestId: randomUUID(),
  };
  assert.equal((await api("/ai/chat", "POST", message, a.token)).status, 200);
  assert.equal((await api("/ai/chat", "POST", message, a.token)).status, 200);
  assert.equal(store.turns(a.user.id).length, 2);
  assert.equal(
    (await api("/ai/history", "GET", undefined, b.token)).body.messages.length,
    0,
  );
  assert.equal(
    (await api("/profile/approve", "POST", { card, consent: true }, a.token))
      .status,
    403,
  );
  await api("/me/consent", "PUT", { aiConsent: false }, a.token);
  assert.equal(
    (
      await api(
        "/ai/chat",
        "POST",
        { ...message, requestId: randomUUID() },
        a.token,
      )
    ).status,
    403,
  );
  assert.ok(
    !store.get("SELECT body FROM turns LIMIT 1").body.includes("honesty"),
  );
});
test("failed AI calls do not fabricate history or progress", async (t) => {
  const { api, register, store } = await fixture(t, {
    chat: async () => {
      throw new Error("upstream failure");
    },
  });
  const a = await register("asha");
  assert.equal(
    (
      await api(
        "/ai/chat",
        "POST",
        {
          message:
            "A long enough message about honest conversations and everyday life.",
          requestId: randomUUID(),
        },
        a.token,
      )
    ).status,
    500,
  );
  assert.equal(store.turns(a.user.id).length, 0);
});
test("match data excludes private history, memory, birthdate and username", async (t) => {
  const { api, approved } = await fixture(t);
  const a = await approved("asha"),
    b = await approved("arjun", {
      ...profile,
      name: "Arjun",
      gender: "Man",
      seeking: ["Woman"],
    });
  const r = await api("/matches", "GET", undefined, a.token);
  assert.equal(r.body.people.length, 1);
  const p = r.body.people[0].person;
  assert.equal(p.id, b.user.id);
  for (const key of ["dob", "handle", "memory", "password", "profile"])
    assert.ok(!(key in p));
});
test("mutual consent, unauthorized participant, dedupe, report and block", async (t) => {
  const { api, approved, register } = await fixture(t);
  const a = await approved("asha"),
    b = await approved("arjun", {
      ...profile,
      name: "Arjun",
      gender: "Man",
      seeking: ["Woman"],
    }),
    c = await register("third");
  const r = await api("/intros", "POST", { target: b.user.id }, a.token);
  const id = r.body.id;
  assert.equal(
    (await api(`/intros/${id}/messages`, "GET", undefined, a.token)).status,
    403,
  );
  assert.equal(
    (await api(`/intros/${id}/accept`, "POST", {}, c.token)).status,
    404,
  );
  assert.equal(
    (await api(`/intros/${id}/accept`, "POST", {}, b.token)).status,
    200,
  );
  const msg = {
    message: "Hello, what have you been reading?",
    requestId: randomUUID(),
  };
  const sent = await api(`/intros/${id}/messages`, "POST", msg, a.token);
  assert.equal(sent.status, 200);
  assert.equal(
    (await api(`/intros/${id}/messages`, "POST", msg, a.token)).body.id,
    sent.body.id,
  );
  assert.equal(
    (await api(`/intros/${id}/messages`, "GET", undefined, b.token)).body
      .messages.length,
    1,
  );
  assert.equal(
    (await api(`/intros/${id}/messages`, "GET", undefined, c.token)).status,
    404,
  );
  assert.equal(
    (
      await api(
        "/reports",
        "POST",
        {
          target: a.user.id,
          reason: "Repeated unwanted contact after I asked them to stop.",
        },
        b.token,
      )
    ).status,
    200,
  );
  assert.equal(
    (await api(`/intros/${id}/messages`, "GET", undefined, a.token)).status,
    404,
  );
  assert.equal(
    (await api("/matches", "GET", undefined, a.token)).body.people.length,
    0,
  );
});
test("pausing withdraws pending introductions and visibility", async (t) => {
  const { api, approved } = await fixture(t);
  const a = await approved("asha"),
    b = await approved("arjun", {
      ...profile,
      gender: "Man",
      seeking: ["Woman"],
    });
  const id = (await api("/intros", "POST", { target: b.user.id }, a.token)).body
    .id;
  await api("/profile/pause", "POST", {}, a.token);
  assert.equal(
    (await api(`/intros/${id}/accept`, "POST", {}, b.token)).status,
    404,
  );
  assert.equal(
    (await api("/matches", "GET", undefined, b.token)).body.people.length,
    0,
  );
});
test("account deletion removes sessions, AI history, intros and messages", async (t) => {
  const { api, approved, store } = await fixture(t);
  const a = await approved("asha"),
    b = await approved("arjun", {
      ...profile,
      gender: "Man",
      seeking: ["Woman"],
    });
  const id = (await api("/intros", "POST", { target: b.user.id }, a.token)).body
    .id;
  await api(`/intros/${id}/accept`, "POST", {}, b.token);
  await api(
    `/intros/${id}/messages`,
    "POST",
    { message: "Hello!", requestId: randomUUID() },
    a.token,
  );
  assert.equal(
    (
      await api(
        "/me",
        "DELETE",
        { confirm: "DELETE", password: "wrong" },
        a.token,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await api(
        "/me",
        "DELETE",
        { confirm: "DELETE", password: "correct-horse-2026" },
        a.token,
      )
    ).status,
    200,
  );
  assert.equal(store.user(a.user.id), null);
  assert.equal(
    store.get("SELECT count(*) AS n FROM turns WHERE user_id=?", a.user.id).n,
    0,
  );
  assert.equal(store.get("SELECT count(*) AS n FROM messages").n, 0);
  assert.equal((await api("/me", "GET", undefined, a.token)).status, 401);
});
test("history deletion resets learning and removes AI memory", async (t) => {
  const { api, approved, store } = await fixture(t);
  const a = await approved("asha");
  await api("/ai/history", "DELETE", {}, a.token);
  const u = store.user(a.user.id);
  assert.equal(u.approved, 0);
  assert.equal(u.memory, null);
  assert.equal(u.card, null);
  assert.equal(store.turns(u.id).length, 0);
});
test("OpenAI request is stateless, bounded, structured and validated", async () => {
  let body;
  const ai = makeAI({
    key: "test",
    model: "configured-model",
    fetchImpl: async (url, o) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      body = JSON.parse(o.body);
      return {
        ok: true,
        json: async () => ({
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    reply: "A question?",
                    memory: "Prefers calm conversations.",
                  }),
                },
              ],
            },
          ],
        }),
      };
    },
  });
  const result = await ai.chat({ memory: "" }, [], "Hello");
  assert.equal(result.reply, "A question?");
  assert.equal(body.store, false);
  assert.equal(body.text.format.strict, true);
  assert.ok(body.max_output_tokens <= 2400);
});
