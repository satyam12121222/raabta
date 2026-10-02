# Verification — 1 October 2026

This file supersedes the original pilot's validation notes. Results refer to this v0.2 source, not a deployed service.

| Check | Result |
|---|---|
| Node 24 backend regression suite | **26 passed, 0 failed** |
| TypeScript `tsc --noEmit` | Passed |
| Expo ESLint | Passed |
| Android JS/Hermes bundle export | Passed; 1,253 modules |
| Web bundle export | Passed; 790 modules |
| Online database backup and restored decryption | Passed using an isolated synthetic database |
| Browser visual/interaction tests | **Not completed**: browser binary unavailable; browser download failed |
| Docker/Caddy deployment | Configuration included; not executed in this environment |
| Live OpenAI, moderation and Resend delivery | Not tested; adapters validated with synthetic providers |
| Signed APK/AAB | Not built |
| Real Android device / two-phone flows | Not tested |
| Public launch/store approval | Not completed |

The 26 tests cover the seven-day gate, bilateral dealbreakers, protected profile data, authentication, encrypted fields, consent, idempotency, mutual chat acceptance, unrelated-user authorization, report/block and unblock behavior, pause, deletion, code expiry/attempt limits/reuse, generic recovery responses, session revocation, private memory, moderation outages and personal distress, blocking during message moderation, unread/read cursors, configuration guards, public-page escaping, backup restore, AI reply reporting and history pagination.

One negative-path regression intentionally throws an upstream AI error and emits an internal-error diagnostic; the test confirms it creates no fabricated history or progress.

## Required staging/device acceptance

1. Install a signed preview APK on two physical Android devices. Confirm cold launch, force-close/relaunch, and session restoration.
2. Register, receive a real verification email, verify, request recovery and sign in with the new password. Test expired and incorrect codes.
3. Conduct real Hindi/English conversations; inspect memory across separate days; correct it and check later responses respect corrections. Review drafts for accidental sensitive disclosures.
4. Test the genuine seven-day learning period with a small consenting cohort. Do not add a production bypass to manufacture progress or fake matches.
5. Both approve profiles; inspect the explanation, accept mutually, message, background/reopen, lose/recover network, retry, block, report and end a connection. No message should be delivered after a block.
6. Report an AI reply; review it through the operator console. Test moderation provider downtime without unsafe delivery.
7. Erase AI history; verify progress/memory/card removal. Delete an account in the app and via the browser page; verify sessions and conversations disappear.
8. Rehearse encrypted-storage backup restore and deletion replay in staging. Check host/proxy configuration, provider budgets and support ownership.

The app is text-first and single-process. No claim of large-scale capacity, automated identity verification, perfect matching, end-to-end encryption or public-store compliance is made.
