import { DatabaseSync } from "node:sqlite";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export class Store {
  constructor(path, key) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.key = Buffer.from(key, "base64");
    if (this.key.length !== 32)
      throw new Error("DATA_KEY must be a base64-encoded 32-byte key.");
    this.db = new DatabaseSync(path);
    this.db
      .exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,handle TEXT UNIQUE NOT NULL,password TEXT NOT NULL,profile TEXT NOT NULL,card TEXT,memory TEXT,approved INTEGER NOT NULL DEFAULT 0,ai_consent INTEGER NOT NULL DEFAULT 0,suspended INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS turns(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,role TEXT NOT NULL,body TEXT NOT NULL,day TEXT NOT NULL,created TEXT NOT NULL,request_id TEXT);
    CREATE UNIQUE INDEX IF NOT EXISTS request_dedupe ON turns(user_id,request_id,role);
    CREATE TABLE IF NOT EXISTS intros(id TEXT PRIMARY KEY,a TEXT REFERENCES users(id) ON DELETE CASCADE,b TEXT REFERENCES users(id) ON DELETE CASCADE,a_yes INTEGER NOT NULL DEFAULT 0,b_yes INTEGER NOT NULL DEFAULT 0,closed INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL,UNIQUE(a,b));
    CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT,intro_id TEXT REFERENCES intros(id) ON DELETE CASCADE,sender TEXT REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL,created TEXT NOT NULL,request_id TEXT NOT NULL,UNIQUE(sender,request_id));
    CREATE TABLE IF NOT EXISTS blocks(owner TEXT REFERENCES users(id) ON DELETE CASCADE,target TEXT REFERENCES users(id) ON DELETE CASCADE,PRIMARY KEY(owner,target));
    CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY,reporter TEXT REFERENCES users(id) ON DELETE CASCADE,target TEXT REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL,created TEXT NOT NULL,resolved INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS ai_reports(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,turn_id INTEGER REFERENCES turns(id) ON DELETE CASCADE,reason TEXT NOT NULL,created TEXT NOT NULL,resolved INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS contacts(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,email_hash TEXT UNIQUE NOT NULL,email TEXT NOT NULL,verified INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS challenges(user_id TEXT REFERENCES users(id) ON DELETE CASCADE,purpose TEXT NOT NULL,token TEXT NOT NULL,expires INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,purpose));
    CREATE TABLE IF NOT EXISTS consent_events(id INTEGER PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,kind TEXT NOT NULL,version TEXT NOT NULL,accepted INTEGER NOT NULL,created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS message_reads(user_id TEXT REFERENCES users(id) ON DELETE CASCADE,intro_id TEXT REFERENCES intros(id) ON DELETE CASCADE,last_id INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,intro_id));
    CREATE INDEX IF NOT EXISTS turns_user ON turns(user_id,id);
    CREATE INDEX IF NOT EXISTS messages_intro ON messages(intro_id,id);
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS limits(k TEXT PRIMARY KEY,n INTEGER NOT NULL,until_ms INTEGER NOT NULL);`);
  }
  progress(id, required = 7) {
    // Ciphertext is decrypted one row at a time; never load the entire conversation into memory.
    const days = new Map();
    for (const t of this.db.prepare("SELECT body,day FROM turns WHERE user_id=? AND role='user'").iterate(id)) {
      const length = this.open(t.body).trim().length;
      if (length < 40) continue;
      const v = days.get(t.day) || { count: 0, chars: 0 };
      v.count++; v.chars += length; days.set(t.day, v);
    }
    const completed = [...days.values()].filter(v => v.count >= 2 && v.chars >= 120).length;
    return { completed, required, ready: completed >= required };
  }
  recentTurns(id, count = 200, before = Number.MAX_SAFE_INTEGER) {
    return this.all("SELECT * FROM turns WHERE user_id=? AND id<? ORDER BY id DESC LIMIT ?", id, before, count)
      .reverse().map(t => ({ ...t, text: this.open(t.body) }));
  }
  seal(v) {
    const iv = randomBytes(12),
      c = createCipheriv("aes-256-gcm", this.key, iv);
    const data = Buffer.concat([
      c.update(JSON.stringify(v), "utf8"),
      c.final(),
    ]);
    return Buffer.concat([iv, c.getAuthTag(), data]).toString("base64");
  }
  open(v) {
    if (v == null) return null;
    const b = Buffer.from(v, "base64"),
      d = createDecipheriv("aes-256-gcm", this.key, b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8"),
    );
  }
  run(sql, ...p) {
    return this.db.prepare(sql).run(...p);
  }
  get(sql, ...p) {
    return this.db.prepare(sql).get(...p);
  }
  all(sql, ...p) {
    return this.db.prepare(sql).all(...p);
  }
  user(id) {
    const u = this.get("SELECT * FROM users WHERE id=?", id);
    return u
      ? {
          ...u,
          profile: this.open(u.profile),
          card: this.open(u.card),
          memory: this.open(u.memory),
        }
      : null;
  }
  turns(id) {
    return this.all("SELECT * FROM turns WHERE user_id=? ORDER BY id", id).map(
      (t) => ({ ...t, text: this.open(t.body) }),
    );
  }
  transaction(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const r = fn();
      this.db.exec("COMMIT");
      return r;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  blocked(a, b) {
    return !!this.get(
      "SELECT 1 FROM blocks WHERE (owner=? AND target=?) OR (owner=? AND target=?)",
      a,
      b,
      b,
      a,
    );
  }
  consume(k, max, windowMs, now = Date.now()) {
    this.run("DELETE FROM limits WHERE until_ms<?", now);
    const r = this.get("SELECT * FROM limits WHERE k=?", k);
    if (r && r.n >= max) return false;
    this.run(
      "INSERT INTO limits(k,n,until_ms) VALUES(?,1,?) ON CONFLICT(k) DO UPDATE SET n=n+1",
      k,
      now + windowMs,
    );
    return true;
  }
  close() {
    this.db.close();
  }
}
