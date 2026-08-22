#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

function parseArgs(argv) {
  // GitHub-hosted runners share CPUs with other jobs, so run-to-run noise on
  // sub-millisecond benchmarks can easily swing 40-50% with no code change.
  // A generous threshold keeps the check useful for catching real (multi-x)
  // regressions without flaking on noise.
  const args = { baseline: path.join(__dirname, "..", "bench", "baseline.json"), threshold: 0.75 };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--baseline") args.baseline = argv[++i];
    else if (arg === "--threshold") args.threshold = Number(argv[++i]);
    else if (arg === "--markdown-out") args.markdownOut = argv[++i];
    else positional.push(arg);
  }
  args.current = positional[0];
  return args;
}

function toMarkdown(rows, threshold, hasRegression) {
  const emoji = status => (status === "REGRESSION" ? "🔴" : "🟢");
  const header = "| Benchmark | Baseline | Current | Change |\n|---|---|---|---|";
  const body = rows
    .map(r => `| ${r.name} | ${r.baselineMs} ms | ${r.currentMs} ms | ${r.change} ${emoji(r.status)} |`)
    .join("\n");
  const summary = hasRegression
    ? `⚠️ One or more benchmarks are more than ${(threshold * 100).toFixed(0)}% slower than baseline. If this is expected, update the baseline with \`npm run bench:baseline\`.`
    : "No performance regressions detected.";
  return `### Benchmark results\n\n${header}\n${body}\n\n${summary}\n`;
}

function loadBenchmarks(jsonPath) {
  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const benchmarks = new Map();
  for (const file of raw.files ?? []) {
    for (const group of file.groups ?? []) {
      for (const b of group.benchmarks ?? []) {
        benchmarks.set(`${group.fullName} > ${b.name}`, b.mean);
      }
    }
  }
  return benchmarks;
}

function main() {
  const { current, baseline, threshold, markdownOut } = parseArgs(process.argv.slice(2));
  if (!current) {
    console.error("Usage: node scripts/bench-check.js <current.json> [--baseline path] [--threshold 0.4]");
    process.exit(2);
  }
  if (!fs.existsSync(baseline)) {
    console.error(`No baseline found at ${baseline}. Run "npm run bench:baseline" once and commit the file.`);
    process.exit(2);
  }

  const currentBench = loadBenchmarks(current);
  const baselineBench = loadBenchmarks(baseline);

  let hasRegression = false;
  const rows = [];

  for (const [name, baselineMean] of baselineBench) {
    const currentMean = currentBench.get(name);
    if (currentMean === undefined) continue; // benchmark removed/renamed, not our concern here

    const change = (currentMean - baselineMean) / baselineMean;
    const regressed = change > threshold;
    if (regressed) hasRegression = true;

    rows.push({
      name,
      baselineMs: baselineMean.toFixed(3),
      currentMs: currentMean.toFixed(3),
      change: `${change >= 0 ? "+" : ""}${(change * 100).toFixed(1)}%`,
      status: regressed ? "REGRESSION" : "ok"
    });
  }

  console.table(rows);

  if (markdownOut) {
    fs.writeFileSync(markdownOut, toMarkdown(rows, threshold, hasRegression));
  }

  if (hasRegression) {
    console.error(
      `\nPerformance regression detected: one or more benchmarks are more than ${(threshold * 100).toFixed(0)}% slower than baseline.\n` +
        `If this is expected (intentional trade-off), update the baseline with "npm run bench:baseline" and commit bench/baseline.json.`
    );
    process.exit(1);
  }

  console.log("\nNo performance regressions detected.");
}

main();
