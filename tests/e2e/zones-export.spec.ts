import { test, expect } from "@playwright/test";

test.describe("Zone Export", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();

    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Navigate with seed parameter and wait for full load
    await page.goto("/?seed=test-zones-export&width=1280&height=720");

    // Wait for map generation to complete
    await page.waitForFunction(
      () => (window as any).mapId !== undefined,
      { timeout: 60000 }
    );

    // Additional wait for any rendering/animations to settle
    await page.waitForTimeout(500);
  });

  // Helper function to create a test zone programmatically
  // Uses BFS to select a contiguous set of land cells for stable, representative testing
  async function createTestZone(page: any): Promise<number> {
    return await page.evaluate(() => {
      const { cells, zones } = (window as any).pack;

      // Find a starting land cell (height >= 20)
      const totalCells = cells.i.length;
      let startCell = -1;
      for (let i = 1; i < totalCells; i++) {
        if (cells.h[i] >= 20) {
          startCell = i;
          break;
        }
      }

      if (startCell === -1) {
        throw new Error("No land cells found to create a test zone");
      }

      // Use BFS to select a contiguous set of 10-20 land cells
      const zoneCells: number[] = [];
      const visited = new Set<number>();
      const queue: number[] = [];
      
      visited.add(startCell);
      queue.push(startCell);

      while (queue.length > 0 && zoneCells.length < 20) {
        const current = queue.shift() as number;
        
        // Only include land cells in the zone
        if (cells.h[current] >= 20) {
          zoneCells.push(current);
        }

        // Explore neighbors
        const neighbors: number[] = cells.c[current] || [];
        for (const neighbor of neighbors) {
          if (neighbor && !visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      if (zoneCells.length < 10) {
        throw new Error(`Not enough contiguous land cells found: ${zoneCells.length}`);
      }

      // Generate unique zone ID
      const zoneId = zones.length;

      // Create zone object
      const zone = {
        i: zoneId,
        name: "Test Export Zone",
        type: "Test",
        color: "#FF0000",
        cells: zoneCells,
      };

      // Add zone to pack.zones array
      zones.push(zone);

      return zoneId;
    });
  }

  // Helper function to export zones to GeoJSON without file download
  // This calls the production code from public/modules/io/export.js
  async function exportZonesToGeoJson(page: any): Promise<any> {
    return await page.evaluate(() => {
      // Mock downloadFile to capture the JSON instead of downloading
      const originalDownloadFile = (window as any).downloadFile;
      let capturedJson: any = null;

      (window as any).downloadFile = (data: string) => {
        capturedJson = JSON.parse(data);
      };

      // Call the production code
      (window as any).saveGeoJsonZones();

      // Restore original downloadFile
      (window as any).downloadFile = originalDownloadFile;

      return capturedJson;
    });
  }

  test("should export zone with valid GeoJSON root structure", async ({ page }) => {
    // Create a test zone
    const zoneId = await createTestZone(page);
    expect(zoneId).toBeGreaterThanOrEqual(0);

    // Export zones to GeoJSON
    const geoJson = await exportZonesToGeoJson(page);

    // Validate root GeoJSON structure (Task 5.1)
    expect(geoJson).toBeDefined();
    expect(geoJson).toHaveProperty("type");
    expect(geoJson.type).toBe("FeatureCollection");
    
    expect(geoJson).toHaveProperty("features");
    expect(Array.isArray(geoJson.features)).toBe(true);
    expect(geoJson.features.length).toBeGreaterThan(0);

    // Verify the test zone is in the export
    const testZoneFeature = geoJson.features.find((f: any) => f.properties.id === zoneId);
    expect(testZoneFeature).toBeDefined();
    expect(testZoneFeature.properties.name).toBe("Test Export Zone");

    // Validate Feature structure (Task 5.2)
    expect(testZoneFeature).toHaveProperty("type");
    expect(testZoneFeature.type).toBe("Feature");

    expect(testZoneFeature).toHaveProperty("geometry");
    expect(testZoneFeature.geometry).toBeDefined();
    expect(typeof testZoneFeature.geometry).toBe("object");

    expect(testZoneFeature.geometry).toHaveProperty("type");
    // Note: Geometry type can be "Polygon" (single component) or "MultiPolygon" (multiple disconnected components)
    // For this test with contiguous BFS-selected cells, we expect "Polygon"
    expect(testZoneFeature.geometry.type).toBe("Polygon");

    expect(testZoneFeature.geometry).toHaveProperty("coordinates");
    expect(Array.isArray(testZoneFeature.geometry.coordinates)).toBe(true);

    expect(testZoneFeature).toHaveProperty("properties");
    expect(testZoneFeature.properties).toBeDefined();
    expect(typeof testZoneFeature.properties).toBe("object");

    // Task 6.1: Validate zone property mapping
    // Get the test zone from pack.zones in browser context
    const testZone = await page.evaluate((id: number) => {
      const { zones } = (window as any).pack;
      return zones.find((z: any) => z.i === id);
    }, zoneId);

    expect(testZone).toBeDefined();

    // Assert feature.properties match zone properties
    expect(testZoneFeature.properties.id).toBe(testZone.i);
    expect(testZoneFeature.properties.name).toBe(testZone.name);
    expect(testZoneFeature.properties.type).toBe(testZone.type);
    expect(testZoneFeature.properties.color).toBe(testZone.color);
    expect(testZoneFeature.properties.cells).toEqual(testZone.cells);

    // Task 7.1: Validate coordinate array structure
    const { coordinates } = testZoneFeature.geometry;
    
    // Assert geometry.coordinates is an array
    expect(Array.isArray(coordinates)).toBe(true);
    
    // Assert coordinates array is not empty
    expect(coordinates.length).toBeGreaterThan(0);
    
    // Validate each LinearRing in the coordinates array
    // Note: Zones can have multiple rings (holes) or be MultiPolygon (disconnected components)
    for (const linearRing of coordinates) {
      // Assert LinearRing is an array
      expect(Array.isArray(linearRing)).toBe(true);
      
      // Task 7.2: Validate LinearRing validity
      // Assert LinearRing has at least 4 positions
      expect(linearRing.length).toBeGreaterThanOrEqual(4);
      
      // Assert first position equals last position (closed ring)
      const firstPosition = linearRing[0];
      const lastPosition = linearRing[linearRing.length - 1];
      expect(firstPosition[0]).toBe(lastPosition[0]);
      expect(firstPosition[1]).toBe(lastPosition[1]);
      
      // Assert each position in LinearRing is an array of 2 numbers
      for (const position of linearRing) {
        expect(Array.isArray(position)).toBe(true);
        expect(position.length).toBe(2);
        expect(typeof position[0]).toBe("number");
        expect(typeof position[1]).toBe("number");
        
        // Assert all positions are valid [longitude, latitude] pairs
        // Longitude should be between -180 and 180
        expect(position[0]).toBeGreaterThanOrEqual(-180);
        expect(position[0]).toBeLessThanOrEqual(180);
        
        // Latitude should be between -90 and 90
        expect(position[1]).toBeGreaterThanOrEqual(-90);
        expect(position[1]).toBeLessThanOrEqual(90);
      }
    }
  });

  test("should exclude hidden zones from GeoJSON export", async ({ page }) => {
  // Create a regular test zone
  const regularZoneId = await createTestZone(page);
  expect(regularZoneId).toBeGreaterThanOrEqual(0);

  // Create a hidden zone
  const hiddenZoneId = await page.evaluate(() => {
    const { cells, zones } = (window as any).pack;

    // Find a starting land cell that's not already in a zone
    const totalCells = cells.i.length;
    let startCell = -1;
    for (let i = 1; i < totalCells; i++) {
      const isLand = cells.h[i] >= 20;
      const notInZone = !zones.some((z: any) => z.cells && z.cells.includes(i));
      if (isLand && notInZone) {
        startCell = i;
        break;
      }
    }

    if (startCell === -1) {
      throw new Error("No available land cells found for hidden zone");
    }

    // Use BFS to select a contiguous set of 10-20 land cells
    const zoneCells: number[] = [];
    const visited = new Set<number>();
    const queue: number[] = [];
    
    visited.add(startCell);
    queue.push(startCell);

    while (queue.length > 0 && zoneCells.length < 20) {
      const current = queue.shift() as number;
      
      // Only include land cells not already in a zone
      const isLand = cells.h[current] >= 20;
      const notInZone = !zones.some((z: any) => z.cells && z.cells.includes(current));
      if (isLand && notInZone) {
        zoneCells.push(current);
      }

      // Explore neighbors
      const neighbors: number[] = cells.c[current] || [];
      for (const neighbor of neighbors) {
        if (neighbor && !visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    if (zoneCells.length < 10) {
      throw new Error(`Not enough contiguous land cells found: ${zoneCells.length}`);
    }

    // Generate unique zone ID
    const zoneId = zones.length;

    // Create hidden zone object
    const zone = {
      i: zoneId,
      name: "Hidden Test Zone",
      type: "Test",
      color: "#00FF00",
      cells: zoneCells,
      hidden: true, // Mark as hidden
    };

    // Add zone to pack.zones array
    zones.push(zone);

    return zoneId;
  });
  expect(hiddenZoneId).toBeGreaterThanOrEqual(0);

  // Export zones to GeoJSON
  const geoJson = await exportZonesToGeoJson(page);

  // Validate that the regular zone is in the export
  const regularZoneFeature = geoJson.features.find((f: any) => f.properties.id === regularZoneId);
  expect(regularZoneFeature).toBeDefined();
  expect(regularZoneFeature.properties.name).toBe("Test Export Zone");

  // Validate that the hidden zone is NOT in the export
  const hiddenZoneFeature = geoJson.features.find((f: any) => f.properties.id === hiddenZoneId);
  expect(hiddenZoneFeature).toBeUndefined();
  });

  test("should exclude zones with empty cells array from GeoJSON export", async ({ page }) => {
  // Create a regular test zone
  const regularZoneId = await createTestZone(page);
  expect(regularZoneId).toBeGreaterThanOrEqual(0);

  // Create a zone with empty cells array
  const emptyZoneId = await page.evaluate(() => {
    const { zones } = (window as any).pack;

    // Generate unique zone ID
    const zoneId = zones.length;

    // Create zone object with empty cells array
    const zone = {
      i: zoneId,
      name: "Empty Test Zone",
      type: "Test",
      color: "#0000FF",
      cells: [], // Empty cells array
    };

    // Add zone to pack.zones array
    zones.push(zone);

    return zoneId;
  });
  expect(emptyZoneId).toBeGreaterThanOrEqual(0);

  // Export zones to GeoJSON
  const geoJson = await exportZonesToGeoJson(page);

  // Validate that the regular zone is in the export
  const regularZoneFeature = geoJson.features.find((f: any) => f.properties.id === regularZoneId);
  expect(regularZoneFeature).toBeDefined();
  expect(regularZoneFeature.properties.name).toBe("Test Export Zone");

  // Validate that the empty zone is NOT in the export
  const emptyZoneFeature = geoJson.features.find((f: any) => f.properties.id === emptyZoneId);
  expect(emptyZoneFeature).toBeUndefined();
  });
});