# Mobile App URL and local Android test plan

**Goal:** Let users connect the native app to a SnagFlow web deployment from the login screen, and prepare the current PC for same-Wi-Fi testing with the user's Android 16 phone.

**Modules:** FEATURE/UI/SECURITY, MOD-MOBILE / FEAT-MOBILE, MOD-WEB public configuration route, MOD-SHARED connection validation. No database or workflow change.

**Approach:** Add a small public versioned discovery endpoint containing only the public Supabase URL/anon key. Validate and probe it before replacing the active mobile connection. Persist validated configuration, namespace secure sessions by a SHA-256 connection identity, remount private navigation on switching, and route reports to the selected app origin. This preserves direct user-session RLS rather than building a second API proxy for every data/storage/realtime call. Manually entering separate backend/key fields would burden users; embedding the whole web app would lose native capture/markup.

**Constraints:** Preserve Fieldwork UI and existing web/invitation runtime settings. Public HTTPS by default; HTTP permitted only for explicit loopback/private IPv4 development addresses. Never expose the service key, fetch discovery with credentials, follow config redirects, or transfer a previous session to a different connection. No hosted services, reset, offline/push or production-distribution work.

1. [x] Write shared connection-schema and mobile discovery tests first; validate URL/key/response shape, secret rejection, redirect/timeout/error handling, HTTPS downgrade and loopback advertising mistakes.
2. [x] Add the request-time public web configuration endpoint and verify anonymous access, no-store/CORS, absence of credentials and fail-closed misconfiguration.
3. [x] Implement persisted mobile connection lifecycle and isolated session storage/client replacement. Keep the login available without build-time environment values; prevent sign-in against an uncommitted URL edit.
4. [x] Add App URL/Connect/login feedback; use selected app URL for report requests. Verify switching, failed connection preservation and reload persistence in real browser previews.
5. [x] Prepare an interface-bound LAN entry point and phone-reachable public backend configuration. Reuse current local services, preserve data and invitation runtime. Inspect phone installation requirements; request missing user participation asynchronously.
6. [x] Run touched shared/mobile/web lint/typechecks/tests, native bundles and scoped real browser regressions, obtain independent review, update handoff/state/indexes, commit and push as authorized in this session.

**Acceptance boundaries:** LAN phone access needs the phone on the same Wi-Fi and an installed compatible native client. A successful PC/LAN probe does not establish physical-device verification. Hosted acceptance remains separate. No physical phone result is claimed until observed.

**Initial evidence:** Clean main at 69b123b. Wi-Fi IPv4 is 172.20.10.183; web standalone listens only on127.0.0.1:3003, Supabase54321 already listens on wildcard interfaces. No adb/java executable detected. User has Android16 and can connect to the PC's network; native client installation is being clarified.

## Delivery ledger

- Shared validation/public-key contracts and server public response passed14 checks; mobile connection/request/share guards are included in50 mobile units. Full shared/output suite passed89; local mobile API8; final mobile browser8; scoped web auth/invitation/report20. Configured build/lint/typechecks and final Android/iOS/browser exports pass.
- Independent review reproduced a cross-deployment continuation bug; captured clients, revoked storage/fetch and share guards fix it. Regression tests failed before and passed after. Local Change app URL recovery also has a failing-first real-browser check.
- User confirmed no native client installed, received the SDK58 Expo Go installation link, and explicitly approved the exact scoped test firewall rule. Wi-Fi later changed to10.48.43.195; the user explicitly approved updating the same rule. The bridge, runtime public address, Metro and QR now use that address. PC health/manifest/bundle probes pass; actual phone actions remain pending.
- No reset, schema/permission/workflow or hosted-service change. Invitation runtime/canonical origin preserved privately; current PC backend remains loopback. Final handoff: docs/AI/MOBILE-APP-URL-LAN-2026-11-02.md. Commit/push follows staged checks under the user's existing session authorization.
