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

## Verification

- 82 mobile unit checks including actual SQLite close/reopen, interrupted retry, immutable photos, pinned-account requests, stale form/workflow base, binder race, acknowledged-data recovery, pending fix evidence and legacy-server capability detection. All 8 existing mobile API/service checks pass against the preserved local stack.
- 70 preserved-local database checks (existing RLS/workflow/security plus 10 offline and 5 push).
- 90 shared/actual-report checks. Configured shared lint targets src and passes; an extra ad-hoc lint of tests found 18 existing style/global errors outside that configured target.
- 17 browser checks: 12 existing mobile/App URL regressions and 5 offline/compatibility cases. Final suite covers text/photo draft restart, queued create/edit/comment/transition restart, committed upload/create response loss, exact-once rows/activity, conflict review/restart/discard, account/deployment switching, and schema 17 online create/photo/edit/comment/workflow fallback. The legacy-server case asserts zero Phase 6 mutation RPC calls and no false offline-save promise. Artifacts: `e2e/.playwright/phase6-browser-final` and `phase6-compat-ui`.
- Local late-commit pull regression RED with strict timestamp filter, GREEN with bounded full snapshots. All disposable fixtures cleaned; preserved data retained.
- Mobile/shared/database/E2E typechecks and configured lint pass; mobile lint has six existing generated/test import warnings. Android and web exports pass; the 366-file release archive excludes private environment/signing/runtime paths and contains no local private key literal. Final native build status is recorded below when observed.

## External activation and acceptance pending

Hosted stays at migration 17, where this APK preserves online use through the checked compatibility fallback. Phase 6 offline RPCs require migrations 18/19 on the target deployment before native offline use; no hosted rollout is implied by APK delivery. Native FCM/google-services.json (and APNs for iOS), Edge deployment/webhook secret, receipt scheduling and explicit delivery gates require external setup/authorization. See `supabase/functions/push-send/README.md`.

Physical Android airplane-mode/restart/reconnect and real notification delivery/tap acceptance remain pending. Browser/SQLite tests and native compilation do not replace those cases.

## APK

Android1.0.4/code5 preparation in progress. Do not claim a new APK exists until EAS reports FINISHED and provides its actual artifact.

The first submission `b97de024-4c57-42ee-a739-b4fe8cdae6db` (source 6354a5b) was canceled before delivery to include the schema 17 compatibility correction. It is not the release artifact.
