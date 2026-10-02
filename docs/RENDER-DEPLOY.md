# Prepared Render deployment

The repository root includes render.yaml. This defines a single Node 24 API with a 1 GB persistent disk and health checks. It is a paid-service specification, not evidence of a live deployment. Confirm actual pricing and workspace before creating resources.

Publish the raabta directory as a private GitHub repository, then connect it to Render. Supply secrets through Render environment settings, never in source control. Generate DATA_KEY and INVITE_CODE with server/setup.mjs or a cryptographically secure equivalent; DATA_KEY must decode to exactly 32 bytes. Preserve the same key when moving existing data.

Set PUBLIC_ORIGIN to the service's actual HTTPS URL, without a trailing path. A custom domain is optional: the assigned Render HTTPS URL can be used for the API and the hosted privacy/terms/deletion pages. Set the same origin as EXPO_PUBLIC_API_URL for both EAS environments.

Do not launch with missing secrets: the app deliberately fails startup. Real AI and email delivery must be checked after configuration. Operator name and support email must be real and reachable. Keep registration invite-only for the first physical-device tests.

This blueprint leaves TRUST_PROXY=false because the Caddy-specific X-Real-IP trust configuration must not be assumed on another provider. IP request limits may therefore be shared behind Render's proxy. Validate Render's current forwarding behavior and configure a verified trusted-proxy policy before increasing traffic. Per-user limits still apply.

Schedule the included backup command against the attached disk and manage encrypted off-host storage/retention as described in OPERATIONS.md. Render deployment has not been executed or validated against a live workspace in this delivery.
