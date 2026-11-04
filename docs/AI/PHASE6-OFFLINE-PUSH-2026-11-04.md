# Phase 6 offline and push — 2026-11-04

## Scope and release boundaries

Spec §§11,12,15; implementation plan `docs/superpowers/plans/2026-11-04-phase6-offline-push.md`. Work stays on `codex/phase6-offline-push`, starting at d4d58fb with clean Git status. Earlier branding/mobile changes remain intact. No main push, hosted Supabase/Vercel modification, live notification, or local database reset.

User confirms Android1.0.2/code3 installed and worked; reported installation failure resolved. No broader acceptance inference. EAS independently reports branded1.0.3/code4 FINISHED; next release is1.0.4/code5, same package/signing and branding.

## Architecture and behavior

- Native SQLite WAL stores account/deployment snapshots/drafts and an atomic outbox. The deployment identity hashes App URL, Supabase URL and anon key. Browser acceptance uses IndexedDB; native uses expo-sqlite.
- Capture autosaves fields, stable identity, defaults and prepared original/thumbnail/flattened markup into the document directory. Edit/comment/workflow/fix-photo drafts persist too. Original files and vector annotation are retained. Unsaved markup still in the open editor must be completed with Done to become an attached durable photo.
- Create/edit/comment/assign/transition replay uses migration18 transactional receipts and current RLS-equivalent authority. Photo batches retain separate deterministic IDs and use the existing immutable-byte/annotation pipeline. A pinned originating JWT and revocable transport prevent account changes from rebinding a request chain.
- Changed plain fields compare against the persisted form base and server field clocks (including web writers). Newer server fields remain and the local intent needs review. Stale workflow RPC intents are retained with clear attention/retry/discard. Ambiguous responses retain the exact original replay identity; confirmed conflicts receive a new ID only on explicit retry.
- Full bounded project snapshots reconcile deleted/removed records and metadata, avoiding transaction-timestamp delta holes. Each table has an explicit20k-row limit; no partial cursor is advanced. See `PHASE6-OFFLINE-DB-2026-11-04.md` for the decision and RPC contract.
- Pull/replay runs at start, foreground, connectivity regain, refresh and periodic foreground reconciliation. Uploads run asynchronously while the app is active and recover on restart/foreground; no promise of uninterrupted OS execution while force-closed. Queue status, last sync and needs-attention screen remain visible. Pending snags have no invented server number.
- Revoked project access removes its mirror and private drafts while preserving queued user intent for review. Different accounts/deployments cannot see or send each other's work. Retained media files are private app files; automatic garbage collection/retention quotas are not implemented yet.
- Push is explicit opt-in, permission/channel-aware, account/deployment/installation-bound, refreshed/leased and unlinked on logout/change. Delivery reads authoritative persisted recipients and rechecks current access; generic OS text and validated tap navigation limit stale-account exposure. Ticket/receipt DeviceNotRegistered cleanup cannot delete a newer registration.
- A server without the Phase 6 snapshot RPC explicitly uses the existing online mutation paths with pinned account clients, including photo/markup writes. The UI explains that offline sync needs a server update and does not promise durable offline saves. Existing queues remain paused in their original scope until support is available. This preserves online use on hosted schema 17 without authorizing any hosted migration.
- Expired access tokens do not lock verified field data offline: recovery reads the originating secure session, requires a matching previously verified active profile and an actual retryable SDK refresh failure, and restores local identity only. Tokens never enter SQLite. Network replay still requires a fresh SDK session/JWT. Logout fences old storage/refresh work, removes the secure session through the existing connection reset, and reports reset failure explicitly.
- Installed Auth SDK 2.118.0 caches refresh failures for 60 seconds. Reconnect retains the original queued IDs and waits through this cooldown before the next automatic retry. No second refresh client or private SDK override bypasses token-rotation/backoff behavior.

## Verification

