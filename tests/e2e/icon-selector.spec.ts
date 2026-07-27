import { expect, test, type Page } from "@playwright/test";

const MAP_URL = "/?seed=test-seed&width=1280&height=720";

async function loadMap(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(MAP_URL);
  await page.waitForFunction(() => (window as any).mapId !== undefined, { timeout: 60000 });
  await page.waitForTimeout(500);
}

async function openIconSelector(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await (window as any).Controllers.IconSelector.open("A", () => {});
  });
  await expect(page.locator("#iconSelector")).toHaveCount(1);
}

async function closeIconSelector(page: Page): Promise<void> {
  await page.evaluate(() => {
    const iconSelector = document.getElementById("iconSelector");
    if (iconSelector) (window as any).$(iconSelector).dialog("close");
  });
  await page.waitForFunction(() => !document.getElementById("iconSelector"), { timeout: 5000 });
}

test.describe("Icon selector lifecycle", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await loadMap(page);
  });

  test("creates a fresh dialog on open and removes it on close", async ({ page }) => {
    await openIconSelector(page);

    await page.evaluate(() => {
      (window as any).__firstIconSelector = document.getElementById("iconSelector");
    });

    await closeIconSelector(page);
    await expect(page.locator("#iconSelector")).toHaveCount(0);

    await openIconSelector(page);
    const reused = await page.evaluate(() => {
      return (window as any).__firstIconSelector === document.getElementById("iconSelector");
    });

    expect(reused).toBe(false);
    await closeIconSelector(page);
    await expect(page.locator("#iconSelector")).toHaveCount(0);
  });
});
