import { mean, quadtree } from "d3";
import { clipPolyline } from "lineclip";
import type { PackedGraph } from "../types/PackedGraph";
import {
  findAllCellsInRadius,
  findClosestCell,
  generateGrid,
  getPolesOfInaccessibility,
  isWater,
  rn,
  unique,
} from "../utils";
import type { River } from "./river-generator";
import type { Point } from "./voronoi";

declare global {
  var Resample: Resampler;
}

interface ResamplerProcessOptions {
  projection: (x: number, y: number) => [number, number];
  inverse: (x: number, y: number) => [number, number];
  scale: number;
}

type ParentMapDefinition = {
  grid: any;
  pack: PackedGraph;
  notes: any[];
};

class Resampler {
  private saveRiversData(parentRivers: PackedGraph["rivers"]) {
    return parentRivers.map((river) => {
      const meanderedPoints = Rivers.addMeandering(river.cells, river.points);
      return { ...river, meanderedPoints };
    });
  }

  private smoothHeightmap() {
    grid.cells.h.forEach((height: number, newGridCell: number) => {
      const heights = [
        height,
        ...grid.cells.c[newGridCell].map((c: number) => grid.cells.h[c]),
      ];
      const meanHeight = mean(heights) as number;
      grid.cells.h[newGridCell] = isWater(newGridCell, grid)
        ? Math.min(meanHeight, 19)
        : Math.max(meanHeight, 20);
    });
  }

  private resamplePrimaryGridData(
    parentMap: ParentMapDefinition,
    inverse: (x: number, y: number) => [number, number],
    scale: number,
  ) {
    grid.cells.h = new Uint8Array(grid.points.length);
    grid.cells.temp = new Int8Array(grid.points.length);
    grid.cells.prec = new Uint8Array(grid.points.length);

    const parentPackQ = quadtree(
      parentMap.pack.cells.p.map(([x, y], i) => [x, y, i]),
    );
    grid.points.forEach(([x, y]: [number, number], newGridCell: number) => {
      const [parentX, parentY] = inverse(x, y);
      const parentPackCell = parentPackQ.find(parentX, parentY, Infinity)?.[2];
      if (parentPackCell === undefined) return;
      const parentGridCell = parentMap.pack.cells.g[parentPackCell];

      grid.cells.h[newGridCell] = parentMap.grid.cells.h[parentGridCell];
      grid.cells.temp[newGridCell] = parentMap.grid.cells.temp[parentGridCell];
      grid.cells.prec[newGridCell] = parentMap.grid.cells.prec[parentGridCell];
    });

    if (scale >= 2) this.smoothHeightmap();
  }

  private groupCellsByType(graph: PackedGraph) {
    return graph.cells.p.reduce(
      (acc, [x, y], cellId) => {
        const group = isWater(cellId, graph) ? "water" : "land";
        acc[group].push([x, y, cellId]);
        return acc;
      },
      { land: [], water: [] } as Record<string, [number, number, number][]>,
    );
  }

  private isInMap(x: number, y: number) {
    return x >= 0 && x <= graphWidth && y >= 0 && y <= graphHeight;
  }

  private restoreCellData(
    parentMap: ParentMapDefinition,
    inverse: (x: number, y: number) => [number, number],
    scale: number,
  ) {
    pack.cells.biome = new Uint8Array(pack.cells.i.length);
    pack.cells.fl = new Uint16Array(pack.cells.i.length);
    pack.cells.s = new Int16Array(pack.cells.i.length);
    pack.cells.pop = new Float32Array(pack.cells.i.length);
    pack.cells.culture = new Uint16Array(pack.cells.i.length);
    pack.cells.state = new Uint16Array(pack.cells.i.length);
    pack.cells.burg = new Uint16Array(pack.cells.i.length);
    pack.cells.religion = new Uint16Array(pack.cells.i.length);
    pack.cells.province = new Uint16Array(pack.cells.i.length);

    const parentPackCellGroups = this.groupCellsByType(parentMap.pack);
    const parentPackLandCellsQuadtree = quadtree(parentPackCellGroups.land);

    for (const newPackCell of pack.cells.i) {
      const [x, y] = inverse(...pack.cells.p[newPackCell]);
      if (isWater(newPackCell, pack)) continue;

      const parentPackCell = parentPackLandCellsQuadtree.find(
        x,
        y,
        Infinity,
      )?.[2];
      if (parentPackCell === undefined) continue;
      const parentCellArea = parentMap.pack.cells.area[parentPackCell];
      const areaRatio = pack.cells.area[newPackCell] / parentCellArea;
      const scaleRatio = areaRatio / scale;

      pack.cells.biome[newPackCell] =
        parentMap.pack.cells.biome[parentPackCell];
      pack.cells.fl[newPackCell] = parentMap.pack.cells.fl[parentPackCell];
      pack.cells.s[newPackCell] =
        parentMap.pack.cells.s[parentPackCell] * scaleRatio;
      pack.cells.pop[newPackCell] =
        parentMap.pack.cells.pop[parentPackCell] * scaleRatio;
      pack.cells.culture[newPackCell] =
        parentMap.pack.cells.culture[parentPackCell];
      pack.cells.state[newPackCell] =
        parentMap.pack.cells.state[parentPackCell];
      pack.cells.religion[newPackCell] =
        parentMap.pack.cells.religion[parentPackCell];
      pack.cells.province[newPackCell] =
        parentMap.pack.cells.province[parentPackCell];
    }
  }

