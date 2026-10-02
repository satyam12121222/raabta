# API v0.2 additions

All authenticated routes use `Authorization: Bearer <session>`. Responses are JSON; errors contain `error`. Rate-limit errors use 429. Secrets are never returned by configuration endpoints.

| Endpoint | Purpose |
|---|---|
| GET /config | Public registration requirements and policy/support links |
| POST /auth/register | Username/password/profile plus email, adultConsent, aiConsent, termsConsent, optional invitation |
| PUT /auth/email | Add recovery email to a legacy account; requires current password |
| POST /auth/verify/send | Email an 8-digit, ten-minute code |
| POST /auth/verify | Consume code and verify inbox |
| POST /auth/recovery | Generic recovery response; sends only to verified accounts |
| POST /auth/reset | Email/code/new password; revokes existing sessions |
| PUT /auth/password | Current/new password; returns a replacement session |
| POST /auth/logout-all | Revoke every session |
| GET, PUT /me/memory | Review/correct private rolling memory |
| GET /ai/history?before=ID | Up to 100 turns plus hasMore and progress |
| POST /ai/reports | messageId and reason; only one's own assistant replies |
| GET, DELETE /blocks | List/remove own blocks; no automatic reconnection |
| POST /intros/:id/read | lastId from that conversation; monotonic read cursor |
| GET /intros | Introduction list including participant-specific unread count |
| GET /privacy, /terms | Hosted notices |
| GET /delete-account | Browser sign-in and permanent account deletion |

Core endpoints remain: /me GET/PUT/DELETE, /me/consent PUT, /ai/chat POST, /ai/history DELETE, /profile/draft POST, /profile/approve POST, /profile/pause POST, /matches GET, /intros POST, /intros/:id/accept or decline POST, /intros/:id/messages GET/POST, /blocks POST, /reports POST, /auth/login and logout POST.

AI and partner sends use a client requestId for idempotent retries. Partner messages are reauthorized after asynchronous moderation, preventing delivery after a simultaneous block. Raw AI history/memory never enter matching responses. Old blocked or declined pairs remain excluded after unblocking; this avoids unwanted repeated introductions.
