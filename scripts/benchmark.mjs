#!/usr/bin/env node
/**
 * Compare the working tree against the commit it branched from: generation, rendering, zoom and pan.
 * See docs/architecture/benchmark.md.
 *
 * Usage:
 *   node scripts/benchmark.mjs [--base origin/master] [--rounds 3]
 */

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "playwright";

const SEED = "benchmark";
const VIEWPORT = { width: 1280, height: 720 };
// page work (script, style, layout on the main thread) and painting (raster) gate apart: neither hides behind the other
const TOTALS = {
  generation: "Generate the map",
  rendering: "Draw the map",
  "zoom page": "Zoom: page work",
  "zoom paint": "Zoom: painting",
  "pan page": "Pan: page work",
  "pan paint": "Pan: painting"
};
const PARTS = { generation: "Generation", rendering: "Drawing" };
const THRESHOLD = 0.15; // a total changes when its median moves this much and every round agrees, clear of the ~10% noise
const PART_THRESHOLD = 0.25; // parts are noisier, so they need a bigger move to be listed
const MIN_MS = 5; // parts below this are noise
const TRACE_CATEGORIES = ["devtools.timeline", "disabled-by-default-devtools.timeline", "toplevel"];

const { values: args } = parseArgs({
  options: { base: { type: "string", default: "origin/master" }, rounds: { type: "string", default: "3" } }
});
const rounds = Number(args.rounds);

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const git = (...gitArgs) => execFileSync("git", gitArgs, { cwd: repo, encoding: "utf8" }).trim();
const vite = path.join(repo, "node_modules/vite/bin/vite.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fmg-benchmark-"));
const baseRef = git("merge-base", "HEAD", args.base); // before the change, not wherever the base branch is now

async function serve(label, dir, port) {
  console.error(`[${label}] building`);
  const outDir = path.join(tmp, `${label}-dist`);
  execFileSync(process.execPath, [vite, "build", "--outDir", outDir, "--logLevel", "error"], {
    cwd: dir,
    stdio: "inherit"
  });

  const server = spawn(process.execPath, [vite, "preview", "--outDir", outDir, "--port", `${port}`, "--strictPort"], {
    cwd: dir,
    stdio: "ignore"
  });
  const url = `http://localhost:${port}/Fantasy-Map-Generator/`;
  for (let attempt = 0; !(await fetch(url).then(res => res.ok, () => false)); attempt++) {
    if (attempt > 100) throw new Error(`[${label}] preview server did not start on ${url}`);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return { label, url, server };
}

function checkout(ref) {
  const dir = path.join(tmp, "base");
  execFileSync("git", ["worktree", "add", "--detach", "--quiet", dir, ref], { cwd: repo, stdio: "inherit" });
  fs.symlinkSync(path.join(repo, "node_modules"), path.join(dir, "node_modules"), "dir");
  return dir;
}

const frame = page => page.evaluate(() => new Promise(requestAnimationFrame));
const settle = async page => {
  await page.waitForTimeout(400); // past d3's wheel end delay, so the settle redraw runs
  await frame(page);
  await frame(page);
};

/** CPU time the browser spends on a gesture: main-thread tasks, and raster, which no in-page timer sees */
async function traced(browser, page, gesture) {
  await browser.startTracing(page, { categories: TRACE_CATEGORIES });
  await gesture();
  await settle(page);
  const { traceEvents } = JSON.parse(await browser.stopTracing());

  const mainThreads = new Set(
    traceEvents
      .filter(event => event.name === "thread_name" && event.args.name === "CrRendererMain")
      .map(event => `${event.pid}:${event.tid}`)
  );
  const work = { page: 0, paint: 0 };
  for (const { name, dur, pid, tid } of traceEvents) {
    if (!dur) continue;
    if (name === "RasterTask") work.paint += dur / 1000;
    else if (name === "ThreadControllerImpl::RunTask" && mainThreads.has(`${pid}:${tid}`)) {
      work.page += dur / 1000;
    }
  }
  return work;
}

async function zoom(page, ticks, deltaY) {
  await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
  for (let i = 0; i < ticks; i++) {
    await page.mouse.wheel(0, deltaY);
    await frame(page);
  }
}

async function drag(page, dx, steps) {
  const y = VIEWPORT.height / 2;
  const x = VIEWPORT.width / 2 - dx / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x + (dx * i) / steps, y);
    await frame(page);
  }
  await page.mouse.up();
}

/** Load the map in a fresh profile, then zoom in, pan and zoom out with real input, one event per frame */
async function sample(browser, side) {
  const context = await browser.newContext({ viewport: VIEWPORT, serviceWorkers: "block" });
  const origin = new URL(side.url).origin;
  await context.route(url => url.origin !== origin, route => route.abort()); // offline: no fonts, no analytics

  const page = await context.newPage();
  await page.goto(`${side.url}?seed=${SEED}`);
  // the full draw closes the load; a ref from before the app's measures only ever registers the map
  await page.waitForFunction(
    () =>
      performance.getEntriesByName("Layers Rendering").length ||
      (globalThis.mapHistory?.length && !performance.getEntriesByName("Generation Pipeline").length),
    undefined,
    { timeout: 120_000 }
  );
  const measures = await page.evaluate(() =>
    performance.getEntriesByType("measure").map(({ name, duration, detail }) => ({ name, duration, detail }))
  );

  const metrics = {};
  const add = (key, ms) => (metrics[key] = (metrics[key] ?? 0) + ms);
  for (const { name, duration, detail } of measures) {
    if (name === "Generation Pipeline") add("generation", duration);
    else if (detail === "Generation Pipeline") add(`generation › ${name}`, duration);
    else if (detail === "Layers") {
      add("rendering", duration);
      add(`rendering › ${name}`, duration);
    }
  }

  await settle(page);
  const gestures = [
    ["zoom", () => zoom(page, 22, -100)], // d3 scales 2^0.2 per tick: 22 ticks reach the 20x maximum
    ["pan", () => drag(page, 600, 30).then(() => drag(page, -600, 30))],
    ["zoom", () => zoom(page, 22, 100)]
  ];
  for (const [gesture, run] of gestures) {
    for (const [part, ms] of Object.entries(await traced(browser, page, run))) add(`${gesture} ${part}`, ms);
  }

  await context.close();
  return metrics;
}

