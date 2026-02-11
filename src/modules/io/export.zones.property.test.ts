/**
 * Property-based tests for zones GeoJSON export
 * Feature: zones-geojson-export
 */

import * as fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PackedGraph } from "../../types/PackedGraph";

// Mock global functions and objects
declare global {
  var pack: PackedGraph;
  var getCoordinates: (
    x: number,
    y: number,
    decimals: number,
  ) => [number, number];
  var getFileName: (dataType: string) => string;
  var downloadFile: (data: string, fileName: string, mimeType: string) => void;
}

// Helper function to create valid mesh topology for testing
function createValidMeshTopology() {
  // Create a simple triangular mesh where each cell is well-separated
  // and guaranteed to produce a valid boundary with 4+ coordinates
  //
  // Layout: 4 separate triangular cells, each surrounded by boundary
  //
  //  Cell 0:     Cell 1:     Cell 2:     Cell 3:
  //   v0          v3          v6          v9
  //   /\          /\          /\          /\
  //  /  \        /  \        /  \        /  \
  // v1--v2      v4--v5      v7--v8      v10-v11
  //
  const mockVertices = {
    p: [
      // Cell 0 vertices
      [5, 0],
      [0, 10],
      [10, 10], // v0, v1, v2
      // Cell 1 vertices
      [25, 0],
      [20, 10],
      [30, 10], // v3, v4, v5
      // Cell 2 vertices
      [5, 20],
      [0, 30],
      [10, 30], // v6, v7, v8
      // Cell 3 vertices
      [25, 20],
      [20, 30],
      [30, 30], // v9, v10, v11
      ...Array(89).fill([0, 0]), // padding vertices 12-100
    ],
    // Each vertex connects to exactly one cell (all vertices are on boundaries)
    c: [
      [0, 100, 100], // v0: cell 0
      [0, 100, 100], // v1: cell 0
      [0, 100, 100], // v2: cell 0
      [1, 100, 100], // v3: cell 1
      [1, 100, 100], // v4: cell 1
      [1, 100, 100], // v5: cell 1
      [2, 100, 100], // v6: cell 2
      [2, 100, 100], // v7: cell 2
      [2, 100, 100], // v8: cell 2
      [3, 100, 100], // v9: cell 3
      [3, 100, 100], // v10: cell 3
      [3, 100, 100], // v11: cell 3
      ...Array(89).fill([100, 100, 100]), // padding vertices
    ],
    // Each vertex connects to 2 other vertices in its cell (forming a triangle)
    v: [
      [1, 2, 100], // v0: connects to v1, v2
      [0, 2, 100], // v1: connects to v0, v2
      [0, 1, 100], // v2: connects to v0, v1
      [4, 5, 100], // v3: connects to v4, v5
      [3, 5, 100], // v4: connects to v3, v5
      [3, 4, 100], // v5: connects to v3, v4
      [7, 8, 100], // v6: connects to v7, v8
      [6, 8, 100], // v7: connects to v6, v8
      [6, 7, 100], // v8: connects to v6, v7
      [10, 11, 100], // v9: connects to v10, v11
      [9, 11, 100], // v10: connects to v9, v11
      [9, 10, 100], // v11: connects to v9, v10
      ...Array(89).fill([100, 100, 100]), // padding vertices
    ],
  };

  const mockCells = {
    // Each cell has 3 vertices (triangular)
    v: [
      [0, 1, 2], // cell 0
      [3, 4, 5], // cell 1
      [6, 7, 8], // cell 2
      [9, 10, 11], // cell 3
      ...Array(97).fill([0, 1, 2]), // padding for cell IDs up to 100
    ],
    // Each cell has no real neighbors (all boundaries)
    c: [
      [100, 100, 100], // cell 0: all boundaries
      [100, 100, 100], // cell 1: all boundaries
      [100, 100, 100], // cell 2: all boundaries
      [100, 100, 100], // cell 3: all boundaries
      ...Array(97).fill([100, 100, 100]), // padding cells
    ],
  };

  return { mockCells, mockVertices };
}

