import {defineMapSize} from "modules/coordinates";
import {generateGrid} from "scripts/generation/graph";
import {markupGridFeatures} from "scripts/generation/markup";
import {rn} from "utils/numberUtils";
import {byId} from "utils/shorthands";
import {generatePrecipitation} from "./precipitation";
import {calculateTemperatures} from "./temperature";

const {HeightmapGenerator} = window;

export async function createGrid(globalGrid: IGrid, precreatedGrid?: IGrid): Promise<IGrid> {
  const shouldRegenerate = shouldRegenerateGridPoints(globalGrid);
  const {spacing, cellsDesired, boundary, points, cellsX, cellsY, cells, vertices} = shouldRegenerate
    ? (precreatedGrid && undressPrecreatedGrid(precreatedGrid)) || generateGrid()
    : undressPrecreatedGrid(globalGrid);

  const heights: Uint8Array = await HeightmapGenerator.generate({
    vertices,
    points,
    cells,
    cellsDesired,
    spacing,
    cellsX,
    cellsY
  });
  if (!heights) throw new Error("Heightmap generation failed");

  const {featureIds, distanceField, features} = markupGridFeatures(cells.c, cells.b, heights);

  const touchesEdges = features.some(feature => feature && feature.land && feature.border);
  defineMapSize(touchesEdges);

  const temp = calculateTemperatures(heights, cellsX, points);
  const prec = generatePrecipitation(heights, temp, cellsX, cellsY);

  return {
    cellsDesired,
    cellsX,
    cellsY,
    spacing,
    boundary,
    points,
    vertices,
    cells: {
      ...cells,
      h: heights,
      f: featureIds,
      t: distanceField,
      prec,
      temp
    },
    features
  };
}

function undressPrecreatedGrid(extendedGrid: IGrid) {
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
