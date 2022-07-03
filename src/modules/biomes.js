import {TIME} from "config/logging";
import {isLand} from "utils/graphUtils";
import {rn} from "utils/numberUtils";

window.Biomes = (function () {
  const getDefault = () => {
    const name = [
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
      "Wetland"
    ];

    const color = [
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
      "#0b9131"
    ];
    const habitability = [0, 4, 10, 22, 30, 50, 100, 80, 90, 12, 4, 0, 12];
    const iconsDensity = [0, 3, 2, 120, 120, 120, 120, 150, 150, 100, 5, 0, 150];
    const icons = [
      {},
      {dune: 3, cactus: 6, deadTree: 1},
      {dune: 9, deadTree: 1},
      {acacia: 1, grass: 9},
      {grass: 1},
      {acacia: 8, palm: 1},
      {deciduous: 1},
      {acacia: 5, palm: 3, deciduous: 1, swamp: 1},
      {deciduous: 6, swamp: 1},
      {conifer: 1},
      {grass: 1},
      {},
      {swamp: 1}
    ];
    const cost = [10, 200, 150, 60, 50, 70, 70, 80, 90, 200, 1000, 5000, 150]; // biome movement cost
    const biomesMartix = [
      // hot ↔ cold [>19°C; <-4°C]; dry ↕ wet
      new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 10]),
      new Uint8Array([3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 9, 9, 9, 9, 10, 10, 10]),
      new Uint8Array([5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 9, 9, 9, 9, 9, 10, 10, 10]),
      new Uint8Array([5, 6, 6, 6, 6, 6, 6, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 10, 10, 10]),
      new Uint8Array([7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 9, 10, 10])
    ];

    // parse icons weighted array into a simple array
    for (let i = 0; i < icons.length; i++) {
      const parsed = [];
      for (const icon in icons[i]) {
        for (let j = 0; j < icons[i][icon]; j++) {
          parsed.push(icon);
        }
      }
      icons[i] = parsed;
    }

    return {i: d3.range(0, name.length), name, color, biomesMartix, habitability, iconsDensity, icons, cost};
  };

  function isWetLand(moisture, temperature, height) {
    if (moisture > 40 && temperature > -2 && height < 25) return true; //near coast
    if (moisture > 24 && temperature > -2 && height > 24 && height < 60) return true; //off coast
    return false;
  }

  // assign biome id for each cell
  function define() {
    TIME && console.time("defineBiomes");
    const {cells} = pack;
    const {temp, prec} = grid.cells;
    cells.biome = new Uint8Array(cells.i.length); // biomes array

    for (const i of cells.i) {
      const temperature = temp[cells.g[i]];
      const height = cells.h[i];
      const moisture = height < 20 ? 0 : calculateMoisture(i);
      cells.biome[i] = getId(moisture, temperature, height);
    }

    function calculateMoisture(i) {
      let moist = prec[cells.g[i]];
      if (cells.r[i]) moist += Math.max(cells.fl[i] / 20, 2);

      const n = cells.c[i]
        .filter(isLand)
        .map(c => prec[cells.g[c]])
        .concat([moist]);
      return rn(4 + d3.mean(n));
    }

    TIME && console.timeEnd("defineBiomes");
  }

  // assign biome id to a cell
  function getId(moisture, temperature, height) {
    if (height < 20) return 0; // marine biome: all water cells
    if (temperature < -5) return 11; // permafrost biome
    if (isWetLand(moisture, temperature, height)) return 12; // wetland biome

    const moistureBand = Math.min((moisture / 5) | 0, 4); // [0-4]
    const temperatureBand = Math.min(Math.max(20 - temperature, 0), 25); // [0-25]
    return biomesData.biomesMartix[moistureBand][temperatureBand];
  }

  return {getDefault, define, getId};
})();
