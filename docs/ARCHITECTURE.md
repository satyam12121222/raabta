# Architecture v0.2

Expo SDK 57 / React Native / TypeScript client, Node 24 HTTP API, SQLite WAL database, server-side OpenAI Responses and moderation adapters, Resend transactional email. Caddy terminates HTTPS. One API process/replica only; process-local in-flight locks are part of consistency control.

AI conversations use up to the recent 18 turns plus a bounded rolling memory. Drafting uses up to 30 turns. Private memory is editable; the model is instructed to prioritize corrections, though model behavior must be evaluated with live providers. History pagination returns the newest 100 turns and permits loading earlier batches. Learning progress is evaluated from encrypted user-turn lengths on distinct server dates in Asia/Kolkata.

Email addresses are encrypted, with keyed digests for lookup. Passwords use scrypt with per-password salt. Session tokens are random and stored as SHA-256 digests. Verification/recovery codes are random, stored as keyed digests, expire after 10 minutes and allow five attempts. Recovery uses generic responses. Rate limits apply to requests, authentication, email, AI, chat, reports and introductions.

Only approved profiles enter matching. Bilateral age/gender, location, smoking and children preferences filter candidates; shared values/interests and communication preferences explain suggestions. The seven-day requirement is a product rule. The AI has no tools that can override eligibility or accept introductions.

Safety moderation runs before storing/delivering content, with separate treatment for private reflection and public/member content. Errors fail closed. Partner authorization is checked again after asynchronous moderation so concurrent blocks cannot be bypassed. Machine classification can misclassify; operator review and appeals remain necessary.

SQLite encrypts sensitive field values using AES-256-GCM; the database as a whole is not encrypted. Usernames, IDs, timestamps and password hashes remain visible to database administrators. Keep storage encrypted and restrict server/key access. Content is not end-to-end encrypted.

Provider references used during implementation:
- https://docs.expo.dev/versions/v57.0.0/
- https://developers.openai.com/api/docs/guides/moderation
- https://resend.com/docs/api-reference/emails/send-email
- https://nodejs.org/api/sqlite.html
- https://caddyserver.com/docs/caddyfile/directives/reverse_proxy
