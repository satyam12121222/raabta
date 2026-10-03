# Profile photos and manual selfie review

This change adds three photo slots, optional height (90–250 cm), bio, education,
work, languages, relationship status and drinking preferences. Existing accounts
remain compatible. These fields are self-declared. Photos do not affect compatibility scoring.

## Release gate: preserve data before changing Render

At implementation time raabta-api uses the Free plan and the committed DB_PATH
is /tmp/raabta.db. Redeploys, upgrades and restarts may lose that database.
DO NOT merge this change or upgrade before deciding how to preserve current data.
The supplied Blueprint switches to a paid 0.5c-512mb instance and a 1 GB disk,
mount /var/data, DB_PATH=/var/data/raabta.db. It does not migrate /tmp data.

Use an online SQLite backup from the running instance and download it before any
restart, if the current plan permits access. Keep DATA_KEY separately and unchanged.
Restore the backup onto the mounted disk with the service stopped and verify it
can be decrypted. If Free-tier access prevents exporting the database, obtain the
operator's explicit decision about existing test data before resetting it.
Do not claim old accounts or conversations will survive an upgrade automatically.

Production photo writes remain disabled unless PROFILE_PHOTOS_ENABLED=true.
Enable only after permanent storage is confirmed. Check sufficient free space.
The new build command is npm ci && npm test; the server now depends on sharp.
Native image-decoder dependencies and lockfiles are included.

## Mobile update

Use the updated mobile sources and npm ci. Preserve the locally linked
extra.eas.projectId, owner and signing identity in app.json when applying updates.
Merge the new expo-image-picker plugin into that existing app.json.
Keep the existing EXPO_PUBLIC_API_URL. Rebuild the APK with the preview EAS profile.
Do not create a new EAS project. Test camera permission denial, cancellation,
gallery upload, slow connections, replacement, deletion and selfie review on a real phone.
Android export is a bundle check, not an installed-device test.

## How review works

Photos are encrypted inside SQLite, decoded and re-encoded as JPEG on the server,
limited to 1.5 MB input and 16 megapixels, resized to at most 1000×1000.
EXIF/location metadata and original files are not retained. Only still JPEG, PNG
and WebP inputs are accepted. Photo content is manually moderated before visibility.
Authenticated owners can see their pending photos; other members can only see
approved photos when they are eligible matches or participants in an open introduction.
Blocks and suspensions revoke subsequent access. Previously saved screenshots
cannot be revoked.

Add all three photos, consent, then take a camera selfie in Android. The status
becomes pending, never automatically verified. No selfie is returned through
member APIs or sent to the conversation AI. This is human visual comparison,
NOT automated liveness, government-ID, legal-age verification or a safety guarantee.
A modified client could submit an existing image; stronger assurance needs a
specialized liveness service before marketing automated identity verification.

Operator commands (run in server/ with DB_PATH and DATA_KEY configured):

```sh
node --env-file=.env review-photos.mjs list
node --env-file=.env review-photos.mjs export USER_ID
# Open private-review-USER_ID.html locally. Never upload or publish it.
# Set REVIEWER_NAME to the operator performing the review.
node --env-file=.env review-photos.mjs approve USER_ID REVISION
node --env-file=.env review-photos.mjs reject USER_ID REVISION "Clear reason for the member"
```

Approve only after inspecting all three photos and the selfie for a clear match
and community-rule compliance. Reject unclear, mismatched, explicit or
impersonating images; do not use this workflow to establish someone's age.
Revision binding prevents approving a changed set of photos. Decisions store the
reviewer name and date; only the status and rejection reason reach the member.
Delete every local HTML export immediately after review, including rejected reviews.

Replacing/removing any photo or withdrawing verification removes the badge and
deletes the current selfie. A decision also deletes the selfie from the active DB.
Pending reviews expire after seven days; cleanup runs at startup, every minute,
and on access. Backups retain data until their retention period ends. Account deletion
cascades to photos and reviews. Operate backup retention and deletion replay as
described in the existing operations guidance.

## Capacity

This is an invite-only pilot implementation: bounded encrypted image blobs in
SQLite, one server, JSON image delivery, and a human review queue. It is not
architecture for lakhs of users. Before a large rollout, migrate images to private
object storage with expiring access, database metadata to Postgres, and review
processing to durable workers with an authenticated moderator interface.

## Validation

29 backend tests passed, including photo access control, consent, forged status,
slot limits, EXIF stripping, stale review rejection, block revocation, replacement,
expiry and deletion. TypeScript, Expo lint and Android Hermes export passed.
Real camera/gallery behavior and operator review still require device acceptance.
