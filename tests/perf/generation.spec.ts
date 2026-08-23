import { test } from "@playwright/test";

const SEEDS = ["100000000", "200000000"];

const STAGE_TIME_RE = /^([\w.]+): ([\d.]+) ?ms$/;
const TOTAL_TIME_RE = /^TOTAL: ([\d.]+)s$/;

for (const seed of SEEDS) {
  test(`generate map for seed ${seed}`, async ({ page }) => {
    const stageMs: Record<string, number> = {};
    let totalMs: number | undefined;

    page.on("console", msg => {
      const text = msg.text();
      const stageMatch = text.match(STAGE_TIME_RE);
      if (stageMatch) {
        stageMs[stageMatch[1]] = Number(stageMatch[2]);
        return;
      }
      const totalMatch = text.match(TOTAL_TIME_RE);
      if (totalMatch) totalMs = Number(totalMatch[1]) * 1000;
    });

    await page.addInitScript(() => {
      window.addEventListener("map:generated", event => {
        (window as unknown as { __mapGenerated: unknown }).__mapGenerated = (event as CustomEvent).detail;
      });
    });

    await page.goto(`/?seed=${seed}`);
    await page.waitForFunction(() => (window as unknown as { __mapGenerated?: unknown }).__mapGenerated !== undefined, {
      timeout: 120_000
    });

    if (totalMs === undefined) throw new Error(`generation for seed ${seed} never logged a TOTAL time`);

    console.log(`PERF_RESULT ${JSON.stringify({ suite: "generation", case: `seed ${seed}`, metrics: { total: totalMs, ...stageMs } })}`);
  });
}
