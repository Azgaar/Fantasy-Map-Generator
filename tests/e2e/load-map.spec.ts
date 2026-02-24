import { test, expect } from "@playwright/test";
import path from "path";

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
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(`console.error: ${msg.text()}`);
      }
    });

    // Get the file input element and upload the map file
    const fileInput = page.locator("#mapToLoad");
    const mapFilePath = path.join(__dirname, "../fixtures/demo.map");
    await fileInput.setInputFiles(mapFilePath);

    // Wait for map to be fully loaded
    // mapId is set at the very end of map loading in showStatistics()
    await page.waitForFunction(() => (window as any).mapId !== undefined, {
      timeout: 120000,
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
        mapId: (window as any).mapId,
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
      (e) =>
        !e.includes("fonts.googleapis.com") &&
        !e.includes("google-analytics") &&
        !e.includes("googletagmanager") &&
        !e.includes("Failed to load resource")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("loaded map should have correct SVG structure", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(`console.error: ${msg.text()}`);
      }
    });

    const fileInput = page.locator("#mapToLoad");
    const mapFilePath = path.join(__dirname, "../fixtures/demo.map");
    await fileInput.setInputFiles(mapFilePath);

    await page.waitForFunction(() => (window as any).mapId !== undefined, {
      timeout: 120000,
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
        labels: !!document.getElementById("labels"),
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
      (e) =>
        !e.includes("fonts.googleapis.com") &&
        !e.includes("google-analytics") &&
        !e.includes("googletagmanager") &&
        !e.includes("Failed to load resource")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("loaded map should preserve state data", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(`console.error: ${msg.text()}`);
      }
    });

    const fileInput = page.locator("#mapToLoad");
    const mapFilePath = path.join(__dirname, "../fixtures/demo.map");
    await fileInput.setInputFiles(mapFilePath);

    await page.waitForFunction(() => (window as any).mapId !== undefined, {
      timeout: 120000,
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
        allHaveArea: states.every((s: any) => s.area > 0),
      };
    });

    expect(statesData.count).toBeGreaterThan(0);
    expect(statesData.allHaveNames).toBe(true);
    expect(statesData.allHaveCells).toBe(true);
    expect(statesData.allHaveArea).toBe(true);

    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("fonts.googleapis.com") &&
        !e.includes("google-analytics") &&
        !e.includes("googletagmanager") &&
        !e.includes("Failed to load resource")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("loaded map should preserve burg data", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(`console.error: ${msg.text()}`);
      }
    });

    const fileInput = page.locator("#mapToLoad");
    const mapFilePath = path.join(__dirname, "../fixtures/demo.map");
    await fileInput.setInputFiles(mapFilePath);

    await page.waitForFunction(() => (window as any).mapId !== undefined, {
      timeout: 120000,
    });
    await page.waitForTimeout(500);

    // Verify burgs have proper structure
    const burgsData = await page.evaluate(() => {
      const pack = (window as any).pack;
      // Filter out placeholder (i=0) and removed burgs (removed=true or no name)
      const activeBurgs = pack.burgs.filter(
        (b: any) => b.i !== 0 && !b.removed && b.name
      );

      return {
        count: activeBurgs.length,
        allHaveNames: activeBurgs.every(
          (b: any) => b.name && b.name.length > 0
        ),
        allHaveCoords: activeBurgs.every(
          (b: any) => typeof b.x === "number" && typeof b.y === "number"
        ),
        allHaveCells: activeBurgs.every(
          (b: any) => typeof b.cell === "number"
        ),
      };
    });

    expect(burgsData.count).toBeGreaterThan(0);
    expect(burgsData.allHaveNames).toBe(true);
    expect(burgsData.allHaveCoords).toBe(true);
    expect(burgsData.allHaveCells).toBe(true);

    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("fonts.googleapis.com") &&
        !e.includes("google-analytics") &&
        !e.includes("googletagmanager") &&
        !e.includes("Failed to load resource")
    );
    expect(criticalErrors).toEqual([]);
  });
});