const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Before and after medians per metric; the change is the median per-round ratio, and counts only if every round agrees */
function compare(before, after) {
  const keys = new Set([...before, ...after].flatMap(Object.keys));
  return [...keys].map(key => {
    const ratios = after.map((round, i) => (round[key] ?? 0) / (before[i][key] ?? 0)).filter(Number.isFinite);
    const change = ratios.length ? median(ratios) - 1 : undefined;
    const threshold = key in TOTALS ? THRESHOLD : PART_THRESHOLD;
    const counts = Math.abs(change) > threshold && (ratios.every(r => r > 1) || ratios.every(r => r < 1));
    return {
      key,
      before: median(before.map(round => round[key] ?? 0)) || undefined,
      after: median(after.map(round => round[key] ?? 0)),
      change,
      verdict: !counts ? "same" : change > 0 ? "slower" : "faster"
    };
  });
}

const time = ms => (ms === undefined ? "—" : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);
const share = change => `${Math.round(Math.abs(change) * 100)}%`;
const verdict = ({ change, verdict }) =>
  change === undefined
    ? "—"
    : verdict === "slower"
      ? `🔴 ${share(change)} slower`
      : verdict === "faster"
        ? `🟢 ${share(change)} faster`
        : "no change";

function report(rows, baseLabel) {
  const totals = Object.entries(TOTALS).map(([key, label]) => ({ ...rows.find(row => row.key === key), label }));
  const slower = totals.filter(row => row.verdict === "slower");
  const changed = rows
    .filter(row => !(row.key in TOTALS) && row.verdict !== "same" && Math.max(row.before ?? 0, row.after) >= MIN_MS)
    .sort((a, b) => Math.abs(b.after - (b.before ?? 0)) - Math.abs(a.after - (a.before ?? 0)));
  const partLabel = key => {
    const [total, part] = key.split(" › ");
    return `${PARTS[total]}: ${part}`;
  };

  const markdown = [
    slower.length
      ? `### 🔴 Slower: ${slower.map(row => `${row.label.toLowerCase()} (+${share(row.change)})`).join(", ")}`
      : "### ✅ No slowdowns",
    "",
    `Compared with \`${baseLabel}\`: the same map, built both ways and run ${rounds} times each. Lower is better.`,
    "",
    "| | Before | After | |",
    "|---|--:|--:|---|",
    ...totals.map(row => `| ${row.label} | ${time(row.before)} | ${time(row.after)} | ${verdict(row)} |`),
    "",
    "<details><summary>Details</summary>",
    "",
    `Seed \`${SEED}\`, 10k cells, 1280×720. Zooming is 22 wheel ticks to 20× and back; panning is two 600 px ` +
      "drags at 20×. Page work is the main thread: script, style, layout and paint recording; painting is raster. " +
      `A total changes when it moves over ${share(THRESHOLD)} (a part over ${share(PART_THRESHOLD)}) and every run agrees.`,
    "",
    changed.length ? "| What changed | Before | After | |\n|---|--:|--:|---|" : "No part changed.",
    ...changed.map(row => `| ${partLabel(row.key)} | ${time(row.before)} | ${time(row.after)} | ${verdict(row)} |`),
    "",
    "</details>",
    ""
  ].join("\n");
  return { markdown, regressed: slower.length > 0 };
}

const sides = [];
const samples = { base: [], head: [] };
let browser;
let baseDir;

try {
  baseDir = checkout(baseRef);
  sides.push(await serve("base", baseDir, 4310), await serve("head", repo, 4311));

  browser = await chromium.launch();
  for (let round = 0; round <= rounds; round++) {
    for (const side of round % 2 ? sides : [...sides].reverse()) {
      const metrics = await sample(browser, side);
      if (round) samples[side.label].push(metrics); // round 0 is the warm-up
    }
    console.error(round ? `round ${round}/${rounds}` : "warm-up done");
  }
} finally {
  await browser?.close();
  for (const { server } of sides) server.kill();
  if (baseDir) execFileSync("git", ["worktree", "remove", "--force", baseDir], { cwd: repo });
  fs.rmSync(tmp, { recursive: true, force: true });
}

const baseLabel = /^[0-9a-f]{40}$/.test(args.base) ? baseRef.slice(0, 8) : `${args.base}@${baseRef.slice(0, 8)}`;
const { markdown, regressed } = report(compare(samples.base, samples.head), baseLabel);
console.log(markdown);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
process.exit(regressed ? 1 : 0);
