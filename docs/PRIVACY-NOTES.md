# Privacy implementation notes

The live server supplies /privacy and /terms using OPERATOR_NAME and SUPPORT_EMAIL; production requires these values. Review these pages against actual operational practices before publishing. Shared profile text and partner messages are sent to OpenAI for safety checks; disclose this in addition to conversational AI processing. Resend receives email addresses to send verification/recovery codes.

The client can withdraw AI consent, correct memory, pause matching, erase AI history, unblock members or delete the account. Browser deletion is at /delete-account. No separate data-export UI is included; the published support contact handles access/export requests.

AI history erasure removes related AI reports through foreign keys. Account deletion removes associated partner reports as well as sessions, messages, introductions, memory, consent history and recovery contacts. If a different evidence-retention policy is required, change the code and notices together before launch. Do not claim that complaints are retained after deletion in this version.

Backups retain encrypted-field snapshots and account metadata. The included backup script prunes local snapshots older than seven days when scheduled. Remote copies/host snapshots need matching retention settings. A backup restore must replay post-snapshot deletions before users can access it. An external durable deletion journal is an operator requirement, not an implemented managed service in this package.

Email verification proves inbox control only. Birth date is self-declared. There is no photo/identity/liveness verification. Private AI conversations never enter candidate responses, but authorized server operators can decrypt them. Do not describe the system as end-to-end encrypted.
