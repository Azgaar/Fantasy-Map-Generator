#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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

function syncPerfSpecs(fromDir, toDir) {
  const fromPerfDir = path.join(fromDir, "tests/perf");
  if (!existsSync(fromPerfDir)) return;

  const toPerfDir = path.join(toDir, "tests/perf");
  mkdirSync(toPerfDir, { recursive: true });
  for (const file of readdirSync(fromPerfDir)) {
    if (file.endsWith(".spec.ts") || file === "playwright.config.ts") {
      copyFileSync(path.join(fromPerfDir, file), path.join(toPerfDir, file));
    }
  }
}

async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {}
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
    stdio: ["ignore", "pipe", "pipe"],
    detached: true
  });
  child.stdout?.on("data", () => {});
  child.stderr?.on("data", () => {});
  child.unref();

  await waitForServer(`http://localhost:${port}/`);
  return child;
}

function killServer(child) {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {}
}

function parsePerfResults(stdout) {
  const metrics = new Map();
  const checksums = new Map();
  for (const line of stdout.split("\n")) {
    const marker = "PERF_RESULT ";
    const idx = line.indexOf(marker);
    if (idx === -1) continue;

    let parsed;
    try {
      parsed = JSON.parse(line.slice(idx + marker.length));
    } catch {
      continue;
    }

    const { suite, case: caseName, metrics: caseMetrics, checksum } = parsed;
    const caseKey = `${suite} > ${caseName}`;
    for (const [metric, value] of Object.entries(caseMetrics)) {
      metrics.set(`${caseKey} > ${metric}`, value);
    }
    if (checksum) checksums.set(caseKey, checksum.hash);
  }
  return { metrics, checksums };
}

function runPerfSuite(dir, port) {
  try {
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
  } catch (error) {
    return parsePerfResults(error.stdout ?? "");
  }
}

const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

function toMarkdown(rows, threshold, hasRegression, checksumIssues, checksumWarnings) {
  const emoji = status => (status === "REGRESSION" ? "🔴" : status === "ok" ? "🟢" : "⚪");
  const header = "| Metric | Change (median) | Spread across rounds | |\n|---|---|---|---|";
  const body = rows.map(r => `| ${r.metric} | ${r.change} | ${r.spread} | ${emoji(r.status)} |`).join("\n");
  const summary = hasRegression
    ? `⚠️ One or more metrics are more than ${(threshold * 100).toFixed(0)}% slower than \`master\` (median across alternating rounds, so runner noise is cancelled out rather than thresholded around).`
    : "No performance regressions detected (base and head were run alternately on the same runner, so this isn't affected by machine-to-machine noise).";

  const sections = [`### Real-map generation/interaction benchmark (A/B vs \`master\`)`];
  if (checksumIssues.length) {
    sections.push(`🔴 **Checksum mismatch**\n\n${checksumIssues.map(issue => `- ${issue}`).join("\n")}`);
  }
  if (checksumWarnings.length) {
    sections.push(`⚠️ **Determinism warning**\n\n${checksumWarnings.map(warning => `- ${warning}`).join("\n")}`);
  }
  sections.push(`${header}\n${body}\n\n${summary}`);
  return `${sections.join("\n\n")}\n`;
}

const { base, head, rounds, threshold, jsonOut, markdownOut } = parseArgs(process.argv.slice(2));

const BASE_PORT = 4300;
const HEAD_PORT = 4301;

const baseDir = prepareWorktree(base, "base");
const headDir = prepareWorktree(head, "head");
syncPerfSpecs(headDir, baseDir);

let baseServer;
let headServer;
const ratios = new Map();
const baseChecksums = new Map();
const headChecksums = new Map();

try {
  baseServer = await buildAndServe(baseDir, BASE_PORT, "base");
  headServer = await buildAndServe(headDir, HEAD_PORT, "head");

  for (let round = 1; round <= rounds; round++) {
    const first = round % 2 ? ["base", "head"] : ["head", "base"];
    const results = new Map();
    for (const which of first) {
      const [dir, port] = which === "base" ? [baseDir, BASE_PORT] : [headDir, HEAD_PORT];
      results.set(which, runPerfSuite(dir, port));
    }

    const baseResult = results.get("base");
    const headResult = results.get("head");
    for (const [name, baseValue] of baseResult.metrics) {
      const headValue = headResult.metrics.get(name);
      if (headValue === undefined || !baseValue) continue;
      if (!ratios.has(name)) ratios.set(name, []);
      ratios.get(name).push(headValue / baseValue);
    }
    for (const [caseKey, hash] of baseResult.checksums) {
      if (!baseChecksums.has(caseKey)) baseChecksums.set(caseKey, []);
      baseChecksums.get(caseKey).push(hash);
    }
    for (const [caseKey, hash] of headResult.checksums) {
      if (!headChecksums.has(caseKey)) headChecksums.set(caseKey, []);
      headChecksums.get(caseKey).push(hash);
    }
    console.error(`round ${round}/${rounds} done`);
  }
} finally {
  for (const server of [baseServer, headServer]) killServer(server);
  for (const dir of [baseDir, headDir]) {
    run("git", ["worktree", "remove", "--force", dir], repoRoot);
  }
}

const checksumIssues = [];
const checksumWarnings = [];
for (const [caseKey, baseHashes] of baseChecksums) {
  const headHashes = headChecksums.get(caseKey) ?? [];
  const baseSet = new Set(baseHashes);
  const headSet = new Set(headHashes);
  if (baseSet.size > 1 || headSet.size > 1) {
    checksumWarnings.push(
      `\`${caseKey}\`: same seed generated different maps within one side (base: ${[...baseSet].join(", ")}; head: ${[...headSet].join(", ")}) — a generation determinism bug, timings for this case are noisier than they look`
    );
  } else if (baseSet.size && headSet.size && [...baseSet][0] !== [...headSet][0]) {
    checksumIssues.push(
      `\`${caseKey}\`: base and head deterministically generate different maps (${[...baseSet][0]} vs ${[...headSet][0]}) — head changes generation output, so timings for this case are not comparable`
    );
  }
}

const isGated = name => name.endsWith("> total") || name.endsWith("> gesture");

const rows = [];
let regressed = false;
for (const [name, samples] of ratios) {
  const change = median(samples) - 1;
  const spread = Math.max(...samples) - Math.min(...samples);
  const gated = isGated(name);
  const isRegression = gated && change > threshold;
  if (isRegression) regressed = true;
  rows.push({
    metric: name,
    change: `${change >= 0 ? "+" : ""}${(change * 100).toFixed(1)}%`,
    spread: `${(spread * 100).toFixed(1)}%`,
    status: isRegression ? "REGRESSION" : gated ? "ok" : "info"
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
if (checksumWarnings.length) console.error(`\nDeterminism warning:\n${checksumWarnings.map(w => `- ${w}`).join("\n")}`);
if (checksumIssues.length) console.error(`\nChecksum mismatch:\n${checksumIssues.map(i => `- ${i}`).join("\n")}`);

if (jsonOut) writeOutput(jsonOut, JSON.stringify(rows, null, 2));
if (markdownOut) writeOutput(markdownOut, toMarkdown(rows, threshold, regressed, checksumIssues, checksumWarnings));

if (checksumIssues.length) {
  console.error("\nFAILED: head generates a different map than base for the same seed.");
  process.exit(1);
}
if (regressed) {
  console.error(`\nRegression: a metric is more than ${(threshold * 100).toFixed(0)}% slower than ${base}.`);
  process.exit(1);
}
console.error(`\nNo regression beyond ${(threshold * 100).toFixed(0)}% vs ${base}.`);
process.exit(0);
