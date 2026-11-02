# Phase 5 mobile online — 2026-11-02

## Delivery and acceptance boundary

Phase 5 is implemented locally, with hosted and physical-device acceptance **pending**. Spec §15 requires key flows on a physical phone against hosted Supabase; native bundle exports, browser previews and local API tests do not meet that criterion. Phases 6 and 7 remain out of scope.

- Expo Router invite-only email/password and same-installation PKCE magic links, exact callback validation, chunked secure native session storage, lifecycle refresh and account-keyed private navigation.
- Fieldwork home with assigned work, manager review and active projects; paginated project search/filters and typed authorized detail/metadata/team reads. Focus, foreground, pull, authenticated Realtime and periodic reconciliation include removals/access changes.
- Shared-schema capture/edit/comments, stable create/comment identities, assignment and all shared-map transitions, review/reopen reasons, fix-photo requirements, private issue/fix gallery and confirmed soft deletion.
- Camera/library preparation with decoded orientation, <=1600px JPEG original and <=400px thumbnail; eight-photo cap, per-photo stages and exact immutable-byte retry. Continuous capture creates one snag per photo with an editable provisional title; partial progress keeps unfinished identities.
- Native Skia pen/arrow/circle/rectangle/text/measurement notes, colour, history, object selection/movement/deletion, original-pixel vectors and separate flattened JPEG. Original bytes are retained; optimistic conflicts require reviewing the latest saved image before replacement. Measurements are notes, not calibrated distances.
- Personal in-app updates and bearer-authenticated PDF/Excel generation, three themes, shared options/filters, revisions/regeneration and native share sheet. No mobile service key, new migration or authorization-rule duplication.

## Verification

- Mobile pure suite: 41 passed (auth/session 12, markup 7, photos 7, reports 7, online operations 8).
- Mobile services against real local Supabase: eight passed, using disposable snag fixtures and cleanup. Covers metadata/team reads, create/revised retry, search, comment receipts, assignment/unassignment, active-project scoping, fix-photo enforcement and viewer denial.
- Existing DB suite: 55 passed. Shared contracts and actual PDF/XLSX outputs: 75 passed.
- Monorepo build/lint/typecheck: 12 tasks passed. Android and iOS Hermes exports passed using the installed Expo CLI.
- Real production web browser regression: 81 passed; separate Fieldwork fixture UI: nine passed; rollback-only SQL authorization assertions: 25 passed.
- Isolated production Expo browser preview: five passed against local Supabase. Real Chrome covers password/error/signout, viewer gating, two-session issue-photo/edit/comment/assign/start/fix/review/reject/resubmit/approve, failed-create draft retry and landscape/enlarged-text layouts. Four screenshots inspected; no browser page errors. Native markup is explicitly replaced by an original-photo fallback in this preview.
- Independent review identified recoverable-read draft loss (resource and foreground auth layers), changed-assignment/comment retry gaps, active-project scope and stale UI permissions. Regressions reproduced material issues and passed after corrections. Final independent assessment has no remaining material defect; hosted/native runtime boundaries remain explicit.

**299 targeted checks passed** across these sequential/isolated suites. The exact combined Turbo build/lint/typecheck/test command was not run because DB/E2E suites share fixtures; configured monorepo build/lint/typecheck and each test suite were verified separately. CI now runs mobile units, and the DB-backed mobile integration suite has its own explicit command and loopback guard.

Logs and ignored artifacts are under `.superpowers/phase5/` and `e2e/.playwright/phase5-*`. Browser logs: `.superpowers/phase5/web-browser.log`, `.superpowers/phase5/fixture.log`; mobile preview artifacts: `e2e/.playwright/phase5-mobile/`. Native final exports/log: `.superpowers/phase5/native-release/` and `.superpowers/phase5/native-release.log`. Local data and migration ledger 17 are preserved. No hosted service or external email recipient was changed.

## Baseline and operations

- Started from clean main `f0e2c5e`. Web login on port 3003 returned HTTP 200.
- Inherited mobile setup failure: mobile dependencies were not linked, so Expo base tsconfig/router/RN declarations were missing. Restoring the existing lock first made scaffold typecheck pass. Expo lint initially hit a sandbox write to the user's Expo settings directory; approved execution and disabled telemetry resolved the tooling limitation.
- Installed fallback pnpm is 11.25.0 while the repository requests pnpm 9.15.9. Commands used explicit `--config.manage-package-manager-versions=false --config.verify-deps-before-run=false` to prevent the fallback shim's implicit installation attempts. Required native modules were resolved through the installed Expo SDK 58 installer; Skia companion downloads needed a longer timeout. No broad SDK upgrade was performed.
- Turbo's web typecheck depends on web build. The first combined lint/typecheck attempt hit the known locked Sharp DLL because standalone was running. Stopped the identified task server, rebuilt successfully, copied static assets and restarted using the existing ignored private runtime script. Invitation settings were restored without printing credentials. Standalone remains on `http://127.0.0.1:3003`.
- SDK patch-update recommendations can differ from the pinned scaffold. Bundle/lint/typecheck results above establish the installed build; a future SDK update should be a separate tested change.
- The first development browser preview timed out during cold Metro page compilation; a bounded-worker production export succeeded and all browser cases ran against that static export. The native preview fallback is deliberate, not evidence of a physical Skia renderer test. Only mobile's direct dependency versions changed; other lockfile importer differences are regenerated peer-context identifiers from the installed package manager.

