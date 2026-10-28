// Tunes the goods catalogue and economy constants against the economy KPIs by simulated annealing, on the game's own
// economy run headless. A pool of workers, one per exported map, runs each candidate on every map at once; several
// chains share the pool. Every 30 s a PROGRESS line, with the best checked on a held-out map in the real game.
// The best is saved to .cache/best.json on every improvement and on any failure; a .cache/STOP file ends the run.
//   node scripts/economy-tuner/search.mjs [--budget=1000] [--chains=6] [--test-seed=8888] [--url=http://localhost:5173/...]
// Needs the dev server running and the maps exported (export-maps.mjs); apply.mjs writes the best into the source
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { build } from "./build.mjs";
import { overridesOf, readCatalogue, readCommonness, ROOT, thetaOf } from "./catalogue.mjs";
import { MAPS_DIR } from "./export-maps.mjs";
import { checkOverrides, DEFAULT_URL, openGame, registeredTunables } from "./game.mjs";
import { objective, summary } from "./objective.mjs";
import { RANGES, readTunables } from "./tunables.mjs";

const arg = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const budget = +arg("budget", 1000),
  chainCount = +arg("chains", 6),
  testSeed = arg("test-seed", "8888"),
  url = arg("url", DEFAULT_URL);
const CACHE = fileURLToPath(new URL("./.cache/", import.meta.url));
const LOG = `${CACHE}search.log`,
  BEST = `${CACHE}best.json`,
  STOP = `${CACHE}STOP`;
mkdirSync(CACHE, { recursive: true });
writeFileSync(LOG, "");
if (existsSync(STOP)) unlinkSync(STOP);
const say = line => {
  console.log(line);
  appendFileSync(LOG, `${line}\n`);
};

const maps = existsSync(MAPS_DIR) ? readdirSync(MAPS_DIR).filter(f => f.endsWith(".json")) : [];
if (!maps.length) throw new Error("No exported maps: run scripts/economy-tuner/export-maps.mjs first");
const catalogue = readCatalogue();
const weights = readCommonness();
const defaults = readTunables(file => readFileSync(`${ROOT}${file}`, "utf8"));
const start = thetaOf(catalogue, defaults);

// ---- state; the best is written whole or not at all, so a crash never leaves a broken file
const t0 = Date.now();
let runs = 0,
  inflight = 0,
  evals = 0,
  best = null,
  check = "game check pending",
  stopping = false,
  finished = false;
