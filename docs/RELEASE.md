# Release checklist

Read README.md for exact setup and APK/AAB commands. Read VALIDATION.md for what has and has not actually passed.

Before public access: configure valid AI and transactional-email credentials, verified sending domain, HTTPS origin, named operator and reachable support email. Keep verification and moderation enabled. Review and publish accurate privacy/community notices. Configure provider budgets, backup schedules with retention and deletion replay, monitoring and operator access. Complete physical-device acceptance and real multi-day learning evaluation before opening registration.

Keep REGISTRATION_MODE=invite for staged rollout; switch to open only when ready to serve uninvited users. The app reads this setting and hides the invitation field for open registration. Accounts still require email verification before AI/new matching.

EAS preview creates APK; EAS production creates AAB. Neither is included in this source archive. Complete the current Play Console requirements in your own account, including store listing, disclosures, content rating, testing and applicable review requirements. Hosting and signing are not completed by exporting a JavaScript bundle.

Not implemented: photos/liveness, verified age/identity, voice/video, push notifications, paid subscriptions/payments or multi-replica scaling. Existing text-only foreground polling is intentional and must be described honestly to testers.
