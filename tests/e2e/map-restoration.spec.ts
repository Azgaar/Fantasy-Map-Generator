import { expect, type Page, test } from "@playwright/test";
import { waitForMap } from "./wait-for-map";

/** how often the map breaks each integrity rule; a broken id never throws, so it is checked */
function violations(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() =>
    Object.fromEntries((window as any).FMG.MapIntegrity.check().map((v: any) => [v.rule, v.count]))
  );
}

/** the rules broken more often than before */
function worsened(before: Record<string, number>, after: Record<string, number>) {
  return Object.keys(after).filter(rule => after[rule] > (before[rule] ?? 0));
}

/** Edit the heightmap in Risk mode: raise a sea corner to land and sink an inland patch */
function editInRiskMode(page: Page, erosion: boolean) {
  return page.evaluate(async erosion => {
    const w = window as any;
    w.options.app.heightmapEditor.allowErosion = erosion;
    await w.FMG.Controllers.HeightmapEditor.open({ mode: "risk" });
    const { width, height } = w.options.map.graph;
    const { h } = w.grid.cells;
    w.grid.points.forEach(([x, y]: [number, number], i: number) => {
      if (x < width * 0.3 && y < height * 0.3 && h[i] < 20) h[i] = 30;
      if (Math.hypot(x - width * 0.55, y - height * 0.5) < 60 && h[i] >= 20) h[i] = 10;
    });
    document.getElementById("finalizeHeightmap")!.click(); // Risk mode applies the edit synchronously
    return w.pack.cells.i.length;
  }, erosion);
}

test.describe("Risk mode heightmap edit", () => {
  let before: Record<string, number>;
  test.beforeEach(async ({ page }) => {
    await page.goto("/?seed=map-restoration");
    await waitForMap(page);
    before = await violations(page);
  });

  test("keeps the map sound when rivers are generated again", async ({ page }) => {
    await editInRiskMode(page, true);
    expect(worsened(before, await violations(page))).toEqual([]);
  });

  test("keeps the map sound when rivers are restored", async ({ page }) => {
    await editInRiskMode(page, false);
    expect(worsened(before, await violations(page))).toEqual([]);
    await editInRiskMode(page, false); // a second edit restores from an already restored map
    expect(worsened(before, await violations(page))).toEqual([]);
  });

  test("leaves the map as it was, and says so, when the edit cannot be applied", async ({ page }) => {
    const fingerprint = () =>
      page.evaluate(() => {
        const { pack } = window as any;
        return JSON.stringify([pack.cells.i.length, pack.burgs.map((b: any) => b.cell), pack.routes.length]);
      });
    const map = await fingerprint();
    await page.evaluate(() => {
      (window as any).FMG.Production.regenerateEconomy = () => {
        throw new Error("injected");
      };
    });

    await editInRiskMode(page, true);

    expect(await fingerprint()).toBe(map);
    await expect(page.locator("#tooltip")).toContainText("The map is unchanged");
    expect(worsened(before, await violations(page))).toEqual([]);
  });

  test("keeps the course and data of a locked river when rivers are generated again", async ({ page }) => {
    const locked = await page.evaluate(() => {
      const { pack, options, FMG } = window as any;
      const { Rivers } = FMG;
      const { width, height } = options.map.graph;
      const clear = (cell: number) =>
        cell < 0 ||
        Math.hypot(...pack.cells.p[cell].map((v: number, k: number) => v - [width * 0.55, height * 0.5][k])) > 120;
      const river = pack.rivers
        .filter((r: any) => r.cells.every(clear)) // away from the patch the edit sinks
        .reduce((a: any, b: any) => (b.cells.length > a.cells.length ? b : a));
      Rivers.setLocked(river.i, true);
      const points = Rivers.getRiverPoints(river.cells, river.points ?? null);
      return {
        i: river.i,
        name: river.name,
        points: points.map(([x, y]: number[]) => [x, y].map(v => Math.round(v * 100) / 100))
      };
    });

    await editInRiskMode(page, true);

    const river = await page.evaluate(i => {
      const { pack, FMG } = window as any;
      const { Rivers } = FMG;
      const river = pack.rivers.find((r: any) => r.i === i);
      return (
        river && {
          name: river.name,
          lock: river.lock,
          points: Rivers.getRiverPoints(river.cells, river.points ?? null)
        }
      );
    }, locked.i);
    expect(river).toMatchObject({ name: locked.name, lock: true });
    expect(river.points).toEqual(locked.points.slice(0, river.points.length)); // cut only where it now runs into the sea
    expect(worsened(before, await violations(page))).toEqual([]);
  });
});
