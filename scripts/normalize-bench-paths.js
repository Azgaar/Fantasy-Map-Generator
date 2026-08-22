#!/usr/bin/env node
"use strict";

// Vitest's --outputJson records each file's absolute path, which leaks the
// machine/username that generated the report and causes spurious diffs when
// the baseline is regenerated on a different machine (e.g. CI). Rewrite paths
// to be relative to the repo root so the committed JSON is stable and portable.

const fs = require("node:fs");
const path = require("node:path");

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error("Usage: node scripts/normalize-bench-paths.js <report.json>");
  process.exit(2);
}

const repoRoot = path.join(__dirname, "..");
const report = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

for (const file of report.files ?? []) {
  file.filepath = path.relative(repoRoot, file.filepath).split(path.sep).join("/");
}

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
