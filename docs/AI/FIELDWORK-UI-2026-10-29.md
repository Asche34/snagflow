# Fieldwork UI implementation

Approved visual direction: Fieldwork — dark forest navigation, orange primary actions, quiet light surfaces, Geist typography. Applies to the delivered Next.js web screens; no Expo or backend features were added.

## Delivered

- Semantic light/dark palette, connected Geist fonts, labelled status/priority colors, readable wrapping and 44px controls.
- Desktop sidebar from 1024px, active project links, Radix mobile drawer with keyboard focus return, phone Overview/Projects/My snags navigation and a skip link.
- Updated login, dashboard, project tabs/filters, snag lists/detail/actions and bounded loading skeletons.
- Due dates remain visible on phones; long project/snag titles wrap. Review queue uses the user's role in each project, while aggregate status counts still include all visible projects.
- Workflow/comment textareas have visible labels. Sign-out remains available at all sizes, with an accessible icon button on phones.
- Auth initialization waits for a request via `connection()`, fixing a reproduced Next.js/Supabase `Date.now()` prerender error. Session/RLS behavior is unchanged.

## Verification record

The original UI failed the phone navigation, scoped queue and phone due-date checks. Those passed after implementation. A separate browser-console test reproduced the auth prerender error, then passed after request-time initialization.

An independent reviewer reproduced text-resize overflow (375px viewport, 511px content width at 200% root font size). Wrapping action buttons and explicit min-width-constrained grid columns fixed it; the enlarged-text test also checks a focused final action clears the fixed phone navigation. The reviewer found no other outstanding issues.

Use the dedicated UI suite with the actual Next.js routes/components and a local HTTP fixture transport:

```powershell
pnpm --filter @snagflow/e2e test:ui
```

For a production-build UI check, build with the local fixture URL/anon value and set `UI_PRODUCTION=1` when running that suite. These are sample data and identities, not live Supabase credentials. The transport binds only to 127.0.0.1:55440, the app preview uses 127.0.0.1:3005, and no fixture route or bypass is added to the production app. The default auth suite excludes the fixture-specific tests; it still needs the real Supabase stack.

The UI suite covers 375/768/1024/1440px screenshots, login, keyboard drawer operation/focus return, skip link, reduced motion, long titles, due dates, per-project review gating, viewer controls, clean browser console and 200% text enlargement/focused-control clearance. Text enlargement is not a claim of native browser zoom testing or complete accessibility conformance.

Real Supabase Auth/Storage/workflow end-to-end verification remains pending. No hosted database changes, deployment, or release occurred.

## Local decisions

- Used a feature branch in the existing checkout to retain the prior uncommitted security-review work and installed runtime. Those changes were not reset or discarded.
- The bundled Bash ledger helper could not create directories under the Windows sandbox, so native file tools maintain the ledger.
- Kept all unsupported mockup actions out of the app: no placeholder notifications, new-snag button, uploads, or management links.
- Added UI-only fixture coverage because Docker/Supabase was unavailable; it establishes presentation and navigation behavior, not server authorization.
- Removed oversized fixed skeleton widths and allowed long action labels to wrap following the enlarged-text reproduction.

Final verification: production build passed; web and E2E lint/typechecks passed; 28 shared unit tests and all 8 production-build UI browser tests passed. Documentation validator and git whitespace checks passed. Light/dark text pairs exceed 4.5:1 and input borders exceed 3:1 in the measured palette. Review fixes were rechecked by the enlarged-text test and the whole UI suite. Native browser zoom and real Supabase end-to-end tests were not established by these checks.
