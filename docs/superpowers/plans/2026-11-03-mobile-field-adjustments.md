# Mobile field adjustments implementation plan

> **For agentic workers:** Use superpowers:executing-plans for this targeted change; obtain a fresh final review.

**Goal:** Remove the visible Fieldwork home heading, prioritize project access, add a project side menu and retain capture location/category for the next snag; deliver a replacement APK.

**Architecture:** Keep the protected Expo Router stack and existing captured Supabase clients. A header button opens an accessible React Native side panel of RLS-readable active projects. Capture defaults live only in the current project/capture session and advance only after a complete successful save. Existing shared schemas and database authorization remain authoritative.

**Tech Stack:** Installed Expo58/React Native, existing Modal/Router and Supabase dependencies, local Playwright preview, EAS27.2.0 internal APK.

**Spec:** User's mobile adjustment request; user confirmed Medium default with no required priority selection.

## Constraints and review focus

- Keep Fieldwork colors/typography; remove its visible home text only. Projects precede Your work.
- Project menu preserves back navigation, is keyboard/screen-reader accessible, closes on Android Back and shows no stale data after signout/connection change.
- Query projects through the current authenticated client and RLS; no custom authorization rules.
- Switch project navigation resets project-specific filters and cannot carry location/category into another project.
- Save-and-add-another retains only location/category; new identity, empty title/photos/other fields; failed save/photo retry keeps the existing draft/identity.
- Preserve earlier uncommitted hosted handoff changes. No database reset or unrelated hosted/Auth/Vercel setting change.
- Build the same Android package/signing identity with a higher version code; source upload remains free of secrets.

## Tasks

- [x] Add browser regressions for home order/text, project menu/switching and repeated capture defaults; observe failure against existing preview.
- [x] Implement shared active-project read, header side menu, home order and project-local reset behavior.
- [x] Implement successful-save capture defaults and agreed optional-priority presentation.
- [x] Run mobile lint/typecheck/units and isolated real-local-backend browser checks; export Android and review screenshots.
- [x] Obtain independent review; update feature/handoff docs and build version. Review staging for secrets, commit requested changes and submit Expo preview build.
- [ ] Observe cloud build result, provide actual APK URL and record remaining physical-device checks.

## Baseline and decisions

- Existing mobile units50 and mobile typecheck passed before changes.
- Use a side panel implemented with installed React Native Modal rather than restructuring the whole route tree or adding dependencies. This keeps existing protected routes and deep links intact.
- Priority currently defaults to Medium in shared creation validation and database. Ask whether optional capture should retain this default or introduce true unset semantics before changing that contract.

- Verification: all11 browser checks,50 mobile units, mobile/E2E lint/typecheck and Android export pass. Independent review's capture/save race fixed and regression verified.
- Ruling: optional priority uses the existing Medium default with clear UI copy; true unset requires a separately agreed shared/DB/web change.

- Cloud build submitted from4ab3b53 as fcca55a1-633b-4e89-b4aa-33ff6f4db5bb. Source archive319 files passed exclusion/private-key checks. Final observed queue wait74.3 minutes; native artifact remains externally pending. Commit is local only to avoid unapproved Vercel deployment.

- User clarification confirmed the implemented optional-priority behavior: Use Medium by default; no selection required. No rebuild is needed for this confirmation.
