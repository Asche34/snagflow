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

## Verification

-81 mobile unit checks including actual SQLite close/reopen, interrupted retry, immutable photos, pinned-account requests, stale form/workflow base, binder race, acknowledged-data recovery and pending fix evidence.
-70 preserved-local database checks (existing RLS/workflow/security plus10 offline and5 push).
-90 shared/actual-report checks. Configured shared lint targets src; an extra ad-hoc lint of tests found18 existing style/global errors and is not the package lint command.
-16 browser checks:12 existing mobile/App URL regressions,4 new offline acceptance cases. Final new suite covers text/photo draft restart, queued create/edit/comment/transition restart, committed upload/create response loss, exact-once rows/activity, conflict review/restart/discard, and account/deployment switching. Artifacts `e2e/.playwright/phase6-offline-final`.
-Local late-commit pull regression RED with strict timestamp filter, GREEN with bounded full snapshots. All disposable fixtures cleaned; preserved data retained.
-Mobile and E2E typechecks pass; mobile lint has zero errors and six existing generated/test import warnings. Final exports/archive/native build status recorded below when observed.

## External activation and acceptance pending

Hosted stays at migration17. Phase6 offline RPCs require migrations18/19 on the target deployment before native offline use; no hosted rollout is implied by APK delivery. Native FCM/google-services.json (and APNs for iOS), Edge deployment/webhook secret, receipt scheduling and explicit delivery gates require external setup/authorization. See `supabase/functions/push-send/README.md`.

Physical Android airplane-mode/restart/reconnect and real notification delivery/tap acceptance remain pending. Browser/SQLite tests and native compilation do not replace those cases.

## APK

Android1.0.4/code5 preparation in progress. Do not claim a new APK exists until EAS reports FINISHED and provides its actual artifact.
