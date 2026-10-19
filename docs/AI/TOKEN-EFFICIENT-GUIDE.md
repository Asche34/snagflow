# TOKEN-EFFICIENT-GUIDE

1. Read indexes before code. `AGENTS.md → PROJECT-STATE → MODULE/FEATURE-INDEX` answers 80% of "where is X?".
2. Load only files in the CONTEXT SET (CONTINUATION-PROTOCOL.md §5).
3. For big files, grep for the symbol first (`file::function` pointers in indexes give the name to grep for).
4. Never copy code into documentation — reference `file::symbol(:line)`.
5. One fact, one home: PROJECT-STATE = present · CHANGELOG.md = history · SNAGFLOW_BUILD_PROMPT.md §15 = future. Don't duplicate them.
6. Prefer running `node scripts/ai/update-index.mjs` over hand-editing `.ai/index.json`.
7. For a targeted fix, never load unrelated modules even if "just checking" — indexes prevent this.
8. When 3–10 relevant files are identified, finish work on them before widening the analysis.
9. Don't re-run full audits or re-read old commits to reconstruct state — PROJECT-STATE exists for that.
10. Ask the user (or record a DECISION entry) instead of long speculative exploration.
