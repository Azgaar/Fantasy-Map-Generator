import { expect, test, type Page } from "@playwright/test";
import { waitForMap } from "./wait-for-map";

// The Astral view is a presentation mode: entering swaps the Layers tab for the Astral list, applies
// the star chart style and layers, and takes the preset save/remove buttons with it. Leaving restores
// exactly what was there before — list, preset value, layer state and style.

declare const options: { map: { astral: boolean; style: { preset: string } } };
declare const styles: {
  texture: { options: { href: string } };
  borders: { groups: { stateBorders: { attrs: { opacity: number } } } };
  coreRim: { options: { flip: boolean; intensity: number } };
};
declare const Layers: {
  isOn(id: string): boolean;
  state: { order: string[]; active: string[] };
  draw(...ids: string[]): void;
};
declare const pack: import("@/types/PackedGraph").PackedGraph;
declare const grid: import("@/types/GridGraph").GridGraph;
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

/** the mount-family icons, the drawn remnants, and how the drawn ones fall across the classes */
async function remnantStats(page: Page): Promise<{ family: number; total: number; perClass: number }> {
  return page.evaluate(() => {
    const family = pack.relief.filter(
      icon => "type" in icon && ["mount", "mountSnow", "vulcan"].includes(icon.type)
    ).length;
    const total = document.querySelectorAll("#remnants [data-id]").length;
    const perClass = ["blackHole", "pulsar", "neutron"]
      .map(cls => document.querySelectorAll(`#remnants [data-group="${cls}"] [data-id]`).length)
      .reduce((a, b) => a + b, 0);
    return { family, total, perClass };
  });
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
    for (const id of ["coreRim", "texture", "composition", "nebulae", "starDensity", "dustDensity", "systems", "remnants", "states", "markers"])
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
    expect(visiblePresets).toEqual(["astral", "composition", "dustDensity", "empires", "survey", "systems"]);

    // the mode flag and the chart style are on
    expect(await page.evaluate(() => options.map.astral)).toBe(true);
    expect(await page.evaluate(() => options.map.style.preset)).toBe("astral");
    await expect.poll(() => page.evaluate(() => styles.texture.options.href)).toContain("starfield");

    // the default chart draws systems, empires and hyperlanes; dust, composition, nebulae and
    // density stay off by button — each is one click away in the same Astral list
    expect(await page.evaluate(() => Layers.isOn("systems"))).toBe(true);
    expect(await page.evaluate(() => Layers.isOn("states"))).toBe(true);
    expect(await page.evaluate(() => Layers.isOn("routes"))).toBe(true);
    expect(await page.evaluate(() => Layers.isOn("coreRim"))).toBe(false);
    expect(await page.evaluate(() => Layers.isOn("composition"))).toBe(false);
    expect(await page.evaluate(() => Layers.isOn("nebulae"))).toBe(false);
    expect(await page.evaluate(() => Layers.isOn("starDensity"))).toBe(false);
    expect(await page.evaluate(() => Layers.isOn("dustDensity"))).toBe(false);
    expect(await page.evaluate(() => Layers.isOn("remnants"))).toBe(false);
    for (const id of ["texture", "nebulae", "starDensity"])
      await expect(page.locator(layerItem(id))).toBeVisible();

    // a marker per burg, and the hyperlanes really are drawn
    const markers = await page.locator("#systems [data-id]").count();
    const burgs = await page.evaluate(
      () => pack.burgs.filter(burg => burg && burg.i && !burg.removed).length
    );
    expect(markers).toBe(burgs);
    expect(await page.locator("#routes path").count()).toBeGreaterThan(0);
  });

  test("Borders is off on entry and switches the state-matched inner borders", async ({ page }) => {
    await enterAstral(page);
    const halo = page.locator("#statesHalo");

    // off by default, and the shared border path the Standard view draws is faded out in Astral so it
    // cannot compete with the blue hyperlanes
    expect(await page.evaluate(() => Layers.isOn("borders"))).toBe(false);
    expect(await page.evaluate(() => document.getElementById("statesHalo")!.style.display)).toBe("none");
    expect(await page.evaluate(() => styles.borders.groups.stateBorders.attrs.opacity)).toBe(0);
    expect(await page.evaluate(() => getComputedStyle(document.getElementById("stateBorders")!).opacity)).toBe("0");

    // the button brings them on: one path per empire, clipped to itself so only its inner half shows
    await page.locator(layerItem("borders")).click();
    await expect.poll(() => page.evaluate(() => Layers.isOn("borders"))).toBe(true);
    await expect.poll(() => page.evaluate(() => document.getElementById("statesHalo")!.style.display)).not.toBe(
      "none"
    );
    await expect(halo.locator("path").first()).toBeAttached();

    const drawn = await page.evaluate(() =>
      Array.from(document.querySelectorAll<SVGPathElement>("#statesHalo path")).map(path => ({
        stroke: path.getAttribute("stroke"),
        clip: path.getAttribute("clip-path")
      }))
    );
    expect(drawn.length).toBeGreaterThan(1);
    expect(drawn.every(border => /^#[0-9a-f]{6}$/i.test(border.stroke ?? ""))).toBe(true);
    expect(drawn.every(border => border.clip?.startsWith("url(#state-clip"))).toBe(true);
    // neighbouring empires each keep their own colour instead of sharing one unattributable line
    expect(new Set(drawn.map(border => border.stroke)).size).toBeGreaterThan(1);

    // pressing it again takes them away
    await page.locator(layerItem("borders")).click();
    await expect.poll(() => page.evaluate(() => Layers.isOn("borders"))).toBe(false);
    expect(await page.evaluate(() => document.getElementById("statesHalo")!.style.display)).toBe("none");
  });

  test("Dust Density bands the terrain and starts off", async ({ page }) => {
    await enterAstral(page);
    const bands = page.locator("#dustDensity [data-group] path");

    expect(await page.evaluate(() => Layers.isOn("dustDensity"))).toBe(false);
    expect(await bands.count()).toBe(0);

    await page.locator(layerItem("dustDensity")).click();
    await expect.poll(() => page.evaluate(() => Layers.isOn("dustDensity"))).toBe(true);
    await expect(bands.first()).toBeAttached();

    await page.locator(layerItem("dustDensity")).click();
    await expect.poll(() => page.evaluate(() => Layers.isOn("dustDensity"))).toBe(false);
    await expect(bands).toHaveCount(0);
  });

  test("Composition tints the biomes and starts off", async ({ page }) => {
    await enterAstral(page);
    const fills = page.locator("#composition [data-group] path");

    expect(await page.evaluate(() => Layers.isOn("composition"))).toBe(false);
    expect(await fills.count()).toBe(0);

    await page.locator(layerItem("composition")).click();
    await expect.poll(() => page.evaluate(() => Layers.isOn("composition"))).toBe(true);
    await expect(fills.first()).toBeAttached();

    await page.locator(layerItem("composition")).click();
    await expect.poll(() => page.evaluate(() => Layers.isOn("composition"))).toBe(false);
    await expect(fills).toHaveCount(0);
  });

  test("Core–Rim washes from the warm edge, flips, and sits under the dust", async ({ page }) => {
    await enterAstral(page);
    const rect = page.locator("#coreRim rect");

    expect(await page.evaluate(() => Layers.isOn("coreRim"))).toBe(false);
    expect(await rect.count()).toBe(0);

    await page.locator(layerItem("coreRim")).click();
    await expect.poll(() => page.evaluate(() => Layers.isOn("coreRim"))).toBe(true);
    await expect(rect).toBeAttached();

    // the hot stop lands on the warm side of the map, finite coordinates throughout
    const axis = await page.evaluate(() => {
      const gradient = document.querySelector<SVGLinearGradientElement>("#coreRim linearGradient")!;
      const attrs = ["x1", "y1", "x2", "y2"].map(name => gradient.getAttribute(name)!);
      let warmest = 0;
      for (let i = 1; i < grid.cells.temp.length; i++)
        if (grid.cells.temp[i] > grid.cells.temp[warmest]) warmest = i;
      const [wx, wy] = grid.points[warmest];
      const [x1, y1, x2, y2] = attrs.map(Number);
      return {
        attrs,
        hotDistance: Math.hypot(x1 - wx, y1 - wy),
        coldDistance: Math.hypot(x2 - wx, y2 - wy),
        stops: document.querySelectorAll("#coreRim stop").length
      };
    });
    expect(axis.attrs.join()).not.toContain("NaN");
    expect(axis.stops).toBe(3);
    expect(axis.hotDistance).toBeLessThan(axis.coldDistance);

    // flip inverts the axis: the endpoints swap
    await page.evaluate(() => {
      styles.coreRim.options.flip = true;
      Layers.draw("coreRim");
    });
    const flipped = await page.evaluate(() => {
      const gradient = document.querySelector<SVGLinearGradientElement>("#coreRim linearGradient")!;
      return ["x1", "y1", "x2", "y2"].map(name => gradient.getAttribute(name));
    });
    expect(flipped.slice(0, 2)).toEqual(axis.attrs.slice(2));
    expect(flipped.slice(2)).toEqual(axis.attrs.slice(0, 2));
    await page.evaluate(() => {
      styles.coreRim.options.flip = false;
      Layers.draw("coreRim");
    });

    // the wash sits under the dust sheet: coreRim precedes dustDensity in the chart
    await page.locator(layerItem("dustDensity")).click();
    await expect.poll(() => page.evaluate(() => Layers.isOn("dustDensity"))).toBe(true);
    const washUnderDust = await page.evaluate(
      () =>
        (document.querySelector("#coreRim")!.compareDocumentPosition(document.querySelector("#dustDensity")!) &
          Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    );
    expect(washUnderDust).toBe(true);
  });

  test("Remnants mark the mountains, cull to the viewport and share the chart with Anomalies", async ({
    page
  }) => {
    await enterAstral(page);
    const remnants = page.locator("#remnants [data-id]");

    expect(await page.evaluate(() => Layers.isOn("remnants"))).toBe(false);
    expect(await remnants.count()).toBe(0);

    await page.locator(layerItem("remnants")).click();
    await expect.poll(() => page.evaluate(() => Layers.isOn("remnants"))).toBe(true);
    await expect(remnants.first()).toBeAttached();

    // one remnant per mount-family relief icon at the full view, split across the three classes
    const before = await remnantStats(page);
    expect(before.total).toBe(before.family);
    expect(before.perClass).toBe(before.total);

    // zoom culls to the viewport, like the star markers do
    await page.evaluate(() => window.closeDialogs?.()); // the version popup eats the wheel
    await page.mouse.move(640, 360);
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -240);
    await page.waitForTimeout(800);
    const after = await remnantStats(page);
    expect(after.total).toBeLessThan(before.total);

    // Anomalies and Remnants coexist: one being on never empties the other
    await page.locator(layerItem("markers")).click();
    await expect.poll(() => page.evaluate(() => Layers.isOn("markers"))).toBe(true);
    expect(await page.evaluate(() => Layers.isOn("remnants"))).toBe(true);
    expect(await remnants.count()).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.querySelector("#markers")?.childElementCount ?? 0)).toBeGreaterThan(0);
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
    // Sector Dust is off in the default chart; switch it on so the texture-inlining assertion has
    // something to see — the starfield PNG travels inlined as a base64 image
    await page.locator(layerItem("texture")).click();
    const svg = await page.evaluate(async () => {
      const url = await Services.ExportMap.getMapURL("svg");
      return await (await fetch(url)).text();
    });
    // the default chart carries systems and hyperlanes; empty optional layers are not emitted
    expect(svg).toContain('id="systems"');
    expect(svg).toMatch(/data-group="[GFKABM]"/);
    expect(svg).toContain('id="routes"');
    expect(svg).toMatch(/<image[^>]+href="data:image\/png;base64/);
  });
});
