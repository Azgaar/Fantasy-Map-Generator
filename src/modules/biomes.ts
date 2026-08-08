import { mean, range } from "d3";
import { rn } from "../utils";

declare global {
  var Biomes: BiomesModule;
}

class BiomesModule {
  private MIN_LAND_HEIGHT = 20;

  getDefault() {
    const name: string[] = [
      "Marine",
      "Hot desert",
      "Cold desert",
      "Savanna",
      "Grassland",
      "Tropical seasonal forest",
      "Temperate deciduous forest",
      "Tropical rainforest",
      "Temperate rainforest",
      "Taiga",
      "Tundra",
      "Glacier",
      "Wetland",
      "Shallow Reef",
      "Kelp Forest",
      "Pelagic Zone",
      "Abyssal Plain",
      "Oceanic Trench",
      "Chaos Land",
      "Chaos Water"
    ];

    const color: string[] = [
      "#466eab",
      "#fbe79f",
      "#b5b887",
      "#d2d082",
      "#c8d68f",
      "#b6d95d",
      "#29bc56",
      "#7dcb35",
      "#409c43",
      "#4b6b32",
      "#96784b",
      "#d5e7eb",
      "#0b9131",
      "#006994",
      "#004B49",
      "#000080",
      "#000033",
      "#000011",
      "#4B0082",
      "#190033"
    ];
    const habitability: number[] = [50, 4, 10, 22, 30, 50, 100, 80, 90, 12, 4, 0, 12, 80, 70, 30, 5, 0, 2, 2];
    const iconsDensity: number[] = [0, 3, 2, 120, 120, 120, 120, 150, 150, 100, 5, 0, 250, 200, 150, 0, 0, 0, 10, 0];
    const icons: Array<{ [key: string]: number }> = [
      {},
      { dune: 3, cactus: 6, deadTree: 1 },
      { dune: 9, deadTree: 1 },
      { acacia: 1, grass: 9 },
      { grass: 1 },
      { acacia: 8, palm: 1 },
      { deciduous: 1 },
      { acacia: 5, palm: 3, deciduous: 1, swamp: 1 },
      { deciduous: 6, swamp: 1 },
      { conifer: 1 },
      { grass: 1 },
      {},
      { swamp: 1 },
      {},
      {},
      {},
      {},
      {},
      { deadTree: 5 },
      {}
    ];
    const cost: number[] = [
      10, 200, 150, 60, 50, 70, 70, 80, 90, 200, 1000, 5000, 150, 30, 40, 200, 1000, 5000, 2000, 2000
    ]; // biome movement cost
    const biomesMatrix: Uint8Array[] = [
      // hot ↔ cold [>19°C; <-4°C]; dry ↕ wet
      new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 10]),
      new Uint8Array([3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 9, 9, 9, 9, 10, 10, 10]),
      new Uint8Array([5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 9, 9, 9, 9, 9, 10, 10, 10]),
      new Uint8Array([5, 6, 6, 6, 6, 6, 6, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 10, 10, 10]),
      new Uint8Array([7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 9, 10, 10])
    ];

    // parse icons weighted array into a simple array
    const parsedIcons: string[][] = [];
    for (let i = 0; i < icons.length; i++) {
      const parsed: string[] = [];
      for (const icon in icons[i]) {
        for (let j = 0; j < icons[i][icon]; j++) {
          parsed.push(icon);
        }
      }
      parsedIcons[i] = parsed;
    }

    return {
      i: range(0, name.length),
      name,
      color,
      biomesMatrix,
      habitability,
      iconsDensity,
      icons: parsedIcons,
      cost
    };
  }

  define() {
    TIME && console.time("defineBiomes");

    const { fl: flux, r: riverIds, h: heights, c: neighbors, g: gridReference } = pack.cells;
    const { temp, prec } = grid.cells;
    pack.cells.biome = new Uint8Array(pack.cells.i.length); // biomes array

    const calculateMoisture = (cellId: number) => {
      let moisture = prec[gridReference[cellId]];
      if (riverIds[cellId]) moisture += Math.max(flux[cellId] / 10, 2);

      const moistAround = neighbors[cellId]
        .filter((neibCellId: number) => heights[neibCellId] >= this.MIN_LAND_HEIGHT)
        .map((c: number) => prec[gridReference[c]])
        .concat([moisture]);
      return rn(4 + (mean(moistAround) as number));
    };

    for (let cellId = 0; cellId < heights.length; cellId++) {
      const height = heights[cellId];
      const moisture = height < this.MIN_LAND_HEIGHT ? 0 : calculateMoisture(cellId);
      const temperature = temp[gridReference[cellId]];
      pack.cells.biome[cellId] = this.getId(moisture, temperature, height, Boolean(riverIds[cellId]));
    }

    this.generateChaos();
    TIME && console.timeEnd("defineBiomes");
  }

  generateChaos() {
    TIME && console.time("generateChaos");
    const { cells } = pack;
    const W = graphWidth;
    const H = graphHeight;

    // 13 origins
    const origins: [number, number][] = [
      [W / 2, 0], // North pole
      [W / 2, H], // South pole
      [W / 2, H / 2] // Center
    ];
    for (let i = 0; i < 5; i++) {
      origins.push([(W / 5) * i, H * 0.25]); // Northern row
      origins.push([(W / 5) * i + W / 10, H * 0.75]); // Southern offset row
    }

    const queue = new FlatQueue();
    const chaosLimit = Math.floor(cells.i.length * 0.1); // Chaos takes 10% of the world
    let chaosCount = 0;

    const cost = new Float32Array(cells.i.length).fill(10000);
    const isChaos = new Uint8Array(cells.i.length);

    for (const [x, y] of origins) {
      const cellId = window.findCell(x, y, undefined, pack);
      if (cellId !== undefined) {
        cost[cellId] = 0;
        isChaos[cellId] = 1;
        queue.push(cellId, 0);
      }
    }

    while (queue.length && chaosCount < chaosLimit) {
      const next = queue.pop();
      cells.c[next].forEach((e: number) => {
        const h = cells.h[e];
        const stepCost = h < 20 ? 10 : 20; // spreads easier in water
        const totalCost = cost[next] + stepCost;
        if (totalCost < cost[e]) {
          cost[e] = totalCost;
          isChaos[e] = 1;
          chaosCount++;
          cells.biome[e] = h < 20 ? 19 : 18; // 18 is Chaos Land, 19 is Chaos Water
          queue.push(e, totalCost);
        }
      });
    }
    TIME && console.timeEnd("generateChaos");
  }

  getId(moisture: number, temperature: number, height: number, hasRiver: boolean) {
    if (height < 20) {
      if (height >= 15) return 13; // Shallow Reef
      if (height >= 10 && temperature > 10) return 14; // Kelp Forest
      if (height >= 5) return 15; // Pelagic Zone
      if (height >= 2) return 16; // Abyssal Plain
      return 17; // Oceanic Trench
    }
    if (temperature < -5) return 11; // too cold: permafrost biome
    if (temperature >= 25 && !hasRiver && moisture < 8) return 1; // too hot and dry: hot desert biome
    if (this.isWetland(moisture, temperature, height)) return 12; // too wet: wetland biome

    // in other cases use biome matrix
    const moistureBand = Math.min((moisture / 5) | 0, 4); // [0-4]
    const temperatureBand = Math.min(Math.max(20 - temperature, 0), 25); // [0-25]
    return biomesData.biomesMatrix[moistureBand][temperatureBand];
  }

  private isWetland(moisture: number, temperature: number, height: number) {
    if (temperature <= -2) return false; // too cold
    if (moisture > 40 && height < 25) return true; // near coast
    if (moisture > 24 && height > 24 && height < 60) return true; // off coast
    return false;
  }
}

window.Biomes = new BiomesModule();
