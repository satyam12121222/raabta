import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env")) { console.log(".env already exists; preserved."); process.exit(0); }
const content = readFileSync(new URL("./.env.example", import.meta.url), "utf8")
  .replace(/^DATA_KEY=$/m, `DATA_KEY=${randomBytes(32).toString("base64")}`)
  .replace(/^INVITE_CODE=$/m, `INVITE_CODE=${randomBytes(18).toString("base64url")}`);
writeFileSync(".env", content, { mode: 0o600 });
console.log("Created .env. Add AI and email credentials. Back up DATA_KEY separately.");
