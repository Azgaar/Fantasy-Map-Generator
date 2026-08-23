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

for (const seed of SEEDS) {
  test(`generate map for seed ${seed}`, async ({ page }) => {
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

    if (totalMs === undefined) throw new Error(`generation for seed ${seed} never reported a totalMs`);

    console.log(`PERF_RESULT ${JSON.stringify({ suite: "generation", case: `seed ${seed}`, metrics: { total: totalMs, ...stageMs } })}`);
  });
}