  private restoreRivers(
    riversData: (River & { meanderedPoints?: [number, number, number][] })[],
    projection: (x: number, y: number) => [number, number],
    scale: number,
  ) {
    pack.cells.r = new Uint16Array(pack.cells.i.length);
    pack.cells.conf = new Uint8Array(pack.cells.i.length);

    pack.rivers = riversData
      .map((river) => {
        let wasInMap = true;
        const points: Point[] = [];

        river.meanderedPoints?.forEach(([parentX, parentY]) => {
          const [x, y] = projection(parentX, parentY);
          const inMap = this.isInMap(x, y);
          if (inMap || wasInMap) points.push([rn(x, 2), rn(y, 2)]);
          wasInMap = inMap;
        });
        if (points.length < 2) return null;

        const cells = points
          .map((point) => findClosestCell(...point, Infinity, pack))
          .filter((cellId) => cellId !== undefined);
        cells.forEach((cellId) => {
          if (pack.cells.r[cellId]) pack.cells.conf[cellId] = 1;
          pack.cells.r[cellId] = river.i;
        });

        const widthFactor = river.widthFactor * scale;
        delete river.meanderedPoints;
        return {
          ...river,
          cells,
          points,
          source: cells.at(0) as number,
          mouth: cells.at(-2) as number,
          widthFactor,
        };
      })
      .filter((river) => river !== null);

    pack.rivers.forEach((river) => {
      river.basin = Rivers.getBasin(river.i);
      river.length = Rivers.getApproximateLength(river.points);
    });
  }

  private restoreCultures(
    parentMap: ParentMapDefinition,
    projection: (x: number, y: number) => [number, number],
  ) {
    const validCultures = new Set(pack.cells.culture);
    const culturePoles = getPolesOfInaccessibility(
      pack,
      (cellId) => pack.cells.culture[cellId],
    );
    pack.cultures = parentMap.pack.cultures.map((culture) => {
      if (!culture.i || culture.removed) return culture;
      if (!validCultures.has(culture.i))
        return { ...culture, removed: true, lock: false };

      const parentCoords = parentMap.pack.cells.p[culture.center!];
      const [xp, yp] = projection(parentCoords[0], parentCoords[1]);
      const [x, y] = [rn(xp, 2), rn(yp, 2)];
      const [centerX, centerY] = this.isInMap(x, y)
        ? [x, y]
        : culturePoles[culture.i];
      const center = findClosestCell(centerX, centerY, Infinity, pack);
      return { ...culture, center };
    });
  }

  private getBurgCoordinates(
    burg: PackedGraph["burgs"][number],
    closestCell: number,
    cell: number,
    xp: number,
    yp: number,
  ): Point {
    const haven = pack.cells.haven[cell];
    if (burg.port && haven) return this.getCloseToEdgePoint(cell, haven);

    if (closestCell !== cell) return pack.cells.p[cell];
    return [rn(xp, 2), rn(yp, 2)];
  }

  private getCloseToEdgePoint(cell1: number, cell2: number): Point {
    const { cells, vertices } = pack;

    const [x0, y0] = cells.p[cell1];
    const commonVertices = cells.v[cell1].filter((vertex) =>
      vertices.c[vertex].some((cell) => cell === cell2),
    );
    const [x1, y1] = vertices.p[commonVertices[0]];
    const [x2, y2] = vertices.p[commonVertices[1]];
    const xEdge = (x1 + x2) / 2;
    const yEdge = (y1 + y2) / 2;

    const x = rn(x0 + 0.95 * (xEdge - x0), 2);
    const y = rn(y0 + 0.95 * (yEdge - y0), 2);

    return [x, y];
  }

