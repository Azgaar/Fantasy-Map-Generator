import { clipPoly, connectVertices, createTypedArray, distanceSquared, isLand, isWater, rn, TYPED_ARRAY_MAX_VALUES,unique } from "../utils";
import Alea from "alea";
import { polygonArea } from "d3";
import { LakesModule } from "./lakes";
import { PackedGraph } from "./PackedGraph";

declare global {
  interface Window {
    Features: any;
  }
  var TIME: boolean;
  var Lakes: LakesModule;
  var grid: any;
  var pack: PackedGraph;
  var seed: string;
}

type FeatureType = "ocean" | "lake" | "island";

export interface PackedGraphFeature {
  i: number;
  type: FeatureType;
  land: boolean;
  border: boolean;
  cells: number;
  firstCell: number;
  vertices: number[];
  area: number;
  shoreline: number[];
  height: number;
  group: string;
  temp: number;
  flux: number;
  evaporation: number;
  name: string;

  // River related
  inlets?: number[];
  outlet?: number;
  river?: number;
  enteringFlux?: number;
  closed?: boolean;
  outCell?: number;
}

export interface GridFeature {
  i: number;
  land: boolean;
  border: boolean;
  type: FeatureType;
}

class FeatureModule {
  private DEEPER_LAND = 3;
  private LANDLOCKED = 2;
  private LAND_COAST = 1;
  private UNMARKED = 0;
  private WATER_COAST = -1;
  private DEEP_WATER = -2;

  private get grid() {
    return grid;
  }

  private get packedGraph() {
    return pack;
  }

  private get seed() {
    return seed;
  }

  /**
   * calculate distance to coast for every cell
   */
  private markup({ distanceField, neighbors, start, increment, limit = TYPED_ARRAY_MAX_VALUES.INT8_MAX }: {
    distanceField: Int8Array;
    neighbors: number[][];
    start: number;
    increment: number;
    limit?: number;
  }) {
    for (let distance = start, marked = Infinity; marked > 0 && distance !== limit; distance += increment) {
      marked = 0;
      const prevDistance = distance - increment;
      for (let cellId = 0; cellId < neighbors.length; cellId++) {
        if (distanceField[cellId] !== prevDistance) continue;

        for (const neighborId of neighbors[cellId]) {
          if (distanceField[neighborId] !== this.UNMARKED) continue;
          distanceField[neighborId] = distance;
          marked++;
        }
      }
    }
  }

  /**
   * mark Grid features (ocean, lakes, islands) and calculate distance field
   */
  markupGrid() {
    TIME && console.time("markupGrid");
    Math.random = Alea(this.seed); // get the same result on heightmap edit in Erase mode

    const { h: heights, c: neighbors, b: borderCells, i } = this.grid.cells;
    const cellsNumber = i.length;
    const distanceField = new Int8Array(cellsNumber); // gird.cells.t
    const featureIds = new Uint16Array(cellsNumber); // gird.cells.f
    const features: GridFeature[] = [];

    const queue = [0];
    for (let featureId = 1; queue[0] !== -1; featureId++) {
      const firstCell = queue[0];
      featureIds[firstCell] = featureId;

      const land = heights[firstCell] >= 20;
      let border = false; // set true if feature touches map edge

      while (queue.length) {
        const cellId = queue.pop() as number;
        if (!border && borderCells[cellId]) border = true;

        for (const neighborId of neighbors[cellId]) {
          const isNeibLand = heights[neighborId] >= 20;

          if (land === isNeibLand && featureIds[neighborId] === this.UNMARKED) {
            featureIds[neighborId] = featureId;
            queue.push(neighborId);
          } else if (land && !isNeibLand) {
            distanceField[cellId] = this.LAND_COAST;
            distanceField[neighborId] = this.WATER_COAST;
          }
        }
      }

      const type = land ? "island" : border ? "ocean" : "lake";
      features.push({ i: featureId, land, border, type });

      queue[0] = featureIds.findIndex(f => f === this.UNMARKED); // find unmarked cell
    }

    // markup deep ocean cells
    this.markup({ distanceField, neighbors, start: this.DEEP_WATER, increment: -1, limit: -10 });
    this.grid.cells.t = distanceField;
    this.grid.cells.f = featureIds;
    this.grid.features = [0, ...features];

    TIME && console.timeEnd("markupGrid");
  }

