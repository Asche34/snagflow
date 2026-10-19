# KNOWN-ISSUES

| # | Issue | Impact | Workaround / status |
| - | ----- | ------ | ------------------- |
| K1 | Fresh PowerShell shells don't see `docker.exe` from supabase CLI | `supabase start/stop` fails with docker not found | prepend Docker bin to `$env:Path` (AGENTS.md §Commands); disappears after terminal restart |
| K2 | PowerShell execution policy blocks `.ps1` shims | `pnpm`/`supabase` bare calls can fail | use `.cmd` shims (`pnpm.cmd`, `supabase.cmd`) or `pnpm` via node |
| K3 | `apps/web/.env.local` / `test.env` not committed (by design) | local runs need manual env | documented in TESTING.md / README |
| K4 | Edge function `push-send` declared in spec §12 but not implemented | Phase 6 item | scheduling; `config.toml` deliberately omits function until then |
| K5 | Playwright E2E not present | Phase 7 item | — |
| K6 | `db-types.ts` may drift if migrations change without `pnpm db:gen-types` | type mismatch | regenerate + rerun suites whenever migrations change |

None of the above blocks current phase work.
