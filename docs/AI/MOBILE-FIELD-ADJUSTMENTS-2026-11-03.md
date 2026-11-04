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

## Constrained retry submitted

- New Expo build: [cf113c7a-35d5-4d15-896a-f7181666c0df](https://expo.dev/accounts/asche34/projects/snagflow/builds/cf113c7a-35d5-4d15-896a-f7181666c0df).
- Source:47f428d9150e44279ac97483bcbd419695cbed69, Android1.0.1/code2, existing remote keystore. Only the preview Gradle concurrency override changed; source UI/behavior and dependency lock are unchanged.
- EAS archive inspection accepted the retry profile. Independent review found no configuration blocker and confirmed the override preserves JVM/worker-size defaults except project parallelism/worker count. Actual worker log must confirm the override and native outcome before calling the experiment successful.
- Expo build list confirms first attempt ERRORED and this retry IN_QUEUE. No APK artifact exists yet; use this new build link rather than the failed attempt. No native success, physical acceptance, paid worker upgrade, Vercel deployment or repository push is claimed.

## APK delivery

- Expo now reports the retry as FINISHED for Android 1.0.1, version code 2, from commit `47f428d9150e44279ac97483bcbd419695cbed69`.
- The [direct APK download](https://expo.dev/artifacts/eas/maqN7vTTbIZv2cu848EbUBevhPbCTQ4d2QC9IQ9qVI0.apk) returned HTTP 200. Physical-device acceptance remains pending.

## Android feedback

- The user reported that the Android 1.0.1 checks worked on their phone and asked for a better mobile interface, especially how photo markup looks and feels. The broader Phase 5 acceptance matrix remains open.

## Photo review and filters APK — 2026-11-04

- Requested follow-up APK submitted as Android 1.0.2, version code 3, using the existing preview signing key and constrained Gradle profile.
- [Expo build eff8b347-8409-4168-a3be-08087ab1ce18](https://expo.dev/accounts/asche34/projects/snagflow/builds/eff8b347-8409-4168-a3be-08087ab1ce18) FINISHED successfully. Expo confirms version 1.0.2/code 3. [Download APK](https://expo.dev/artifacts/eas/2FMMnx7o_G5-9ogtnoVXh-JRdO9KISLPTyyChwXvw0o.apk). Native phone verification of these changes is pending.
- The 319-file source archive excluded environment/signing files and contained the new version metadata. Source remains local with the existing worktree changes.

## Android installation investigation

- The user reports 1.0.2 fails with only “App not installed”, both over the existing app and after uninstalling it.
- Downloaded both released APKs for comparison. Version codes are 2 and 3, package is com.snagflow.app, minimum SDK is 24, target SDK is 36 and all four packaged ABIs match. Signing certificate SHA-256 matches across both releases.
- Both APK v2 RSA signatures and their complete chunked content digests verified. The 1.0.2 ZIP archive integrity check passed. Its exact size is 156357559 bytes. The cause on the phone remains unconfirmed, pending download and device details.
