# CLEANUP-CANDIDATES

Files that MIGHT be obsolete/duplicate. Deletion not automatic — confirm per item.

| File | Reason | Recommended action | Risk |
| ---- | ------ | ------------------ | ---- |
| `apps/web/README.md` | create-next-app boilerplate duplicates root README | trim to a 5-line pointer to root README | none |
| `apps/mobile/README.md` | Expo template boilerplate | trim same way | none |
| `apps/mobile/assets/expo-icons/*` (template set) | template default branding, will be replaced when branding happens (Phase 7) | keep for now; revisit at branding | none |

## Not candidates (explicitly keep)

- `SNAGFLOW_BUILD_PROMPT.md` — authoritative spec referenced everywhere.
- `docs/DECISIONS.md` — decision log.
- `pnpm-lock.yaml`, `.github/`, `supabase/` artifacts excluded via `.gitignore` only.
