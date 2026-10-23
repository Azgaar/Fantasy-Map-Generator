import { expect, test, type Page } from "@playwright/test";
import { waitForMap } from "./wait-for-map";

// The Astral view is a presentation mode: entering swaps the Layers tab for the Astral list, applies
// the star chart style and layers, and takes the preset save/remove buttons with it. Leaving restores
// exactly what was there before — list, preset value, layer state and style.

declare const options: { map: { astral: boolean; style: { preset: string } } };
declare const styles: { texture: { options: { href: string } } };
declare const Layers: { isOn(id: string): boolean; state: { order: string[]; active: string[] } };
declare const pack: import("@/types/PackedGraph").PackedGraph;
declare const Services: { ExportMap: { getMapURL(type: string): Promise<string> } };

const layerItem = (id: string) => `#mapLayers > li[data-layer="${id}"]`;

async function openLayersTab(page: Page): Promise<void> {
  if (await page.locator("#layersContent").isVisible().catch(() => false)) return;
  await page.click("#optionsTrigger");
  await page.click("#layersTab");
  await expect(page.locator("#layersContent")).toBeVisible();
}

/** Enter through the real button and wait for the async preset fetch to land */
async function enterAstral(page: Page): Promise<void> {
  await openLayersTab(page);
  await page.click("#viewAstral");
  await expect(page.locator("#viewAstral")).toHaveClass(/pressed/);
  await expect.poll(() => page.evaluate(() => styles.texture.options.href)).toContain("starfield");
}

