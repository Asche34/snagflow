#!/usr/bin/env node
/**
 * scripts/ai/check-ai-docs.mjs — validate the AI documentation layer. Offline, zero deps.
 *  1. required docs exist
 *  2. JSON indexes parse (project_manifest.json, .ai/index.json)
 *  3. backticked file references in AGENTS.md + docs/AI/*.md point to real files
 *  4. discoveries in .ai/index.json match reality (drift check)
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
/** @type {string[]} */
const errors = [];

const required = [
  "AGENTS.md",
  "project_manifest.json",
  ".ai/index.json",
  "scripts/ai/update-index.mjs",
  "scripts/ai/check-ai-docs.mjs",
  "docs/AI/00-START-HERE.md",
  "docs/AI/PROJECT-SUMMARY.md",
  "docs/AI/PROJECT-STATE.md",
  "docs/AI/ARCHITECTURE.md",
  "docs/AI/REPOSITORY-MAP.md",
  "docs/AI/MODULE-INDEX.md",
  "docs/AI/FEATURE-INDEX.md",
  "docs/AI/ROUTE-INDEX.md",
  "docs/AI/API-INDEX.md",
  "docs/AI/DATABASE-INDEX.md",
  "docs/AI/UI-INDEX.md",
  "docs/AI/DEPENDENCY-MAP.md",
  "docs/AI/BUSINESS-RULES.md",
  "docs/AI/SECURITY.md",
  "docs/AI/TESTING.md",
  "docs/AI/DEVELOPMENT-GUIDE.md",
  "docs/AI/CONTINUATION-PROTOCOL.md",
  "docs/AI/TOKEN-EFFICIENT-GUIDE.md",
  "docs/AI/KNOWN-ISSUES.md",
  "docs/AI/CLEANUP-CANDIDATES.md",
  "docs/AI/REFACTOR-CANDIDATES.md",
  "docs/DECISIONS.md",
  "SNAGFLOW_BUILD_PROMPT.md",
];
for (const f of required) if (!existsSync(join(ROOT, f))) errors.push(`missing file: ${f}`);

for (const f of ["project_manifest.json", ".ai/index.json"]) {
  try {
    JSON.parse(readFileSync(join(ROOT, f), "utf8"));
  } catch (e) {
    errors.push(`invalid JSON in ${f}: ${/** @type {Error} */ (e).message}`);
  }
}

// collect backticked path-like references from AI docs
/** @type {string[]} */
const refs = new Set();
/** @param {string} dir */
function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".md")) {
      const text = readFileSync(p, "utf8");
      for (const m of text.matchAll(/`([^`\n]+)`/g)) {
        const t = m[1].trim();
        if (!/\.(ts|tsx|sql|mjs|json|md|toml|yml|yaml|css)$/.test(t)) continue;
        if (t.includes("*") || t.includes("http") || t.includes(" ")) continue;
        refs.add(t.split("::")[0]); // strip ::symbol
      }
    }
  }
}
walk(join(ROOT, "docs", "AI"));

// basename index of real files (for validating bare filenames like `20261019000005_security.sql`)
const SKIP = new Set(["node_modules", ".git", ".next", ".turbo", ".expo", "dist", "coverage", ".snagflow", "supabase%5Ctemp"]);
/** @type {Set<string>} */
const byName = new Set();
/** @param {string} dir */
function indexFiles(dir) {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP.has(e.name)) continue;
      if (e.name.endsWith("%5Ctemp")) continue;
      indexFiles(join(dir, e.name));
    } else byName.add(e.name);
  }
}
indexFiles(ROOT);

for (const r of refs) {
  const clean = r.split(" + ")[0];
  if (clean.includes("/")) {
    if (!existsSync(join(ROOT, clean))) errors.push(`dangling reference: ${r}`);
  } else if (!byName.has(clean)) {
    errors.push(`dangling reference: ${r}`);
  }
}

// drift: auto sections of .ai/index.json must match current reality (loose check)
const idx = JSON.parse(readFileSync(join(ROOT, ".ai", "index.json"), "utf8"));
const migCount = readdirSync(join(ROOT, "supabase", "migrations")).filter((n) => n.endsWith(".sql")).length;
if ((idx.auto?.migrations_discovered?.length ?? -1) !== migCount)
  errors.push("index drift: run `node scripts/ai/update-index.mjs`");

if (errors.length) {
  console.error(`check-ai-docs: FAILED\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(`check-ai-docs: OK (${required.length} files, ${refs.size} references validated)`);
