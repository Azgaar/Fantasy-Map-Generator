import {MIN_LAND_HEIGHT, MAX_HEIGHT} from "config/generation";
import {TIME, WARN, INFO} from "config/logging";
import {getInputNumber} from "utils/nodeUtils";

// depression filling algorithm (for a correct water flux modeling)
export function resolveDepressions(
  cells: Pick<IPack["cells"], "i" | "c" | "b" | "f">,
  features: TPackFeatures,
  initialCellHeights: Float32Array
): [Float32Array, Dict<boolean>] {
  TIME && console.time("resolveDepressions");

  const MAX_INTERATIONS = getInputNumber("resolveDepressionsStepsOutput");
  const checkLakeMaxIteration = MAX_INTERATIONS * 0.85;
  const elevateLakeMaxIteration = MAX_INTERATIONS * 0.75;

  const LAND_ELEVATION_INCREMENT = 0.1;
  const LAKE_ELEVATION_INCREMENT = 0.2;

  const lakes = features.filter(feature => feature && feature.type === "lake") as IPackFeatureLake[];
  lakes.sort((a, b) => a.height - b.height); // lowest lakes go first

  const getHeight = (i: number) => currentLakeHeights[cells.f[i]] || currentCellHeights[i];
  const getMinHeight = (cellsIds: number[]) => Math.min(...cellsIds.map(getHeight));
  const getMinLandHeight = (cellsIds: number[]) => Math.min(...cellsIds.map(i => currentCellHeights[i]));

  const landCells = cells.i.filter(i => initialCellHeights[i] >= MIN_LAND_HEIGHT && !cells.b[i]);
  landCells.sort((a, b) => initialCellHeights[a] - initialCellHeights[b]); // lowest cells go first

  const currentCellHeights = Float32Array.from(initialCellHeights);
  const currentLakeHeights = Object.fromEntries(lakes.map(({i, height}) => [i, height]));
  const currentDrainableLakes = checkLakesDrainability();
  const depressions: number[] = [];

  let bestDepressions = Infinity;
  let bestCellHeights: typeof currentCellHeights | null = null;
  let bestDrainableLakes: typeof currentDrainableLakes | null = null;

  for (let iteration = 0; depressions.at(-1) !== 0 && iteration < MAX_INTERATIONS; iteration++) {
    let depressionsLeft = 0;

    // elevate potentially drainable lakes
    if (iteration < checkLakeMaxIteration) {
      for (const lake of lakes) {
        if (currentDrainableLakes[lake.i] !== true) continue;

        const minShoreHeight = getMinLandHeight(lake.shoreline);
        if (minShoreHeight >= MAX_HEIGHT || currentLakeHeights[lake.i] > minShoreHeight) continue;

        if (iteration > elevateLakeMaxIteration) {
          // reset heights
          for (const shoreCellId of lake.shoreline) {
            currentCellHeights[shoreCellId] = initialCellHeights[shoreCellId];
          }
          currentLakeHeights[lake.i] = lake.height;

          currentDrainableLakes[lake.i] = false;
          continue;
        }

        currentLakeHeights[lake.i] = minShoreHeight + LAKE_ELEVATION_INCREMENT;
        depressionsLeft++;
      }
    }

    for (const cellId of landCells) {
      const minHeight = getMinHeight(cells.c[cellId]);
      if (minHeight >= MAX_HEIGHT || currentCellHeights[cellId] > minHeight) continue;

      currentCellHeights[cellId] = minHeight + LAND_ELEVATION_INCREMENT;
      depressionsLeft++;
    }

    depressions.push(depressionsLeft);
    if (depressionsLeft < bestDepressions) {
      bestDepressions = depressionsLeft;
      bestCellHeights = Float32Array.from(currentCellHeights);
      bestDrainableLakes = structuredClone(currentDrainableLakes);
    }
  }

  TIME && console.timeEnd("resolveDepressions");

  const depressionsLeft = depressions.at(-1);
  if (depressionsLeft) {
    if (bestCellHeights && bestDrainableLakes) {
      WARN &&
        console.warn(`Cannot resolve all depressions. Depressions: ${depressions[0]}. Best result: ${bestDepressions}`);
      return [bestCellHeights, bestDrainableLakes];
    }

    WARN && console.warn(`Cannot resolve depressions. Depressions: ${depressionsLeft}`);
    return [initialCellHeights, {}];
  }

  INFO && console.info(`ⓘ resolved all ${depressions[0]} depressions in ${depressions.length} iterations`);
  return [currentCellHeights, currentDrainableLakes];

  // define lakes that potentially can be open (drained into another water body)
  function checkLakesDrainability() {
    const canBeDrained: Dict<boolean> = {}; // all false by default

    const ELEVATION_LIMIT = getInputNumber("lakeElevationLimitOutput");
    const drainAllLakes = ELEVATION_LIMIT === MAX_HEIGHT - MIN_LAND_HEIGHT;

    for (const lake of lakes) {
      if (drainAllLakes) {
        canBeDrained[lake.i] = true;
        continue;
      }

      canBeDrained[lake.i] = false;
      const minShoreHeight = getMinHeight(lake.shoreline);
      const minHeightShoreCell =
        lake.shoreline.find(cellId => initialCellHeights[cellId] === minShoreHeight) || lake.shoreline[0];

      const queue = [minHeightShoreCell];
      const checked = [];
      checked[minHeightShoreCell] = true;
      const breakableHeight = lake.height + ELEVATION_LIMIT;

      loopCellsAroundLake: while (queue.length) {
        const cellId = queue.pop()!;

        for (const neibCellId of cells.c[cellId]) {
          if (checked[neibCellId]) continue;
          if (initialCellHeights[neibCellId] >= breakableHeight) continue;

          if (initialCellHeights[neibCellId] < MIN_LAND_HEIGHT) {
            const waterFeatureMet = features[cells.f[neibCellId]];
            const isOceanMet = waterFeatureMet && waterFeatureMet.type === "ocean";
            const isLakeMet = waterFeatureMet && waterFeatureMet.type === "lake";

            if (isOceanMet || (isLakeMet && lake.height > waterFeatureMet.height)) {
              canBeDrained[lake.i] = true;
              break loopCellsAroundLake;
            }
          }

          checked[neibCellId] = true;
          queue.push(neibCellId);
        }
      }
    }

    return canBeDrained;
  }
}
