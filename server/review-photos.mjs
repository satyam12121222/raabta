// Operator-only CLI; never expose this command or DATA_KEY through an API.
import { writeFileSync } from "node:fs";
import { Store } from "./src/store.mjs";
import { initPhotos, expireSelfies, reviewPhotos } from "./src/photos.mjs";
const s = new Store(process.env.DB_PATH || "data/raabta.db", process.env.DATA_KEY);
const [command, id, revision, reason = ""] = process.argv.slice(2);
const escape = x => String(x).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
try {
  initPhotos(s); expireSelfies(s);
  if (command === "list") {
    console.log(JSON.stringify(s.all("SELECT user_id,revision,expires FROM photo_reviews WHERE status='pending' ORDER BY expires")));
  } else if (command === "export") {
    const r = s.get("SELECT * FROM photo_reviews WHERE user_id=? AND status='pending'", id);
    if (!r?.selfie) throw new Error("No pending review.");
    const u = s.user(id);
    const photos = s.all("SELECT slot,body FROM profile_photos WHERE user_id=? ORDER BY slot", id);
    const img = (label, data) => '<figure><figcaption>' + escape(label) + '</figcaption><img width="280" src="data:image/jpeg;base64,' + s.open(data) + '"></figure>';
    const html = '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:"><title>Private photo review</title><h1>' + escape(u.profile.name) + '</h1><p>USER: ' + escape(id) + '</p><p>REVISION: ' + escape(r.revision) + '</p><p>Approve only if the selfie clearly matches the same adult-looking person in ALL THREE photos, each photo follows community rules, and there is no impersonation concern. Reject unclear, explicit, group-only, stolen or mismatched photos. This is manual comparison, not age/identity or liveness proof.</p>' + photos.map(p => img('Photo ' + p.slot, p.body)).join('') + img('PRIVATE SELFIE — never share', r.selfie) + '<p>Delete this export immediately after review. It contains private images and does not expire automatically.</p>';
    const path = "private-review-" + id + ".html";
    writeFileSync(path, html, { mode: 0o600, flag: "wx" });
    console.log("Created " + path + ". Open locally; never host or commit it. Delete after review.");
  } else if (["approve", "reject"].includes(command)) {
    reviewPhotos(s, id, revision, command === "approve" ? "verified" : "rejected", process.env.REVIEWER_NAME, reason);
    console.log("Review saved. Selfie removed from active database. Delete your local export.");
  } else throw new Error("Usage: review-photos.mjs list | export USER_ID | approve USER_ID REVISION | reject USER_ID REVISION REASON. Set REVIEWER_NAME for decisions.");
} finally { s.close(); }
