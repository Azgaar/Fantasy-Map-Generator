import { test } from "@playwright/test";

const SEEDS = ["100000000", "200000000"];

interface MapGeneratedDetail {
  totalMs: number;
}

interface PerfStageDetail {
  stage: string;
  ms: number;
}

interface PerfWindow {
  __mapGenerated?: MapGeneratedDetail;
  __perfStages: Record<string, number>;
}

const STAGE_TIME_RE = /^([\w.]+): ([\d.]+) ?ms$/;
const TOTAL_TIME_RE = /^TOTAL: ([\d.]+)s$/;

interface GenerationChecksum {
  hash: string;
  counts: Record<string, number>;
}

function computeChecksum(): GenerationChecksum {
  const { cells, burgs, states, cultures, religions, provinces, rivers, routes } = (window as any).pack;

  let h = 0x811c9dc5;
  const add = (x: number) => {
    h ^= x & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
    h ^= (x >>> 8) & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
  };
  const addArray = (a: ArrayLike<number>) => {
    for (let i = 0; i < a.length; i++) add(a[i]);
  };

  addArray(cells.h);
  addArray(cells.biome);
  addArray(cells.state);
  addArray(cells.burg);
  addArray(cells.culture);
  for (const burg of burgs) {
    if (!burg?.i) continue;
    add(Math.round(burg.x * 100));
    add(Math.round(burg.y * 100));
    add(Math.round(burg.population * 100));
  }

  return {
    hash: h.toString(16),
    counts: {
      cells: cells.i.length,
      burgs: burgs.length - 1,
      states: states.length - 1,
      cultures: cultures.length - 1,
      religions: religions.length - 1,
      provinces: provinces.length - 1,
      rivers: rivers.length,
      routes: routes.length
    }
  };
}

for (const seed of SEEDS) {
  test(`generate map for seed ${seed}`, async ({ page }) => {
    const consoleStageMs: Record<string, number> = {};
    let consoleTotalMs: number | undefined;

    page.on("console", msg => {
      const text = msg.text();
      const stageMatch = text.match(STAGE_TIME_RE);
      if (stageMatch) {
        consoleStageMs[stageMatch[1]] = Number(stageMatch[2]);
        return;
      }
      const totalMatch = text.match(TOTAL_TIME_RE);
      if (totalMatch) consoleTotalMs = Number(totalMatch[1]) * 1000;
    });

    await page.addInitScript(() => {
      const perfWindow = window as unknown as PerfWindow;
      perfWindow.__perfStages = {};
      window.addEventListener("perf:stage", event => {
        const { stage, ms } = (event as CustomEvent<PerfStageDetail>).detail;
        perfWindow.__perfStages[stage] = ms;
      });
      window.addEventListener("map:generated", event => {
        perfWindow.__mapGenerated = (event as CustomEvent<MapGeneratedDetail>).detail;
      });
    });

    await page.goto(`/?seed=${seed}`);
    await page.waitForFunction(() => (window as unknown as PerfWindow).__mapGenerated !== undefined, {
      timeout: 120_000
    });

    const { totalMs, stageMs } = await page.evaluate(() => {
      const perfWindow = window as unknown as PerfWindow;
      return { totalMs: perfWindow.__mapGenerated?.totalMs, stageMs: perfWindow.__perfStages };
    });

    const resolvedStageMs = Object.keys(stageMs).length ? stageMs : consoleStageMs;
    // older code under test may report neither a totalMs event nor a "TOTAL:" console line;
    // fall back to the sum of whatever per-stage timings did come through, so that case still
    // contributes its stage metrics to the comparison instead of being dropped entirely
    const summedStageMs = Object.values(resolvedStageMs).reduce((sum: number, ms) => sum + (ms as number), 0);
    const resolvedTotalMs = totalMs ?? consoleTotalMs ?? (summedStageMs || undefined);

    const checksum = await page.evaluate(computeChecksum);

    const metrics = resolvedTotalMs === undefined ? resolvedStageMs : { total: resolvedTotalMs, ...resolvedStageMs };
    console.log(`PERF_RESULT ${JSON.stringify({ suite: "generation", case: `seed ${seed}`, metrics, checksum })}`);
  });
}
