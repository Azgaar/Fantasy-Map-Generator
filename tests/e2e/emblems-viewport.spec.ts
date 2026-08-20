import { expect, test } from "@playwright/test";

// The emblems layer is viewport-rendered: only the emblems the current view covers are materialized as
// <use> elements, and their coats of arms are rendered into <defs> on demand. A full-map export therefore
// cannot rely on the live DOM — it has to materialize and render the whole set into the export clone.

type Win = any;

const emblemState = () =>
  ((window as Win) &&
    {
      uses: document.querySelectorAll("#emblems use[data-i]").length,
      unresolved: Array.from(document.querySelectorAll<SVGUseElement>("#emblems use[data-i]")).filter(
        use => !document.getElementById((use.getAttribute("href") || "#").slice(1))
      ).length
    }) as { uses: number; unresolved: number };

test.describe("emblems viewport rendering", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto("/?seed=emblems-viewport&width=1280&height=720");
    await page.waitForFunction(() => (window as Win).mapId !== undefined, { timeout: 60000 });
    await page.evaluate(() => (window as Win).Layers.show("emblems"));
    // the smaller categories are auto-hidden at scale 1; show them all to exercise the culling
    // `options` is a script-scoped global, not a window property, so it is reached through page script
    await page.evaluate("options.emblems.showAll = true; invokeActiveZooming();");
    await expect.poll(async () => page.evaluate(emblemState), { timeout: 90000 }).toEqual({
      uses: expect.any(Number),
      unresolved: 0
    });
  });

  test("zooming in drops off-screen emblems and zooming out brings them back", async ({ page }) => {
    const full = await page.evaluate(emblemState);
    expect(full.uses).toBeGreaterThan(100);

    await page.evaluate(() => (window as Win).zoomTo(400, 300, 8, 0));
    await expect.poll(async () => (await page.evaluate(emblemState)).unresolved, { timeout: 30000 }).toBe(0);
    const zoomed = await page.evaluate(emblemState);
    expect(zoomed.uses).toBeGreaterThan(0);
    expect(zoomed.uses).toBeLessThan(full.uses);

    await page.evaluate(() => (window as Win).resetZoom(0));
    await expect.poll(async () => (await page.evaluate(emblemState)).uses, { timeout: 30000 }).toBe(full.uses);
    expect((await page.evaluate(emblemState)).unresolved).toBe(0);
  });

  test("full-map export emits every emblem with its definition, even while zoomed in", async ({ page }) => {
    const full = await page.evaluate(emblemState);

    await page.evaluate(() => (window as Win).zoomTo(400, 300, 8, 0));
    await expect.poll(async () => (await page.evaluate(emblemState)).unresolved, { timeout: 30000 }).toBe(0);
    expect((await page.evaluate(emblemState)).uses).toBeLessThan(full.uses);

    const report = await page.evaluate(async () => {
      const url: string = await (window as Win).Services.ExportMap.getMapURL("svg", { fullMap: true });
      const text = await (await fetch(url)).text();
      document.getElementById("fantasyMap")?.remove(); // the exporter leaves its clone in the body
      const exported = new DOMParser().parseFromString(text, "image/svg+xml");
      const uses = Array.from(exported.querySelectorAll("#emblems use"));
      return {
        uses: uses.length,
        missing: uses
          .map(use => use.getAttribute("href") || use.getAttribute("xlink:href"))
          .filter(href => !href || !exported.getElementById(href.slice(1))).length
      };
    });

    expect(report).toEqual({ uses: full.uses, missing: 0 });
  });
});
