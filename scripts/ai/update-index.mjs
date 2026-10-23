#!/usr/bin/env node
/**
 * scripts/ai/update-index.mjs — regenerate the derivable ("auto") sections of .ai/index.json.
 * Offline, zero dependencies. Hand-maintained sections (features/modules/routes) are preserved.
 * Run after structure changes: node scripts/ai/update-index.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const INDEX = join(ROOT, ".ai", "index.json");
/** @type {any} */
const idx = JSON.parse(readFileSync(INDEX, "utf8"));

const list = (dir, filter) => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && filter(e.name))
    .map((e) => relative(ROOT, join(dir, e.name)).split(sep).join("/"))
    .sort();
};

// 1. migrations (append-only list)
idx.auto.migrations_discovered = list(join(ROOT, "supabase", "migrations"), (n) => n.endsWith(".sql"));

// 2. tests (unit + db + e2e)
const sharedTests = list(join(ROOT, "packages", "shared", "tests"), (n) => n.endsWith(".test.ts")).map(
  (f) => f,
);
const e2eTests = list(join(ROOT, "e2e", "tests"), (n) => n.endsWith(".spec.ts")).map((f) =>
  relative(ROOT, f).split(sep).join("/"),
);
idx.auto.tests_discovered = [
  ...sharedTests.map((f) => `packages/shared/tests/${f.split("/").pop()}`),
  ...list(join(ROOT, "supabase", "tests"), (n) => n.endsWith(".test.ts")),
  ...e2eTests,
];

// 3. app pages (Next App Router page/layout files + Expo Router screens)
/** @param {string} base dir @param {string[]} acc @returns {string[]} */
function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name === "page.tsx" || e.name === "index.tsx" || e.name === "_layout.tsx") acc.push(p);
  }
  return acc;
}
idx.auto.app_pages_discovered = [
  ...walk(join(ROOT, "apps", "web", "src", "app")).map((f) => relative(ROOT, f).split(sep).join("/")),
  ...walk(join(ROOT, "apps", "mobile", "src", "app")).map((f) => relative(ROOT, f).split(sep).join("/")),
];

writeFileSync(INDEX, JSON.stringify(idx, null, 2) + "\n");
console.log(
  `update-index: migrations=${idx.auto.migrations_discovered.length} tests=${idx.auto.tests_discovered.length} pages=${idx.auto.app_pages_discovered.length}`,
);
