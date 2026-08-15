import { expect, test } from "@playwright/test";

// Emblems and ice keep their content when turned off (`keepContent`), which used to be paired with a
// bespoke "draw only when the group is empty" guard in the layer list. The guard is gone, so these
// layers re-render on every show like every other layer — that is what these tests pin down.
test.describe("layers that keep their content", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();

    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto("/?seed=test-seed&width=1280&height=720");
    await page.waitForFunction(() => (window as any).mapId !== undefined, { timeout: 60000 });
    await page.waitForTimeout(500);
  });

  test("emblems render on show and again after a hide/show round trip", async ({ page }) => {
    const emblems = page.locator("#emblems");
    const uses = page.locator("#emblems use");

    // off by default in the political preset, and empty until first shown
    await expect(emblems).toBeHidden();
    await expect(uses).toHaveCount(0);

    await page.evaluate(() => (window as any).Layers.show("emblems"));
    await expect(emblems).toBeVisible();
    await expect(uses.first()).toBeAttached(); // drawEmblems defers its DOM writes to a frame
    const drawn = await uses.count();
    expect(drawn).toBeGreaterThan(0);

    // every emblem resolves to a rendered coat of arms in <defs>
    await expect
      .poll(async () => page.locator("#emblems use[href]").count(), { timeout: 10000 })
      .toBeGreaterThan(0);

    // keepContent: the markup survives the layer being turned off
    await page.evaluate(() => (window as any).Layers.hide("emblems"));
    await expect(emblems).toBeHidden();
    expect(await uses.count()).toBe(drawn);

    // drop one emblem while the layer is off. The old guard skipped the draw whenever the group still
    // held a <use>, so it would leave the gap; a plain redraw fills it back in
    await page.evaluate(() => document.querySelector("#emblems use")?.remove());
    expect(await uses.count()).toBe(drawn - 1);

    await page.evaluate(() => (window as any).Layers.show("emblems"));
    await expect(emblems).toBeVisible();
    await expect.poll(async () => uses.count(), { timeout: 10000 }).toBe(drawn);
  });

  test("ice keeps its polygons when hidden and redraws them on show", async ({ page }) => {
    const ice = page.locator("#ice");
    const polygons = page.locator("#ice polygon");

    await expect(ice).toBeVisible(); // on in the political preset
    const drawn = await polygons.count();
    expect(drawn).toBeGreaterThan(0);

    await page.evaluate(() => (window as any).Layers.hide("ice"));
    await expect(ice).toBeHidden();
    expect(await polygons.count()).toBe(drawn); // keepContent

    await page.evaluate(() => (window as any).Layers.show("ice"));
    await expect(ice).toBeVisible();
    expect(await polygons.count()).toBe(drawn); // redraw is idempotent
  });
});
