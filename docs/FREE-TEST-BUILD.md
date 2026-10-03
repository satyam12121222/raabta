# Free-server test APK

Extract this package to a NEW folder. Keep your original Downloads/raabta folder.
Double-click mobile/Build-APK.cmd. It imports the existing Expo project ID and owner from Downloads/raabta/mobile/app.json, installs locked dependencies, checks TypeScript/lint and starts EAS preview APK build. Your original folder stays untouched. Use the existing usi_121 Expo account and existing Android signing credentials; do not create a replacement project or rotate the keystore.

If the old app is elsewhere, run from the new mobile folder:
`node build-preview.mjs "C:\path\to\old\mobile\app.json"`

Download the APK from the successful EAS build link. This source package is not an APK; native build and physical-phone testing remain pending. Expo Go is not needed for the APK.

Preview pins the existing HTTPS backend and hides photo controls. The in-app notice says accounts/chats may reset: the free backend database is temporary. Do not invite public users or store important information. OpenAI usage still costs money. Photos, durable storage, public-launch operations and Play Store submission remain pending.

Phone checks: signup/invite/email verification, AI consent and replies, profile/height editing, password recovery, logout/login, deletion of a disposable account, slow server wakeup and airplane-mode retry. With two eligible consenting adult accounts check mutual acceptance, messaging, report/block. Do not bypass the seven-day gate to manufacture matches.