test.describe("Astral view mode", () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto("/?seed=astral-mode&width=1280&height=720");
    await waitForMap(page);
    await page.waitForTimeout(300);
  });

  test("entering swaps the layer list and presets, hides save/remove, and draws the chart", async ({ page }) => {
    await openLayersTab(page);

    // standard before: its own layer buttons, no Astral ones
    await expect(page.locator(layerItem("heightmap"))).toBeVisible();
    await expect(page.locator(layerItem("nebulae"))).toHaveCount(0);

    // a layer set that no preset names offers the save button; entering must take it away
    await page.locator("#mapLayers > li.buttonoff").first().click();
    await expect(page.locator("#savePresetButton")).toBeVisible();
    await page.locator("#layersPreset").selectOption("political");
    await expect(page.locator("#savePresetButton")).toBeHidden();

    await page.click("#viewAstral");
    await expect(page.locator("#viewAstral")).toHaveClass(/pressed/);
    await expect(page.locator("#viewStandard")).not.toHaveClass(/pressed/);

    // the Astral list replaces the standard one
    for (const id of ["texture", "nebulae", "starDensity", "systems", "states", "markers"])
      await expect(page.locator(layerItem(id))).toBeVisible();
    for (const id of ["heightmap", "rivers", "religions", "temperature"])
      await expect(page.locator(layerItem(id))).toHaveCount(0);

    // built-in Astral presets only: the save/remove buttons go with the standard list
    await expect(page.locator("#savePresetButton")).toBeHidden();
    await expect(page.locator("#removePresetButton")).toBeHidden();
    await expect(page.locator("#layersPreset")).toHaveValue("astral");
    const visiblePresets = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLOptionElement>("#layersPreset option"))
        .filter(option => !option.hidden && option.value !== "custom")
        .map(option => option.value)
        .sort()
    );
    expect(visiblePresets).toEqual(["astral", "empires", "survey", "systems"]);

    // the mode flag and the chart style are on
    expect(await page.evaluate(() => options.map.astral)).toBe(true);
    expect(await page.evaluate(() => options.map.style.preset)).toBe("astral");
    await expect.poll(() => page.evaluate(() => styles.texture.options.href)).toContain("starfield");

    // the chart is drawn: nebula clouds with filters, density bands and a marker per burg
    await expect(page.locator("#nebulae ellipse").first()).toBeVisible();
    expect(await page.locator("#nebulae defs filter").count()).toBeGreaterThan(0);
    await expect(page.locator("#starDensity [data-group] path").first()).toBeAttached();
    const markers = await page.locator("#systems [data-id]").count();
    const burgs = await page.evaluate(
      () => pack.burgs.filter(burg => burg && burg.i && !burg.removed).length
    );
    expect(markers).toBe(burgs);
  });

  test("leaving restores the previous list, preset, layers and style", async ({ page }) => {
    await openLayersTab(page);
    const before = await page.evaluate(() => ({
      preset: options.map.style.preset,
      href: styles.texture.options.href,
      layersPreset: (document.getElementById("layersPreset") as HTMLSelectElement).value,
      active: [...Layers.state.active].sort()
    }));

    await enterAstral(page);

    await page.click("#viewStandard");
    await expect(page.locator("#viewStandard")).toHaveClass(/pressed/);
    await expect(page.locator("#viewAstral")).not.toHaveClass(/pressed/);
    await expect(page.locator(layerItem("heightmap"))).toBeVisible();
    await expect(page.locator(layerItem("nebulae"))).toHaveCount(0);
    await expect(page.locator("#layersPreset")).toHaveValue(before.layersPreset);

    const after = await page.evaluate(() => ({
      preset: options.map.style.preset,
      href: styles.texture.options.href,
      astral: options.map.astral,
      active: [...Layers.state.active].sort(),
      systemsOn: Layers.isOn("systems"),
      nebulaeOn: Layers.isOn("nebulae"),
      nebulaeHidden: document.getElementById("nebulae")?.style.display === "none"
    }));
    expect(after.preset).toBe(before.preset);
    expect(after.href).toBe(before.href);
    expect(after.astral).toBe(false);
    expect(after.active).toEqual(before.active);
    // the Astral-only layers are back off; restore hides them (the style record already went back)
    expect(after.systemsOn).toBe(false);
    expect(after.nebulaeOn).toBe(false);
    expect(after.nebulaeHidden).toBe(true);
  });

  test("a double click leaves no stale pressed button, and 3D handoffs stay exclusive", async ({ page }) => {
    await openLayersTab(page);
    const href = await page.evaluate(() => styles.texture.options.href);

    // enter and immediately leave: the generation token lets only the latest transition write state
    await page.click("#viewAstral");
    await page.click("#viewStandard");
    await expect(page.locator("#viewStandard")).toHaveClass(/pressed/);
    await expect(page.locator("#viewAstral")).not.toHaveClass(/pressed/);
    await expect.poll(() => page.evaluate(() => options.map.astral)).toBe(false);
    await expect.poll(() => page.evaluate(() => styles.texture.options.href)).toBe(href);

    // Astral and 3D are exclusive both ways: only one button ever reads as pressed
    await page.click("#viewAstral");
    await expect(page.locator("#viewAstral")).toHaveClass(/pressed/);
    await page.click("#viewMesh");
    await expect(page.locator("#viewMesh")).toHaveClass(/pressed/);
    await expect(page.locator("#viewAstral")).not.toHaveClass(/pressed/);
    await expect.poll(() => page.evaluate(() => options.map.astral)).toBe(false);

    await page.click("#viewAstral");
    await expect(page.locator("#viewAstral")).toHaveClass(/pressed/);
    await expect(page.locator("#viewMesh")).not.toHaveClass(/pressed/);
    await expect.poll(() => page.evaluate(() => options.map.astral)).toBe(true);
    expect(await page.locator("#canvas3d").count()).toBe(0); // the 3D view was torn down
  });

  test("export smoke: the exported SVG carries the chart", async ({ page }) => {
    await enterAstral(page);
    const svg = await page.evaluate(async () => {
      const url = await Services.ExportMap.getMapURL("svg");
      return await (await fetch(url)).text();
    });
    expect(svg).toContain('id="nebulae"');
    expect(svg).toContain('id="systems"');
    // the starfield texture travels with the export, inlined as a base64 image
    expect(svg).toMatch(/<image[^>]+href="data:image\/png;base64/);
    expect(svg).toMatch(/data-group="[GFKABM]"/);
  });
});
