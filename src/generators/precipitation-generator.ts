// The simplest precipitation model: winds enter the map from each side and drop humidity as they pass the cells
import { mean, range } from "d3";
import { minmax, rand, SEA_LEVEL } from "@/utils";

declare global {
  var Precipitation: PrecipitationModule;
}

type WindBand = [number, number, number]; // [firstCellId, latitudeModifier, windTier]
type Winds = { westerly: WindBand[]; easterly: WindBand[]; northerly: number; southerly: number };

// precipitation modifier per 5° latitude band
// x4 = 0-5 latitude: wet through the year (rising zone)
// x2 = 5-20 latitude: wet summer (rising zone), dry winter (sinking zone)
// x1 = 20-30 latitude: dry all year (sinking zone)
// x2 = 30-50 latitude: wet winter (rising zone), dry summer (sinking zone)
// x3 = 50-60 latitude: wet all year (rising zone)
// x2 = 60-70 latitude: wet summer (rising zone), dry winter (sinking zone)
// x1 = 70-85 latitude: dry all year (sinking zone)
// x0.5 = 85-90 latitude: dry all year (sinking zone)
const LATITUDE_MODIFIER = [4, 2, 2, 2, 1, 1, 2, 2, 2, 2, 3, 3, 2, 2, 1, 1, 1, 0.5];

const MAX_PASSABLE_ELEVATION = 85;

class PrecipitationModule {
  /** pass every wind over the cells it reaches, filling `grid.cells.prec` on the way */
  generate(): void {
    const { cells, cellsX, cellsY } = grid;
    cells.prec = new Uint8Array(cells.i.length);

    const cellsNumberModifier = (Grid.getCellsDesired() / 10000) ** 0.25;
    const modifier = cellsNumberModifier * (options.prec / 100);

    const getPrecipitation = (humidity: number, i: number, n: number) => {
      const normalLoss = Math.max(humidity / (10 * modifier), 1); // precipitation in normal conditions
      const diff = Math.max(cells.h[i + n] - cells.h[i], 0); // difference in height
      const mod = (cells.h[i + n] / 70) ** 2; // 50 stands for hills, 70 for mountains
      return minmax(normalLoss + diff * mod, 1, humidity);
    };

    const passWind = (sources: (number | WindBand)[], initialMaxPrec: number, next: number, steps: number) => {
      let maxPrec = initialMaxPrec;

      for (const source of sources) {
        let first: number;
        if (Array.isArray(source)) {
          if (!source[0]) continue; // legacy quirk: a band starting at cell 0 is skipped, fixing it changes every map
          maxPrec = Math.min(initialMaxPrec * source[1], 255);
          first = source[0];
        } else first = source;

        let humidity = maxPrec - cells.h[first]; // initial water amount
        if (humidity <= 0) continue; // if first cell in row is too elevated consider wind dry

        for (let s = 0, current = first; s < steps; s++, current += next) {
          if (cells.temp[current] < -5) continue; // no flux in permafrost

          if (cells.h[current] < SEA_LEVEL) {
            if (cells.h[current + next] >= SEA_LEVEL) {
              cells.prec[current + next] += Math.max(humidity / rand(10, 20), 1); // coastal precipitation
            } else {
              humidity = Math.min(humidity + 5 * modifier, maxPrec); // wind gets more humidity passing water cell
              cells.prec[current] += 5 * modifier; // water cells precipitation (need to correctly pour water through lakes)
            }
            continue;
          }

          // land cell
          const isPassable = cells.h[current + next] <= MAX_PASSABLE_ELEVATION;
          const precipitation = isPassable ? getPrecipitation(humidity, current, next) : humidity;
          cells.prec[current] += precipitation;
          const evaporation = precipitation > 1.5 ? 1 : 0; // some humidity evaporates back to the atmosphere
          humidity = isPassable ? minmax(humidity - precipitation + evaporation, 0, maxPrec) : 0;
        }
      }
    };

    const { westerly, easterly, northerly, southerly } = this.getWinds();

    if (westerly.length) passWind(westerly, 120 * modifier, 1, cellsX);
    if (easterly.length) passWind(easterly, 120 * modifier, -1, cellsX);

    const vertT = southerly + northerly;
    if (northerly) {
      const bandN = ((Math.abs(mapCoordinates.latN!) - 1) / 5) | 0;
      const latModN = mapCoordinates.latT! > 60 ? (mean(LATITUDE_MODIFIER) as number) : LATITUDE_MODIFIER[bandN];
      const maxPrecN = (northerly / vertT) * 60 * modifier * latModN;
      passWind(range(0, cellsX, 1), maxPrecN, cellsX, cellsY);
    }

    if (southerly) {
      const bandS = ((Math.abs(mapCoordinates.latS!) - 1) / 5) | 0;
      const latModS = mapCoordinates.latT! > 60 ? (mean(LATITUDE_MODIFIER) as number) : LATITUDE_MODIFIER[bandS];
      const maxPrecS = (southerly / vertT) * 60 * modifier * latModS;
      passWind(range(cells.i.length - cellsX, cells.i.length, 1), maxPrecS, -cellsX, cellsY);
    }
  }

  /**
   * rows and columns the prevailing winds enter the map through, derived from the map position and
   * the wind angles. Free of randomness, so the renderer can ask for them at any time
   */
  getWinds(): Winds {
    const { cells, cellsX, cellsY } = grid;
    const westerly: WindBand[] = [];
    const easterly: WindBand[] = [];
    let northerly = 0;
    let southerly = 0;

    range(0, cells.i.length, cellsX).forEach((cellId, rowId) => {
      const lat = mapCoordinates.latN! - (rowId / cellsY) * mapCoordinates.latT!;
      const latMod = LATITUDE_MODIFIER[((Math.abs(lat) - 1) / 5) | 0];
      const tier = (Math.abs(lat - 89) / 30) | 0; // 30° tiers from 0 to 5, north to south
      const angle = options.winds[tier];

      if (angle > 40 && angle < 140) westerly.push([cellId, latMod, tier]);
      if (angle > 220 && angle < 320) easterly.push([cellId + cellsX - 1, latMod, tier]);
      if (angle > 100 && angle < 260) northerly++;
      if (angle > 280 || angle < 80) southerly++;
    });

    return { westerly, easterly, northerly, southerly };
  }
}

window.Precipitation = new PrecipitationModule();
