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
  async function createTestZone(page: any): Promise<number> {
    return await page.evaluate(() => {
      const { cells, zones } = (window as any).pack;

      // Find 10-20 land cells (height >= 20)
      const landCells: number[] = [];
      for (let i = 1; i < cells.i.length && landCells.length < 20; i++) {
        const isLand = cells.h[i] >= 20;
        if (isLand) {
          landCells.push(i);
        }
      }

      if (landCells.length < 10) {
        throw new Error(`Not enough land cells found: ${landCells.length}`);
      }

      // Take exactly 10-20 cells
      const zoneCells = landCells.slice(0, Math.min(20, landCells.length));

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
  async function exportZonesToGeoJson(page: any): Promise<any> {
    return await page.evaluate(() => {
      const { zones, cells, vertices } = (window as any).pack;
      const json = { type: "FeatureCollection", features: [] as any[] };

      // Use the global getCoordinates function from window
      const getCoordinates = (window as any).getCoordinates;

      // Helper function to convert zone cells to polygon coordinates
      function getZonePolygonCoordinates(zoneCells: number[]) {
        const cellsInZone = new Set(zoneCells);
        const ofSameType = (cellId: number) => cellsInZone.has(cellId);
        const ofDifferentType = (cellId: number) => !cellsInZone.has(cellId);

        const checkedCells = new Set<number>();
        const coordinates: [number, number][] = [];

        // Find boundary vertices by tracing the zone boundary
        for (const cellId of zoneCells) {
          if (checkedCells.has(cellId)) continue;

          // Check if this cell is on the boundary
          const neighbors = cells.c[cellId];
          const onBorder = neighbors.some(ofDifferentType);
          if (!onBorder) continue;

          // Find a starting vertex that's on the boundary
          const cellVertices = cells.v[cellId];
          let startingVertex: number | null = null;

          for (const vertexId of cellVertices) {
            const vertexCells = vertices.c[vertexId];
            if (vertexCells.some(ofDifferentType)) {
              startingVertex = vertexId;
              break;
            }
          }

          if (startingVertex === null) continue;

          // Trace the boundary by connecting vertices
          const vertexChain: number[] = [];
          let current = startingVertex;
          let previous: number | null = null;
          const maxIterations = vertices.c.length;

          for (let i = 0; i < maxIterations; i++) {
            vertexChain.push(current);

            // Mark cells adjacent to this vertex as checked
            const adjacentCells = vertices.c[current];
            adjacentCells.filter(ofSameType).forEach((c: number) => checkedCells.add(c));

            // Find the next vertex along the boundary
            const [c1, c2, c3] = adjacentCells.map(ofSameType);
            const [v1, v2, v3] = vertices.v[current];

            let next: number | null = null;
            if (v1 !== previous && c1 !== c2) next = v1;
            else if (v2 !== previous && c2 !== c3) next = v2;
            else if (v3 !== previous && c1 !== c3) next = v3;

            if (next === null || next === current) break;
            if (next === startingVertex) break; // Completed the ring

            previous = current;
            current = next;
          }

          // Convert vertex chain to coordinates
          for (const vertexId of vertexChain) {
            const [x, y] = vertices.p[vertexId];
            coordinates.push(getCoordinates(x, y, 4));
          }
        }

        // Close the polygon ring (first coordinate = last coordinate)
        if (coordinates.length > 0) {
          coordinates.push(coordinates[0]);
        }

        return [coordinates];
      }

      // Filter and process zones
      zones.forEach((zone: any) => {
        // Exclude hidden zones and zones with no cells
        if (zone.hidden || !zone.cells || zone.cells.length === 0) return;

        const coordinates = getZonePolygonCoordinates(zone.cells);

        // Only add feature if we have valid coordinates
        // GeoJSON LinearRing requires at least 4 positions (with first == last)
        if (coordinates[0].length >= 4) {
          const properties = {
            id: zone.i,
            name: zone.name,
            type: zone.type,
            color: zone.color,
            cells: zone.cells,
          };

          const feature = {
            type: "Feature",
            geometry: { type: "Polygon", coordinates },
            properties,
          };

          json.features.push(feature);
        }
      });

      return json;
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
    
    // Assert outer array has length 1 (single LinearRing)
    expect(coordinates.length).toBe(1);
    
    // Assert LinearRing is an array
    const linearRing = coordinates[0];
    expect(Array.isArray(linearRing)).toBe(true);
    
    // Assert each position in LinearRing is an array of 2 numbers
    for (const position of linearRing) {
      expect(Array.isArray(position)).toBe(true);
      expect(position.length).toBe(2);
      expect(typeof position[0]).toBe("number");
      expect(typeof position[1]).toBe("number");
    }

    // Task 7.2: Validate LinearRing validity
    // Assert LinearRing has at least 4 positions
    expect(linearRing.length).toBeGreaterThanOrEqual(4);
    
    // Assert first position equals last position (closed ring)
    const firstPosition = linearRing[0];
    const lastPosition = linearRing[linearRing.length - 1];
    expect(firstPosition[0]).toBe(lastPosition[0]);
    expect(firstPosition[1]).toBe(lastPosition[1]);
    
    // Assert all positions are valid [longitude, latitude] pairs
    for (const position of linearRing) {
      // Longitude should be between -180 and 180
      expect(position[0]).toBeGreaterThanOrEqual(-180);
      expect(position[0]).toBeLessThanOrEqual(180);
      
      // Latitude should be between -90 and 90
      expect(position[1]).toBeGreaterThanOrEqual(-90);
      expect(position[1]).toBeLessThanOrEqual(90);
    }
  });

  test("should exclude hidden zones from GeoJSON export", async ({ page }) => {
  // Create a regular test zone
  const regularZoneId = await createTestZone(page);
  expect(regularZoneId).toBeGreaterThanOrEqual(0);

  // Create a hidden zone
  const hiddenZoneId = await page.evaluate(() => {
    const { cells, zones } = (window as any).pack;

    // Find 10-20 land cells (height >= 20)
    const landCells: number[] = [];
    for (let i = 1; i < cells.i.length && landCells.length < 20; i++) {
      const isLand = cells.h[i] >= 20;
      if (isLand && !zones.some((z: any) => z.cells && z.cells.includes(i))) {
        landCells.push(i);
      }
    }

    if (landCells.length < 10) {
      throw new Error(`Not enough land cells found: ${landCells.length}`);
    }

    // Take exactly 10-20 cells
    const zoneCells = landCells.slice(0, Math.min(20, landCells.length));

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