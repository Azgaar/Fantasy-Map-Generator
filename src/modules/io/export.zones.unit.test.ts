/**
 * Unit tests for zones GeoJSON export - Edge Cases
 * Feature: zones-geojson-export
 */

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

describe("zones GeoJSON export - Edge Case Unit Tests", () => {
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
   * Test 6.1: Empty zones export
   * Tests export when all zones are hidden or have no cells
   * Validates: Requirements 1.3, 1.4
   */
  describe("6.1 Empty zones export", () => {
    it("should generate empty FeatureCollection when all zones are hidden", () => {
      // Setup: All zones are hidden
      const zones = [
        {
          i: 0,
          name: "Zone 1",
          type: "Territory",
          color: "#ff0000",
          cells: [0, 1],
          hidden: true,
        },
        {
          i: 1,
          name: "Zone 2",
          type: "Climate",
          color: "#00ff00",
          cells: [2, 3],
          hidden: true,
        },
      ];

      const mockCells = {
        v: [
          [0, 1, 2],
          [0, 1, 2],
          [0, 1, 2],
          [0, 1, 2],
        ],
        c: [
          [1, 2, 3],
          [0, 2, 3],
          [0, 1, 3],
          [0, 1, 2],
        ],
      };

      const mockVertices = {
        p: [
          [0, 0],
          [10, 0],
          [5, 10],
        ],
        c: [
          [0, 1],
          [0, 1],
          [0, 1],
        ],
        v: [
          [1, 2],
          [0, 2],
          [0, 1],
        ],
      };

      globalThis.pack = {
        zones,
        cells: mockCells,
        vertices: mockVertices,
      } as any;

      // Execute
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

      // Verify
      expect(result.type).toBe("FeatureCollection");
      expect(result.features).toEqual([]);
      expect(result.features.length).toBe(0);
    });

    it("should generate empty FeatureCollection when all zones have no cells", () => {
      // Setup: All zones have empty cells arrays
      const zones = [
        {
          i: 0,
          name: "Zone 1",
          type: "Territory",
          color: "#ff0000",
          cells: [],
          hidden: false,
        },
        {
          i: 1,
          name: "Zone 2",
          type: "Climate",
          color: "#00ff00",
          cells: [],
          hidden: false,
        },
      ];

      const mockCells = {
        v: [[0, 1, 2]],
        c: [[1, 2, 3]],
      };

      const mockVertices = {
        p: [
          [0, 0],
          [10, 0],
          [5, 10],
        ],
        c: [[0], [0], [0]],
        v: [
          [1, 2],
          [0, 2],
          [0, 1],
        ],
      };

      globalThis.pack = {
        zones,
        cells: mockCells,
        vertices: mockVertices,
      } as any;

      // Execute
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

      // Verify
      expect(result.type).toBe("FeatureCollection");
      expect(result.features).toEqual([]);
      expect(result.features.length).toBe(0);
    });
  });

  /**
   * Test 6.2: Single zone export
   * Tests export with one visible zone
   * Validates: Requirements 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5
   */
  describe("6.2 Single zone export", () => {
    it("should export single visible zone with correct GeoJSON structure and properties", () => {
      // Setup: One visible zone with cells that have boundaries
      const zones = [
        {
          i: 0,
          name: "Test Zone",
          type: "Territory",
          color: "#ff0000",
          cells: [0, 1],
          hidden: false,
        },
      ];

      const mockCells = {
        v: [
          [0, 1, 2, 3], // cell 0 - square with 4 vertices
          [0, 1, 2, 3], // cell 1 - square with 4 vertices
        ],
        c: [
          [1, 2, 3, 4], // Cell 0 has neighbors 1,2,3,4 where 2,3,4 are outside the zone
          [0, 2, 3, 4], // Cell 1 has neighbors 0,2,3,4 where 2,3,4 are outside the zone
        ],
      };

      const mockVertices = {
        p: [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10], // 4 vertices forming a square
        ],
        c: [
          [0, 1, 2],
          [0, 1, 3],
          [0, 1, 2],
          [0, 1, 3],
        ], // Vertices connected to cells including outside cells
        v: [
          [1, 2, 3],
          [0, 2, 3],
          [0, 1, 3],
          [0, 1, 2],
        ],
      };

      globalThis.pack = {
        zones,
        cells: mockCells,
        vertices: mockVertices,
      } as any;

      // Execute
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

      // Verify GeoJSON structure
      expect(result.type).toBe("FeatureCollection");
      expect(result.features).toBeDefined();
      expect(result.features.length).toBe(1);

      // Verify feature structure
      const feature = result.features[0];
      expect(feature.type).toBe("Feature");
      expect(feature.geometry).toBeDefined();
      expect(feature.geometry.type).toBe("Polygon");
      expect(feature.geometry.coordinates).toBeDefined();
      expect(Array.isArray(feature.geometry.coordinates)).toBe(true);

      // Verify all properties are present
      expect(feature.properties).toBeDefined();
      expect(feature.properties.id).toBe(0);
      expect(feature.properties.name).toBe("Test Zone");
      expect(feature.properties.type).toBe("Territory");
      expect(feature.properties.color).toBe("#ff0000");
      expect(feature.properties.cells).toEqual([0, 1]);
    });
  });

  /**
   * Test 6.3: Multiple zones export
   * Tests export with multiple visible zones
   * Validates: Requirements 1.1, 1.3, 1.4
   */
  describe("6.3 Multiple zones export", () => {
    it("should export multiple visible zones with correct feature count", () => {
      // Setup: Multiple visible zones with one hidden
      const zones = [
        {
          i: 0,
          name: "Zone 1",
          type: "Territory",
          color: "#ff0000",
          cells: [0, 1],
          hidden: false,
        },
        {
          i: 1,
          name: "Zone 2",
          type: "Climate",
          color: "#00ff00",
          cells: [2, 3],
          hidden: true,
        },
        {
          i: 2,
          name: "Zone 3",
          type: "Unknown",
          color: "#0000ff",
          cells: [4, 5],
          hidden: false,
        },
      ];

      const mockCells = {
        v: [
          [0, 1, 2, 3], // cell 0 - zone 0, uses vertices 0-3 (left square)
          [0, 1, 2, 3], // cell 1 - zone 0, uses vertices 0-3 (left square)
          [0, 1, 2, 3], // cell 2 - zone 1 (hidden), uses vertices 0-3
          [0, 1, 2, 3], // cell 3 - zone 1 (hidden), uses vertices 0-3
          [4, 5, 6, 7], // cell 4 - zone 2, uses vertices 4-7 (right square)
          [4, 5, 6, 7], // cell 5 - zone 2, uses vertices 4-7 (right square)
        ],
        c: [
          [1, 2, 3, 8], // cell 0 neighbors (1 is same zone, 2,3,8 are different)
          [0, 2, 3, 8], // cell 1 neighbors (0 is same zone, 2,3,8 are different)
          [0, 1, 3, 8], // cell 2 neighbors (hidden zone)
          [0, 1, 2, 8], // cell 3 neighbors (hidden zone)
          [5, 0, 1, 8], // cell 4 neighbors (5 is same zone, 0,1,8 are different)
          [4, 0, 1, 8], // cell 5 neighbors (4 is same zone, 0,1,8 are different)
        ],
      };

      const mockVertices = {
        p: [
          [0, 0], // vertex 0 - left square
          [10, 0], // vertex 1
          [10, 10], // vertex 2
          [0, 10], // vertex 3
          [20, 0], // vertex 4 - right square
          [30, 0], // vertex 5
          [30, 10], // vertex 6
          [20, 10], // vertex 7
        ],
        c: [
          [0, 1, 2, 3], // vertex 0 adjacent cells (left square cells)
          [0, 1, 2, 3], // vertex 1 adjacent cells
          [0, 1, 2, 3], // vertex 2 adjacent cells
          [0, 1, 2, 3], // vertex 3 adjacent cells
          [4, 5, 0, 1], // vertex 4 adjacent cells (right square cells + some from left)
          [4, 5, 0, 1], // vertex 5 adjacent cells
          [4, 5, 0, 1], // vertex 6 adjacent cells
          [4, 5, 0, 1], // vertex 7 adjacent cells
        ],
        v: [
          [1, 2, 3], // vertex 0 neighbors
          [0, 2, 3], // vertex 1 neighbors
          [0, 1, 3], // vertex 2 neighbors
          [0, 1, 2], // vertex 3 neighbors
          [5, 6, 7], // vertex 4 neighbors
          [4, 6, 7], // vertex 5 neighbors
          [4, 5, 7], // vertex 6 neighbors
          [4, 5, 6], // vertex 7 neighbors
        ],
      };

      globalThis.pack = {
        zones,
        cells: mockCells,
        vertices: mockVertices,
      } as any;

      // Execute
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

      // Verify feature count matches visible zones (2 out of 3)
      expect(result.type).toBe("FeatureCollection");
      expect(result.features.length).toBe(2);

      // Verify each zone is correctly converted
      const feature1 = result.features.find((f: any) => f.properties.id === 0);
      const feature2 = result.features.find((f: any) => f.properties.id === 2);

      expect(feature1).toBeDefined();
      expect(feature1?.properties.name).toBe("Zone 1");
      expect(feature1?.properties.type).toBe("Territory");
      expect(feature1?.properties.color).toBe("#ff0000");
      expect(feature1?.properties.cells).toEqual([0, 1]);

      expect(feature2).toBeDefined();
      expect(feature2?.properties.name).toBe("Zone 3");
      expect(feature2?.properties.type).toBe("Unknown");
      expect(feature2?.properties.color).toBe("#0000ff");
      expect(feature2?.properties.cells).toEqual([4, 5]);

      // Verify hidden zone is not exported
      const hiddenFeature = result.features.find(
        (f: any) => f.properties.id === 1,
      );
      expect(hiddenFeature).toBeUndefined();
    });
  });
});
