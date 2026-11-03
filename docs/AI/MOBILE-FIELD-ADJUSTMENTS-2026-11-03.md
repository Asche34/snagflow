# Mobile field adjustments — 2026-11-03

## Delivered behavior

- Home title is Projects; the visible Fieldwork label is removed. Active projects appear before Your work. Existing colors, type and account/App URL controls remain.
- A header Projects button on project/capture/report/snag routes opens a left side panel. It lists active projects through the current user's RLS client, identifies the current project where available, supports close/back and web Escape, and exposes loading/error/retry states. Opening it does not copy credentials or use a privileged client.
- Switching resets project-screen filters and capture state by project identity. Another project's location/category defaults cannot carry across. Capture's switch button is disabled during photo selection/save/upload to retain the current operation and its retry identity.
- Save & add another retains location and category only after the snag and all photos succeed. It creates a fresh client identity and clears title, description, due date, assignee and photos. Failure/retry retains the same draft and identity. Defaults live only in the current capture session; this is not Phase6 persistence.
- Priority selection is optional at creation, with an explicit Decide later (Medium default) choice and explanation. The existing shared schema/database Medium default remains; managers/admins can edit later under existing permissions. No nullable priority, new permission or schema migration was introduced. User explicitly confirmed: use Medium by default with no selection required. The implemented behavior matches this choice.
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

## Cloud build submitted

- Source commit: 4ab3b53f59ea4288eae308afee4dafcfff4c011a (local main; not pushed, to avoid the linked Vercel automatic web deployment).
- Expo build: [fcca55a1-633b-4e89-b4aa-33ff6f4db5bb](https://expo.dev/accounts/asche34/projects/snagflow/builds/fcca55a1-633b-4e89-b4aa-33ff6f4db5bb), preview, Android1.0.1/code2, same remote keystore.
- Last observed status: IN_QUEUE,74.3 minutes after submission. Expo has not assigned a worker and no artifact/error is reported. Native cloud verification and APK download remain externally pending; do not provide the prior APK as the replacement.
- Local source archive:319 files; expected shared/component inputs present, environment files excluded and no actual local service-role key literal found. No account-level preview variables override manual App URL behavior.
  The source/test work is complete, but the requested APK artifact is not available while Expo remains queued. The build page above is the current user-facing progress/download destination. No paid-priority upgrade or duplicate build was requested. The agent does not claim a background notification or physical-device verification.

## Native build failure diagnosis and constrained retry

Expo build fcca55a1-633b-4e89-b4aa-33ff6f4db5bb subsequently returned ERRORED: EAS_BUILD_UNKNOWN_GRADLE_ERROR. The worker log confirms JavaScript bundling/assets completed before Gradle reported its daemon disappeared unexpectedly. No source compilation failure or explicit heap error was logged. Native dependencies and lockfile are identical to the previous successful1.0.0 build; only version metadata and JavaScript UI changed. Expo Doctor patch-version recommendations were a warning, not the failing phase.

Resource pressure is a hypothesis, not a proven operating-system OOM event. The constrained retry keeps Expo's normal4GiB Gradle heap/metaspace/encoding defaults and existing worker/signing/version2, while disabling parallel project execution and limiting Gradle workers to2 through the documented GRADLE_OPTS profile environment override. No dependency upgrades or paid resource class is selected. Source of supported override: https://docs.expo.dev/build-reference/infrastructure/#gradle-jvm-args . Actual native success remains to be observed.

User explicitly confirmed Medium default with no required priority selection; this matches the shipped JavaScript source and needs no feature change.
