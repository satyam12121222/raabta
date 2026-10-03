import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { check, AppError } from "./domain.mjs";

export const PHOTO_LIMIT = 1500000;
export function initPhotos(s) {
  s.db.exec(`
    CREATE TABLE IF NOT EXISTS profile_photos(user_id TEXT REFERENCES users(id) ON DELETE CASCADE,slot INTEGER CHECK(slot BETWEEN 1 AND 3),id TEXT UNIQUE NOT NULL,body TEXT NOT NULL,PRIMARY KEY(user_id,slot));
    CREATE TABLE IF NOT EXISTS photo_reviews(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,revision TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'unverified',selfie TEXT,expires INTEGER,reason TEXT NOT NULL DEFAULT '',reviewer TEXT,reviewed TEXT);
  `);
}
export function expireSelfies(s) {
  s.run("UPDATE photo_reviews SET selfie=NULL,status='expired',reason='Review expired. Please submit a new selfie.' WHERE status='pending' AND expires<?", Date.now());
}
export function photoState(s, id) {
  expireSelfies(s);
  const r = s.get("SELECT * FROM photo_reviews WHERE user_id=?", id);
  return {
    photos: s.all("SELECT slot,id FROM profile_photos WHERE user_id=? ORDER BY slot", id),
    status: r?.status || "unverified",
    revision: r?.revision || "",
    reason: r?.reason || "",
    method: "manual-selfie-review",
  };
}
export function invalidatePhotos(s, id) {
  s.run("INSERT INTO photo_reviews(user_id,revision) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,status='unverified',selfie=NULL,expires=NULL,reason='',reviewer=NULL,reviewed=NULL", id, randomUUID());
}
export async function cleanImage(base64) {
  check(typeof base64 === "string" && base64.length > 0 && base64.length <= PHOTO_LIMIT * 4 / 3 + 4, "Choose an image under 1.5 MB.");
  check(/^[A-Za-z0-9+/]+={0,2}$/.test(base64) && base64.length % 4 === 0, "Invalid image encoding.");
  const input = Buffer.from(base64, "base64");
  check(input.length <= PHOTO_LIMIT, "Choose an image under 1.5 MB.", 413);
  try {
    const image = sharp(input, { limitInputPixels: 16000000, failOn: "warning" });
    const meta = await image.metadata();
    check(["jpeg", "png", "webp"].includes(meta.format) && !((meta.pages || 1) > 1), "Choose a still JPEG, PNG or WebP.");
    check(meta.width >= 240 && meta.height >= 240, "Choose an image at least 240 × 240 pixels.");
    // Decode and re-encode; originals and EXIF/location metadata are never stored.
    return (await image.rotate().resize(1000, 1000, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer()).toString("base64");
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(400, "This image could not be read. Choose another photo.");
  }
}
export function reviewPhotos(s, id, revision, decision, reviewer, reason = "") {
  expireSelfies(s);
  check(["verified", "rejected"].includes(decision), "Invalid decision.");
  check(typeof reviewer === "string" && reviewer.trim().length >= 2, "Provide the reviewer name.");
  check(typeof reason === "string" && reason.length <= 300, "Reason must be at most 300 characters.");
  if (decision === "rejected") check(reason.trim().length >= 5, "Give a useful rejection reason.");
  s.transaction(() => {
    const r = s.get("SELECT * FROM photo_reviews WHERE user_id=?", id);
    check(r?.status === "pending" && r.revision === revision && r.selfie, "Review expired or photos changed. Open a fresh review.", 409);
    check(s.get("SELECT count(*) n FROM profile_photos WHERE user_id=?", id).n === 3, "Three photos are required.");
    s.run("UPDATE photo_reviews SET status=?,selfie=NULL,expires=NULL,reason=?,reviewer=?,reviewed=? WHERE user_id=?", decision, reason.trim(), reviewer.trim(), new Date().toISOString(), id);
  });
}
