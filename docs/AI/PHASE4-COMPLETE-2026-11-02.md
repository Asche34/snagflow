# Phase 4 markup and reports — 2026-11-02

## Delivered

- Web react-konva editor with pen, arrow, circle/rectangle, text, measurement notes, colour, undo/redo and selection/move/delete. Canvas coordinates remain in the original image's pixel space; responsive scaling changes only display. Object list, insertion/movement buttons and keyboard controls supplement drawing. Shared versioned validation bounds geometry, object/point counts and payload size.
- Private gallery shows annotated images and links originals separately. Signed-link refresh, image-load failure recovery and unsupported-vector recovery are explicit. Drafts remain in the open page after closing the editor or failed saves. Optimistic `updated_at` conflicts preserve drafts and require reviewing/acknowledging the latest saved image before replacement.
- Migration 16 adds authorized annotation saves with audit events, persistent report-generation quota and atomic per-project revision registration. Migration 17 makes photo/report objects append-only for clients. Changed markup creates a separate JPEG plus vectors; source bytes/metadata remain intact. Stable upload/request identities recover exact committed retries without duplicate rows/revisions.
- Project Reports tab generates PDF or Excel, lists paginated revision history, downloads short-lived private links and regenerates the same saved options using current project data. Routes accept caller cookies or bearer JWTs for future mobile reuse; active project manager/admin authorization is checked before work and again in Postgres before final writes. No report service key is used.
- PDF Classic, Compact and Photo-first layouts; cover branding/project/client/address/date/preparer/status and priority summaries/signatures; original/annotated, photo size, fix photos, comments/timestamps, group/sort and all specified filters. Excel has one complete item row per snag, web links, summary and optional photo/comment sheets. Full comments occupy separate bounded cells rather than exceeding Excel's string limit.
- Report reads use keyset pages and bounded related-ID batches; private images download in batches of four and downscale with the already-installed Sharp dependency. Node default runtime, maxDuration 300 and a 260-second readable deadline; explicit oversized/missing/undecodable-file failures avoid silent partial reports.

## Verification

| Check | Result |
| --- | --- |
| Real Chrome against production + local Supabase | 81 passed (69 existing, seven markup, five reports) |
| Fieldwork fixture UI | Nine passed |
| Real DB API/RLS/integrity | 55 passed |
| Shared contracts and actual PDF/XLSX output | 75 passed |
| Transactional SQL authorization | 25 passed, rolled back |
| Production build; configured web/shared/DB/E2E lint and typechecks; shared declarations | Passed |
| Generated DB type equivalence; AI docs/indexes; whitespace/credential scan | Passed |

**245 targeted checks**; full mobile/monorepo gate excluded. Logs: `.superpowers/phase4/{baseline,markup-release,reports-release,fixture-release,db-release,shared-release,authorization,build-release}.log`. Artifact directories are distinct under `e2e/.playwright/phase4-*`. Final reports and source stress PDFs received independent glyph/image-bound checks and PDFium rendered-page inspection. Final real exports: Classic 35 pages, Compact 35, Photo-first 102; each contains all 100 titles and 101 photo placements, zero out-of-page characters/images. All 101 Classic images retain 140-point width; metadata baselines remain 12.15 points apart.

- Real local Supabase data was preserved. Migrations 16 and 17 are applied locally and recorded in its ledger; generated DB types were refreshed with the installed CLI and match a fresh local generation.
- Existing baseline browser coverage includes photo retry after immutable-object policy changes and complete local captured-email invitation flows. Markup cases cover tools and pointer geometry, original retention, re-editing, conflicts, committed-response loss, role revocation, phone/keyboard/image recovery and unsupported stored documents.
- Reports acceptance covers three themes for 100 snags with 101 photo placements, Excel rows/links/comments/summary, exact immutable retry, data beyond 1,000 rows, filters, responsive generation/history/regeneration, authorization/invalid input/origin checks and long comments. PDF output checks inspect actual image matrices and page text/image placement; rendered pages receive visual QA.

## Independent review and corrections

- Independent DB review found old Storage overwrite/delete policies bypassed annotation compare-and-save and a report cleanup-registration race. Migration 17 removes those paths; an immutable-byte regression failed before and passed after the fix. Existing photo uploads now reconcile completed immutable JPEG objects instead of replacing them. Scoped re-review cleared both findings.
- Whole-feature review found identical rendered photo sizes in some theme combinations and Excel comment cells exceeding 32,767 characters. Distinct physical dimensions and a full Comments sheet resolve them; actual serialized PDF/XLSX regressions and scoped re-review cover both.
- Actual Windows exports exposed omitted native DLLs in standalone tracing. The report route's tracing now includes installed Sharp companion libraries. Intermediate generic 500s were not reproduced after a diagnostic rebuild; stage/error diagnostics scrub URLs and JWTs, and no unsupported root cause is assigned.
- Visual QA found column-flex collapse, inherited line spacing overlap, row/caption pagination overflow and unbroken-token overflow that mere text-presence assertions missed. Natural text flow, bounded summary/thumbnail rows, font-specific line heights, protected image/caption blocks and bounded discretionary word breaks correct these. Final scoped pagination review has no remaining material finding. A final Classic regression also reproduced squeezed rows near page boundaries; Page-level summary/narrative/evidence siblings and nonshrinking minimum dimensions now preserve every photo’s physical size and metadata spacing. Stress output contains 100 records, seven maximum-length unbroken comments and a maximum-length description; independent glyph/image checks enforce page bounds.

## Operations and remaining limits

- Standalone production is at `http://127.0.0.1:3003`. Stop task-owned standalone/fixture Next servers before rebuilding on Windows; copy the build's static assets into standalone and restore existing server-only invitation key/canonical origin privately when restarting. Installed Next/Playwright/Vitest/Supabase CLIs were reused; no dependency reinstall was needed.
- No hosted services changed. Hosted migrations through 17 and invitation APP_URL/server-only key/Auth redirects/SMTP remain separate authorized deployment work. Read `TEAM-INVITES-2026-10-30.md` before any deployment. Do not reset existing local Supabase data.
- Full mobile/monorepo gate, physical devices/native zoom and hosted runtime are unverified. Previous handoff minors remain: in-flight refresh under an already-open modal, dedicated inactive archive/delete coverage, broader shared-test import-style lint outside configured scope and existing workspace caps.
- Annotation drafts persist within the current page, not across reload/navigation. Measurements are labels, not calibrated distances. Old flattened revisions and abandoned private uploads are retained; cleanup requires future trusted maintenance and cannot race active registration. Short-lived signed URLs remain usable until expiry. Compact uses smaller type/photos with natural vertical flow; it can occupy more pages than Classic’s side-by-side rows. Page-number footers are not provided.
- Additional output permutations (original versus annotated selection, fix-photo exclusion, configured logo/date-format branding and lost HTTP response after report registration) remain deferred test coverage; their controls/code were reviewed. The tested exact request retry is idempotent.
- Report reads fail explicitly above their configured project/metadata/related-record limits (20,000 per paginated set; comments 100,000 per related-ID batch). Processed image buffers cap at 100 MiB and final report files at 50 MiB. Reports are current multi-query reads, not a transactionally frozen project snapshot. A deadline response cannot immediately cancel renderer work already in progress, but final writes check the deadline and stable retries reconcile uncertain outcomes.

Next recommended: Phase 5 mobile online mode. Plan hosted Supabase deployment separately under the invitation handoff; it was not performed here.