  private restoreBurgs(
    parentMap: ParentMapDefinition,
    projection: (x: number, y: number) => [number, number],
    scale: number,
  ) {
    const packLandCellsQuadtree = quadtree(this.groupCellsByType(pack).land);
    const findLandCell = (x: number, y: number) =>
      packLandCellsQuadtree.find(x, y, Infinity)?.[2];

    pack.burgs = parentMap.pack.burgs.map((burg) => {
      if (!burg.i || burg.removed) return burg;
      burg.population! *= scale; // adjust for populationRate change

      const [xp, yp] = projection(burg.x, burg.y);
      if (!this.isInMap(xp, yp)) return { ...burg, removed: true, lock: false };

      const closestCell = findClosestCell(xp, yp, Infinity, pack) as number;
      const cell = isWater(closestCell, pack)
        ? (findLandCell(xp, yp) as number)
        : closestCell;

      if (pack.cells.burg[cell]) {
        WARN &&
          console.warn(
            `Cell ${cell} already has a burg. Removing burg ${burg.name} (${burg.i})`,
          );
        return { ...burg, removed: true, lock: false };
      }

      pack.cells.burg[cell] = burg.i;
      const [x, y] = this.getBurgCoordinates(burg, closestCell, cell, xp, yp);
      return { ...burg, cell, x, y };
    });
  }

  private restoreStates(
    parentMap: ParentMapDefinition,
    projection: (x: number, y: number) => [number, number],
  ) {
    const validStates = new Set(pack.cells.state);
    pack.states = parentMap.pack.states.map((state) => {
      if (!state.i || state.removed) return state;
      if (validStates.has(state.i)) return state;
      return { ...state, removed: true, lock: false };
    });

    States.getPoles();
    const regimentCellsMap: Record<number, number> = {};
    const VERTICAL_GAP = 8;

    pack.states = pack.states.map((state) => {
      if (!state.i || state.removed) return state;

      const capital = pack.burgs[state.capital];
      const [poleX, poleY] = state.pole as Point;
      state.center =
        !capital || capital.removed
          ? findClosestCell(poleX, poleY, Infinity, pack)!
          : capital.cell;

      const military = state.military!.map((regiment) => {
        const cellCoords = projection(...parentMap.pack.cells.p[regiment.cell]);
        const cell = this.isInMap(...cellCoords)
          ? findClosestCell(...cellCoords, Infinity, pack)!
          : state.center;

        const [xPos, yPos] = projection(regiment.x, regiment.y);
        const [xBase, yBase] = projection(regiment.bx, regiment.by);
        const [xCell, yCell] = pack.cells.p[cell];

        const regsOnCell = regimentCellsMap[cell] || 0;
        regimentCellsMap[cell] = regsOnCell + 1;

        const name =
          this.isInMap(xPos, yPos) || regiment.name.includes("[relocated]")
            ? regiment.name
            : `[relocated] ${regiment.name}`;

        const pos = this.isInMap(xPos, yPos)
          ? { x: rn(xPos, 2), y: rn(yPos, 2) }
          : { x: xCell, y: yCell + regsOnCell * VERTICAL_GAP };

        const base = this.isInMap(xBase, yBase)
          ? { bx: rn(xBase, 2), by: rn(yBase, 2) }
          : { bx: xCell, by: yCell };

        return { ...regiment, cell, name, ...base, ...pos };
      });

      const neighbors = state.neighbors!.filter((stateId) =>
        validStates.has(stateId),
      );
      return { ...state, neighbors, military };
    });
  }

  private restoreRoutes(
    parentMap: ParentMapDefinition,
    projection: (x: number, y: number) => [number, number],
  ) {
    pack.routes = parentMap.pack.routes
      .map((route) => {
        let wasInMap = true;
        const points: Point[] = [];

        route.points.forEach(([parentX, parentY]) => {
          const [x, y] = projection(parentX, parentY);
          const inMap = this.isInMap(x, y);
          if (inMap || wasInMap) points.push([rn(x, 2), rn(y, 2)]);
          wasInMap = inMap;
        });
        if (points.length < 2) return null;

        const bbox: [number, number, number, number] = [
          0,
          0,
          graphWidth,
          graphHeight,
        ];
        // @types/lineclip is incorrect - lineclip returns Point[][] (array of line segments), not Point[]
        const clippedSegments = clipPolyline(
          points,
          bbox,
        ) as unknown as Point[][];
        if (!clippedSegments[0]?.length) return null;
        const clipped = clippedSegments[0].map(
          ([x, y]) =>
            [
              rn(x, 2),
              rn(y, 2),
              findClosestCell(x, y, Infinity, pack) as number,
            ] as [number, number, number],
        );
        const firstCell = clipped[0][2];
        const feature = pack.cells.f[firstCell];
        return { ...route, feature, points: clipped };
      })
      .filter((route) => route !== null);

    pack.cells.routes = Routes.buildLinks(pack.routes);
  }

