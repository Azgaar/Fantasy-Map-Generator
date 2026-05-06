import { expect, test } from "./fixtures";

test.describe("Journey layer", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();

    await page.goto("");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto("?seed=test-seed&width=1280&height=720");

    await page.waitForFunction(() => (window as unknown as { mapId?: unknown }).mapId !== undefined, {
      timeout: 60000,
    });

    await page.waitForTimeout(500);
  });

  test("toggleJourney shows and hides the #journeys SVG group", async ({ page }) => {
    await page.evaluate(() => (window as unknown as { showOptions: () => void }).showOptions());

    let disp = await page.evaluate(() => getComputedStyle(document.getElementById("journeys")!).display);
    expect(disp).toBe("none");

    await page.locator("#toggleJourney").click();
    await page.waitForTimeout(600);
    disp = await page.evaluate(() => getComputedStyle(document.getElementById("journeys")!).display);
    expect(disp).not.toBe("none");

    await page.locator("#toggleJourney").click();
    await page.waitForTimeout(600);
    disp = await page.evaluate(() => getComputedStyle(document.getElementById("journeys")!).display);
    expect(disp).toBe("none");
  });

  test("drawJourney renders paths and vertices for journey data", async ({ page }) => {
    await page.evaluate(() => {
      const w = window as unknown as {
        layerIsOn: (id: string) => boolean;
        toggleJourney: () => void;
        pack: { journey: { points: [number, number][] } };
        drawJourney: () => void;
      };
      if (!w.layerIsOn("toggleJourney")) w.toggleJourney();
      w.pack.journey = {
        points: [
          [400, 300],
          [700, 450],
          [400, 300],
        ],
      };
      w.drawJourney();
    });

    await expect(page.locator("#journeys .journey-strokes path")).toHaveCount(2);
    await expect(page.locator("#journeys .journey-vertices circle")).toHaveCount(2);
  });

  test("journey editor opens from Tools add Journey", async ({ page }) => {
    await page.evaluate(() => (window as unknown as { showOptions: () => void }).showOptions());
    await page.locator("#toolsTab").click();
    await page.locator("#addJourney").click();
    await expect(page.locator("#journeyEditor")).toBeVisible();

    await page.evaluate(() => {
      const $ = (window as unknown as { $: (sel: string) => { dialog: (a: string) => void } }).$;
      $("#journeyEditor").dialog("close");
    });
  });
});