  /**
   * mark PackedGraph features (oceans, lakes, islands) and calculate distance field
   */
  markupPack() {
    const defineHaven = (cellId: number) => {
      const waterCells = neighbors[cellId].filter((index: number) => isWater(index, this.packedGraph));
      const distances = waterCells.map((neibCellId: number) => distanceSquared(cells.p[cellId], cells.p[neibCellId]));
      const closest = distances.indexOf(Math.min.apply(Math, distances));

      haven[cellId] = waterCells[closest];
      harbor[cellId] = waterCells.length;
    }

    const getCellsData = (featureType: string, firstCell: number): [number, number[]] => {
      if (featureType === "ocean") return [firstCell, []];

      const getType = (cellId: number) => featureIds[cellId];
      const type = getType(firstCell);
      const ofSameType = (cellId: number) => getType(cellId) === type;
      const ofDifferentType = (cellId: number) => getType(cellId) !== type;

      const startCell = findOnBorderCell(firstCell);
      const featureVertices = getFeatureVertices(startCell);
      return [startCell, featureVertices];

      function findOnBorderCell(firstCell: number) {
        const isOnBorder = (cellId: number) => borderCells[cellId] || neighbors[cellId].some(ofDifferentType);
        if (isOnBorder(firstCell)) return firstCell;

        const startCell = cells.i.filter(ofSameType).find(isOnBorder);
        if (startCell === undefined)
          throw new Error(`Markup: firstCell ${firstCell} is not on the feature or map border`);

        return startCell;
      }

      function getFeatureVertices(startCell: number) {
        const startingVertex = cells.v[startCell].find((v: number) => vertices.c[v].some(ofDifferentType));
        if (startingVertex === undefined)
          throw new Error(`Markup: startingVertex for cell ${startCell} is not found`);

        return connectVertices({ vertices, startingVertex, ofSameType, closeRing: false });
      }
    }

    const addFeature = ({ firstCell, land, border, featureId, totalCells }: { firstCell: number; land: boolean; border: boolean; featureId: number; totalCells: number }): PackedGraphFeature => {
      const type = land ? "island" : border ? "ocean" : "lake";
      const [startCell, featureVertices] = getCellsData(type, firstCell);
      const points = clipPoly(featureVertices.map((vertex: number) => vertices.p[vertex]));
      const area = polygonArea(points); // feature perimiter area
      const absArea = Math.abs(rn(area));

      const feature: Partial<PackedGraphFeature> = {
        i: featureId,
        type,
        land,
        border,
        cells: totalCells,
        firstCell: startCell,
        vertices: featureVertices,
        area: absArea,
        shoreline: [],
        height: 0,
      };

      if (type === "lake") {
        if (area > 0) feature.vertices = (feature.vertices as number[]).reverse();
        feature.shoreline = unique((feature.vertices as number[]).map(vertex => vertices.c[vertex].filter((index: number) => isLand(index, this.packedGraph))).flat() || []);
        feature.height = Lakes.getHeight(feature as PackedGraphFeature);
      }

      return {
        ...feature
      } as PackedGraphFeature;
    }

    TIME && console.time("markupPack");

    const { cells, vertices } = this.packedGraph;
    const { c: neighbors, b: borderCells, i } = cells;
    const packCellsNumber = i.length;
    if (!packCellsNumber) return; // no cells -> there is nothing to do

    const distanceField = new Int8Array(packCellsNumber); // pack.cells.t
    const featureIds = new Uint16Array(packCellsNumber); // pack.cells.f
    const haven = createTypedArray({ maxValue: packCellsNumber, length: packCellsNumber }); // haven: opposite water cell
    const harbor = new Uint8Array(packCellsNumber); // harbor: number of adjacent water cells
    const features: PackedGraphFeature[] = [];

    const queue = [0];
    for (let featureId = 1; queue[0] !== -1; featureId++) {
      const firstCell = queue[0];
      featureIds[firstCell] = featureId;

      const land = isLand(firstCell, this.packedGraph);
      let border = Boolean(borderCells[firstCell]); // true if feature touches map border
      let totalCells = 1; // count cells in a feature

      while (queue.length) {
        const cellId = queue.pop() as number;
        if (borderCells[cellId]) border = true;
        if (!border && borderCells[cellId]) border = true;

        for (const neighborId of neighbors[cellId]) {
          const isNeibLand = isLand(neighborId, this.packedGraph);

          if (land && !isNeibLand) {
            distanceField[cellId] = this.LAND_COAST;
            distanceField[neighborId] = this.WATER_COAST;
            if (!haven[cellId]) defineHaven(cellId);
          } else if (land && isNeibLand) {
            if (distanceField[neighborId] === this.UNMARKED && distanceField[cellId] === this.LAND_COAST)
              distanceField[neighborId] = this.LANDLOCKED;
            else if (distanceField[cellId] === this.UNMARKED && distanceField[neighborId] === this.LAND_COAST)
              distanceField[cellId] = this.LANDLOCKED;
          }

          if (!featureIds[neighborId] && land === isNeibLand) {
            queue.push(neighborId);
            featureIds[neighborId] = featureId;
            totalCells++;
          }
        }
      }

      features.push(addFeature({ firstCell, land, border, featureId, totalCells }));
      queue[0] = featureIds.findIndex(f => f === this.UNMARKED); // find unmarked cell
    }

    this.markup({ distanceField, neighbors, start: this.DEEPER_LAND, increment: 1 }); // markup pack land
    this.markup({ distanceField, neighbors, start: this.DEEP_WATER, increment: -1, limit: -10 }); // markup pack water

    this.packedGraph.cells.t = distanceField;
    this.packedGraph.cells.f = featureIds;
    this.packedGraph.cells.haven = haven;
    this.packedGraph.cells.harbor = harbor;
    this.packedGraph.features = [0 as unknown as PackedGraphFeature, ...features];

    TIME && console.timeEnd("markupPack");
  }

