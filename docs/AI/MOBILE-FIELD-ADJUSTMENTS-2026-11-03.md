# Mobile field adjustments — 2026-11-03

## Delivered behavior

- Home title is Projects; the visible Fieldwork label is removed. Active projects appear before Your work. Existing colors, type and account/App URL controls remain.
- A header Projects button on project/capture/report/snag routes opens a left side panel. It lists active projects through the current user's RLS client, identifies the current project where available, supports close/back and web Escape, and exposes loading/error/retry states. Opening it does not copy credentials or use a privileged client.
- Switching resets project-screen filters and capture state by project identity. Another project's location/category defaults cannot carry across. Capture's switch button is disabled during photo selection/save/upload to retain the current operation and its retry identity.
- Save & add another retains location and category only after the snag and all photos succeed. It creates a fresh client identity and clears title, description, due date, assignee and photos. Failure/retry retains the same draft and identity. Defaults live only in the current capture session; this is not Phase6 persistence.
- Priority selection is optional at creation, with an explicit Decide later (Medium default) choice and explanation. The existing shared schema/database Medium default remains; managers/admins can edit later under existing permissions. No nullable priority, new permission or schema migration was introduced. An optional clarification about true unset semantics was asked but not answered; retaining the established default is the stated implementation assumption.
- Android package remains com.snagflow.app, version1.0.1/code2, with the existing Expo-managed signing identity and manual App URL connection.

## Verification and review

- Baseline mobile50 units and typecheck passed. Local Docker/Supabase/preview had stopped; restarted the preserved stack without reset. Initial browser startup failure was environment-only.
- New home/carry-forward browser tests failed against the prior preview for visible Fieldwork text and lost selected location/category before implementation.
- Final mobile lint/typecheck/50 unit checks and E2E package lint/typecheck passed. All11 real-local-backend mobile browser checks passed, including home order, authorized project switching, viewer scoping, repeated capture persistence/new identities, optional-priority default, delayed-save guard, keyboard dismissal, App URL/session isolation and the existing photo/workflow loop. Disposable fixtures were cleaned; no hosted test writes.
- Browser artifacts: e2e/.playwright/mobile-adjustments-release. Side-panel screenshot inspected at375px; existing landscape/enlarged-text checks pass. Earlier false-negative selected-radio assertions exposed missing RNWeb aria-checked; explicit radio state now represents visible selection. Escape check waits for the modal's active dialog, not just its opening button.
- Android Hermes export passed using the preview profile's unconfigured presets. EAS local archive inspection passed; explicit secret/exclusion scan is performed before cloud upload.
- Independent review found the pending-capture navigation race. A delayed POST regression failed before the fix; capture now overrides its header switch control with busy state. Review of the correction found no remaining blocker.

## Release boundaries

No hosted configuration, migration, email, Vercel setting or offline/push work is part of these adjustments. Prior hosted handoff edits are preserved. Main is linked to Vercel deployment; keep any unapproved web deployment/push separate from the requested Expo APK build. Native physical acceptance of this replacement remains the user's next step.

Cloud build ID, final source commit and actual APK URL are recorded when available. Do not claim native build success from the browser or Hermes export alone.
