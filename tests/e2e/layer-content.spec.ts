import { expect, test } from "@playwright/test";

// Emblems keep their content when turned off (`keepContent`), which used to be paired with a bespoke
// "draw only when the group is empty" guard in the layer list. The guard is gone, so the layer re-renders
// on every show like every other layer. Ice is the counterpart: it erases and redraws from pack.ice.
test.describe("layer content on hide and show", () => {
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

  test("ice drops its polygons when hidden and redraws them on show", async ({ page }) => {
    const ice = page.locator("#ice");
    const polygons = page.locator("#ice polygon");

    await expect(ice).toBeVisible(); // on in the political preset
    const drawn = await polygons.count();
    expect(drawn).toBeGreaterThan(0);

    await page.evaluate(() => (window as any).Layers.hide("ice"));
    await expect(ice).toBeHidden();
    expect(await polygons.count()).toBe(0); // no keepContent: the shapes are redrawn from pack.ice

    await page.evaluate(() => (window as any).Layers.show("ice"));
    await expect(ice).toBeVisible();
    expect(await polygons.count()).toBe(drawn); // the same shapes come back
  });

  // fogging is permanent, so a preset cannot turn it off. Its content follows the fog mask instead
  test("fogging follows the fog mask and survives a preset change", async ({ page }) => {
    const fogging = page.locator("#fogging");
    const rects = page.locator("#fogging rect");

    expect(await rects.count()).toBe(0); // nothing focused yet

    // reveal an area the way the state focus does: punch a shape out of the fog mask, then redraw
    await page.evaluate((id: string) => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.id = id;
      path.setAttribute("d", "M0,0 L200,0 L200,200 L0,200 Z");
      document.getElementById("fog")!.append(path);
      (window as any).Layers.draw("fogging");
    }, "focusState1");
    await expect(fogging).toBeVisible();
    expect(await rects.count()).toBe(2);

    // the old registry treated fogging as a user layer, so a preset silently hid it for good
    await page.evaluate(() => (window as any).Layers.set(["states", "labels", "rivers"]));
    await expect(fogging).toBeVisible();
    expect(await rects.count()).toBe(2);

    await page.evaluate(() => (window as any).unfog());
    expect(await rects.count()).toBe(0); // no revealed area left: the overlay empties itself
  });
});
