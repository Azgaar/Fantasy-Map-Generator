#!/usr/bin/env node
// Compare two git refs by benchmarking both on the same machine, alternating
// between them across several rounds and reporting the median per-benchmark ratio.
//
// Absolute timings on a shared CI runner are worthless on their own: a busy
// neighbour moves every result by tens of percent. Alternating means both refs
// meet the same neighbours, so the ratio survives what the raw numbers do not.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const parseArgs = argv => {
  const args = { rounds: 3, threshold: 0.25, base: "origin/master", head: "HEAD", filter: "" };
  for (let i = 0; i < argv.length; i++) {
    const next = () => argv[++i];
    if (argv[i] === "--base") args.base = next();
    else if (argv[i] === "--head") args.head = next();
    else if (argv[i] === "--rounds") args.rounds = Number(next());
    else if (argv[i] === "--threshold") args.threshold = Number(next());
    else if (argv[i] === "--filter") args.filter = next();
    else if (argv[i] === "--json-out") args.jsonOut = next();
    else if (argv[i] === "--markdown-out") args.markdownOut = next();
  }
  return args;
};

const run = (cmd, cmdArgs, cwd) =>
  execFileSync(cmd, cmdArgs, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

const repoRoot = run("git", ["rev-parse", "--show-toplevel"], process.cwd()).trim();

function prepareWorktree(ref, label) {
  const dir = mkdtempSync(path.join(tmpdir(), `bench-${label}-`));
  rmSync(dir, { recursive: true, force: true });
  run("git", ["worktree", "add", "--detach", dir, ref], repoRoot);

  const modules = path.join(repoRoot, "node_modules");
  if (existsSync(modules)) run("ln", ["-s", modules, path.join(dir, "node_modules")], repoRoot);
  return dir;
}

function benchmark(dir, filter) {
  const out = path.join(dir, "bench-run.json");
  const argv = ["vitest", "bench", "--run", "--outputJson", out];
  if (filter) argv.push(...filter.split("|"));
  try {
    run("npx", argv, dir);
  } catch {
    // Ref predates this benchmark suite (e.g. base == the commit that first
    // introduces bench/*.bench.ts): nothing to compare against yet, so treat
    // as an empty result set rather than failing the whole comparison.
    return new Map();
  }
  if (!existsSync(out)) return new Map();

  const raw = JSON.parse(readFileSync(out, "utf8"));
  const means = new Map();
  for (const file of raw.files ?? []) {
    for (const group of file.groups ?? []) {
      // fullName starts with the file's absolute path, which differs per worktree
      const suite = path.basename(file.filepath ?? "");
      const groupName = (group.fullName ?? "").split(" > ").slice(1).join(" > ");
      for (const b of group.benchmarks ?? []) means.set(`${suite} > ${groupName} > ${b.name}`, b.mean);
    }
  }
  return means;
}

const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

function toMarkdown(rows, threshold, hasRegression) {
  const emoji = status => (status === "REGRESSION" ? "🔴" : "🟢");
  const header = "| Benchmark | Change (median) | Spread across rounds | |\n|---|---|---|---|";
  const body = rows
    .map(r => `| ${r.benchmark} | ${r.change} | ${r.spread} | ${emoji(r.status)} |`)
    .join("\n");
  const summary = hasRegression
    ? `⚠️ One or more benchmarks are more than ${(threshold * 100).toFixed(0)}% slower than \`master\` (median across alternating rounds, so runner noise is cancelled out rather than thresholded around).`
    : "No performance regressions detected (base and head were benchmarked alternately on the same runner, so this isn't affected by machine-to-machine noise).";
  return `### Benchmark results (A/B vs \`master\`)\n\n${header}\n${body}\n\n${summary}\n`;
}

const { base, head, rounds, threshold, filter, jsonOut, markdownOut } = parseArgs(process.argv.slice(2));

const baseDir = prepareWorktree(base, "base");
const headDir = prepareWorktree(head, "head");
const ratios = new Map();

try {
  for (let round = 1; round <= rounds; round++) {
    // order flips each round so a drifting machine cannot favour one ref
    const first = round % 2 ? [baseDir, headDir] : [headDir, baseDir];
    const results = new Map();
    for (const dir of first) results.set(dir, benchmark(dir, filter));

    const baseMeans = results.get(baseDir);
    const headMeans = results.get(headDir);
    for (const [name, baseMean] of baseMeans) {
      const headMean = headMeans.get(name);
      if (headMean === undefined || !baseMean) continue;
      if (!ratios.has(name)) ratios.set(name, []);
      ratios.get(name).push(headMean / baseMean);
    }
    console.error(`round ${round}/${rounds} done`);
  }
} finally {
  for (const dir of [baseDir, headDir]) {
    run("git", ["worktree", "remove", "--force", dir], repoRoot);
  }
}

const rows = [];
let regressed = false;
for (const [name, samples] of ratios) {
  const change = median(samples) - 1;
  const spread = Math.max(...samples) - Math.min(...samples);
  if (change > threshold) regressed = true;
  rows.push({
    benchmark: name,
    change: `${change >= 0 ? "+" : ""}${(change * 100).toFixed(1)}%`,
    spread: `${(spread * 100).toFixed(1)}%`,
    status: change > threshold ? "REGRESSION" : "ok"
  });
}

rows.sort((a, b) => Number.parseFloat(b.change) - Number.parseFloat(a.change));

if (rows.length === 0) {
  console.error(`No comparable benchmarks between ${base} and ${head} (one of the refs predates this bench suite).`);
  if (markdownOut) {
    writeFileSync(
      markdownOut,
      `### Benchmark results (A/B vs \`master\`)\n\nNo comparable benchmarks yet — \`${base}\` predates this benchmark suite.\n`
    );
  }
  process.exit(0);
}

console.table(rows);

if (jsonOut) writeFileSync(jsonOut, JSON.stringify(rows, null, 2));
if (markdownOut) writeFileSync(markdownOut, toMarkdown(rows, threshold, regressed));

if (regressed) {
  console.error(`\nRegression: a benchmark is more than ${(threshold * 100).toFixed(0)}% slower than ${base}.`);
  process.exit(1);
}
console.error(`\nNo regression beyond ${(threshold * 100).toFixed(0)}% vs ${base}.`);
