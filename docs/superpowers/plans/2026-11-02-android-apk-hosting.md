# Android APK and hosting preparation implementation plan

> **For agentic workers:** Use superpowers:executing-plans for this small configuration change.

**Goal:** Prepare a directly installable SnagFlow 1.0 Android APK with the existing editable App URL and a reviewed Render deployment template.

**Architecture:** Expo Build compiles a signed internal preview APK with bundled JavaScript and no development server. The app discovers its backend through the selected HTTPS web origin. Render runs the existing Docker standalone web app against hosted Supabase.

**Tech Stack:** Installed Expo SDK58, EAS CLI27.2.0, pnpm9.15.9, Next16 Docker, Supabase.

**Spec:** User's APK/App URL/Render request and `docs/AI/PHASE5-MOBILE-2026-11-02.md`.

## Global constraints

- Keep App URL editable; no hosted project or LAN address baked into the preview.
- No database reset, hosted deployment, paid build or invitation changes without explicit authorization.
- Keep secrets, local runtime evidence and signing material out of cloud source archives.
- This is a requested Phase5 acceptance build; broader Phase7 store publishing stays out of scope.

## Review focus

- Local dotenv or cloud public presets must not silently bind the APK to the PC backend.
- The archive must include shared workspace sources and lockfile but exclude actual environment/signing files.
- Render must use repository-root Docker context and preserve public build versus private runtime settings.
- Creating accounts does not mean hosted migrations/deployments are authorized.
- User-reported Android success must not imply every acceptance flow was observed.

## Tasks

- [x] Add `apps/mobile/eas.json` preview APK profile and stable Android application ID/version code in app.json. Validate with the actual Expo/EAS config tools.
- [x] Add repository-root `.easignore`, signing ignores and Docker context exclusions. Inspect a local EAS source archive before any upload.
- [x] Add `render.yaml` with free Docker service, health check, manual deploys and environment prompts. Validate YAML/schema locally; do not create a service.
- [x] Run mobile lint/typecheck/units and Android export; record user-reported local device success and remaining hosted/native APK checks.
- [ ] Connect the user's Expo account through device login; only then link/build the requested preview with no paid upgrade. Record the exact project/build result if performed.

## Delivery ledger

- Accounts exist per user; Expo CLI device sign-in requested. Hosted project and data status not yet identified.
- Ruling: Android application ID `com.snagflow.app`, version1.0.0/code1 for the first test APK. Retain signing identity for future upgrades; no store submission.
