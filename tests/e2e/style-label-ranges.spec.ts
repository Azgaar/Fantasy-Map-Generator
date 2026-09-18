import { expect, test, type Page } from "@playwright/test";
import { waitForMap } from "./wait-for-map";

const f = (path: string): string => `#styleForm [data-field="${path}"]`;

// the slider range of a row as the editor shows it; the value stays absolute
async function sliderRange(page: Page, path: string) {
  await page.locator(f(path)).waitFor();
  return page.evaluate(p => {
    const input = document.querySelector<HTMLInputElement>(`#styleForm [data-field="${p}"] input[type=range]`)!;
    return { min: +input.min, max: +input.max, value: +input.value };
  }, path);
}

test.describe("Style editor slider ranges", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?seed=test-style-ranges&width=1280&height=720");
    await waitForMap(page);
  });

  test("a label group's stroke width has its own narrow range", async ({ page }) => {
    await page.evaluate(() => (window as any).Controllers.StyleEditor.open("labels", "river"));
    expect(await sliderRange(page, "attrs.stroke-width")).toMatchObject({ min: 0, max: 2 });
  });

  test("a stored value beyond the range stays reachable", async ({ page }) => {
    await page.evaluate(() => {
      (window as any).styles.labels.groups.river.attrs["stroke-width"] = 4;
      (window as any).Controllers.StyleEditor.open("labels", "river");
    });
    const range = await sliderRange(page, "attrs.stroke-width");
    expect(range.value).toBe(4);
    expect(range.max).toBeGreaterThanOrEqual(4);
  });

  test("other elements get the default stroke range", async ({ page }) => {
    await page.evaluate(() => (window as any).Controllers.StyleEditor.open("borders"));
    expect((await sliderRange(page, "groups.stateBorders.attrs.stroke-width")).max).toBe(10);
  });
});
