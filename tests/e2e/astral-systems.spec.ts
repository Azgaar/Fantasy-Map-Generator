import { expect, test, type Page } from "@playwright/test";
import { waitForMap } from "./wait-for-map";

// The star markers are a second visual representation of a burg: the tooltip reads them as systems,
// a click opens the System Editor, search reveals them on the systems layer, and zoom culls them to
// the viewport. This spec is the hit-testing parity guard the plan calls for.

declare const styles: { texture: { options: { href: string } } };
declare const Layers: { isOn(id: string): boolean; hide(...ids: string[]): void };
declare const pack: import("@/types/PackedGraph").PackedGraph;
declare const Controllers: { AstralMode: { enter: () => Promise<void> }; Omnibar: { open: () => void } };

/** Enter through the controller and wait until the markers are reconciled into the dom */
async function withSystems(page: Page): Promise<void> {
  await page.evaluate(() => Controllers.AstralMode.enter());
  await expect.poll(() => page.evaluate(() => styles.texture.options.href)).toContain("starfield");
  await expect(page.locator("#systems [data-id]").first()).toBeAttached();
}

async function centerOf(page: Page, selector: string): Promise<{ x: number; y: number }> {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`${selector} has no box`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** A marker whose centre actually resolves to its star (labels can overlap a marker and shadow it) */
async function starPoint(page: Page): Promise<{ x: number; y: number }> {
  const clean = await page.evaluate(() => {
    const markers = Array.from(document.querySelectorAll<SVGGElement>("#systems [data-id]"));
    for (const marker of markers) {
      const box = marker.getBoundingClientRect();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      if (document.elementFromPoint(x, y)?.closest("#systems [data-id]") === marker) return { x, y };
    }
    return null;
  });
  if (!clean) throw new Error("no marker is unobscured by a label");
  return clean;
}

// FMG's version-update changelog opens a dialog over the map centre and eats the wheel: dismiss it
async function dismissChangelog(page: Page): Promise<void> {
  if (await page.locator("#alert").isVisible().catch(() => false))
    await page.evaluate(() => window.closeDialogs?.());
}

const viewScale = (page: Page) =>
  page.evaluate(() => {
    const viewbox = document.getElementById("viewbox") as unknown as SVGGraphicsElement;
    return viewbox.transform.baseVal.consolidate()?.matrix.a ?? 1;
  });

test.describe("Astral systems", () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto("/?seed=astral-systems&width=1280&height=720");
    await waitForMap(page);
    await page.waitForTimeout(300);
  });

  test("the tooltip reads a marker as a system", async ({ page }) => {
    await withSystems(page);
    await page.evaluate(() => Layers.hide("labels")); // state labels can shadow a marker's centre
    const point = await starPoint(page);
    await page.mouse.move(point.x, point.y);
    await page.mouse.move(point.x + 1, point.y); // the handler is debounced: nudge it awake

    const tooltip = page.locator("#tooltip");
    await expect(tooltip).toContainText("-class", { timeout: 5000 });
    await expect(tooltip).toContainText("Click to edit");
  });

  test("clicking a marker opens the System Editor", async ({ page }) => {
    await withSystems(page);
    const point = await centerOf(page, "#system1");
    await page.mouse.click(point.x, point.y);

    await expect(page.locator("#astralSystemEditor")).toBeVisible();
    await page.locator(".ui-dialog:has(#astralSystemEditor) .ui-dialog-titlebar-close").click();
  });

  test("search reveals the burg on the systems layer and outlines the marker", async ({ page }) => {
    await withSystems(page);
    await page.evaluate(() => Layers.hide("systems"));
    const name = await page.evaluate(() => pack.burgs[1].name);

    await page.keyboard.press("Space"); // the plain-Space omnibar hotkey
    if (!(await page.locator("#omnibar-input").count()))
      await page.evaluate(() => Controllers.Omnibar.open()); // focus guards may eat the hotkey
    await expect(page.locator("#omnibar-input")).toBeFocused();
    await page.fill("#omnibar-input", name);
    await expect(page.locator("#omnibar-list [role='option']").first()).toBeVisible();
    await page.keyboard.press("Enter");

    // the mode-aware reveal shows the systems layer, not burgIcons
    await expect.poll(() => page.evaluate(() => Layers.isOn("systems"))).toBe(true);
    expect(await viewScale(page)).toBeGreaterThan(1);
    await expect(page.locator("#debug .highlighted")).toHaveCount(1, { timeout: 5000 });
  });

  test("zoom culls markers to the viewport", async ({ page }) => {
    await withSystems(page);
    await dismissChangelog(page); // the version popup covers the map centre and eats the wheel
    const full = await page.locator("#systems [data-id]").count();
    expect(full).toBeGreaterThan(0);

    await page.mouse.move(640, 360);
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -240);
    await page.waitForTimeout(800);

    // the gesture really zoomed before we judge the culling by its result
    const scale = await viewScale(page);
    expect(scale).toBeGreaterThan(1);
    const zoomed = await page.locator("#systems [data-id]").count();
    expect(zoomed).toBeLessThan(full);
    // what stays on screen is still a working marker
    await expect(page.locator("#systems [data-id] circle.star").first()).toBeAttached();
  });
});