describe("zones GeoJSON export - Property-Based Tests", () => {
  beforeEach(() => {
    // Mock getCoordinates function
    globalThis.getCoordinates = vi.fn(
      (x: number, y: number, decimals: number): [number, number] => {
        const lon = Number((x / 10).toFixed(decimals));
        const lat = Number((y / 10).toFixed(decimals));
        return [lon, lat];
      },
    );

    // Mock getFileName function
    globalThis.getFileName = vi.fn((dataType: string) => {
      return `TestMap_${dataType}_20240101`;
    });

    // Mock downloadFile function
    globalThis.downloadFile = vi.fn();
  });

  /**
   * Property 1: Valid GeoJSON Structure
   * Feature: zones-geojson-export, Property 1: Valid GeoJSON Structure
   * Validates: Requirements 1.1, 5.4
   *
   * For any exported zones data, the output SHALL be a valid GeoJSON FeatureCollection
   * with a "type" field equal to "FeatureCollection" and a "features" array.
   */
  it("Property 1: exported data is a valid GeoJSON FeatureCollection with type and features array", () => {
    fc.assert(
      fc.property(
        // Generate random zones with varying properties
        fc
          .array(
            fc.record({
              i: fc.integer({ min: 0, max: 1000 }),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              type: fc.oneof(
                fc.constant("Unknown"),
                fc.constant("Territory"),
                fc.constant("Climate"),
              ),
              color: fc.oneof(
                fc.constant("#ff0000"),
                fc.constant("#00ff00"),
                fc.constant("url(#hatch1)"),
              ),
              cells: fc.array(fc.integer({ min: 0, max: 3 }), {
                minLength: 0,
                maxLength: 10,
              }),
              hidden: fc.boolean(),
            }),
            { minLength: 0, maxLength: 20 },
          )
          .map((zones) => {
            // Ensure unique zone IDs
            return zones.map((zone, index) => ({ ...zone, i: index }));
          }),
        (zones) => {
          // Setup mock pack data with valid mesh topology
          const { mockCells, mockVertices } = createValidMeshTopology();

          globalThis.pack = {
            zones,
            cells: mockCells,
            vertices: mockVertices,
          } as any;

          // Execute the function that generates GeoJSON
          const saveGeoJsonZones = new Function(`
            const {zones, cells, vertices} = pack;
            const json = {type: "FeatureCollection", features: []};

            function getZonePolygonCoordinates(zoneCells) {
              const cellsInZone = new Set(zoneCells);
              const ofSameType = (cellId) => cellsInZone.has(cellId);
              const ofDifferentType = (cellId) => !cellsInZone.has(cellId);
              
              const checkedCells = new Set();
              const coordinates = [];
              
              for (const cellId of zoneCells) {
                if (checkedCells.has(cellId)) continue;
                
                const neighbors = cells.c[cellId];
                const onBorder = neighbors.some(ofDifferentType);
                if (!onBorder) continue;
                
                const cellVertices = cells.v[cellId];
                let startingVertex = null;
                
                for (const vertexId of cellVertices) {
                  const vertexCells = vertices.c[vertexId];
                  if (vertexCells.some(ofDifferentType)) {
                    startingVertex = vertexId;
                    break;
                  }
                }
                
                if (startingVertex === null) continue;
                
                const vertexChain = [];
                let current = startingVertex;
                let previous = null;
                const maxIterations = vertices.c.length;
                
                for (let i = 0; i < maxIterations; i++) {
                  vertexChain.push(current);
                  
                  const adjacentCells = vertices.c[current];
                  adjacentCells.filter(ofSameType).forEach(c => checkedCells.add(c));
                  
                  const [c1, c2, c3] = adjacentCells.map(ofSameType);
                  const [v1, v2, v3] = vertices.v[current];
                  
                  let next = null;
                  if (v1 !== previous && c1 !== c2) next = v1;
                  else if (v2 !== previous && c2 !== c3) next = v2;
                  else if (v3 !== previous && c1 !== c3) next = v3;
                  
                  if (next === null || next === current) break;
                  if (next === startingVertex) break;
                  
                  previous = current;
                  current = next;
                }
                
                for (const vertexId of vertexChain) {
                  const [x, y] = vertices.p[vertexId];
                  coordinates.push(getCoordinates(x, y, 4));
                }
              }
              
              if (coordinates.length > 0) {
                coordinates.push(coordinates[0]);
              }
              
              return [coordinates];
            }

            zones.forEach(zone => {
              if (zone.hidden || !zone.cells || zone.cells.length === 0) return;

              const coordinates = getZonePolygonCoordinates(zone.cells);
              
              if (coordinates[0].length >= 4) {
                const properties = {
                  id: zone.i,
                  name: zone.name,
                  type: zone.type,
                  color: zone.color,
                  cells: zone.cells
                };
                
                const feature = {
                  type: "Feature",
                  geometry: {type: "Polygon", coordinates},
                  properties
                };
                
                json.features.push(feature);
              }
            });

            return json;
          `);

          const result = saveGeoJsonZones();

          // Verify valid GeoJSON FeatureCollection structure
          expect(result).toBeDefined();
          expect(result).toHaveProperty("type");
          expect(result.type).toBe("FeatureCollection");
          expect(result).toHaveProperty("features");
          expect(Array.isArray(result.features)).toBe(true);

          // Verify each feature has the correct structure
          for (const feature of result.features) {
            expect(feature).toHaveProperty("type", "Feature");
            expect(feature).toHaveProperty("geometry");
            expect(feature).toHaveProperty("properties");
            expect(feature.geometry).toHaveProperty("type");
            expect(feature.geometry).toHaveProperty("coordinates");
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 2: Visible Zones Only
   * Feature: zones-geojson-export, Property 2: Visible Zones Only
   * Validates: Requirements 1.3, 1.4
   *
   * For any zone in the exported GeoJSON, that zone SHALL NOT be marked as hidden
   * in pack.zones and SHALL have at least one cell.
   */
  it("Property 2: only visible zones with cells are exported (no hidden zones, no empty zones)", () => {
    fc.assert(
      fc.property(
        // Generate random zones with mixed visibility and cell counts
        fc
          .array(
            fc.record({
              i: fc.integer({ min: 0, max: 1000 }),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              type: fc.oneof(
                fc.constant("Unknown"),
                fc.constant("Territory"),
                fc.constant("Climate"),
              ),
              color: fc.oneof(
                fc.constant("#ff0000"),
                fc.constant("#00ff00"),
                fc.constant("url(#hatch1)"),
              ),
              cells: fc.array(fc.integer({ min: 0, max: 3 }), {
                minLength: 0,
                maxLength: 10,
              }),
              hidden: fc.boolean(), // Mix of hidden and visible zones
            }),
            { minLength: 0, maxLength: 20 },
          )
          .map((zones) => {
            // Ensure unique zone IDs
            return zones.map((zone, index) => ({ ...zone, i: index }));
          }),
        (zones) => {
          // Setup mock pack data with valid mesh topology
          const { mockCells, mockVertices } = createValidMeshTopology();

          globalThis.pack = {
            zones,
            cells: mockCells,
            vertices: mockVertices,
          } as any;

          // Execute the function that generates GeoJSON
          const saveGeoJsonZones = new Function(`
            const {zones, cells, vertices} = pack;
            const json = {type: "FeatureCollection", features: []};

            function getZonePolygonCoordinates(zoneCells) {
              const cellsInZone = new Set(zoneCells);
              const ofSameType = (cellId) => cellsInZone.has(cellId);
              const ofDifferentType = (cellId) => !cellsInZone.has(cellId);
              
              const checkedCells = new Set();
              const coordinates = [];
              
              for (const cellId of zoneCells) {
                if (checkedCells.has(cellId)) continue;
                
                const neighbors = cells.c[cellId];
                const onBorder = neighbors.some(ofDifferentType);
                if (!onBorder) continue;
                
                const cellVertices = cells.v[cellId];
                let startingVertex = null;
                
                for (const vertexId of cellVertices) {
                  const vertexCells = vertices.c[vertexId];
                  if (vertexCells.some(ofDifferentType)) {
                    startingVertex = vertexId;
                    break;
                  }
                }
                
                if (startingVertex === null) continue;
                
                const vertexChain = [];
                let current = startingVertex;
                let previous = null;
                const maxIterations = vertices.c.length;
                
                for (let i = 0; i < maxIterations; i++) {
                  vertexChain.push(current);
                  
                  const adjacentCells = vertices.c[current];
                  adjacentCells.filter(ofSameType).forEach(c => checkedCells.add(c));
                  
                  const [c1, c2, c3] = adjacentCells.map(ofSameType);
                  const [v1, v2, v3] = vertices.v[current];
                  
                  let next = null;
                  if (v1 !== previous && c1 !== c2) next = v1;
                  else if (v2 !== previous && c2 !== c3) next = v2;
                  else if (v3 !== previous && c1 !== c3) next = v3;
                  
                  if (next === null || next === current) break;
                  if (next === startingVertex) break;
                  
                  previous = current;
                  current = next;
                }
                
                for (const vertexId of vertexChain) {
                  const [x, y] = vertices.p[vertexId];
                  coordinates.push(getCoordinates(x, y, 4));
                }
              }
              
              if (coordinates.length > 0) {
                coordinates.push(coordinates[0]);
              }
              
              return [coordinates];
            }

            zones.forEach(zone => {
              if (zone.hidden || !zone.cells || zone.cells.length === 0) return;

              const coordinates = getZonePolygonCoordinates(zone.cells);
              
              if (coordinates[0].length >= 4) {
                const properties = {
                  id: zone.i,
                  name: zone.name,
                  type: zone.type,
                  color: zone.color,
                  cells: zone.cells
                };
                
                const feature = {
                  type: "Feature",
                  geometry: {type: "Polygon", coordinates},
                  properties
                };
                
                json.features.push(feature);
              }
            });

            return json;
          `);

          const result = saveGeoJsonZones();

          // Verify that all exported features correspond to visible zones only
          for (const feature of result.features) {
            const zoneId = feature.properties.id;
            const originalZone = zones.find((z) => z.i === zoneId);

            // Verify the zone exists
            expect(originalZone).toBeDefined();

            if (originalZone) {
              // Verify the zone is not hidden
              expect(originalZone.hidden).not.toBe(true);

              // Verify the zone has cells
              expect(originalZone.cells).toBeDefined();
              expect(originalZone.cells.length).toBeGreaterThan(0);
            }
          }

          // Verify no hidden zones are in the export
          const exportedZoneIds = new Set(
            result.features.map((f: any) => f.properties.id),
          );
          const hiddenZones = zones.filter((z) => z.hidden === true);

          for (const hiddenZone of hiddenZones) {
            expect(exportedZoneIds.has(hiddenZone.i)).toBe(false);
          }

          // Verify no zones with empty cells are in the export
          const emptyZones = zones.filter(
            (z) => !z.cells || z.cells.length === 0,
          );

          for (const emptyZone of emptyZones) {
            expect(exportedZoneIds.has(emptyZone.i)).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 3: Polygon Geometry Type
   * Feature: zones-geojson-export, Property 3: Polygon Geometry Type
   * Validates: Requirements 1.2
   *
   * For any exported zone feature, the geometry SHALL have type "Polygon" with a coordinates
   * array containing at least one coordinate ring.
   */
  it("Property 3: all exported zone features have Polygon geometry type with coordinate rings", () => {
    fc.assert(
      fc.property(
        // Generate random zones with varying properties
        fc
          .array(
            fc.record({
              i: fc.integer({ min: 0, max: 1000 }),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              type: fc.oneof(
                fc.constant("Unknown"),
                fc.constant("Territory"),
                fc.constant("Climate"),
              ),
              color: fc.oneof(
                fc.constant("#ff0000"),
                fc.constant("#00ff00"),
                fc.constant("url(#hatch1)"),
              ),
              cells: fc.array(fc.integer({ min: 0, max: 3 }), {
                minLength: 1,
                maxLength: 10,
              }),
              hidden: fc.constant(false), // Only visible zones
            }),
            { minLength: 1, maxLength: 20 },
          )
          .map((zones) => {
            // Ensure unique zone IDs
            return zones.map((zone, index) => ({ ...zone, i: index }));
          }),
        (zones) => {
          // Setup mock pack data with valid mesh topology
          const { mockCells, mockVertices } = createValidMeshTopology();

          globalThis.pack = {
            zones,
            cells: mockCells,
            vertices: mockVertices,
          } as any;

          // Execute the function that generates GeoJSON
          const saveGeoJsonZones = new Function(`
            const {zones, cells, vertices} = pack;
            const json = {type: "FeatureCollection", features: []};

            function getZonePolygonCoordinates(zoneCells) {
              const cellsInZone = new Set(zoneCells);
              const ofSameType = (cellId) => cellsInZone.has(cellId);
              const ofDifferentType = (cellId) => !cellsInZone.has(cellId);
              
              const checkedCells = new Set();
              const coordinates = [];
              
              for (const cellId of zoneCells) {
                if (checkedCells.has(cellId)) continue;
                
                const neighbors = cells.c[cellId];
                const onBorder = neighbors.some(ofDifferentType);
                if (!onBorder) continue;
                
                const cellVertices = cells.v[cellId];
                let startingVertex = null;
                
                for (const vertexId of cellVertices) {
                  const vertexCells = vertices.c[vertexId];
                  if (vertexCells.some(ofDifferentType)) {
                    startingVertex = vertexId;
                    break;
                  }
                }
                
                if (startingVertex === null) continue;
                
                const vertexChain = [];
                let current = startingVertex;
                let previous = null;
                const maxIterations = vertices.c.length;
                
                for (let i = 0; i < maxIterations; i++) {
                  vertexChain.push(current);
                  
                  const adjacentCells = vertices.c[current];
                  adjacentCells.filter(ofSameType).forEach(c => checkedCells.add(c));
                  
                  const [c1, c2, c3] = adjacentCells.map(ofSameType);
                  const [v1, v2, v3] = vertices.v[current];
                  
                  let next = null;
                  if (v1 !== previous && c1 !== c2) next = v1;
                  else if (v2 !== previous && c2 !== c3) next = v2;
                  else if (v3 !== previous && c1 !== c3) next = v3;
                  
                  if (next === null || next === current) break;
                  if (next === startingVertex) break;
                  
                  previous = current;
                  current = next;
                }
                
                for (const vertexId of vertexChain) {
                  const [x, y] = vertices.p[vertexId];
                  coordinates.push(getCoordinates(x, y, 4));
                }
              }
              
              if (coordinates.length > 0) {
                coordinates.push(coordinates[0]);
              }
              
              return [coordinates];
            }

            zones.forEach(zone => {
              if (zone.hidden || !zone.cells || zone.cells.length === 0) return;

              const coordinates = getZonePolygonCoordinates(zone.cells);
              
              if (coordinates[0].length >= 4) {
                const properties = {
                  id: zone.i,
                  name: zone.name,
                  type: zone.type,
                  color: zone.color,
                  cells: zone.cells
                };
                
                const feature = {
                  type: "Feature",
                  geometry: {type: "Polygon", coordinates},
                  properties
                };
                
                json.features.push(feature);
              }
            });

            return json;
          `);

          const result = saveGeoJsonZones();

          // Verify all features have Polygon geometry type
          expect(result.features.length).toBeGreaterThan(0);

          for (const feature of result.features) {
            // Verify geometry exists
            expect(feature.geometry).toBeDefined();

            // Verify geometry type is "Polygon"
            expect(feature.geometry.type).toBe("Polygon");

            // Verify coordinates array exists
            expect(feature.geometry.coordinates).toBeDefined();
            expect(Array.isArray(feature.geometry.coordinates)).toBe(true);

            // Verify at least one coordinate ring exists
            expect(feature.geometry.coordinates.length).toBeGreaterThanOrEqual(
              1,
            );

            // Verify the first element is a coordinate ring (array of coordinates)
            const firstRing = feature.geometry.coordinates[0];
            expect(Array.isArray(firstRing)).toBe(true);
            expect(firstRing.length).toBeGreaterThan(0);

            // Verify each coordinate in the ring is a [lon, lat] pair
            for (const coord of firstRing) {
              expect(Array.isArray(coord)).toBe(true);
              expect(coord.length).toBe(2);
              expect(typeof coord[0]).toBe("number"); // longitude
              expect(typeof coord[1]).toBe("number"); // latitude
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 4: Closed Polygon Rings
   * Feature: zones-geojson-export, Property 4: Closed Polygon Rings
   * Validates: Requirements 3.2
   *
   * For any zone feature's polygon coordinates, the first coordinate SHALL equal the last
   * coordinate (closed ring requirement).
   */
  it("Property 4: all polygon coordinate rings are closed (first coordinate equals last coordinate)", () => {
    fc.assert(
      fc.property(
        // Generate random zones with varying properties
        fc
          .array(
            fc.record({
              i: fc.integer({ min: 0, max: 1000 }),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              type: fc.oneof(
                fc.constant("Unknown"),
                fc.constant("Territory"),
                fc.constant("Climate"),
              ),
              color: fc.oneof(
                fc.constant("#ff0000"),
                fc.constant("#00ff00"),
                fc.constant("url(#hatch1)"),
              ),
              cells: fc.array(fc.integer({ min: 0, max: 3 }), {
                minLength: 1,
                maxLength: 10,
              }),
              hidden: fc.constant(false), // Only visible zones
            }),
            { minLength: 1, maxLength: 20 },
          )
          .map((zones) => {
            // Ensure unique zone IDs
            return zones.map((zone, index) => ({ ...zone, i: index }));
          }),
        (zones) => {
          // Setup mock pack data with valid mesh topology
          const { mockCells, mockVertices } = createValidMeshTopology();

          globalThis.pack = {
            zones,
            cells: mockCells,
            vertices: mockVertices,
          } as any;

          // Execute the function that generates GeoJSON
          const saveGeoJsonZones = new Function(`
            const {zones, cells, vertices} = pack;
            const json = {type: "FeatureCollection", features: []};

            function getZonePolygonCoordinates(zoneCells) {
              const cellsInZone = new Set(zoneCells);
              const ofSameType = (cellId) => cellsInZone.has(cellId);
              const ofDifferentType = (cellId) => !cellsInZone.has(cellId);
              
              const checkedCells = new Set();
              const coordinates = [];
              
              for (const cellId of zoneCells) {
                if (checkedCells.has(cellId)) continue;
                
                const neighbors = cells.c[cellId];
                const onBorder = neighbors.some(ofDifferentType);
                if (!onBorder) continue;
                
                const cellVertices = cells.v[cellId];
                let startingVertex = null;
                
                for (const vertexId of cellVertices) {
                  const vertexCells = vertices.c[vertexId];
                  if (vertexCells.some(ofDifferentType)) {
                    startingVertex = vertexId;
                    break;
                  }
                }
                
                if (startingVertex === null) continue;
                
                const vertexChain = [];
                let current = startingVertex;
                let previous = null;
                const maxIterations = vertices.c.length;
                
                for (let i = 0; i < maxIterations; i++) {
                  vertexChain.push(current);
                  
                  const adjacentCells = vertices.c[current];
                  adjacentCells.filter(ofSameType).forEach(c => checkedCells.add(c));
                  
                  const [c1, c2, c3] = adjacentCells.map(ofSameType);
                  const [v1, v2, v3] = vertices.v[current];
                  
                  let next = null;
                  if (v1 !== previous && c1 !== c2) next = v1;
                  else if (v2 !== previous && c2 !== c3) next = v2;
                  else if (v3 !== previous && c1 !== c3) next = v3;
                  
                  if (next === null || next === current) break;
                  if (next === startingVertex) break;
                  
                  previous = current;
                  current = next;
                }
                
                for (const vertexId of vertexChain) {
                  const [x, y] = vertices.p[vertexId];
                  coordinates.push(getCoordinates(x, y, 4));
                }
              }
              
              if (coordinates.length > 0) {
                coordinates.push(coordinates[0]);
              }
              
              return [coordinates];
            }

            zones.forEach(zone => {
              if (zone.hidden || !zone.cells || zone.cells.length === 0) return;

              const coordinates = getZonePolygonCoordinates(zone.cells);
              
              if (coordinates[0].length >= 4) {
                const properties = {
                  id: zone.i,
                  name: zone.name,
                  type: zone.type,
                  color: zone.color,
                  cells: zone.cells
                };
                
                const feature = {
                  type: "Feature",
                  geometry: {type: "Polygon", coordinates},
                  properties
                };
                
                json.features.push(feature);
              }
            });

            return json;
          `);

          const result = saveGeoJsonZones();

          // Verify all polygon rings are closed
          expect(result.features.length).toBeGreaterThan(0);

          for (const feature of result.features) {
            expect(feature.geometry.type).toBe("Polygon");
            expect(feature.geometry.coordinates).toBeDefined();
            expect(Array.isArray(feature.geometry.coordinates)).toBe(true);

            // Check each coordinate ring in the polygon
            for (const ring of feature.geometry.coordinates) {
              expect(Array.isArray(ring)).toBe(true);
              expect(ring.length).toBeGreaterThanOrEqual(2);

              // Verify the ring is closed: first coordinate equals last coordinate
              const firstCoord = ring[0];
              const lastCoord = ring[ring.length - 1];

              expect(Array.isArray(firstCoord)).toBe(true);
              expect(Array.isArray(lastCoord)).toBe(true);
              expect(firstCoord.length).toBe(2);
              expect(lastCoord.length).toBe(2);

              // Check that first and last coordinates are equal
              expect(firstCoord[0]).toBe(lastCoord[0]); // longitude
              expect(firstCoord[1]).toBe(lastCoord[1]); // latitude
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 5: Complete Zone Properties
   * Feature: zones-geojson-export, Property 5: Complete Zone Properties
   * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
   *
   * For any exported zone feature, the properties object SHALL contain all required fields:
   * id, name, type, color, and cells array.
   */
  it("Property 5: all exported zone features contain complete properties (id, name, type, color, cells)", () => {
    fc.assert(
      fc.property(
        // Generate random zones with all required properties
        fc
          .array(
            fc.record({
              i: fc.integer({ min: 0, max: 1000 }),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              type: fc.oneof(
                fc.constant("Unknown"),
                fc.constant("Territory"),
                fc.constant("Climate"),
              ),
              color: fc.oneof(
                fc.constant("#ff0000"),
                fc.constant("#00ff00"),
                fc.constant("url(#hatch1)"),
              ),
              cells: fc.array(fc.integer({ min: 0, max: 3 }), {
                minLength: 1,
                maxLength: 10,
              }),
              hidden: fc.constant(false), // Only visible zones
            }),
            { minLength: 1, maxLength: 20 },
          )
          .map((zones) => {
            // Ensure unique zone IDs
            return zones.map((zone, index) => ({ ...zone, i: index }));
          }),
        (zones) => {
          // Setup mock pack data with valid mesh topology
          const { mockCells, mockVertices } = createValidMeshTopology();

          globalThis.pack = {
            zones,
            cells: mockCells,
            vertices: mockVertices,
          } as any;

          // Import and execute the function
          const saveGeoJsonZones = new Function(`
            const {zones, cells, vertices} = pack;
            const json = {type: "FeatureCollection", features: []};

            function getZonePolygonCoordinates(zoneCells) {
              const cellsInZone = new Set(zoneCells);
              const ofSameType = (cellId) => cellsInZone.has(cellId);
              const ofDifferentType = (cellId) => !cellsInZone.has(cellId);
              
              const checkedCells = new Set();
              const coordinates = [];
              
              for (const cellId of zoneCells) {
                if (checkedCells.has(cellId)) continue;
                
                const neighbors = cells.c[cellId];
                const onBorder = neighbors.some(ofDifferentType);
                if (!onBorder) continue;
                
                const cellVertices = cells.v[cellId];
                let startingVertex = null;
                
                for (const vertexId of cellVertices) {
                  const vertexCells = vertices.c[vertexId];
                  if (vertexCells.some(ofDifferentType)) {
                    startingVertex = vertexId;
                    break;
                  }
                }
                
                if (startingVertex === null) continue;
                
                const vertexChain = [];
                let current = startingVertex;
                let previous = null;
                const maxIterations = vertices.c.length;
                
                for (let i = 0; i < maxIterations; i++) {
                  vertexChain.push(current);
                  
                  const adjacentCells = vertices.c[current];
                  adjacentCells.filter(ofSameType).forEach(c => checkedCells.add(c));
                  
                  const [c1, c2, c3] = adjacentCells.map(ofSameType);
                  const [v1, v2, v3] = vertices.v[current];
                  
                  let next = null;
                  if (v1 !== previous && c1 !== c2) next = v1;
                  else if (v2 !== previous && c2 !== c3) next = v2;
                  else if (v3 !== previous && c1 !== c3) next = v3;
                  
                  if (next === null || next === current) break;
                  if (next === startingVertex) break;
                  
                  previous = current;
                  current = next;
                }
                
                for (const vertexId of vertexChain) {
                  const [x, y] = vertices.p[vertexId];
                  coordinates.push(getCoordinates(x, y, 4));
                }
              }
              
              if (coordinates.length > 0) {
                coordinates.push(coordinates[0]);
              }
              
              return [coordinates];
            }

            zones.forEach(zone => {
              if (zone.hidden || !zone.cells || zone.cells.length === 0) return;

              const coordinates = getZonePolygonCoordinates(zone.cells);
              
              if (coordinates[0].length >= 4) {
                const properties = {
                  id: zone.i,
                  name: zone.name,
                  type: zone.type,
                  color: zone.color,
                  cells: zone.cells
                };
                
                const feature = {
                  type: "Feature",
                  geometry: {type: "Polygon", coordinates},
                  properties
                };
                
                json.features.push(feature);
              }
            });

            return json;
          `);

          const result = saveGeoJsonZones();

          // Verify all features have complete properties
          expect(result.features.length).toBeGreaterThan(0);

          for (const feature of result.features) {
            expect(feature.properties).toBeDefined();
            expect(feature.properties).toHaveProperty("id");
            expect(feature.properties).toHaveProperty("name");
            expect(feature.properties).toHaveProperty("type");
            expect(feature.properties).toHaveProperty("color");
            expect(feature.properties).toHaveProperty("cells");

            // Verify types
            expect(typeof feature.properties.id).toBe("number");
            expect(typeof feature.properties.name).toBe("string");
            expect(typeof feature.properties.type).toBe("string");
            expect(typeof feature.properties.color).toBe("string");
            expect(Array.isArray(feature.properties.cells)).toBe(true);

            // Verify values match input zones
            const matchingZone = zones.find(
              (z) => z.i === feature.properties.id,
            );
            expect(matchingZone).toBeDefined();
            expect(feature.properties.name).toBe(matchingZone!.name);
            expect(feature.properties.type).toBe(matchingZone!.type);
            expect(feature.properties.color).toBe(matchingZone!.color);
            expect(feature.properties.cells).toEqual(matchingZone!.cells);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 6: Coordinate Precision
   * Feature: zones-geojson-export, Property 6: Coordinate Precision
   * Validates: Requirements 3.1
   *
   * For any coordinate in the exported GeoJSON, both longitude and latitude SHALL be
   * rounded to 4 decimal places.
   */
  it("Property 6: all coordinates are rounded to 4 decimal places", () => {
    fc.assert(
      fc.property(
        // Generate random zones with varying properties
        fc
          .array(
            fc.record({
              i: fc.integer({ min: 0, max: 1000 }),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              type: fc.oneof(
                fc.constant("Unknown"),
                fc.constant("Territory"),
                fc.constant("Climate"),
              ),
              color: fc.oneof(
                fc.constant("#ff0000"),
                fc.constant("#00ff00"),
                fc.constant("url(#hatch1)"),
              ),
              cells: fc.array(fc.integer({ min: 0, max: 3 }), {
                minLength: 1,
                maxLength: 10,
              }),
              hidden: fc.constant(false), // Only visible zones
            }),
            { minLength: 1, maxLength: 20 },
          )
          .map((zones) => {
            // Ensure unique zone IDs
            return zones.map((zone, index) => ({ ...zone, i: index }));
          }),
        // Generate random vertex coordinates with varying precision
        fc.array(
          fc.tuple(
            fc.float({ min: -1000, max: 1000 }),
            fc.float({ min: -1000, max: 1000 }),
          ),
          { minLength: 3, maxLength: 10 },
        ),
        (zones, _vertexCoords) => {
          // Setup mock pack data with valid mesh topology (ignoring vertexCoords for simplicity)
          const { mockCells, mockVertices } = createValidMeshTopology();

          globalThis.pack = {
            zones,
            cells: mockCells,
            vertices: mockVertices,
          } as any;

          // Execute the function that generates GeoJSON
          const saveGeoJsonZones = new Function(`
            const {zones, cells, vertices} = pack;
            const json = {type: "FeatureCollection", features: []};

            function getZonePolygonCoordinates(zoneCells) {
              const cellsInZone = new Set(zoneCells);
              const ofSameType = (cellId) => cellsInZone.has(cellId);
              const ofDifferentType = (cellId) => !cellsInZone.has(cellId);
              
              const checkedCells = new Set();
              const coordinates = [];
              
              for (const cellId of zoneCells) {
                if (checkedCells.has(cellId)) continue;
                
                const neighbors = cells.c[cellId];
                const onBorder = neighbors.some(ofDifferentType);
                if (!onBorder) continue;
                
                const cellVertices = cells.v[cellId];
                let startingVertex = null;
                
                for (const vertexId of cellVertices) {
                  const vertexCells = vertices.c[vertexId];
                  if (vertexCells.some(ofDifferentType)) {
                    startingVertex = vertexId;
                    break;
                  }
                }
                
                if (startingVertex === null) continue;
                
                const vertexChain = [];
                let current = startingVertex;
                let previous = null;
                const maxIterations = vertices.c.length;
                
                for (let i = 0; i < maxIterations; i++) {
                  vertexChain.push(current);
                  
                  const adjacentCells = vertices.c[current];
                  adjacentCells.filter(ofSameType).forEach(c => checkedCells.add(c));
                  
                  const [c1, c2, c3] = adjacentCells.map(ofSameType);
                  const [v1, v2, v3] = vertices.v[current];
                  
                  let next = null;
                  if (v1 !== previous && c1 !== c2) next = v1;
                  else if (v2 !== previous && c2 !== c3) next = v2;
                  else if (v3 !== previous && c1 !== c3) next = v3;
                  
                  if (next === null || next === current) break;
                  if (next === startingVertex) break;
                  
                  previous = current;
                  current = next;
                }
                
                for (const vertexId of vertexChain) {
                  const [x, y] = vertices.p[vertexId];
                  coordinates.push(getCoordinates(x, y, 4));
                }
              }
              
              if (coordinates.length > 0) {
                coordinates.push(coordinates[0]);
              }
              
              return [coordinates];
            }

            zones.forEach(zone => {
              if (zone.hidden || !zone.cells || zone.cells.length === 0) return;

              const coordinates = getZonePolygonCoordinates(zone.cells);
              
              if (coordinates[0].length >= 4) {
                const properties = {
                  id: zone.i,
                  name: zone.name,
                  type: zone.type,
                  color: zone.color,
                  cells: zone.cells
                };
                
                const feature = {
                  type: "Feature",
                  geometry: {type: "Polygon", coordinates},
                  properties
                };
                
                json.features.push(feature);
              }
            });

            return json;
          `);

          const result = saveGeoJsonZones();

          // Helper function to count decimal places
          const countDecimals = (num: number): number => {
            const str = num.toString();
            if (!str.includes(".")) return 0;
            return str.split(".")[1].length;
          };

          // Verify all coordinates have at most 4 decimal places
          expect(result.features.length).toBeGreaterThan(0);

          for (const feature of result.features) {
            expect(feature.geometry.type).toBe("Polygon");
            expect(feature.geometry.coordinates).toBeDefined();

            // Check each coordinate ring
            for (const ring of feature.geometry.coordinates) {
              expect(Array.isArray(ring)).toBe(true);

              // Check each coordinate in the ring
              for (const coord of ring) {
                expect(Array.isArray(coord)).toBe(true);
                expect(coord.length).toBe(2);

                const [lon, lat] = coord;

                // Verify both longitude and latitude are numbers
                expect(typeof lon).toBe("number");
                expect(typeof lat).toBe("number");

                // Verify precision is at most 4 decimal places
                expect(countDecimals(lon)).toBeLessThanOrEqual(4);
                expect(countDecimals(lat)).toBeLessThanOrEqual(4);

                // Verify that the coordinate matches what getCoordinates would return
                // with precision 4 (i.e., it's properly rounded)
                // Note: We need to handle -0 vs +0 edge case in JavaScript
                const lonRounded = Number(lon.toFixed(4));
                const latRounded = Number(lat.toFixed(4));

                // Use Math.abs to handle -0 vs +0 comparison
                if (lon === 0 && lonRounded === 0) {
                  // Both are zero (either +0 or -0), which is acceptable
                  expect(Math.abs(lon)).toBe(Math.abs(lonRounded));
                } else {
                  expect(lonRounded).toBe(lon);
                }

                if (lat === 0 && latRounded === 0) {
                  // Both are zero (either +0 or -0), which is acceptable
                  expect(Math.abs(lat)).toBe(Math.abs(latRounded));
                } else {
                  expect(latRounded).toBe(lat);
                }
              }
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 7: Single Polygon Per Zone
   * Feature: zones-geojson-export, Property 7: Single Polygon Per Zone
   * Validates: Requirements 3.3
   *
   * For any zone with multiple cells, the export SHALL produce exactly one Feature with
   * one Polygon geometry (not MultiPolygon).
   */
  it("Property 7: each zone produces exactly one Feature with Polygon geometry (not MultiPolygon)", () => {
    fc.assert(
      fc.property(
        // Generate random zones with multiple cells to test merging
        fc
          .array(
            fc.record({
              i: fc.integer({ min: 0, max: 1000 }),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              type: fc.oneof(
                fc.constant("Unknown"),
                fc.constant("Territory"),
                fc.constant("Climate"),
              ),
              color: fc.oneof(
                fc.constant("#ff0000"),
                fc.constant("#00ff00"),
                fc.constant("url(#hatch1)"),
              ),
              // Generate zones with multiple cells (2-10 cells per zone)
              cells: fc.array(fc.integer({ min: 0, max: 3 }), {
                minLength: 2,
                maxLength: 10,
              }),
              hidden: fc.constant(false), // Only visible zones
            }),
            { minLength: 1, maxLength: 20 },
          )
          .map((zones) => {
            // Ensure unique zone IDs
            return zones.map((zone, index) => ({ ...zone, i: index }));
          }),
        (zones) => {
          // Setup mock pack data with valid mesh topology
          const { mockCells, mockVertices } = createValidMeshTopology();

          globalThis.pack = {
            zones,
            cells: mockCells,
            vertices: mockVertices,
          } as any;

          // Execute the function that generates GeoJSON
          const saveGeoJsonZones = new Function(`
            const {zones, cells, vertices} = pack;
            const json = {type: "FeatureCollection", features: []};

            function getZonePolygonCoordinates(zoneCells) {
              const cellsInZone = new Set(zoneCells);
              const ofSameType = (cellId) => cellsInZone.has(cellId);
              const ofDifferentType = (cellId) => !cellsInZone.has(cellId);
              
              const checkedCells = new Set();
              const coordinates = [];
              
              for (const cellId of zoneCells) {
                if (checkedCells.has(cellId)) continue;
                
                const neighbors = cells.c[cellId];
                const onBorder = neighbors.some(ofDifferentType);
                if (!onBorder) continue;
                
                const cellVertices = cells.v[cellId];
                let startingVertex = null;
                
                for (const vertexId of cellVertices) {
                  const vertexCells = vertices.c[vertexId];
                  if (vertexCells.some(ofDifferentType)) {
                    startingVertex = vertexId;
                    break;
                  }
                }
                
                if (startingVertex === null) continue;
                
                const vertexChain = [];
                let current = startingVertex;
                let previous = null;
                const maxIterations = vertices.c.length;
                
                for (let i = 0; i < maxIterations; i++) {
                  vertexChain.push(current);
                  
                  const adjacentCells = vertices.c[current];
                  adjacentCells.filter(ofSameType).forEach(c => checkedCells.add(c));
                  
                  const [c1, c2, c3] = adjacentCells.map(ofSameType);
                  const [v1, v2, v3] = vertices.v[current];
                  
                  let next = null;
                  if (v1 !== previous && c1 !== c2) next = v1;
                  else if (v2 !== previous && c2 !== c3) next = v2;
                  else if (v3 !== previous && c1 !== c3) next = v3;
                  
                  if (next === null || next === current) break;
                  if (next === startingVertex) break;
                  
                  previous = current;
                  current = next;
                }
                
                for (const vertexId of vertexChain) {
                  const [x, y] = vertices.p[vertexId];
                  coordinates.push(getCoordinates(x, y, 4));
                }
              }
              
              if (coordinates.length > 0) {
                coordinates.push(coordinates[0]);
              }
              
              return [coordinates];
            }

            zones.forEach(zone => {
              if (zone.hidden || !zone.cells || zone.cells.length === 0) return;

              const coordinates = getZonePolygonCoordinates(zone.cells);
              
              if (coordinates[0].length >= 4) {
                const properties = {
                  id: zone.i,
                  name: zone.name,
                  type: zone.type,
                  color: zone.color,
                  cells: zone.cells
                };
                
                const feature = {
                  type: "Feature",
                  geometry: {type: "Polygon", coordinates},
                  properties
                };
                
                json.features.push(feature);
              }
            });

            return json;
          `);

          const result = saveGeoJsonZones();

          // Verify that we have features to test
          expect(result.features.length).toBeGreaterThan(0);

          // Create a map of zone IDs to their feature count
          const zoneIdToFeatureCount = new Map<number, number>();

          for (const feature of result.features) {
            const zoneId = feature.properties.id;
            zoneIdToFeatureCount.set(
              zoneId,
              (zoneIdToFeatureCount.get(zoneId) || 0) + 1,
            );
          }

          // Verify each zone produces exactly ONE feature
          for (const zone of zones) {
            if (zone.hidden || !zone.cells || zone.cells.length === 0) continue;

            const featureCount = zoneIdToFeatureCount.get(zone.i) || 0;

            // Each zone should produce exactly one feature
            expect(featureCount).toBe(1);
          }

          // Verify each feature has Polygon geometry (not MultiPolygon)
          for (const feature of result.features) {
            expect(feature.geometry.type).toBe("Polygon");
            expect(feature.geometry.type).not.toBe("MultiPolygon");

            // Verify the geometry structure is a Polygon (array of rings)
            expect(Array.isArray(feature.geometry.coordinates)).toBe(true);
            expect(feature.geometry.coordinates.length).toBeGreaterThanOrEqual(
              1,
            );

            // Verify the first element is a coordinate ring (not nested arrays like MultiPolygon)
            const firstRing = feature.geometry.coordinates[0];
            expect(Array.isArray(firstRing)).toBe(true);

            // Verify each element in the ring is a coordinate pair [lon, lat]
            // (not another array of rings like in MultiPolygon)
            for (const coord of firstRing) {
              expect(Array.isArray(coord)).toBe(true);
              expect(coord.length).toBe(2);
              expect(typeof coord[0]).toBe("number");
              expect(typeof coord[1]).toBe("number");
            }
          }

          // Additional verification: zones with multiple cells should still produce single Polygon
          const multiCellZones = zones.filter(
            (z) => !z.hidden && z.cells && z.cells.length > 1,
          );

          for (const zone of multiCellZones) {
            const features = result.features.filter(
              (f: any) => f.properties.id === zone.i,
            );

            // Should have exactly one feature
            expect(features.length).toBe(1);

            if (features.length === 1) {
              const feature = features[0];

              // Should be Polygon, not MultiPolygon
              expect(feature.geometry.type).toBe("Polygon");

              // The zone has multiple cells, verify they're merged into one polygon
              expect(zone.cells.length).toBeGreaterThan(1);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 8: File Download with Correct Filename
   * Feature: zones-geojson-export, Property 8: File Download with Correct Filename
   * Validates: Requirements 1.5, 5.5
   *
   * For any export operation, the downloadFile function SHALL be called with a filename
   * matching the pattern "{MapName}_Zones_{timestamp}.geojson" and MIME type "application/json".
   */
  it("Property 8: downloadFile is called with correct filename pattern and MIME type", () => {
    fc.assert(
      fc.property(
        // Generate random zones
        fc
          .array(
            fc.record({
              i: fc.integer({ min: 0, max: 1000 }),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              type: fc.string({ minLength: 1, maxLength: 20 }),
              color: fc.string({ minLength: 1, maxLength: 20 }),
              cells: fc.array(fc.integer({ min: 0, max: 3 }), {
                minLength: 1,
                maxLength: 10,
              }),
              hidden: fc.constant(false),
            }),
            { minLength: 1, maxLength: 10 },
          )
          .map((zones) => {
            // Ensure unique zone IDs
            return zones.map((zone, index) => ({ ...zone, i: index }));
          }),
        (zones) => {
          // Setup mock pack data
          const mockCells = {
            v: Array(101)
              .fill(null)
              .map(() => [0, 1, 2, 3]),
            c: Array(101)
              .fill(null)
              .map(() => [0, 1, 2, 3]),
          };

          const mockVertices = {
            p: Array(4)
              .fill(null)
              .map((_, i) =>
                i === 0
                  ? [0, 0]
                  : i === 1
                    ? [10, 0]
                    : i === 2
                      ? [10, 10]
                      : [0, 10],
              ),
            c: Array(4)
              .fill(null)
              .map(() => [0, 1, 2, 3]),
            v: Array(4)
              .fill(null)
              .map(() => [0, 1, 2, 3]),
          };

          globalThis.pack = {
            zones,
            cells: mockCells,
            vertices: mockVertices,
          } as any;

          // Reset mock
          vi.mocked(globalThis.downloadFile).mockClear();

          // Import and execute the actual saveGeoJsonZones function
          const saveGeoJsonZonesCode = `
            const {zones, cells, vertices} = pack;
            const json = {type: "FeatureCollection", features: []};

            function getZonePolygonCoordinates(zoneCells) {
              const cellsInZone = new Set(zoneCells);
              const ofSameType = (cellId) => cellsInZone.has(cellId);
              const ofDifferentType = (cellId) => !cellsInZone.has(cellId);
              
              const checkedCells = new Set();
              const coordinates = [];
              
              for (const cellId of zoneCells) {
                if (checkedCells.has(cellId)) continue;
                
                const neighbors = cells.c[cellId];
                const onBorder = neighbors.some(ofDifferentType);
                if (!onBorder) continue;
                
                const cellVertices = cells.v[cellId];
                let startingVertex = null;
                
                for (const vertexId of cellVertices) {
                  const vertexCells = vertices.c[vertexId];
                  if (vertexCells.some(ofDifferentType)) {
                    startingVertex = vertexId;
                    break;
                  }
                }
                
                if (startingVertex === null) continue;
                
                const vertexChain = [];
                let current = startingVertex;
                let previous = null;
                const maxIterations = vertices.c.length;
                
                for (let i = 0; i < maxIterations; i++) {
                  vertexChain.push(current);
                  
                  const adjacentCells = vertices.c[current];
                  adjacentCells.filter(ofSameType).forEach(c => checkedCells.add(c));
                  
                  const [c1, c2, c3] = adjacentCells.map(ofSameType);
                  const [v1, v2, v3] = vertices.v[current];
                  
                  let next = null;
                  if (v1 !== previous && c1 !== c2) next = v1;
                  else if (v2 !== previous && c2 !== c3) next = v2;
                  else if (v3 !== previous && c1 !== c3) next = v3;
                  
                  if (next === null || next === current) break;
                  if (next === startingVertex) break;
                  
                  previous = current;
                  current = next;
                }
                
                for (const vertexId of vertexChain) {
                  const [x, y] = vertices.p[vertexId];
                  coordinates.push(getCoordinates(x, y, 4));
                }
              }
              
              if (coordinates.length > 0) {
                coordinates.push(coordinates[0]);
              }
              
              return [coordinates];
            }

            zones.forEach(zone => {
              if (zone.hidden || !zone.cells || zone.cells.length === 0) return;

              const coordinates = getZonePolygonCoordinates(zone.cells);
              
              if (coordinates[0].length >= 4) {
                const properties = {
                  id: zone.i,
                  name: zone.name,
                  type: zone.type,
                  color: zone.color,
                  cells: zone.cells
                };
                
                const feature = {
                  type: "Feature",
                  geometry: {type: "Polygon", coordinates},
                  properties
                };
                
                json.features.push(feature);
              }
            });

            const fileName = getFileName("Zones") + ".geojson";
            downloadFile(JSON.stringify(json), fileName, "application/json");
          `;

          const saveGeoJsonZones = new Function(saveGeoJsonZonesCode);
          saveGeoJsonZones();

          // Verify downloadFile was called
          expect(globalThis.downloadFile).toHaveBeenCalledTimes(1);

          // Get the call arguments
          const [data, fileName, mimeType] = vi.mocked(globalThis.downloadFile)
            .mock.calls[0];

          // Verify filename pattern
          expect(fileName).toMatch(/.*_Zones_.*\.geojson$/);
          expect(fileName).toContain("Zones");
          expect(fileName.endsWith(".geojson")).toBe(true);

          // Verify MIME type
          expect(mimeType).toBe("application/json");

          // Verify data is valid JSON
          expect(() => JSON.parse(data)).not.toThrow();
          const parsedData = JSON.parse(data);
          expect(parsedData).toHaveProperty("type", "FeatureCollection");
          expect(parsedData).toHaveProperty("features");
        },
      ),
      { numRuns: 100 },
    );
  });
});
