import { test, expect, Page } from "@playwright/test";

const STORAGE_KEY = "fmg-tour-prompt-count";

async function waitForMapLoad(page: Page) {
  await page.waitForFunction(() => (window as any).mapId !== undefined, {
    timeout: 60000,
  });
  await page.waitForTimeout(500);
}

test.describe("Tour Prompt Button", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto("/?seed=test-tour-prompt&width=1280&height=720");
    await waitForMapLoad(page);
  });

  test("button is visible on first load when counter starts at 0", async ({ page }) => {
    const btn = page.locator("#tourPromptButton");
    await expect(btn).toBeVisible();
  });

  test("button increments the counter on first load", async ({ page }) => {
    const count = await page.evaluate(
      (key: string) => localStorage.getItem(key),
      STORAGE_KEY,
    );
    expect(count).toBe("1");
  });

  test("button is visible on second and third load", async ({ page }) => {
    // Simulate second load by setting count to 1 then reloading.
    await page.evaluate(
      (key: string) => localStorage.setItem(key, "1"),
      STORAGE_KEY,
    );
    await page.reload();
    await waitForMapLoad(page);
    await expect(page.locator("#tourPromptButton")).toBeVisible();

    // Simulate third load.
    await page.evaluate(
      (key: string) => localStorage.setItem(key, "2"),
      STORAGE_KEY,
    );
    await page.reload();
    await waitForMapLoad(page);
    await expect(page.locator("#tourPromptButton")).toBeVisible();
  });

  test("button is hidden when counter is already at 3 or more", async ({ page }) => {
    await page.evaluate(
      (key: string) => localStorage.setItem(key, "3"),
      STORAGE_KEY,
    );
    await page.reload();
    await waitForMapLoad(page);
    await expect(page.locator("#tourPromptButton")).toBeHidden();
  });

  test("clicking the button starts the tour (driver-active class on body)", async ({ page }) => {
    const btn = page.locator("#tourPromptButton");
    await expect(btn).toBeVisible();
    await btn.click();
    await page.waitForSelector(".driver-popover", { state: "visible" });
    await expect(page.locator("body")).toHaveClass(/driver-active/);
  });

  test("clicking the button keeps the button visible", async ({ page }) => {
    const btn = page.locator("#tourPromptButton");
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(btn).toBeVisible();
  });
});
