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
const PHASES = { moving: "while moving", after: "after it stops" };
const THRESHOLD = 0.1; // a total changes when its median moves this much and every round agrees: twice the 5% noise
const PART_THRESHOLD = 0.25; // parts are noisier, so they need a bigger move to be listed
const MIN_MS = 10; // a part must also move this much to be listed: smaller swings are noise
const TRACE_CATEGORIES = ["devtools.timeline", "disabled-by-default-devtools.timeline", "toplevel", "blink.user_timing"];

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

/** Runs in the page before the app: nothing covers the map, and every frame a gesture draws is counted */
function prepare() {
  localStorage.setItem("version", "999.0.0"); // newer than any build, so no "what's new" dialog opens mid-gesture
  globalThis.benchmarkFrames = 0;
  addEventListener("DOMContentLoaded", () => {
    const count = records => (globalThis.benchmarkFrames += records.length);
    new MutationObserver(count).observe(document.getElementById("viewbox"), { attributeFilter: ["transform"] });
  });
}

/** CPU time of one gesture from a Chrome trace: main-thread tasks and raster, while moving and after it stops */
async function traced(browser, page, gesture, inputs) {
  await page.evaluate(() => (globalThis.benchmarkFrames = 0));
  await browser.startTracing(page, { categories: TRACE_CATEGORIES });
  const release = await gesture();
  const frames = await page.evaluate(() => {
    performance.mark("benchmark:stop");
    return globalThis.benchmarkFrames;
  });
  await release?.();
  await settle(page);
  const { traceEvents } = JSON.parse(await browser.stopTracing());
  if (frames !== inputs) throw new Error(`${inputs} inputs drew ${frames} frames: the gesture missed the map`);

  const stop = traceEvents.find(event => event.name === "benchmark:stop").ts;
  const mainThreads = new Set(
    traceEvents
      .filter(event => event.name === "thread_name" && event.args.name === "CrRendererMain")
      .map(event => `${event.pid}:${event.tid}`)
  );
  const work = {};
  for (const { name, ts, dur, pid, tid } of traceEvents) {
    if (!dur) continue;
    const main = name === "ThreadControllerImpl::RunTask" && mainThreads.has(`${pid}:${tid}`);
    const kind = name === "RasterTask" ? "paint" : main ? "page" : null;
    if (!kind) continue;
    const key = `${kind} › ${ts < stop ? "moving" : "after"}`;
    work[key] = (work[key] ?? 0) + dur / 1000;
  }
  return work;
}

const TICKS = 22; // d3 scales 2^0.2 per tick: 22 ticks go from 1x to the 20x maximum, and back
const PAN = [
  [400, 0],
  [0, 300],
  [-400, 0],
  [0, -300]
];
const PAN_STEPS = 25; // per side of the loop

async function zoom(page, [x, y], deltaY) {
  await page.mouse.move(x, y);
  for (let i = 0; i < TICKS; i++) {
    await page.mouse.wheel(0, deltaY);
    await frame(page);
  }
}

/** One drag around a square: the release, and with it the settle redraw, is left to the caller */
async function pan(page, [x, y]) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (const [dx, dy] of PAN) {
    for (let i = 0; i < PAN_STEPS; i++) {
      x += dx / PAN_STEPS;
      y += dy / PAN_STEPS;
      await page.mouse.move(x, y);
      await frame(page);
    }
  }
  return () => page.mouse.up();
}

/** The biggest city, the biggest port and the deepest sea in the middle of the screen, clear of the panels */
function findSpots({ width, height }) {
  const { a: k, e, f } = document.getElementById("viewbox").getScreenCTM();
  const toScreen = ([x, y]) => [e + x * k, f + y * k];
  const inside = ([x, y]) => x > width * 0.2 && x < width * 0.8 && y > height * 0.2 && y < height * 0.8;

  const burgs = pack.burgs
    .filter(burg => burg.i && !burg.removed)
    .map(burg => ({ ...burg, at: toScreen([burg.x, burg.y]) }))
    .filter(burg => inside(burg.at))
    .sort((a, b) => b.population - a.population);
  let sea;
  for (let i = 0; i < grid.points.length; i++) {
    const at = toScreen(grid.points[i]);
    if (inside(at) && (!sea || grid.cells.h[i] < sea.h)) sea = { h: grid.cells.h[i], at };
  }
  return [burgs[0]?.at, burgs.find(burg => burg.port)?.at, sea?.at];
}

/** Load the map in a fresh profile, then zoom at three spots and pan a loop at 20x, with real input, one event per frame */
async function sample(browser, side) {
  const context = await browser.newContext({ viewport: VIEWPORT, serviceWorkers: "block" });
  const origin = new URL(side.url).origin;
  await context.route(url => url.origin !== origin, route => route.abort()); // offline: no fonts, no analytics
  await context.addInitScript(prepare);

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
  const spots = await page.evaluate(findSpots, VIEWPORT);
  if (!spots.every(Boolean)) throw new Error(`seed ${SEED} has no city, port or sea in the middle of the screen`);
  const record = (gesture, work) => {
    for (const [part, ms] of Object.entries(work)) {
      add(`${gesture} ${part.split(" ")[0]}`, ms);
      add(`${gesture} ${part}`, ms);
    }
  };

  for (const spot of spots) {
    record("zoom", await traced(browser, page, () => zoom(page, spot, -100), TICKS));
    record("zoom", await traced(browser, page, () => zoom(page, spot, 100), TICKS));
  }

  await zoom(page, spots[0], -100);
  await settle(page);
  const corner = [VIEWPORT.width / 2 - 200, VIEWPORT.height / 2 - 150];
  record("pan", await traced(browser, page, () => pan(page, corner), PAN.length * PAN_STEPS));

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
    .filter(row => !(row.key in TOTALS) && row.verdict !== "same" && Math.abs(row.after - (row.before ?? 0)) >= MIN_MS)
    .sort((a, b) => Math.abs(b.after - (b.before ?? 0)) - Math.abs(a.after - (a.before ?? 0)));
  const partLabel = key => {
    const [total, part] = key.split(" › ");
    return total in TOTALS ? `${TOTALS[total]} ${PHASES[part]}` : `${PARTS[total]}: ${part}`;
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
    `Seed \`${SEED}\`, 10k cells, 1280×720. Zooming is 22 wheel ticks to 20× and back at the biggest city, ` +
      "the biggest port and the deepest sea; panning is one 100-step drag around a square at 20×. " +
      "Every input draws one frame. Page work is the main thread: script, style, layout and paint recording; " +
      "painting is raster. " +
      `A total changes when it moves over ${share(THRESHOLD)} (a part over ${share(PART_THRESHOLD)}) and every run agrees.`,
    "",
    changed.length ? "| What changed | Before | After | |\n|---|--:|--:|---|" : "No part changed.",
    ...changed.map(row => `| ${partLabel(row.key)} | ${time(row.before)} | ${time(row.after)} | ${verdict(row)} |`),
    "",
    "</details>",
    ""
  ].join("\n");
  return markdown;
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
const markdown = report(compare(samples.base, samples.head), baseLabel);
console.log(markdown);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
process.exit(); // a monitor, not a gate: slower numbers are reported, never an exit code
