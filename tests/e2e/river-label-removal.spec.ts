import { expect, test } from "@playwright/test";

test.describe("removing a river removes its label", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?seed=123456789&width=1280&height=720");
    await page.waitForFunction(() => (window as any).mapId !== undefined, { timeout: 120000 });

    // river labels are zoom-gated, so bring one into view
    await page.evaluate(() => {
      const w = window as any;
      const river = w.pack.rivers.find((r: any) => r.cells?.length && r.name);
      const [x, y] = w.pack.cells.p[river.cells[Math.floor(river.cells.length / 2)]];
      w.zoomTo(x, y, 8, 0);
    });
    await page.waitForFunction(() => document.querySelector("#labels [id^=riverLabel]") !== null, { timeout: 10000 });
  });

  const labelledRiverId = (page: any) =>
    page.evaluate(() => +document.querySelector("#labels [id^=riverLabel]")!.id.replace("riverLabel", ""));

  test("through the river editor", async ({ page }) => {
    const id = await labelledRiverId(page);

    await page.evaluate(riverId => (window as any).Controllers.RiverEditor.open(`river${riverId}`), id);
    await page.click("#riverRemove");
    await page.click('.ui-dialog-buttonpane button:has-text("Remove")');

    await expect(page.locator(`#riverLabel${id}`)).toHaveCount(0);
  });

  test("through remove all rivers", async ({ page }) => {
    await page.evaluate(() => (window as any).Controllers.RiversOverview.open());
    await page.click("#riversRemoveAll");
    await page.click('.ui-dialog-buttonpane button:has-text("Remove")');

    await expect(page.locator("#labels [id^=riverLabel]")).toHaveCount(0);
  });
});
