# Offline field feedback — 2026-11-04

The user reports1.0.5 is not useful offline and rejects the large top status block. This is failed hosted offline acceptance, not a successful Phase6 field rollout. Optional Medium priority, photo review/markup, project navigation, continuous location/category carry-forward and filters remain preserved.

## Confirmed causes

- Read-only discovery against https://snagflow.vercel.app succeeds. The advertised hosted backend returns404/PGRST202 for mobile_sync_snapshot: the Phase6 endpoint is absent. The delivered APK therefore selects its explicit online-only compatibility path. It cannot offer full offline work on this deployment before backend activation. Earlier local verification did not establish hosted offline acceptance.
- A durable save awaited sync whenever the last known state was online. A dropped radio or stalled request therefore kept the save waiting even after its local transaction committed. A new runtime test reproduces this and passes after separating local save completion from network replay.
- Cached reads and the cached active profile waited for a network refresh. A cold restart with pending REST requests could remain on a loading screen. A real-browser test first opens/caches the project online, then holds REST requests indefinitely and reloads capture. Delivered auth/read behavior fails; corrected behavior opens capture and saves a pending snag without a server write.
- A change queued after an active sync's flush stage could wait for the15-second timer. A new deterministic runtime test fails before a bounded follow-up sync and passes afterwards. New work gets one immediate turn after the current request completes; failed-operation backoff and authority checks remain intact.
- A first online form could open from live metadata before its project's initial snapshot finished, causing a quick save to be rejected as uncached. The first-save regression is RED/GREEN verified: when online, finish that initial download once before enqueueing. Previously cached projects do not wait on network.

## Client changes

- Remove the global status block above navigation. A48dp bottom control opens Sync; timestamps, errors and project readiness are on the details screen. No top banner competes with field actions. The control labels deployments without support as Online only.
- Restore a matching previously verified active profile for local screens before background profile refresh. Generation/account checks still fence late callbacks. Replay still requires a fresh authenticated session and current server access.
- Cached resource reads run immediately, and local-state changes refresh the visible data without starting another network cycle. Local saves complete after durable persistence; network replay runs separately and remains bound to account/project/deployment.
- Network-loss events update offline status immediately. No native dependency/plugin change; SQLite source compilation remains enabled.

## Hosted change ready for explicit approval

Target: existing Snagflow Project, ref mtpmqnczwdbglebrakhw, used by https://snagflow.vercel.app.

The CLI dry run lists exactly `supabase/migrations/20261104000018_offline_sync.sql` and `supabase/migrations/20261104000019_push_delivery.sql`, with empty seed/role lists. Both are already applied/tested on preserved local data; all70 database security/workflow checks pass again. No hosted migration has been applied during this correction. The user's original instruction explicitly requires approval before modifying hosted Supabase; approval has been requested and is pending.

Read-only ledger/count preflight confirms17 migrations/latest20261102000017 and no offline RPC. Preservation baseline:2 profiles,1 project,1 snag,1 photo,0 comments. No business row or setting was changed by this inspection.

On approval: recheck the pending migration set, apply exactly18/19 without reset/seed/role/Vault changes, verify ledger and RPCs, verify RLS/private receipt protections and that push_delivery_config.enabled is false, and compare business-data counts before/after. No Vercel deployment, main push, Edge deployment/webhook/scheduler, FCM/APNs setup or live delivery activation is included. Keep live push disabled. Use a forward repair if an unexpected failure occurs; do not reset or drop user data.

The existing1.0.5 APK can obtain authorized offline snapshots after this activation. Connect once and let the project finish saving on the phone before airplane-mode testing. Hosted activation alone does not prove native field acceptance.

## Verification and release

-101 mobile unit/API checks pass (93 unit checks plus8 local service integration checks);70 complete local DB checks pass. Mobile/test types and configured mobile/test lint pass; mobile retains six pre-existing warnings.
- Stalled-save, stalled-read, during-pull queue and first-project-save regressions are RED/GREEN verified. Final consolidated browser suite passes19/19, exit0, including real photo/workflow loop, cached restart with pending requests, interrupted uploads, conflicts, exact-one replay, account/deployment isolation and expired-session recovery. Artifacts: `e2e/.playwright/phase6-feedback-final5`. Assertions wait for background uploads rather than assuming a local save has already reached the server; projects are fully cached before simulated disconnection. The expiry assertion targets the visible stack screen.
- Capture screenshots at375x812 and320x640 verify that the status control is below field content, timestamps are absent from the capture screen, and no horizontal overflow occurs. Browser screenshots do not establish native touch/keyboard acceptance.
- Final Android Hermes and web exports pass. Focused independent review found no material client finding; it did not rerun tests or establish physical/hosted acceptance. Stalled Auth refresh and actual native airplane-mode behavior remain separate field checks.
- Prepare Android1.0.6/code7 using a manual signed repack of the verified1.0.5 build3db4ce92-98c6-4c25-a47c-71bd81f79937. Current Android fingerprint matches that native base exactly: f1c71c22005aec18c7581c0e6f12a86b51b4ad3b, including after the version metadata change. The supported metadata repack updates version/code as well as JS; it does not recompile native libraries. Compare the final APK's certificate, DEX/native-library hashes and registration ABI before delivery. See https://docs.expo.dev/build-reference/repack/ . No OTA, store submission or paid worker upgrade.

All work remains on codex/phase6-offline-push. The unrelated untracked web branding PNG remains untouched. No main push or local database reset.

## Signed update ready; hosted approval pending

Source1da8fc3. Manual workflow01a1a86d-dbc5-7508-abe4-df793594155c and Android repack [64dee654-6c06-4eb3-a089-9626d848d9a0](https://expo.dev/accounts/asche34/projects/snagflow/builds/64dee654-6c06-4eb3-a089-9626d848d9a0) FINISHED. [Android1.0.6/code7 APK](https://expo.dev/artifacts/eas/gCgV0Qi8aJyFb9v2fV6Fp87HBndVVvYTNHhv7TZJ0Fw.apk), package com.snagflow.app.164485390 bytes; SHA256222ac115a3f7ea5e1d667e1d1e2b54b60a246bc788865305b7f727ef20d11cd5. Actual Android manifest confirms version/name/code/package and the same SDK24/36/four ABIs. APK v2 signing certificate matches1.0.5; RSA signature and complete chunked content digest verify; ZIP integrity passes. All122 DEX/native-library entries are byte-for-byte identical to verified1.0.5. The faulty1.0.4 native base was not reused.

Install over the existing app without uninstalling/clearing data. Native manual field acceptance remains pending. Hosted18/19 approval is still pending: this new APK is not sufficient to enable hosted offline working by itself. Once the reviewed backend is activated, connect online, open the project and let its download finish, then test capture/photo/restart in airplane mode and reconnect for exactly-once delivery. No live push activation is included.