## Concrete hosted deployment checklist — requires explicit authorization

Read `docs/AI/TEAM-INVITES-2026-10-30.md` first. Nothing in this checklist has been executed against hosted services.

1. Identify the hosted Supabase project reference, owner/access arrangement, canonical HTTPS web/API origin, intended testers and physical phone model/OS. Do not paste secret keys into chat. These details remain unprovided; the user received an explanation of what is needed.
2. Read hosted migration state and take the project's normal backup. Review the pending migration diff, including 13–17, and apply every missing migration in order through 17 using the installed Supabase CLI. Never reset or seed over an existing hosted database. Confirm the ledger and generated types, RLS/RPCs, private buckets and Realtime publication.
3. Supply the hosted public URL/anon key to web and mobile. Keep the service-role key exclusively in trusted web invitation runtime. Set server `APP_URL` and public app origin to the canonical HTTPS origin. Confirm server-only invitation settings survive restart.
4. Enable email/password provider, disable public signup, configure SMTP, and preserve the existing web invite/recovery ConfirmationURL semantics. Allow the canonical web invite URL pattern and the exact native PKCE redirect `snagflow://auth/callback`. Verify both independently; do not replace web invitation callbacks with the native login callback.
5. Deploy the reviewed web build with current environment settings. Configure mobile `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_BASE_URL`; all are public, and the API base is the canonical web origin. Ensure the phone can reach HTTPS Auth/Storage/Realtime and report endpoints. No localhost URLs in hosted device builds.
6. Prepare a matching native development build through the team's existing Expo/native setup, with camera/photo permission strings and the SnagFlow URL scheme. Use separate authorized build credentials/access if required. EAS production profiles, app-store distribution and push credentials remain Phase 7/6 respectively.
7. Invite dedicated manager/member/viewer testers; avoid seeded demo passwords in hosted operation. Confirm intended project membership and the fix-photo setting. Verify public signup denial and private-photo isolation before acceptance testing.
8. Run and record the physical-device matrix below, including both role sessions and web collaboration. Record device/build ID, OS, hosted migration version and evidence. Mark Phase 5 accepted only after the required flows pass.

## Physical-device acceptance matrix — not performed

| Flow | Required observation |
| --- | --- |
| Auth | Password login, cold/warm same-device PKCE link, app restart/session refresh, signout and account switch clear private state; invalid/replayed/wrong-install links recover readably |
| Capture | Camera/library denial and Settings recovery, portrait/landscape/EXIF orientation, no square crop, 1600/400 dimensions, eight-photo cap, save/add-another |
| Native markup | All six tools, touch drawing/movement, colour/history/delete, original retention, reopen editable vectors, distinct flattened bytes, concurrent-save conflict acknowledgement |
| Continuous capture | Several photos → one numbered snag each, fill details later, partial upload retry produces no duplicate snags/photos |
| Work/review | Manager assigns → assignee starts → fix photo → request review → manager rejects with reason → resubmit → approve; reopen requires reason |
| Collaboration | Phone/web updates, foreground/reconnect/pull catch-up, membership/admin revocation, viewer restrictions and private-photo denial |
| Failure recovery | Response loss after create/comment/photo/markup, edited retry draft, transient foreground read failure retains open forms, definite access loss clears private data |
| Reports | Actual hosted PDF/Excel generation, all three themes, options/filter/revision/regeneration, native download/share sheet and temporary-file cleanup |
| Usability | Small phone/landscape, large system text, reduced motion, safe areas and screen reader labels; no keyboard-obscured fields |

## Remaining limits / next step

No physical device, hosted Supabase, native camera/Skia rendering, native magic-link dispatch or native sharing was exercised. Browser preview intentionally uses an original-photo fallback for markup and browser downloads for sharing. Drafts/queues are in the mounted screen only, not durable offline data; cache originals and abandoned uploads are not background-cleaned in this phase. Signed links remain valid until expiry. Large native selectors are scrollable choices, with further performance polish deferred to Phase 7.

Next: obtain hosted/device identifiers and explicit deployment authorization, execute the checklist and physical acceptance matrix, then begin Phase 6 offline/push work after Phase 5 acceptance.
