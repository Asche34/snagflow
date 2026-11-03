# Hosted Vercel rollout — 2026-11-03

## Identified targets and read-only evidence

- User chose existing [Vercel project asche/snagflow](https://vercel.com/asche/snagflow), ID `prj_YU5suMWBuQhIkmoM4GccVr58oGJX`. Render is superseded; do not create or sync the dormant `render.yaml` template.
- Canonical production alias: `https://snagflow.vercel.app`. Existing production deployment is Ready, but anonymous probes return login500, health503 and mobile-config503. The Vercel environment list is empty.
- Current settings: Next.js preset, root `apps/web`, outside-root sources enabled, Node26.x and default build/install detection. Git is linked to `Asche34/snagflow`, production branch `main`; further pushes may deploy, so hold pushes until rollout approval or deployment behavior is established.
- User's Supabase project: `mtpmqnczwdbglebrakhw`, name Snagflow Project, region `eu-west-1`, status ACTIVE_HEALTHY. CLI authenticated through the user's browser approval.
- Read-only SQL confirms zero public tables, zero Auth users, zero buckets and no migration ledger. User also says any old demo data is disposable. A reset is unnecessary and is not planned; local Supabase data remains protected.
- Administrator email: `administrator@snagflow.dev`; user cannot receive mail there and explicitly selected private password setup. Use company name SnagFlow unless corrected.

Update: the user added Vercel environment values/redeployed and requested the first admin. Existing migrations and admin bootstrap have now executed as recorded below. Other rollout checklist items remain separately tracked.

## APK ready

Expo build `36b6a885-d543-4bea-8809-2063b4947f6d` finished successfully, source `7b09d98c82eab5f561d8cc5ae88ba35c4a6e3caf`, Android1.0.0/code1, application ID `com.snagflow.app`.

- [Download APK](https://expo.dev/artifacts/eas/Jo7Yj_hcr-l9hIip0OnWu18aZ6VfmzHfGT4nkZ1jwfg.apk)
- Local ignored copy: `.superpowers/apk/SnagFlow-1.0.0.apk`, 156346863 bytes.
- SHA-256: `34aa64994f157aed3f6ccd8da16b7f37918917069c47f1ca877830f255544f02`.
- Signing key remains managed by Expo under asche34. No credentials are committed.
- The same APK accepts the eventual Vercel origin through App URL; no rebuild is needed for the hosting choice. Successful compilation is not physical APK/hosted-flow acceptance.

## Concrete changes requiring user approval

1. Recheck the hosted schema/ledger and retain the current settings snapshot. Link tooling only to the identified hosted reference; do not retarget or reset the local running database. Apply the existing17 migrations in order using CLI migration history, without `seed.sql`, resets or table drops. Stop on an unexpected schema/ledger difference.
2. Verify all migrations recorded through `20261102000017`, expected RLS/policies/RPCs/triggers, private buckets and Realtime publication. No permission/workflow contract is changed.
3. Configure hosted Auth for invite-only email/password access: public signup disabled, canonical site origin `https://snagflow.vercel.app`, compatible web invitation/recovery redirects and exact native `snagflow://auth/callback`. Preserve existing callback/template semantics described in `TEAM-INVITES-2026-10-30.md`; do not overwrite unrelated Auth settings.
4. Configure only the existing Vercel project's production environment:

   | Name                            | Value/source                                                     |
   | ------------------------------- | ---------------------------------------------------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`      | `https://mtpmqnczwdbglebrakhw.supabase.co`                       |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | This project's public anon/publishable key, obtained privately   |
   | `NEXT_PUBLIC_APP_URL`           | `https://snagflow.vercel.app`                                    |
   | `APP_URL`                       | `https://snagflow.vercel.app`                                    |
   | `SUPABASE_SERVICE_ROLE_KEY`     | This project's privileged key, encrypted server environment only |
   | `NEXT_PUBLIC_DEMO_ACCOUNTS`     | `false`                                                          |

   No privileged value enters an EXPO_PUBLIC/NEXT_PUBLIC setting, build command, committed file or printed output. Hosted server/mobile URL overrides are unnecessary because the public backend is already reachable. Preserve any settings added by the user since inspection.

5. Align Vercel Node with the locally verified24.x runtime. Keep Next.js preset, root `apps/web`, outside-root access and workspace lockfile. Use pnpm9.15.9/frozen installation and existing web build; deploy the reviewed main source. Add no paid services or plan upgrades.
6. The user creates the initial Auth account/password privately in the Supabase dashboard with email confirmation appropriate to this non-mailbox test login. Never enter or request that password through chat/tools. Then match exactly one Auth UUID to `administrator@snagflow.dev` and create/activate/promote only its profile through a trusted bootstrap operation. Insert the singleton org_settings row for SnagFlow. Do not enable public signup or install demo accounts/projects.
7. Check public HTTPS login/health/mobile discovery and hosted schema protections, then user signs in privately on web/APK. Verify native auth/session restart, camera/photos, editable markup, workflow, collaboration and PDF/Excel sharing using the Phase5 acceptance matrix. The APK App URL is `https://snagflow.vercel.app`.

## Limits and rollback

- SMTP remains unconfigured/unverified. This admin has no mailbox. Password login can be tested; invitation delivery, magic links and email password recovery need an accessible recipient and suitable SMTP later. Do not send invitations as part of private-password bootstrap.
- Hosted report duration/memory, private photo isolation and native APK behavior require actual verification. The successful local Linux Docker image build is supplemental; Vercel uses its Next.js build adapter, not that image. Windows local web/mobile gates and Android bundle compilation were already recorded in the APK handoff.
- Roll back a failed web release through Vercel's existing deployment controls and restore prior environment/Auth settings. Do not drop the database or blindly roll back migrations; use reviewed forward repairs if needed. Never use a local reset as a hosted repair.
- Vercel plan/billing remains unchanged. Check plan suitability before business production use; this rollout is a test deployment. No store publishing, offline sync or push work is included.

## Approval boundary

The user's original instruction explicitly requires approval before hosted service changes. This checklist is prepared for that approval; read-only account/project checks and the completed APK build do not authorize its execution.

## Executed first-admin bootstrap — 2026-11-03

- User action: added production Vercel environment and initiated redeployment; requested “create the first admin.” Ruling: apply the existing schema required for the requested profile/authorization bootstrap, without reset or demo seed. No Vercel settings/deployment were changed by the agent.
- CLI dry-run listed exactly migrations1–17; `db push --linked --project-ref mtpmqnczwdbglebrakhw --skip-vault --yes` applied all17, without `--include-seed`. Verified count17/latest20261102000017. No local stack reset or data changes.
- Created confirmed Auth identity `administrator@snagflow.dev`, UUID `ec07ce0e-2425-4a95-8040-daef4552ebc2`, initially without a password or email delivery. Granted active admin only to that exact UUID and inserted singleton org_settings company SnagFlow. There is exactly one active administrator and zero demo projects.
- User entered the password twice in a private interactive PowerShell helper. Password remained in process memory and was sent only to the intended Supabase Auth API; no transcript, password file, chat value or token output. The helper verified actual password sign-in, read the admin profile with that user session, then signed out only that verification session. Non-secret result confirms passwordSet/loginVerified/adminAccessVerified=true.
- Hosted verification: no public base table lacks RLS; branding/reports/snag-photos buckets are private. Live login, health and mobile-config each return200. Discovery advertises the intended hosted Supabase URL with an anon key, not a privileged key.
- Public Auth settings still report disable_signup=false. Invite-only Auth configuration, redirect allowlists, SMTP and complete hosted/device acceptance remain pending; no full hosted acceptance claim. User must sign in privately through the actual web/APK screens next.
- APK App URL and web sign-in: https://snagflow.vercel.app. First login email: administrator@snagflow.dev. Password is known only to the user.
- Evidence stays ignored under .superpowers/apk/ (migration dry-run/apply logs, SQL verification, non-secret private-helper result). Temporary hosted key cache is removed after successful password verification. Local docs remain unpushed while the newly connected Vercel main-branch deployment behavior is outside this admin-only change.
