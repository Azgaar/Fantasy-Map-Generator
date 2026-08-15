// Compatibility entry point for classic scripts in public/. New TypeScript code must import utilities directly.
import { createTypedArray, last, TYPED_ARRAY_MAX, unique } from "./arrayUtils";
import { list, nth } from "./languageUtils";
import { minmax, normalize, rn } from "./numberUtils";
import "./polyfills";
import { toHEX } from "./colorUtils";
import { debounce, initializePrompt, isCtrlClick, link, openURL, parseError, wiki } from "./commonUtils";
import { drawCellsValue, drawPath, drawPoint, drawPolygons, drawRouteConnections } from "./debugUtils";
import { downloadFile, uploadFile } from "./fileUtils";
import { distanceSquared } from "./functionUtils";
import {
  calculateVoronoi,
  drawHeights,
  findClosestCell,
  generateGrid,
  getGridPolygon,
  getPackPolygon,
  shouldRegenerateGrid
} from "./graphUtils";
import { applyOption, ensureEl, findEl, getNextId } from "./nodeUtils";
import { getIsolines, getVertexPath } from "./pathUtils";
import { each, gauss, generateSeed, P, rand, rw } from "./probabilityUtils";
import { capitalize, isValidJSON, parseTransform, round, safeParseJSON } from "./stringUtils";
import { getPrecipitation } from "./unitUtils";

const legacyWindow = window as Window & typeof globalThis;

legacyWindow.rn = rn;
legacyWindow.minmax = minmax;
legacyWindow.normalize = normalize;
legacyWindow.nth = nth;
legacyWindow.list = list;
legacyWindow.last = last;
legacyWindow.unique = unique;
legacyWindow.createTypedArray = createTypedArray;
legacyWindow.rand = rand;
legacyWindow.P = P;
legacyWindow.each = each;
legacyWindow.gauss = gauss;
legacyWindow.rw = rw;
legacyWindow.generateSeed = generateSeed;
legacyWindow.toHEX = toHEX;
legacyWindow.ensureEl = ensureEl;
legacyWindow.findEl = findEl;
legacyWindow.applyOption = applyOption;
legacyWindow.getNextId = getNextId;
legacyWindow.dist2 = distanceSquared;
legacyWindow.getIsolines = getIsolines;
legacyWindow.getVertexPath = cellsArray => getVertexPath(cellsArray, pack);
legacyWindow.round = round;
legacyWindow.capitalize = capitalize;
legacyWindow.parseTransform = parseTransform;
legacyWindow.shouldRegenerateGrid = (grid, expectedSeed) =>
  shouldRegenerateGrid(grid, expectedSeed, graphWidth, graphHeight);
legacyWindow.generateGrid = () => generateGrid(seed, graphWidth, graphHeight);
legacyWindow.findCell = (x, y, radius) => findClosestCell(x, y, radius, pack);
legacyWindow.getPackPolygon = cellIndex => getPackPolygon(cellIndex, pack);
legacyWindow.getGridPolygon = cellIndex => getGridPolygon(cellIndex, grid);
legacyWindow.calculateVoronoi = calculateVoronoi;
legacyWindow.drawHeights = drawHeights;
legacyWindow.debounce = debounce;
legacyWindow.parseError = parseError;
legacyWindow.openURL = openURL;
legacyWindow.wiki = wiki;
legacyWindow.link = link;
legacyWindow.isCtrlClick = isCtrlClick;
legacyWindow.drawCellsValue = drawCellsValue;
legacyWindow.drawPolygons = data => drawPolygons(data, terrs, grid);
legacyWindow.drawRouteConnections = () =>
  drawRouteConnections((legacyWindow as typeof legacyWindow & { packedGraph: unknown }).packedGraph);
legacyWindow.drawPoint = drawPoint;
legacyWindow.drawPath = drawPath;
legacyWindow.downloadFile = downloadFile;
legacyWindow.uploadFile = uploadFile;
legacyWindow.getPrecipitation = getPrecipitation;
legacyWindow.TYPED_ARRAY_MAX = TYPED_ARRAY_MAX;

JSON.isValid = isValidJSON;
JSON.safeParse = safeParseJSON;

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializePrompt);
else initializePrompt();
