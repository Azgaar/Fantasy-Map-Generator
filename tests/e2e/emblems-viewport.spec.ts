import { expect, test } from "@playwright/test";

// The emblems layer is viewport-rendered: only the emblems the current view covers are materialized as
// <use> elements, and their coats of arms are rendered into <defs> on demand. A full-map export therefore
// cannot rely on the live DOM — it has to materialize and render the whole set into the export clone.

type Win = any;

const countUses = () => document.querySelectorAll("#emblems use[data-i]").length;
const countStateUses = () => document.querySelectorAll("#stateEmblems > use").length;

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
    await expect.poll(async () => page.evaluate(countStateUses), { timeout: 30000 }).toBeGreaterThan(0);
  });

  test("zooming in drops off-screen emblems and zooming out brings them back", async ({ page }) => {
    // `options` is a script-scoped global, not a window property, so it is reached through page script.
    // Showing all categories puts every emblem in the scene; only the <use> elements are counted here,
    // so the test does not wait on the (asynchronous) coat of arms rendering.
    await page.evaluate("options.emblems.showAll = true; invokeActiveZooming();");
    const full = await page.evaluate(countUses);
    expect(full).toBeGreaterThan(100);

    await page.evaluate(() => (window as Win).zoomTo(400, 300, 8, 0));
    await expect.poll(async () => page.evaluate(countUses), { timeout: 15000 }).toBeLessThan(full);
    expect(await page.evaluate(countUses)).toBeGreaterThan(0);

    await page.evaluate(() => (window as Win).resetZoom(0));
    await expect.poll(async () => page.evaluate(countUses), { timeout: 15000 }).toBe(full);
  });

  test("full-map export emits every emblem with its definition, even while zoomed in", async ({ page }) => {
    const allStates = await page.evaluate(countStateUses);

    await page.evaluate(() => (window as Win).zoomTo(200, 150, 4, 0));
    await expect.poll(async () => page.evaluate(countStateUses), { timeout: 15000 }).toBeLessThan(allStates);

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

    expect(report).toEqual({ uses: allStates, missing: 0 });
  });

  test("keeps a hidden emblem's zero size when it is reselected in the editor", async ({ page }) => {
    await page.evaluate(() => (window as Win).Controllers.EmblemsEditor.openDefault());
    await expect(page.locator("#emblemEditor")).toBeVisible();

    const states = page.locator("#emblemStates");
    const first = await states.inputValue();
    const values = await states.locator("option").evaluateAll(options =>
      options.map(option => (option as HTMLOptionElement).value)
    );
    const second = values.find(value => value !== "0" && value !== first);
    if (!second) throw new Error("The generated map has fewer than two states");

    await page.locator("#emblemSizeNumber").fill("0");
    await states.selectOption(second);
    await states.selectOption(first);

    await expect(page.locator("#emblemSizeNumber")).toHaveValue("0");
    await expect(page.locator(`#stateEmblems > use[data-i="${first}"]`)).toHaveCount(0);
  });
});