  /**
   * define feature groups (ocean, sea, gulf, continent, island, isle, freshwater lake, salt lake, etc.)
   */
  defineGroups() {
    const gridCellsNumber = this.grid.cells.i.length;
    const OCEAN_MIN_SIZE = gridCellsNumber / 25;
    const SEA_MIN_SIZE = gridCellsNumber / 1000;
    const CONTINENT_MIN_SIZE = gridCellsNumber / 10;
    const ISLAND_MIN_SIZE = gridCellsNumber / 1000;

    const defineIslandGroup = (feature: PackedGraphFeature) => {
      const prevFeature = this.packedGraph.features[this.packedGraph.cells.f[feature.firstCell - 1]];
      if (prevFeature && prevFeature.type === "lake") return "lake_island";
      if (feature.cells > CONTINENT_MIN_SIZE) return "continent";
      if (feature.cells > ISLAND_MIN_SIZE) return "island";
      return "isle";
    }

    const defineOceanGroup = (feature: PackedGraphFeature) => {
      if (feature.cells > OCEAN_MIN_SIZE) return "ocean";
      if (feature.cells > SEA_MIN_SIZE) return "sea";
      return "gulf";
    }

    const defineLakeGroup = (feature: PackedGraphFeature) => {
      if (feature.temp < -3) return "frozen";
      if (feature.height > 60 && feature.cells < 10 && feature.firstCell % 10 === 0) return "lava";

      if (!feature.inlets && !feature.outlet) {
        if (feature.evaporation > feature.flux * 4) return "dry";
        if (feature.cells < 3 && feature.firstCell % 10 === 0) return "sinkhole";
      }

      if (!feature.outlet && feature.evaporation > feature.flux) return "salt";

      return "freshwater";
    }

    const defineGroup = (feature: PackedGraphFeature) => {
      if (feature.type === "island") return defineIslandGroup(feature);
      if (feature.type === "ocean") return defineOceanGroup(feature);
      if (feature.type === "lake") return defineLakeGroup(feature);
      throw new Error(`Markup: unknown feature type ${feature.type}`);
    }

    for (const feature of this.packedGraph.features) {
      if (!feature || feature.type === "ocean") continue;

      if (feature.type === "lake") feature.height = Lakes.getHeight(feature);
      feature.group = defineGroup(feature);
    }
  }
}

window.Features = new FeatureModule();
