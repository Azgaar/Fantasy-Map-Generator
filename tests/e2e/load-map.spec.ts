import { test, expect, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";

declare const notes: { id: string }[]; // page global, resolved inside page.evaluate
declare const options: {
  labels: { resizeOnZoom: boolean; showAll: boolean; groups: { type: string; mode?: string }[] };
};
declare const style: { relief: { set: string; size: number; density: number } };

const LEGACY_RELIEF_ICONS = [
  { icon: "relief-mount-1", x: 100, y: 100, s: 20 },
  { icon: "relief-hill-1", x: 200, y: 150, s: 10 }
];

// 1.139.4.map has an empty #terrain group, so the legacy layout (icons in the svg, relief style
// in the group attributes, layer hidden by display) has to be re-created to test the migration
function buildLegacyReliefMap(hidden: boolean): Buffer {
  const mapFilePath = path.join(__dirname, "../fixtures/1.139.4.map");
  const mapData = fs.readFileSync(mapFilePath, "utf8").split("\r\n"); // map records are CRLF-delimited

  const icons = LEGACY_RELIEF_ICONS.map(
    ({ icon, x, y, s }) => `<use href="#${icon}" x="${x}" y="${y}" width="${s}" height="${s}"/>`
  ).join("");
  const display = hidden ? ' style="display: none;"' : "";
  const terrain = `<g id="terrain"${display} set="simple" size="2" density="0.5">${icons}</g>`;
  mapData[5] = mapData[5].replace(/<g id="terrain"[^>]*\/>/, terrain);

  return Buffer.from(mapData.join("\r\n"));
}

// legacy maps also hide a layer with the `display` presentation attribute, which inline style cannot
// override. 1.139.4.map has #borders shown, so the attribute-hidden variant has to be re-created
function buildLegacyMapWithAttributeHiddenBorders(): Buffer {
  const mapFilePath = path.join(__dirname, "../fixtures/1.139.4.map");
  const mapData = fs.readFileSync(mapFilePath, "utf8").split("\r\n");

  mapData[5] = mapData[5].replace('<g id="borders" fill="none">', '<g id="borders" fill="none" display="none">');

  return Buffer.from(mapData.join("\r\n"));
}

function buildLegacyMapWithoutLakeShorelines(): Buffer {
  const mapFilePath = path.join(__dirname, "../fixtures/1.139.4.map");
  const mapData = fs.readFileSync(mapFilePath, "utf8").split("\r\n");
  const features = JSON.parse(mapData[12]);

  for (const feature of features) {
    if (feature?.type === "lake") delete feature.shoreline;
  }

  mapData[12] = JSON.stringify(features);
  return Buffer.from(mapData.join("\r\n"));
}

function getReliefState(page: Page) {
  return page.evaluate(() => {
    const terrain = document.getElementById("terrain");
    return {
      relief: (window as any).pack.relief,
      // `style` is script-scoped, so it has to be read off the lexical global rather than off window
      style: style.relief,
      layerIsOn: (window as any).Layers.isOn("relief"),
      terrainStyle: terrain?.getAttribute("style") ?? null
    };
  });
}

test.describe("Map loading", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();

    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Wait for the hidden file input to be available
    await page.waitForSelector("#mapToLoad", { state: "attached" });
  });

  test("should load a saved map file", async ({ page }) => {
    // Track errors during map loading
    const errors: string[] = [];
    page.on("pageerror", error => {
      const message = error?.message || String(error);
      if (message) errors.push(`pageerror: ${message}`);
    });
    page.on("console", msg => {
      if (msg.type() === "error") {
        errors.push(`console.error: ${msg.text()}`);
      }
    });

    // Get the file input element and upload the map file
    const fileInput = page.locator("#mapToLoad");
    const mapFilePath = path.join(__dirname, "../fixtures/1.112.1.map");
    await fileInput.setInputFiles(mapFilePath);

    // Wait for map to be fully loaded
    await page.waitForFunction(() => (window as any).mapId !== undefined, {
      timeout: 120000
    });

    // Additional wait for rendering to settle
    await page.waitForTimeout(500);

    // Verify map data is loaded
    const mapData = await page.evaluate(() => {
      const pack = (window as any).pack;
      return {
        hasStates: pack.states && pack.states.length > 1,
        hasBurgs: pack.burgs && pack.burgs.length > 1,
        hasCells: pack.cells && pack.cells.i && pack.cells.i.length > 0,
        hasRivers: pack.rivers && pack.rivers.length > 0,
        mapId: (window as any).mapId
      };
    });

    expect(mapData.hasStates).toBe(true);
    expect(mapData.hasBurgs).toBe(true);
    expect(mapData.hasCells).toBe(true);
    expect(mapData.hasRivers).toBe(true);
    expect(mapData.mapId).toBeDefined();

    // Ensure no JavaScript errors occurred during loading
    // Filter out expected errors (external resources like Google Analytics, fonts)
    const criticalErrors = errors.filter(
      e =>
        !e.includes("fonts.googleapis.com") &&
        !e.includes("google-analytics") &&
        !e.includes("googletagmanager") &&
        !e.includes("Failed to load resource")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("loaded map should have correct SVG structure", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => {
      const message = error?.message || String(error);
      if (message) errors.push(`pageerror: ${message}`);
    });
    page.on("console", msg => {
      if (msg.type() === "error") {
        errors.push(`console.error: ${msg.text()}`);
      }
    });

    const fileInput = page.locator("#mapToLoad");
    const mapFilePath = path.join(__dirname, "../fixtures/1.112.1.map");
    await fileInput.setInputFiles(mapFilePath);

    await page.waitForFunction(() => (window as any).mapId !== undefined, {
      timeout: 120000
    });
    await page.waitForTimeout(500);

    // Check essential SVG layers exist
    const layers = await page.evaluate(() => {
      return {
        ocean: !!document.getElementById("ocean"),
        lakes: !!document.getElementById("lakes"),
        coastline: !!document.getElementById("coastline"),
        rivers: !!document.getElementById("rivers"),
        borders: !!document.getElementById("borders"),
        burgs: !!document.getElementById("burgIcons"),
        labels: !!document.getElementById("labels")
      };
    });

    expect(layers.ocean).toBe(true);
    expect(layers.lakes).toBe(true);
    expect(layers.coastline).toBe(true);
    expect(layers.rivers).toBe(true);
    expect(layers.borders).toBe(true);
    expect(layers.burgs).toBe(true);
    expect(layers.labels).toBe(true);

    const criticalErrors = errors.filter(
      e =>
        !e.includes("fonts.googleapis.com") &&
        !e.includes("google-analytics") &&
        !e.includes("googletagmanager") &&
        !e.includes("Failed to load resource")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("loaded map should preserve state data", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => {
      const message = error?.message || String(error);
      if (message) errors.push(`pageerror: ${message}`);
    });
    page.on("console", msg => {
      if (msg.type() === "error") {
        errors.push(`console.error: ${msg.text()}`);
      }
    });

    const fileInput = page.locator("#mapToLoad");
    const mapFilePath = path.join(__dirname, "../fixtures/1.112.1.map");
    await fileInput.setInputFiles(mapFilePath);

    await page.waitForFunction(() => (window as any).mapId !== undefined, {
      timeout: 120000
    });
    await page.waitForTimeout(500);

    // Verify states have proper structure
    const statesData = await page.evaluate(() => {
      const pack = (window as any).pack;
      const states = pack.states.filter((s: any) => s.i !== 0); // exclude neutral

      return {
        count: states.length,
        allHaveNames: states.every((s: any) => s.name && s.name.length > 0),
        allHaveCells: states.every((s: any) => s.cells > 0),
        allHaveArea: states.every((s: any) => s.area > 0)
      };
    });

    expect(statesData.count).toBeGreaterThan(0);
    expect(statesData.allHaveNames).toBe(true);
    expect(statesData.allHaveCells).toBe(true);
    expect(statesData.allHaveArea).toBe(true);

    const criticalErrors = errors.filter(
      e =>
        !e.includes("fonts.googleapis.com") &&
        !e.includes("google-analytics") &&
        !e.includes("googletagmanager") &&
        !e.includes("Failed to load resource")
    );
    expect(criticalErrors).toEqual([]);
  });

  // 1.112.1.map stores its ruler in the legacy data[33] string
  test("legacy rulers should migrate to pack.measurers", async ({ page }) => {
    const fileInput = page.locator("#mapToLoad");
    const mapFilePath = path.join(__dirname, "../fixtures/1.112.1.map");
    await fileInput.setInputFiles(mapFilePath);

    await expect(page.locator("#tooltip")).toContainText("Map is successfully loaded", { timeout: 120000 });

    const measurers = await page.evaluate(() => (window as any).pack.measurers);

    expect(measurers).toEqual([
      {
        type: "Ruler",
        points: [
          [417, 206],
          [1097, 158]
        ]
      }
    ]);
  });

  // 1.112.1.map wraps its fogging layer into the pre-1.143 masked #fogging-cont container. Unwrapping it must
  // leave the layer in its own slot — right before the ruler — not at the end of the z-order
  test("legacy fogging container should be unwrapped in place", async ({ page }) => {
    const fileInput = page.locator("#mapToLoad");
    const mapFilePath = path.join(__dirname, "../fixtures/1.112.1.map");
    await fileInput.setInputFiles(mapFilePath);

    await expect(page.locator("#tooltip")).toContainText("Map is successfully loaded", { timeout: 120000 });

    const fogging = await page.evaluate(() => ({
      hasContainer: Boolean(document.getElementById("fogging-cont")),
      parent: document.getElementById("fogging")?.parentElement?.id,
      mask: document.getElementById("fogging")?.getAttribute("mask"),
      order: (window as any).Layers.state.order as string[],
      groups: Array.from(document.querySelectorAll("#viewbox > *"), node => node.id),
      rects: document.querySelectorAll("#fogging rect").length,
      revealed: document.querySelectorAll("#fog path").length
    }));

    expect(fogging.hasContainer).toBe(false);
    expect(fogging.parent).toBe("viewbox");
    expect(fogging.mask).toBe("url(#fog)");
    expect(fogging.order.indexOf("fogging")).toBeLessThan(fogging.order.indexOf("rulers"));
    expect(fogging.groups.indexOf("fogging")).toBeLessThan(fogging.groups.indexOf("ruler"));

    // the layer is permanent, so the old `display: none` no longer hides it: nothing is revealed in this map,
    // so the overlay must be empty or it would dim the whole map
    expect(fogging.revealed).toBe(0);
    expect(fogging.rects).toBe(0);
  });

  // 1.139.4.map keeps its 4 user-added labels as <text> in the legacy #addedLabels SVG group,
  // which the v1.140.0 migration turns into pack.addedLabels entities
  test("legacy added labels should migrate to pack.addedLabels", async ({ page }) => {
    const fileInput = page.locator("#mapToLoad");
    const mapFilePath = path.join(__dirname, "../fixtures/1.139.4.map");
    await fileInput.setInputFiles(mapFilePath);

    await expect(page.locator("#tooltip")).toContainText("Map is successfully loaded", { timeout: 120000 });

    const migrated = await page.evaluate(() => {
      const addedLabels = (window as any).pack.addedLabels;
      return {
        count: addedLabels.length,
        entities: addedLabels.map((added: any) => ({
          hasId: added.i > 0,
          hasPosition: Number.isFinite(added.x) && Number.isFinite(added.y),
          hasText: Boolean(added.label?.text),
          hasGroup: Boolean(added.label?.group),
          hasPath: (added.label?.pathPoints?.length ?? 0) > 0,
          // the anchor must sit on the migrated path, not at the origin
          anchorOnPath: added.label.pathPoints.some(([x, y]: number[]) => x === added.x && y === added.y)
        })),
        // every migrated label is rendered, and along its path
        rendered: addedLabels.map(
          (added: any) => document.getElementById(`addedLabel${added.i}`)?.dataset.labelShape ?? "missing"
        ),
        // legacy notes are re-pointed at the new entity ids. `notes` is script-scoped,
        // so it has to be read off the lexical global rather than off window
        orphanNotes: notes.filter(
          (note: any) =>
            note.id.startsWith("addedLabel") && !addedLabels.some((added: any) => `addedLabel${added.i}` === note.id)
        ).length
      };
    });

    expect(migrated.count).toBe(4);
    for (const entity of migrated.entities) {
      expect(entity).toEqual({
        hasId: true,
        hasPosition: true,
        hasText: true,
        hasGroup: true,
        hasPath: true,
        anchorOnPath: true
      });
    }
    expect(migrated.rendered).toEqual(["path", "path", "path", "path"]);
    expect(migrated.orphanNotes).toBe(0);
  });

  test("legacy lakes without shoreline data should get it on load", async ({ page }) => {
    await page.locator("#mapToLoad").setInputFiles({
      name: "legacy-lakes-without-shorelines.map",
      mimeType: "text/plain",
      buffer: buildLegacyMapWithoutLakeShorelines()
    });
    await expect(page.locator("#tooltip")).toContainText("Map is successfully loaded", { timeout: 120000 });

    const lakeShorelines = await page.evaluate(() =>
      (window as any).pack.features
        .filter((feature: any) => feature?.type === "lake")
        .map((lake: any) => lake.shoreline)
    );

    expect(lakeShorelines.length).toBeGreaterThan(0);
    expect(lakeShorelines.every((shoreline: unknown) => Array.isArray(shoreline) && shoreline.length > 0)).toBe(true);
  });

  test("a layer hidden by the display attribute should migrate as off, not as active and invisible", async ({
    page
  }) => {
    await page.locator("#mapToLoad").setInputFiles({
      name: "legacy-attribute-hidden-borders.map",
      mimeType: "text/plain",
      buffer: buildLegacyMapWithAttributeHiddenBorders()
    });
    await expect(page.locator("#tooltip")).toContainText("Map is successfully loaded", { timeout: 120000 });

    const borders = page.locator("#borders");
    expect(await borders.getAttribute("display")).toBeNull(); // converted to inline style on migration
    expect(await page.evaluate(() => (window as any).Layers.isOn("borders"))).toBe(false);
    await expect(borders).toBeHidden();

    // the layer used to migrate as active while staying invisible, with no way to reveal it
    await page.evaluate(() => (window as any).Layers.show("borders"));
    await expect(borders).toBeVisible();
  });

  // the rose became a declared layer child, which the registry matches by id: an id-less legacy rose
  // would otherwise be left in place and a second one created next to it
  test("the legacy compass rose should be adopted rather than duplicated", async ({ page }) => {
    const mapFilePath = path.join(__dirname, "../fixtures/1.139.4.map");
    await page.locator("#mapToLoad").setInputFiles(mapFilePath);
    await expect(page.locator("#tooltip")).toContainText("Map is successfully loaded", { timeout: 120000 });

    const compass = await page.evaluate(() => {
      const uses = document.querySelectorAll("#compass use");
      return {
        count: uses.length,
        id: uses[0]?.id,
        transform: uses[0]?.getAttribute("transform"),
        layerIsOn: (window as any).Layers.isOn("compass")
      };
    });

    // the fixture carries the rose with a style transform and the layer turned off
    expect(compass).toEqual({
      count: 1,
      id: "compassRose",
      transform: "translate(80 80) scale(0.25)",
      layerIsOn: false
    });
  });

  test("legacy label settings should migrate without changing behavior", async ({ page }) => {
    const mapFilePath = path.join(__dirname, "../fixtures/1.139.4.map");
    const mapData = fs.readFileSync(mapFilePath, "utf8").split(/\r?\n/);
    const settings = mapData[1].split("|");
    const legacyOptions = JSON.parse(settings[19]);
    legacyOptions.stateLabelsMode = "full";
    settings[19] = JSON.stringify(legacyOptions);
    settings[21] = "0"; // automatic label visibility disabled => show all
    settings[23] = "0"; // resize on zoom disabled
    mapData[1] = settings.join("|");

    await page.locator("#mapToLoad").setInputFiles({
      name: "legacy-label-settings.map",
      mimeType: "text/plain",
      buffer: Buffer.from(mapData.join("\r\n"))
    });
    await expect(page.locator("#tooltip")).toContainText("Map is successfully loaded", { timeout: 120000 });

    const migrated = await page.evaluate(() => {
      const labels = options.labels;
      return {
        resizeOnZoom: labels.resizeOnZoom,
        showAll: labels.showAll,
        stateMode: labels.groups.find((group: any) => group.type === "state")?.mode
      };
    });

    expect(migrated).toEqual({ resizeOnZoom: false, showAll: true, stateMode: "full" });
  });

  // v1.142.0 moved relief icons from the #terrain group to pack.relief and renders only the ones
  // in the viewport, so the layer is saved empty and its display carries the layer state
  test("legacy relief icons should migrate to pack.relief keeping the layer on", async ({ page }) => {
    await page.locator("#mapToLoad").setInputFiles({
      name: "legacy-relief.map",
      mimeType: "text/plain",
      buffer: buildLegacyReliefMap(false)
    });
    await expect(page.locator("#tooltip")).toContainText("Map is successfully loaded", { timeout: 120000 });

    expect(await getReliefState(page)).toEqual({
      relief: LEGACY_RELIEF_ICONS,
      style: { set: "simple", size: 2, density: 0.5 },
      layerIsOn: true,
      terrainStyle: null
    });
  });

  test("hidden legacy relief layer should stay off after migration", async ({ page }) => {
    await page.locator("#mapToLoad").setInputFiles({
      name: "hidden-legacy-relief.map",
      mimeType: "text/plain",
      buffer: buildLegacyReliefMap(true)
    });
    await expect(page.locator("#tooltip")).toContainText("Map is successfully loaded", { timeout: 120000 });

    expect(await getReliefState(page)).toEqual({
      relief: LEGACY_RELIEF_ICONS,
      style: { set: "simple", size: 2, density: 0.5 },
      layerIsOn: false,
      terrainStyle: "display: none;"
    });
  });

  test("save data should preserve an active but empty label layer", async ({ page }) => {
    await page.waitForFunction(() => Boolean((window as any).pack?.cells?.i?.length), { timeout: 120000 });

    const savedLayers = await page.evaluate(async () => {
      (window as any).Layers.show("labels");
      document.getElementById("labels")?.replaceChildren();
      const mapData = await (window as any).Services.Save.prepareMapData();
      return JSON.parse(mapData.split("\r\n")[50]);
    });

    expect(savedLayers.active).toContain("labels");
  });

  // 1.143.1.map carries both a pre-v1.104 defs skeleton and layer groups stripped of their styles.
  // The v1.148.0 migration repairs both before the loaded map is rendered.
  test("an old map fixture should get its defs, geometry and layer styles back", async ({ page }) => {
    const mapFilePath = path.join(__dirname, "../fixtures/1.143.1.map");
    await page.locator("#mapToLoad").setInputFiles(mapFilePath);
    await expect(page.locator("#tooltip")).toContainText("Map is successfully loaded", { timeout: 120000 });

    const restored = await page.evaluate(() => {
      const features = (window as any).pack.features.filter((f: any) => f && f.type !== "ocean");
      const hrefs = (selector: string) =>
        Array.from(document.querySelectorAll(`${selector} use`), use => use.getAttribute("href"));
      const resolves = (href: string | null) => Boolean(href && document.querySelector(`#featurePaths ${href}`));

      return {
        featurePaths: document.querySelectorAll("#featurePaths > path").length,
        expected: features.length,
        legacyMaskPaths: document.querySelectorAll("#land path, #water path").length,
        landRefs: hrefs("#land").every(resolves),
        coastlineRefs: hrefs("#coastline").every(resolves),
        coastline: document.querySelectorAll("#coastline use").length,
        lakes: document.querySelectorAll("#lakes use").length,
        defsEmblems: Boolean(document.getElementById("defs-emblems")),
        vignetteMask: Boolean(document.getElementById("vignette-rect")),
        fogging: {
          opacity: document.getElementById("fogging")?.getAttribute("opacity"),
          fill: document.getElementById("fogging")?.getAttribute("fill")
        }
      };
    });

    expect(restored.featurePaths).toBe(restored.expected);
    expect(restored.legacyMaskPaths).toBe(0);
    expect(restored.landRefs).toBe(true);
    expect(restored.coastlineRefs).toBe(true);
    expect(restored.coastline).toBeGreaterThan(0);
    expect(restored.lakes).toBeGreaterThan(0);
    expect(restored.defsEmblems).toBe(true);
    expect(restored.vignetteMask).toBe(true);
    expect(restored.fogging).toEqual({ opacity: "0.98", fill: "#30426f" });
  });

  test("loaded map should preserve burg data", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => {
      const message = error?.message || String(error);
      if (message) errors.push(`pageerror: ${message}`);
    });
    page.on("console", msg => {
      if (msg.type() === "error") {
        errors.push(`console.error: ${msg.text()}`);
      }
    });

    const fileInput = page.locator("#mapToLoad");
    const mapFilePath = path.join(__dirname, "../fixtures/1.112.1.map");
    await fileInput.setInputFiles(mapFilePath);

    await page.waitForFunction(() => (window as any).mapId !== undefined, {
      timeout: 120000
    });
    await page.waitForTimeout(500);

    // Verify burgs have proper structure
    const burgsData = await page.evaluate(() => {
      const pack = (window as any).pack;
      // Filter out placeholder (i=0) and removed burgs (removed=true or no name)
      const activeBurgs = pack.burgs.filter((b: any) => b.i !== 0 && !b.removed && b.name);

      return {
        count: activeBurgs.length,
        allHaveNames: activeBurgs.every((b: any) => b.name && b.name.length > 0),
        allHaveCoords: activeBurgs.every((b: any) => typeof b.x === "number" && typeof b.y === "number"),
        allHaveCells: activeBurgs.every((b: any) => typeof b.cell === "number")
      };
    });

    expect(burgsData.count).toBeGreaterThan(0);
    expect(burgsData.allHaveNames).toBe(true);
    expect(burgsData.allHaveCoords).toBe(true);
    expect(burgsData.allHaveCells).toBe(true);

    const criticalErrors = errors.filter(
      e =>
        !e.includes("fonts.googleapis.com") &&
        !e.includes("google-analytics") &&
        !e.includes("googletagmanager") &&
        !e.includes("Failed to load resource")
    );
    expect(criticalErrors).toEqual([]);
  });
});
