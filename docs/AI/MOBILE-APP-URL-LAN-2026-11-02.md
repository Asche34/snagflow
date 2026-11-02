# Mobile App URL and Android LAN testing — 2026-11-02

## Delivered

The login screen now accepts **App URL** and verifies the selected SnagFlow deployment before sign-in. Users do not need to enter Supabase keys or rebuild the native app to switch deployments.

- Public, request-time `GET /api/mobile-config` returns a versioned allowlist: application/version, public Supabase URL and public anon/publishable key. No cookies, service-role key, internal configuration dump or privileged discovery call. Strict validation rejects privileged keys; responses are no-store and allow anonymous browser discovery.
- HTTPS deployment origins are supported; HTTP is limited to explicit private IPv4/loopback development addresses. Credentials, paths, queries, fragments, incompatible applications, HTTPS-to-HTTP downgrades and localhost backends advertised to remote phones are rejected with readable errors. Discovery/probes use Expo's redirect-safe fetch, no prior bearer/cookies, and a bounded timeout.
- Validated configuration is remembered securely. Login stays available without build-time backend values. Editing App URL disables sign-in until that address is connected. Failed discovery retains the current connection; changing deployment clears the previous session, PKCE intent, subscriptions and private navigation.
- SHA-256 session namespaces include app origin, backend and public key. Mounted screens/services retain their original client; deactivated storage and fetch reject late refreshes, mutations, photo batches and responses. A report download finishing after a switch cannot open the previous deployment's native share sheet. An already-sent request can still commit on its original server; it is never replayed against the newly selected deployment.
- Home and the unavailable-account screen offer **Change app URL**. This clears only this device's session and remounts auth without waiting for the old server's logout API, so a remembered unavailable deployment cannot trap the user. The selected address remains available to edit on the login screen.
- Reports use the selected app origin. Signed downloads honor the explicit phone-reachable public backend override while retaining their object path/signature. Existing cookie/bearer authorization, canonical invitation origin and server-only invitation credentials are preserved.

No database migration, reset, hosted configuration, permission/workflow change, offline sync or push work.

## Local Android 16 setup

The user has Android 16, can join the same network, and initially has neither Expo Go nor a SnagFlow test app installed.

| Purpose | Address |
| --- | --- |
| Native App URL | `http://172.20.10.183:3003` |
| Phone reachability check | `http://172.20.10.183:3003/api/health` |
| Same local Supabase | `http://172.20.10.183:54321` |
| Expo Go entry | `exp://172.20.10.183:8081` |
| Existing PC web app | `http://127.0.0.1:3003` |

1. Install [Expo Go for SDK 58 on Android](https://expo.dev/go?device=true&platform=android&sdkVersion=58), then put the phone on the PC's Wi-Fi. The installed native Skia version 2.14.0 is listed as included in [SDK 58 Expo Go](https://docs.expo.dev/versions/v58.0.0/sdk/skia/).
2. Open the health address in the phone browser. A reachable response establishes phone-to-PC connectivity only, not app acceptance.
3. Scan the prepared Expo QR (`.superpowers/app-url/android-expo-qr.png`) from Expo Go, or enter the Expo Go entry URL. In SnagFlow, enter the Native App URL, tap Connect, then sign in with a local demo account. Use only local test credentials for this HTTP trial.
4. Start with `member1@snagflow.test` / `Password123!`. Capture an issue, draw and re-edit native markup, upload and reopen it. Use `manager@snagflow.test` in the PC web app to assign/review. Complete start → fix photo → request review → reject with reason → resubmit → approve; test PDF/Excel sharing from the phone.
5. Record actual device observations in this handoff before claiming physical verification. No phone action has yet been observed.

Expo Go is a convenient local password/camera/markup/share trial. It does not install the SnagFlow custom URL scheme, so full `snagflow://auth/callback` dispatch needs a native SnagFlow development build. Phone HTTP browser preview is not a substitute: browser crypto/security restrictions differ from native Android. Hosted acceptance remains a separate explicit authorization and test step.

## Runtime and network controls

- The existing standalone stays bound to loopback3003. `scripts/mobile/lan-forwarder.mjs` binds **only** Wi-Fi172.20.10.183:3003 and forwards to loopback3003; it does not select an upstream from an incoming URL. It also supports WebSocket forwarding for development use.
- Local runtime has `MOBILE_PUBLIC_SUPABASE_URL=http://172.20.10.183:54321`; `SUPABASE_SERVER_URL` remains on loopback54321 so Wi-Fi changes do not break the PC backend connection. The existing server-only invitation key and canonical APP_URL are restored privately by `.superpowers/app-url/start-web.ps1`, based on the previous task-owned runtime script. No credentials are printed. The compiled PC browser backend remains unchanged.
- Expo Go Metro runs on8081 with explicit Wi-Fi hostname and local App URL/backend defaults. PC probes confirm an Android SDK58 manifest with the Wi-Fi bundle host. The exact current Android development bundle is fetched as a separate compile check; this is not a phone-run claim.
- **User-approved firewall rule:** `SnagFlow-LAN-phone-test`, inbound TCP3003/54321/8081, local address172.20.10.183, remote LocalSubnet, firewall otherwise enabled. Automatic approval initially rejected this persistent rule; it was applied only after the user explicitly approved these exact settings. The address changed during setup and was updated after explicit user approval; the final network returned to the originally approved 172.20.10.183, so runtime, QR and rule were restored to that approved address. Remove it after testing with `Remove-NetFirewallRule -Name 'SnagFlow-LAN-phone-test'` in an elevated shell.
- If Wi-Fi/IP changes, update runtime public addresses, restart the bridge/Metro, and replace the scoped firewall address. Do not listen on a public adapter or disable the firewall. Stop the task-owned Next process before rebuilding on Windows; restore its private invitation settings on restart.

## Verification and review

- Mobile units: 50 passed, including deferred A→B mutation/photo isolation, deactivated transport, connection persistence/discovery and native share cancellation.
- Shared/output: 89 passed, including URL/public-key/manifest contracts, server public-response allowlist and phone-reachable report URL preservation.
- Local mobile services: eight passed with disposable snag fixtures; cleanup now signs out only its own session.
- Production mobile browser preview: eight passed (three new discovery/connection/offline-reset cases plus five existing auth/role/capture/photo/workflow/layout cases). Screenshot inspected at375px; credentials and connection controls retain Fieldwork styling.
- Web auth/invitations/reports: 20 passed against rebuilt standalone. An initial overlapping mobile integration cleanup globally signed out the shared viewer test account and caused a401 instead of expected403; session-local cleanup and serial fixture runs resolved the test collision. No authorization rule was weakened.
- Configured monorepo build/lint/typecheck: 12 tasks passed; Android/iOS/browser exports passed. Logs and QR are in `.superpowers/app-url/`; browser artifacts have separate `e2e/.playwright/app-url-*` directories.
- Independent review reproduced the cross-deployment request race, then verified captured-client/revoked-transport corrections and found no remaining material code defect. Final documentation/device evidence is checked separately.

These are **175 scoped checks**, not a rerun of every Phase5 baseline suite. A Wi-Fi address change during verification made the old advertised backend unreachable; after updating the runtime/QR and the explicitly approved rule, the current-network browser cases passed. The PC backend stays on loopback independently of Wi-Fi addressing.

**Physical-device and hosted verification are still pending.** Next: install Expo Go, verify phone reachability, scan the QR and record the Android observations. The hosted checklist in `docs/AI/PHASE5-MOBILE-2026-11-02.md` remains applicable after this local trial.
