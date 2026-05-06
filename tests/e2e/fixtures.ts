/**
 * Shared Playwright test instance with an end-frame #map screenshot after each passed test.
 * Skipped on CI (pixel baselines are local-only). See playwright.config.ts expect.toHaveScreenshot.
 * layers.spec.ts uses a shared page and registers its own end-frame hook (see that file).
 */
import type { Page, TestInfo } from "@playwright/test";
import { expect, test as base } from "@playwright/test";

export async function waitForLoadingOverlayGone(page: Page) {
  await page.waitForFunction(() => {
    const loading = document.getElementById("loading");
    if (!loading) return true;
    const opacity = Number.parseFloat(getComputedStyle(loading).opacity || "1");
    return opacity < 0.01;
  }, { timeout: 120000 });
}

export async function waitForMapSvgReady(page: Page) {
  await page.waitForFunction(() => (window as unknown as { mapId?: unknown }).mapId !== undefined, {
    timeout: 120000,
  });
  await page.waitForFunction(() => {
    const ocean = document.getElementById("ocean");
    return ocean != null && ocean.childNodes.length > 0;
  }, { timeout: 120000 });
  await waitForLoadingOverlayGone(page);
  await page.waitForTimeout(500);
}

export function endFrameSnapshotName(testInfo: TestInfo): string {
  const slug = testInfo.titlePath
    .filter((s) => s.length > 0 && !/\.spec\.[tj]s$/i.test(s))
    .join("__")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 200);
  return `end-frame__${slug || "unknown"}.png`;
}

function skipGlobalEndFrameScreenshot(testInfo: TestInfo): boolean {
  const name = testInfo.file.split(/[/\\]/).pop() ?? "";
  return name === "layers.spec.ts";
}

export const test = base;

test.afterEach(async ({ page }, testInfo) => {
  if (process.env.CI) return;
  if (testInfo.status !== "passed") return;
  if (skipGlobalEndFrameScreenshot(testInfo)) return;

  await waitForLoadingOverlayGone(page);
  await page.waitForTimeout(100);
  await expect(page.locator("#map")).toHaveScreenshot(endFrameSnapshotName(testInfo), {
    timeout: 30_000,
  });
});

export { expect };
