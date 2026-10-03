import { expect, test, type Page } from "@playwright/test";
import { waitForMap } from "./wait-for-map";

const MAP_URL = "/?seed=test-seed&width=1280&height=720";

async function loadMap(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(MAP_URL);
  await waitForMap(page);
  await page.waitForTimeout(500);
}

async function openIconPicker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await (window as any).Controllers.IconPicker.open({ current: "", onPick: () => {} });
  });
  await expect(page.locator("#iconPicker")).toHaveCount(1);
}

async function closeIconPicker(page: Page): Promise<void> {
  await page.evaluate(() => {
    const iconPicker = document.getElementById("iconPicker");
    if (iconPicker) (window as any).$(iconPicker).dialog("close");
  });
  await page.waitForFunction(() => !document.getElementById("iconPicker"), { timeout: 5000 });
}

test.describe("Icon picker lifecycle", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await loadMap(page);
  });

  test("creates a fresh dialog on open and removes it on close", async ({ page }) => {
    await openIconPicker(page);

    await page.evaluate(() => {
      (window as any).__firstIconPicker = document.getElementById("iconPicker");
    });

    await closeIconPicker(page);
    await expect(page.locator("#iconPicker")).toHaveCount(0);

    await openIconPicker(page);
    const reused = await page.evaluate(() => {
      return (window as any).__firstIconPicker === document.getElementById("iconPicker");
    });

    expect(reused).toBe(false);
    await closeIconPicker(page);
    await expect(page.locator("#iconPicker")).toHaveCount(0);
  });
});