  private restoreReligions(
    parentMap: ParentMapDefinition,
    projection: (x: number, y: number) => [number, number],
  ) {
    const validReligions = new Set(pack.cells.religion);
    const religionPoles = getPolesOfInaccessibility(
      pack,
      (cellId) => pack.cells.religion[cellId],
    );

    pack.religions = parentMap.pack.religions.map((religion) => {
      if (!religion.i || religion.removed) return religion;
      if (!validReligions.has(religion.i))
        return { ...religion, removed: true, lock: false };

      const [xp, yp] = projection(...parentMap.pack.cells.p[religion.center]);
      const [x, y] = [rn(xp, 2), rn(yp, 2)];
      const [centerX, centerY] = this.isInMap(x, y)
        ? [x, y]
        : religionPoles[religion.i];
      const center = findClosestCell(centerX, centerY, Infinity, pack);
      return { ...religion, center };
    });
  }

  private restoreProvinces(parentMap: ParentMapDefinition) {
    const validProvinces = new Set(pack.cells.province);
    pack.provinces = parentMap.pack.provinces.map((province) => {
      if (!province.i || province.removed) return province;
      if (!validProvinces.has(province.i))
        return { ...province, removed: true, lock: false };

      return province;
    });

    Provinces.getPoles();

    pack.provinces.forEach((province) => {
      if (!province.i || province.removed) return;
      const capital = pack.burgs[province.burg];
      const [poleX, poleY] = province.pole as Point;
      province.center = !capital?.removed
        ? capital.cell
        : findClosestCell(poleX, poleY, Infinity, pack)!;
    });
  }

  private restoreFeatureDetails(
    parentMap: ParentMapDefinition,
    inverse: (x: number, y: number) => [number, number],
  ) {
    const parentPackQ = quadtree(
      parentMap.pack.cells.p.map(([x, y], i) => [x, y, i]),
    );
    pack.features.forEach((feature) => {
      if (!feature) return;
      const [x, y] = pack.cells.p[feature.firstCell];
      const [parentX, parentY] = inverse(x, y);
      const parentCell = parentPackQ.find(parentX, parentY, Infinity)?.[2];
      if (parentCell === undefined) return;
      const parentFeature =
        parentMap.pack.features[parentMap.pack.cells.f[parentCell]];

      if (parentFeature.group) feature.group = parentFeature.group;
      if (parentFeature.name) feature.name = parentFeature.name;
      if (parentFeature.height) feature.height = parentFeature.height;
    });
  }

  private restoreMarkers(
    parentMap: ParentMapDefinition,
    projection: (x: number, y: number) => [number, number],
  ) {
    pack.markers = parentMap.pack.markers;
    pack.markers.forEach((marker) => {
      const [x, y] = projection(marker.x, marker.y);
      if (!this.isInMap(x, y)) Markers.deleteMarker(marker.i);

      const cell = findClosestCell(x, y, Infinity, pack);
      marker.x = rn(x, 2);
      marker.y = rn(y, 2);
      marker.cell = cell;
    });
  }

  private restoreZones(
    parentMap: ParentMapDefinition,
    projection: (x: number, y: number) => [number, number],
    scale: number,
  ) {
    const getSearchRadius = (cellId: number) =>
      Math.sqrt(parentMap.pack.cells.area[cellId] / Math.PI) * scale;

    pack.zones = parentMap.pack.zones.map((zone) => {
      const cells = zone.cells.flatMap((cellId) => {
        const [newX, newY] = projection(...parentMap.pack.cells.p[cellId]);
        if (!this.isInMap(newX, newY)) return [];
        return findAllCellsInRadius(newX, newY, getSearchRadius(cellId), pack);
      });

      return { ...zone, cells: unique(cells) };
    });
  }

  process(options: ResamplerProcessOptions): void {
    const { projection, inverse, scale } = options;
    const parentMap = {
      grid: structuredClone(grid),
      pack: structuredClone(pack),
      notes: structuredClone(notes),
    };
    const riversData = this.saveRiversData(pack.rivers);

    grid = generateGrid(seed, graphWidth, graphHeight);
    pack = {} as PackedGraph;
    notes = parentMap.notes;

    this.resamplePrimaryGridData(parentMap, inverse, scale);

    Features.markupGrid();
    addLakesInDeepDepressions();
    openNearSeaLakes();

    OceanLayers();
    calculateMapCoordinates();
    calculateTemperatures();

    reGraph();
    Features.markupPack();
    Ice.generate();
    createDefaultRuler();

    this.restoreCellData(parentMap, inverse, scale);
    this.restoreRivers(riversData, projection, scale);
    this.restoreCultures(parentMap, projection);
    this.restoreBurgs(parentMap, projection, scale);
    this.restoreStates(parentMap, projection);
    this.restoreRoutes(parentMap, projection);
    this.restoreReligions(parentMap, projection);
    this.restoreProvinces(parentMap);
    this.restoreFeatureDetails(parentMap, inverse);
    this.restoreMarkers(parentMap, projection);
    this.restoreZones(parentMap, projection, scale);

    showStatistics();
  }
}

window.Resample = new Resampler();
