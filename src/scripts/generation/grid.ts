import {calculateTemperatures} from "modules/temperature";
import {generateGrid} from "scripts/generation/graph";
import {calculateMapCoordinates, defineMapSize} from "modules/coordinates";
import {markupGridFeatures} from "modules/markup";
// @ts-expect-error js module
import {generatePrecipitation} from "modules/precipitation";
import {byId} from "utils/shorthands";
import {rn} from "utils/numberUtils";

const {Lakes, HeightmapGenerator} = window;

export async function createGrid(globalGrid: IGrid, precreatedGraph?: IGrid): Promise<IGrid> {
  const baseGrid: IGridBase = shouldRegenerateGridPoints(globalGrid)
    ? (precreatedGraph && undressGrid(precreatedGraph)) || generateGrid()
    : undressGrid(globalGrid);

  const heights: Uint8Array = await HeightmapGenerator.generate(baseGrid);
  if (!heights) throw new Error("Heightmap generation failed");
  const heightsGrid = {...baseGrid, cells: {...baseGrid.cells, h: heights}};

  const {featureIds, distanceField, features} = markupGridFeatures(heightsGrid);
  const markedGrid = {...heightsGrid, features, cells: {...heightsGrid.cells, f: featureIds, t: distanceField}};

  const touchesEdges = features.some(feature => feature && feature.land && feature.border);
  defineMapSize(touchesEdges);
  window.mapCoordinates = calculateMapCoordinates();

  Lakes.addLakesInDeepDepressions(markedGrid);
  Lakes.openNearSeaLakes(markedGrid);

  const temperature = calculateTemperatures(markedGrid);
  const temperatureGrid = {...markedGrid, cells: {...markedGrid.cells, temp: temperature}};

  const prec = generatePrecipitation(temperatureGrid);
  return {...temperatureGrid, cells: {...temperatureGrid.cells, prec}};
}

function undressGrid(extendedGrid: IGrid): IGridBase {
  const {spacing, cellsDesired, boundary, points, cellsX, cellsY, cells, vertices} = extendedGrid;
  const {i, b, c, v} = cells;
  return {spacing, cellsDesired, boundary, points, cellsX, cellsY, cells: {i, b, c, v}, vertices};
}

// check if new grid graph should be generated or we can use the existing one
export function shouldRegenerateGridPoints(grid: IGrid) {
  const cellsDesired = Number(byId("pointsInput")?.dataset.cells);
  if (cellsDesired !== grid.cellsDesired) return true;

  const newSpacing = rn(Math.sqrt((graphWidth * graphHeight) / cellsDesired), 2);
  const newCellsX = Math.floor((graphWidth + 0.5 * newSpacing - 1e-10) / newSpacing);
  const newCellsY = Math.floor((graphHeight + 0.5 * newSpacing - 1e-10) / newSpacing);

  return grid.spacing !== newSpacing || grid.cellsX !== newCellsX || grid.cellsY !== newCellsY;
}
