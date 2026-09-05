import {expect, test, type Page} from "@playwright/test";

// real wheel input on purpose: programmatic setMapZoom dispatches "end" with the frame still
// pending, so it cannot catch a reconcile that never runs after human-paced gestures
const materialized = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("#burgIcons use, #labels [data-label-type]")].map(el => el.id).join(",")
  );

async function wheelZoomIn(page: Page) {
  await page.mouse.move(640, 360);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -240);
  await page.waitForTimeout(800);
}

test.describe("Redraw on zoom option", () => {
  test.beforeEach(async ({page}) => {
    await page.goto("/?seed=zoom-redraw&width=1280&height=720");
    await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 120000});
    await page.waitForTimeout(500);
  });

  test("defaults to redrawing while zooming and reconciles at gesture end", async ({page}) => {
    expect(await page.locator("#viewportRedraw").inputValue()).toBe("settled");
    const before = await materialized(page);
    await wheelZoomIn(page);
    expect(await materialized(page)).not.toBe(before);
  });

  test("after-zoom mode still reconciles once the gesture settles and is remembered", async ({page}) => {
    // the select sits in the collapsed options pane; drive it the way the pane's change listener sees it
    await page.evaluate(() => {
      const select = document.getElementById("viewportRedraw") as HTMLSelectElement;
      select.value = "settled";
      select.dispatchEvent(new Event("change", {bubbles: true}));
    });
    const before = await materialized(page);
    await wheelZoomIn(page);
    expect(await materialized(page)).not.toBe(before);

    expect(await page.evaluate(() => localStorage.getItem("viewportRedraw"))).toBe("settled");
    await page.reload();
    await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 120000});
    expect(await page.locator("#viewportRedraw").inputValue()).toBe("settled");
  });
});
