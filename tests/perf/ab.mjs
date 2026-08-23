#!/usr/bin/env node
// Compare two git refs on real generation + interaction, alternating which ref runs first across
// several rounds and reporting the median per-metric ratio.
//
// Absolute timings on a shared CI runner are worthless on their own: a busy neighbour moves every
// result by tens of percent. Alternating means both refs meet the same neighbours, so the ratio
// survives what the raw numbers do not (see scripts history on PR #1601 for the failed
// stored-baseline attempt this replaces).
//
// Each ref is built and served exactly once (not once per round): only the Playwright run itself
// repeats, so 3 rounds cost ~3x a single comparison, not ~3x a full build+comparison.

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const parseArgs = argv => {
  const args = { rounds: 3, threshold: 0.25, base: "origin/master", head: "HEAD" };
  for (let i = 0; i < argv.length; i++) {
    const next = () => argv[++i];
    if (argv[i] === "--base") args.base = next();
    else if (argv[i] === "--head") args.head = next();
    else if (argv[i] === "--rounds") args.rounds = Number(next());
    else if (argv[i] === "--threshold") args.threshold = Number(next());
    else if (argv[i] === "--json-out") args.jsonOut = next();
    else if (argv[i] === "--markdown-out") args.markdownOut = next();
  }
  return args;
};

const writeOutput = (filePath, contents) => {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
};

const run = (cmd, cmdArgs, cwd, env) =>
  execFileSync(cmd, cmdArgs, { cwd, env: { ...process.env, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

const repoRoot = run("git", ["rev-parse", "--show-toplevel"], process.cwd()).trim();

function prepareWorktree(ref, label) {
  const dir = mkdtempSync(path.join(tmpdir(), `perf-${label}-`));
  rmSync(dir, { recursive: true, force: true });
  run("git", ["worktree", "add", "--detach", dir, ref], repoRoot);

  const modules = path.join(repoRoot, "node_modules");
  if (existsSync(modules)) run("ln", ["-s", modules, path.join(dir, "node_modules")], repoRoot);
  return dir;
}

async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      // not up yet
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

async function buildAndServe(dir, port, label) {
  console.error(`[${label}] building...`);
  run("npm", ["run", "build"], dir);

  console.error(`[${label}] starting preview server on :${port}...`);
  const child = spawn("npm", ["run", "preview", "--", "--port", String(port), "--strictPort"], {
    cwd: dir,
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout?.on("data", () => {});
  child.stderr?.on("data", () => {});

  await waitForServer(`http://localhost:${port}/`);
  return child;
}

function parsePerfResults(stdout) {
  const metrics = new Map();
  for (const line of stdout.split("\n")) {
    const marker = "PERF_RESULT ";
    const idx = line.indexOf(marker);
    if (idx === -1) continue;
    const { suite, case: caseName, metrics: caseMetrics } = JSON.parse(line.slice(idx + marker.length));
    for (const [metric, value] of Object.entries(caseMetrics)) {
      metrics.set(`${suite} > ${caseName} > ${metric}`, value);
    }
  }
  return metrics;
}

function runPerfSuite(dir, port) {
  const out = execFileSync(
    "npx",
    ["playwright", "test", "--config=tests/perf/playwright.config.ts", "tests/perf"],
    {
      cwd: dir,
      env: { ...process.env, PERF_BASE_URL: `http://localhost:${port}` },
      encoding: "utf8"
    }
  );
  return parsePerfResults(out);
}

const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

function toMarkdown(rows, threshold, hasRegression) {
  const emoji = status => (status === "REGRESSION" ? "🔴" : "🟢");
  const header = "| Metric | Change (median) | Spread across rounds | |\n|---|---|---|---|";
  const body = rows.map(r => `| ${r.metric} | ${r.change} | ${r.spread} | ${emoji(r.status)} |`).join("\n");
  const summary = hasRegression
    ? `⚠️ One or more metrics are more than ${(threshold * 100).toFixed(0)}% slower than \`master\` (median across alternating rounds, so runner noise is cancelled out rather than thresholded around).`
    : "No performance regressions detected (base and head were run alternately on the same runner, so this isn't affected by machine-to-machine noise).";
  return `### Real-map generation/interaction benchmark (A/B vs \`master\`)\n\n${header}\n${body}\n\n${summary}\n`;
}

const { base, head, rounds, threshold, jsonOut, markdownOut } = parseArgs(process.argv.slice(2));

const BASE_PORT = 4300;
const HEAD_PORT = 4301;

const baseDir = prepareWorktree(base, "base");
const headDir = prepareWorktree(head, "head");
let baseServer;
let headServer;
const ratios = new Map();

try {
  baseServer = await buildAndServe(baseDir, BASE_PORT, "base");
  headServer = await buildAndServe(headDir, HEAD_PORT, "head");

  for (let round = 1; round <= rounds; round++) {
    // order flips each round so a drifting machine cannot favour one ref
    const first = round % 2 ? ["base", "head"] : ["head", "base"];
    const results = new Map();
    for (const which of first) {
      const [dir, port] = which === "base" ? [baseDir, BASE_PORT] : [headDir, HEAD_PORT];
      results.set(which, runPerfSuite(dir, port));
    }

    const baseMetrics = results.get("base");
    const headMetrics = results.get("head");
    for (const [name, baseValue] of baseMetrics) {
      const headValue = headMetrics.get(name);
      if (headValue === undefined || !baseValue) continue;
      if (!ratios.has(name)) ratios.set(name, []);
      ratios.get(name).push(headValue / baseValue);
    }
    console.error(`round ${round}/${rounds} done`);
  }
} finally {
  for (const server of [baseServer, headServer]) server?.kill();
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
    metric: name,
    change: `${change >= 0 ? "+" : ""}${(change * 100).toFixed(1)}%`,
    spread: `${(spread * 100).toFixed(1)}%`,
    status: change > threshold ? "REGRESSION" : "ok"
  });
}

rows.sort((a, b) => Number.parseFloat(b.change) - Number.parseFloat(a.change));

if (rows.length === 0) {
  console.error(`No comparable metrics between ${base} and ${head} (one of the refs predates this perf suite).`);
  if (markdownOut) {
    writeOutput(
      markdownOut,
      `### Real-map generation/interaction benchmark (A/B vs \`master\`)\n\nNo comparable metrics yet — \`${base}\` predates this perf suite.\n`
    );
  }
  process.exit(0);
}

console.table(rows);
if (jsonOut) writeOutput(jsonOut, JSON.stringify(rows, null, 2));
if (markdownOut) writeOutput(markdownOut, toMarkdown(rows, threshold, regressed));

if (regressed) {
  console.error(`\nRegression: a metric is more than ${(threshold * 100).toFixed(0)}% slower than ${base}.`);
  process.exit(1);
}
console.error(`\nNo regression beyond ${(threshold * 100).toFixed(0)}% vs ${base}.`);
