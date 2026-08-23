import { expect, type Page, test } from "@playwright/test";

async function waitForMapLoad(page: Page) {
  await page.waitForFunction(() => (window as any).mapId !== undefined, { timeout: 60000 });
}

test.describe("toast notifications", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?seed=test-toast&width=1280&height=720");
    await waitForMapLoad(page);
  });

  test("shows a toast with the given message and type", async ({ page }) => {
    await page.evaluate(() => (window as any).toast("Hello there", "success", 0));

    const toast = page.locator("toast-item");
    await expect(toast).toBeVisible();
    await expect(toast).toHaveAttribute("data-type", "success");
    await expect(toast.locator(".toast-message")).toHaveText("Hello there");
  });

  test("stacks new toasts above older ones", async ({ page }) => {
    await page.evaluate(() => (window as any).toast("First", "info", 0));
    await page.evaluate(() => (window as any).toast("Second", "info", 0));
    await page.evaluate(() => (window as any).toast("Third", "info", 0));

    await expect(page.locator("toast-item")).toHaveCount(3);
    await expect(page.locator("toast-item .toast-message")).toHaveText(["Third", "Second", "First"]);
  });

  test("auto-dismisses after its duration", async ({ page }) => {
    await page.evaluate(() => (window as any).toast("Bye soon", "warn", 1000));

    await expect(page.locator("toast-item")).toHaveCount(1);
    await expect(page.locator("toast-item")).toHaveCount(0, { timeout: 3000 });
  });

  test("does not auto-dismiss when duration is 0", async ({ page }) => {
    await page.evaluate(() => (window as any).toast("Sticks around", "error", 0));

    await page.waitForTimeout(2000);
    await expect(page.locator("toast-item")).toHaveCount(1);
  });

  test("dismisses on close button click", async ({ page }) => {
    await page.evaluate(() => (window as any).toast("Dismiss me", "info", 0));

    await page.locator("toast-item .toast-close").click();
    await expect(page.locator("toast-item")).toHaveCount(0);
  });

  test("hovering pauses the auto-dismiss timer", async ({ page }) => {
    await page.evaluate(() => (window as any).toast("Pause me", "info", 1000));

    const toast = page.locator("toast-item");
    await toast.hover();
    // Held well past the original 1s deadline while still hovered.
    await page.waitForTimeout(2000);
    await expect(toast).toHaveCount(1);

    // Moving away resumes the (shortened) remaining timer, so it eventually dismisses.
    await page.mouse.move(0, 0);
    await expect(toast).toHaveCount(0, { timeout: 3000 });
  });
});
