# Operations

## Before serving real people

Use exactly one API replica. The supplied proxy overwrites X-Real-IP and does not publish the API port. Only set TRUST_PROXY=true behind that trusted proxy. API rate limits are persistent in SQLite. Never trust client-provided forwarding headers on a directly exposed process.

Set provider-side spending alerts/limits and monitor daily usage. Request caps are per-call ceilings, not a currency budget. AI output/history bounds control payload size, but provider cost still depends on model and usage. Monitor service health, email delivery failures and safety reports. Do not log message bodies, passwords, bearer tokens or email codes.

## Backups and deletion

Run backup.mjs daily; it uses the SQLite online backup API and integrity checking. Retain snapshots for no more than seven days if publishing the supplied privacy notice. The local prune applies only to its configured BACKUP_DIR; configure identical retention on remote copies and hosting snapshots. Encrypt storage: ciphertext fields do not encrypt usernames, IDs, timestamps or password hashes.

Restores must be rehearsed. A snapshot restore rolls back deletions as well as writes. Keep a protected deletion journal outside the snapshot while operating the service, and replay deletions before allowing access to a restored database. The app does not implement an external deletion-journal service. If you cannot reliably replay deletions, do not expose a restored backup until affected data has been reviewed/removed. Do not restore obsolete backups after their expiry.

## Reports

`admin.mjs reports` lists partner complaints and reported AI replies. Operators can suspend a user and revoke sessions, resolve a member report, or resolve an AI report with resolve-ai. Review the reported context with least-privilege server access. No public admin HTTP interface is shipped. Contact the user through established support channels when appropriate; moderation is not an emergency dispatch service.

Account deletion cascades through associated reports. AI history erasure cascades through reports on those AI replies. If lawful evidence-retention requirements differ, implement and disclose a narrowly scoped retention policy before launch; do not promise retained evidence that the code deletes.

## Updates

Take a verified snapshot and keep the encryption key before deploying. Schema upgrades are additive CREATE TABLE/INDEX IF NOT EXISTS operations. Existing pilot users must add/verify an email before AI/new matching once verification is enabled; existing mutually accepted chats remain available. Password recovery works only after email verification.

Use CI and a staging database for upgrades. Never weaken verification/moderation to make production startup pass. Never put DATA_KEY, Resend or OpenAI keys in EXPO_PUBLIC variables.
