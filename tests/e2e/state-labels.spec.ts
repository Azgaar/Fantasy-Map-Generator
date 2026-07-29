import { expect, test } from "@playwright/test";

test("auto-fitted state labels retain full names and readable sizes", async ({ page }) => {
  await page.goto("/?seed=test-seed&width=1280&height=720");
  await page.waitForFunction(() => (window as typeof window & { mapId?: number }).mapId !== undefined, {
    timeout: 60000
  });

  const labels = await page.locator("#labels > #states > text > textPath").evaluateAll(textPaths =>
    textPaths.map(textPath => ({
      lines: textPath.querySelectorAll("tspan").length,
      fontSize: Number.parseFloat(textPath.getAttribute("font-size") || "")
    }))
  );

  expect(labels).toHaveLength(17);
  expect(labels.filter(label => label.lines > 1)).toHaveLength(13);
  expect(labels.filter(label => label.fontSize === 50)).toHaveLength(2);
});