const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`;
const round = (_key, v) => (typeof v === "number" ? +v.toFixed(4) : v);
const save = extra => {
  if (!best) return;
  const data = {
    runs,
    evals,
    elapsed: elapsed(),
    loss: best.loss,
    kpi: best.kpi,
    parts: best.parts,
    unitShare: best.unitShare,
    target: best.target,
    overrides: best.overrides,
    theta: best.theta,
    ...extra
  };
  writeFileSync(`${BEST}.tmp`, JSON.stringify(data, round, 1));
  renameSync(`${BEST}.tmp`, BEST);
};

let game = null,
  tick = null;
const pool = [];
async function shutdown(reason, code) {
  if (finished) return;
  finished = true;
  clearInterval(tick);
  try {
    save({ ended: reason });
  } catch (error) {
    say(`SAVE failed: ${error.message}`);
  }
  say(
    `${code ? "FAILED" : "DONE"} ${reason} | runs ${runs} evals ${evals} ${elapsed()} | best ${best ? `${best.loss.toFixed(3)} ${summary(best.kpi)}` : "-"} | ${check} | saved ${BEST}`
  );
  for (const { worker } of pool) worker.terminate();
  await game?.browser.close().catch(() => {});
  process.exit(code);
}
process.on("uncaughtException", error => shutdown(`uncaught: ${error.message}`, 1));
process.on("unhandledRejection", error => shutdown(`unhandled: ${error?.message ?? error}`, 1));
process.on("SIGINT", () => shutdown("interrupted", 1));
process.on("SIGTERM", () => shutdown("terminated", 1));

// ---- the pool: one worker per map; a candidate goes to all of them at once
const bundle = await build();
let nextId = 0;
const calls = new Map();
await Promise.all(
  maps.map(
    file =>
      new Promise((ready, fail) => {
        const worker = new Worker(new URL("./worker.mjs", import.meta.url), {
          workerData: { bundle, file: `${MAPS_DIR}${file}` }
        });
        pool.push({ file, worker });
        worker.on("message", m => {
          if (m.ready) return ready();
          const call = calls.get(m.id);
          calls.delete(m.id);
          if (m.error) call?.fail(new Error(`${file}: ${m.error}`));
          else call?.done(m.result);
        });
        worker.on("error", error => {
          fail(error);
          shutdown(`worker ${file}: ${error.message}`, 1);
        });
        worker.on("exit", exitCode => {
          if (exitCode && !finished) shutdown(`worker ${file} exited ${exitCode}`, 1);
        });
      })
  )
);
const runOn = (worker, over) =>
  new Promise((done, fail) => {
    const id = nextId++;
    calls.set(id, { done, fail });
    worker.postMessage({ id, over });
  });
async function evaluate(theta) {
  inflight += pool.length;
  try {
    const over = overridesOf(catalogue, theta);
    const results = await Promise.all(pool.map(({ worker }) => runOn(worker, over)));
    runs += results.length;
    evals++;
    return { ...objective(results, theta, weights), overrides: over };
  } finally {
    inflight -= pool.length;
  }
}

// ---- the held-out map in the real game, checked against the best every 30 s
game = await openGame(testSeed, url);
const tunablesInGame = await registeredTunables(game.page);
const gameLine = (label, theta, over) =>
  checkOverrides(game.page, over).then(
    r => `${label} on game ${testSeed}: ${summary(objective([r], theta, weights).kpi)}`
  );
check = await gameLine("current source", start, overridesOf(catalogue, start));
say(
  `BEGIN budget ${budget} runs, ${chainCount} chains on ${pool.length} maps in parallel; tunables in game: ${tunablesInGame.length}/${Object.keys(RANGES).length}`
);
say(`START ${check}`);
let checking = false;
tick = setInterval(() => {
  if (existsSync(STOP)) {
    stopping = true;
    say("STOP file found: finishing the evaluations in flight");
  }
  say(
    `PROGRESS ${elapsed()} runs ${runs}/${budget} evals ${evals} best ${best ? `${best.loss.toFixed(3)} | model: ${summary(best.kpi)}` : "-"} | ${check}`
  );
  if (!best || checking) return;
  checking = true;
  const { loss, theta, overrides } = best;
  gameLine(`best ${loss.toFixed(3)}`, theta, overrides)
    .then(line => {
      check = line;
    })
    .catch(error => {
      check = `game check failed: ${error.message}`;
    })
    .finally(() => {
      checking = false;
    });
}, 30000);

// ---- the chains
function mulberry(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const evalsPerChain = Math.max(1, Math.floor(budget / pool.length / chainCount));
const rawNames = Object.keys(start.raw),
  madeNames = Object.keys(start.margin),
  paramNames = Object.keys(RANGES);

/** A neighbor: one to three raw values, margins, coverage entries or tunables moved */
function mutate(theta, rand, gauss) {
  const next = structuredClone(theta);
  for (let moves = 1 + Math.floor(rand() * 3); moves > 0; moves--) {
    const kind = rand();
    if (kind < 0.25) {
      const n = rawNames[Math.floor(rand() * rawNames.length)];
      next.raw[n] = Math.min(start.raw[n] * 4, Math.max(start.raw[n] / 4, next.raw[n] * Math.exp(0.2 * gauss())));
    } else if (kind < 0.5) {
      const n = madeNames[Math.floor(rand() * madeNames.length)];
      next.margin[n] = Math.min(15, Math.max(1, next.margin[n] * Math.exp(0.25 * gauss())));
    } else if (kind < 0.85) {
      const i = Math.floor(rand() * next.cov.length);
      next.cov[i][2] = Math.min(2, Math.max(0.02, next.cov[i][2] * Math.exp(0.25 * gauss())));
    } else {
      const n = paramNames[Math.floor(rand() * paramNames.length)];
      const [lo, hi] = RANGES[n];
      next.params[n] = Math.min(hi, Math.max(lo, next.params[n] + (hi - lo) * 0.1 * gauss()));
    }
  }
  return next;
}

async function chain(index) {
  const rand = mulberry(1000 + 7919 * index);
  const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
  let theta = structuredClone(start);
  let current = await evaluate(theta);
  const consider = (t, result) => {
    if (best && result.loss >= best.loss) return;
    best = { ...result, theta: structuredClone(t) };
    save();
  };
  consider(theta, current);
  const T0 = 0.3,
    T1 = 0.005;
  for (let e = 1; e < evalsPerChain && !stopping && runs + inflight + pool.length <= budget; e++) {
    const T = T0 * (T1 / T0) ** (e / evalsPerChain);
    const next = mutate(theta, rand, gauss);
    const candidate = await evaluate(next);
    if (candidate.loss < current.loss || rand() < Math.exp((current.loss - candidate.loss) / T)) {
      theta = next;
      current = candidate;
      consider(theta, current);
    }
  }
}

await Promise.all(Array.from({ length: chainCount }, (_, i) => chain(i)));
try {
  check = await gameLine(`final best ${best.loss.toFixed(3)}`, best.theta, best.overrides);
} catch (error) {
  check = `final game check failed: ${error.message}`;
}
await shutdown(stopping ? "stopped early" : "budget used", 0);