- 89 mobile unit checks including actual SQLite close/reopen, interrupted retry, immutable photos, pinned-account requests, stale form/workflow base, binder race, acknowledged-data recovery, pending fix evidence, legacy-server capability detection, revision-aware photo-cache invalidation and secure expired-session recovery. The actual installed SDK test proves offline failure, its 60-second cooldown, refreshed JWT recovery and exactly-once queue drain. All 8 existing mobile API/service checks pass against the preserved local stack.
- 70 preserved-local database checks (existing RLS/workflow/security plus 10 offline and 5 push).
- 90 shared/actual-report checks. Configured shared lint targets src and passes; an extra ad-hoc lint of tests found 18 existing style/global errors outside that configured target.
- 18 browser cases verified individually: 12 existing mobile/App URL regressions and 6 offline/compatibility/expiry cases. Coverage includes text/photo draft restart, queued create/edit/comment/transition restart, committed upload/create response loss, exact-once rows/activity, conflict review/restart/discard, account/deployment switching, schema 17 online fallback, and expired-session cold restart with fresh-auth-only replay. The legacy-server case asserts zero Phase 6 mutation RPC calls and no false offline-save promise. Consolidated final suite is running; earlier artifacts include `e2e/.playwright/phase6-browser-final`, `phase6-compat-ui` and `phase6-photo-cache-final`. The isolation harness now waits for complete fixture synchronization and completed logout before partition/reload.
- Local late-commit pull regression RED with strict timestamp filter, GREEN with bounded full snapshots. All disposable fixtures cleaned; preserved data retained.
- Mobile/shared/database/E2E typechecks and configured lint pass; mobile lint has six existing generated/test import warnings. Android and web exports pass; the final 368-file release archive includes secure offline session recovery, excludes private environment/signing/runtime paths and contains no local private key literal. Final native build status is recorded below when observed.

## External activation and acceptance pending

Hosted stays at migration 17, where this APK preserves online use through the checked compatibility fallback. Phase 6 offline RPCs require migrations 18/19 on the target deployment before native offline use; no hosted rollout is implied by APK delivery. Native FCM/google-services.json (and APNs for iOS), Edge deployment/webhook secret, receipt scheduling and explicit delivery gates require external setup/authorization. See `supabase/functions/push-send/README.md`.

Physical Android airplane-mode/restart/reconnect and real notification delivery/tap acceptance remain pending. Browser/SQLite tests and native compilation do not replace those cases.

## APK

Android 1.0.4/code 5 uses the same remote keystore/package/preview concurrency profile, without a paid worker change. Final source/build will be recorded after the expired-session correction below. Do not claim a new APK exists until EAS reports FINISHED and provides its actual artifact.

After the cache correction, all three targeted browser cases passed again: complete online member/manager photo workflow, durable offline photo/restart/interrupted-upload recovery, and schema 17 compatibility. Evidence: `e2e/.playwright/phase6-photo-cache-final`.

The first submission `b97de024-4c57-42ee-a739-b4fe8cdae6db` (source 6354a5b) was canceled before delivery to include the schema 17 compatibility correction. It is not the release artifact.
The next queued submission `d1ae433f-8c74-4e0b-983b-530def77fbd0` (source 7e8d2a7) was canceled before delivery to include the reproduced photo-cache revision fix. Neither canceled build is the replacement APK.

Build `7e775789-7b1f-4d22-ac88-05142ef4672f` (source e893087) reached Gradle/native compilation, then was canceled before delivery after a real installed-SDK probe confirmed an offline auth expiry gap. Supabase Auth 2.118.0 returns null session with AuthRetryableFetchError when an expired stored token cannot refresh, while retaining the secure stored session. Cached profile alone did not restore AuthProvider/bind/queue. This is now corrected and verified locally: matching verified local identity supports reads/drafts, explicit logout/nonretryable revocation deny recovery, and replay requires fresh authenticated server authority. No APK from these superseded builds is delivered.

The sixth browser regression forces stored expiry and blocks only token refresh while the data API remains reachable. Cold restart restores cached projects/capture; save makes zero early REST writes; reconnect refreshes and commits exactly once after the real SDK cooldown. Final consolidated browser run is recorded when complete.
