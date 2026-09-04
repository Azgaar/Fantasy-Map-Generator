import {expect, test, type Page} from "@playwright/test";

// Slider ranges as the editor shows them for a label group; values stay absolute, only the drag range follows the group
async function openLabelGroup(page: Page, group: string) {
  await page.evaluate(g => (window as any).editStyle("labels", g), group);
  return page.evaluate(() => {
    const range = (id: string) => {
      const input = document.querySelector<HTMLInputElement>(`#${id} input[type=range]`)!;
      return {min: +input.min, max: +input.max, value: +input.value};
    };
    return {
      fontSize: +(document.getElementById("styleFontSize") as HTMLInputElement).value,
      strokeWidth: range("styleStrokeWidthInput"),
      letterSpacing: range("styleLetterSpacingInput")
    };
  });
}

test.describe("Style editor label slider ranges", () => {
  test.beforeEach(async ({page}) => {
    await page.goto("/?seed=test-style-ranges&width=1280&height=720");
    await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 60000});
  });

  test("stroke width and letter spacing ranges follow the group font size", async ({page}) => {
    const river = await openLabelGroup(page, "river");
    expect(river.fontSize).toBeLessThan(5);
    expect(river.strokeWidth.max).toBeCloseTo(river.fontSize / 2, 2);
    expect(river.letterSpacing.max).toBeCloseTo(river.fontSize / 2, 2);
    expect(river.letterSpacing.min).toBeCloseTo(-river.fontSize / 10, 2);

    const state = await openLabelGroup(page, "state");
    expect(state.fontSize).toBeGreaterThan(9);
    expect(state.strokeWidth.max).toBeCloseTo(state.fontSize / 2, 2);
  });

  test("changing the font size refits the ranges", async ({page}) => {
    await openLabelGroup(page, "river");
    await page.fill("#styleFontSize", "10");
    await page.dispatchEvent("#styleFontSize", "change");
    const max = await page.evaluate(
      () => +document.querySelector<HTMLInputElement>("#styleStrokeWidthInput input[type=range]")!.max
    );
    expect(max).toBe(5);
  });

  test("a stored value beyond the fitted range stays reachable", async ({page}) => {
    await page.evaluate(() => {
      (window as any).styles.labels.groups.river.attrs["stroke-width"] = 4;
    });
    const river = await openLabelGroup(page, "river");
    expect(river.strokeWidth.value).toBe(4);
    expect(river.strokeWidth.max).toBeGreaterThanOrEqual(4);
  });

  test("other elements get the default ranges back", async ({page}) => {
    await openLabelGroup(page, "river");
    await page.evaluate(() => (window as any).editStyle("borders"));
    const max = await page.evaluate(
      () => +document.querySelector<HTMLInputElement>("#styleStrokeWidthInput input[type=range]")!.max
    );
    expect(max).toBe(10);
  });
});
