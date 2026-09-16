import { expect, test, type Page } from "@playwright/test";
import { waitForMap } from "./wait-for-map";

const f = (path: string): string => `#styleForm [data-field="${path}"]`;

// Slider ranges as the editor shows them for a label group; values stay absolute, only the drag range follows the group
async function openLabelGroup(page: Page, group: string) {
  await page.evaluate(g => (window as any).Controllers.StyleEditor.open("labels", g), group);
  await page.locator(f("attrs.font-size")).waitFor();
  return page.evaluate(() => {
    const range = (path: string) => {
      const input = document.querySelector<HTMLInputElement>(`#styleForm [data-field="${path}"] input[type=range]`)!;
      return { min: +input.min, max: +input.max, value: +input.value };
    };
    return {
      fontSize: +document.querySelector<HTMLInputElement>('#styleForm [data-field="attrs.font-size"] input[type=number]')!.value,
      strokeWidth: range("attrs.stroke-width"),
      letterSpacing: range("attrs.letter-spacing")
    };
  });
}

test.describe("Style editor label slider ranges", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?seed=test-style-ranges&width=1280&height=720");
    await waitForMap(page);
  });

  test("stroke width and letter spacing ranges follow the group font size", async ({ page }) => {
    const river = await openLabelGroup(page, "river");
    expect(river.fontSize).toBeLessThan(5);
    expect(river.strokeWidth.max).toBeCloseTo(river.fontSize / 2, 2);
    expect(river.letterSpacing.max).toBeCloseTo(river.fontSize / 2, 2);
    expect(river.letterSpacing.min).toBeCloseTo(-river.fontSize / 10, 2);

    const state = await openLabelGroup(page, "state");
    expect(state.fontSize).toBeGreaterThan(9);
    expect(state.strokeWidth.max).toBeCloseTo(state.fontSize / 2, 2);
  });

  test("changing the font size refits the ranges", async ({ page }) => {
    await openLabelGroup(page, "river");
    await page.fill(`${f("attrs.font-size")} input[type=number]`, "10");
    const max = await page.evaluate(
      () => +document.querySelector<HTMLInputElement>('#styleForm [data-field="attrs.stroke-width"] input[type=range]')!.max
    );
    expect(max).toBe(5);
  });

  test("a stored value beyond the fitted range stays reachable", async ({ page }) => {
    await page.evaluate(() => {
      (window as any).styles.labels.groups.river.attrs["stroke-width"] = 4;
    });
    const river = await openLabelGroup(page, "river");
    expect(river.strokeWidth.value).toBe(4);
    expect(river.strokeWidth.max).toBeGreaterThanOrEqual(4);
  });

  test("other elements get the default ranges back", async ({ page }) => {
    await openLabelGroup(page, "river");
    await page.evaluate(() => (window as any).Controllers.StyleEditor.open("borders"));
    await page.locator(f("stateBorders.attrs.stroke-width")).waitFor();
    const max = await page.evaluate(
      () =>
        +document.querySelector<HTMLInputElement>('#styleForm [data-field="stateBorders.attrs.stroke-width"] input[type=range]')!
          .max
    );
    expect(max).toBe(10);
  });
});
