import { test, expect } from "@playwright/test";

// Regression test: temperature must be shown in the scale selected in the Units Editor
// (https://github.com/Azgaar/Fantasy-Map-Generator/issues — burg CSV export and burg
// editor showed Celsius even when Fahrenheit was selected)
test.describe("Temperature units", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();

    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Navigate with seed parameter and wait for full load
    await page.goto("/?seed=test-temperature&width=1280&height=720");

    // Wait for map generation to complete
    await page.waitForFunction(
      () => (window as any).mapId !== undefined,
      { timeout: 60000 }
    );

    // Additional wait for any rendering/animations to settle
    await page.waitForTimeout(500);

    // Select Fahrenheit as in the Units Editor
    await page.evaluate(() => {
      const select = document.getElementById("temperatureScale") as HTMLSelectElement;
      select.value = "°F";
    });
  });

  // Pure conversion math is covered by the unit tests in src/utils/unitUtils.test.ts;
  // the tests below verify the selected scale is respected end-to-end via the UI

  test("burg editor should show temperature in the selected scale", async ({ page }) => {
    await page.evaluate(async () => {
      const burg = (window as any).pack.burgs.find((b: any) => b.i && !b.removed);
      await (window as any).Controllers.BurgEditor.open(burg.i);
    });

    const temperature = await page.locator("#burgTemperature").textContent();
    expect(temperature).toMatch(/^-?[\d.]+°F$/);
  });

  test("burgs CSV export should use the selected scale", async ({ page }) => {
    await page.evaluate(async () => {
      await (window as any).Controllers.BurgsOverview.open();
    });

    const downloadPromise = page.waitForEvent("download");
    await page.click("#burgsExport");
    const download = await downloadPromise;

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const csv = Buffer.concat(chunks).toString("utf8");

    const [header, ...rows] = csv.trim().split("\n");
    const temperatureIndex = header.split(",").indexOf("Temperature");
    expect(temperatureIndex).toBeGreaterThan(-1);

    const dataRows = rows.filter(row => row.trim());
    expect(dataRows.length).toBeGreaterThan(0);
    for (const row of dataRows) {
      const temperature = row.split(",")[temperatureIndex];
      expect(temperature).toMatch(/^-?[\d.]+°F$/);
    }
  });
});
