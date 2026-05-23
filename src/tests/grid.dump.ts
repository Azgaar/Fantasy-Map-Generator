import "./setup.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { generateGrid } from "../utils/graphUtils.js";
import { defaultTestSetup, typedArrayReplacer } from "./test.utils.js";

const dumpDir = path.join(process.cwd(), "tests", "regression_data");

// Ensure the target directory exists
if (!fs.existsSync(dumpDir)) {
  fs.mkdirSync(dumpDir, { recursive: true });
}

// 1. Define Deterministic State
const pointCount = 2000;
defaultTestSetup({ points: pointCount });

console.log(`Generating grid for seed: ${seed}...`);

// 2. Execute Generator
const grid = generateGrid(seed, graphWidth, graphHeight);

// 3. Format and Dump Points Data
const pointsData = {
  Seed: seed,
  Width: graphWidth,
  Height: graphHeight,
  ExpectedPointsCount: pointCount,
  ActualPointsCount: grid.points.length,
  Spacing: grid.spacing,
  CellsCountX: grid.cellsX,
  CellsCountY: grid.cellsY,
  Points: Array.from(grid.points)
};

const pointsPath = path.join(dumpDir, "grid_points_regression.json");
fs.writeFileSync(pointsPath, JSON.stringify(pointsData, null, 2));
console.log(`Dumped: ${pointsPath}`);

// 4. Format and Dump Boundary Data
const boundaryData = {
  Seed: seed,
  Width: graphWidth,
  Height: graphHeight,
  BoundaryPoints: Array.from(grid.boundary)
};

const boundaryPath = path.join(dumpDir, "grid_boundary_regression.json");
fs.writeFileSync(boundaryPath, JSON.stringify(boundaryData, null, 2));
console.log(`Dumped: ${boundaryPath}`);

// 5. Format and Dump Voronoi Data (Cells & Vertices)
const voronoiData = {
  Seed: seed,
  Width: graphWidth,
  Height: graphHeight,
  Cells: JSON.parse(JSON.stringify(grid.cells, typedArrayReplacer)),
  Vertices: JSON.parse(JSON.stringify(grid.vertices, typedArrayReplacer))
};

const voronoiPath = path.join(dumpDir, "grid_voronoi_regression.json");
fs.writeFileSync(voronoiPath, JSON.stringify(voronoiData, null, 2));
console.log(`Dumped: ${voronoiPath}`);

console.log("✅ Grid regression data successfully generated.");
