import { createTypedArray, getTypedArray, last, TYPED_ARRAY_MAX, unique } from "./arrayUtils";
import { abbreviate, getAdjective, isVowel, list, nth, trimVowels } from "./languageUtils";
import { lerp, lim, minmax, normalize, rn } from "./numberUtils";
import "./polyfills";
import { C_12, getColors, getMixedColor, getRandomColor, toHEX } from "./colorUtils";
import {
  clipPoly,
  debounce,
  generateDate,
  getBase64,
  getCoordinates,
  getLatitude,
  getLongitude,
  getSegmentId,
  initializePrompt,
  isCtrlClick,
  link,
  openURL,
  parseError,
  speak,
  throttle,
  wiki
} from "./commonUtils";
import { drawCellsValue, drawPath, drawPoint, drawPolygons, drawRouteConnections } from "./debugUtils";
import { downloadFile, getFileName, uploadFile } from "./fileUtils";
import { distanceSquared, rollups } from "./functionUtils";
import {
  calculateVoronoi,
  drawHeights,
  findAllCellsInRadius,
  findAllInQuadtree,
  findClosestCell,
  findGridAll,
  findGridCell,
  generateGrid,
  getGridPolygon,
  getPackPolygon,
  isLand,
  isWater,
  poissonDiscSampler,
  shouldRegenerateGrid
} from "./graphUtils";
import {
  applyOption,
  destroyDialogIfExists,
  ensureEl,
  findEl,
  getComposedPath,
  getNextId,
  getPointer
} from "./nodeUtils";
import { connectVertices, findPath, getIsolines, getPolesOfInaccessibility, getVertexPath } from "./pathUtils";
import { biased, each, gauss, generateSeed, getNumberInRange, P, Pint, ra, rand, rw } from "./probabilityUtils";
import { capitalize, isValidJSON, parseTransform, round, safeParseJSON, sanitizeId, splitInTwo } from "./stringUtils";
import {
  convertTemperature,
  formatPrice,
  getArea,
  getAreaUnit,
  getCellPopulation,
  getFriendlyHeight,
  getFriendlyPrecipitation,
  getHeight,
  getIntegerFromSI,
  getPrecipitation,
  getTemperatureLikeness,
  si
} from "./unitUtils";

window.rn = rn;
window.minmax = minmax;
window.normalize = normalize;

window.nth = nth;
window.list = list;

window.last = last;
window.unique = unique;
window.createTypedArray = createTypedArray;

window.rand = rand;
window.P = P;
window.each = each;
window.gauss = gauss;
window.rw = rw;
window.generateSeed = generateSeed;

window.toHEX = toHEX;

window.ensureEl = ensureEl;
window.findEl = findEl;
window.applyOption = applyOption;
window.getNextId = getNextId;

window.dist2 = distanceSquared;

window.getIsolines = getIsolines;
window.getVertexPath = cellsArray => getVertexPath(cellsArray, (window as any).pack);

window.round = round;
window.capitalize = capitalize;
window.parseTransform = parseTransform;

JSON.isValid = isValidJSON;
JSON.safeParse = safeParseJSON;

Node.prototype.on = function (name, fn, options) {
  this.addEventListener(name, fn, options);
  return this;
};
Node.prototype.off = function (name, fn) {
  this.removeEventListener(name, fn);
  return this;
};

declare global {
  interface JSON {
    isValid: (str: string) => boolean;
    safeParse: (str: string) => any;
  }
  interface Node {
    on: (name: string, fn: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => Node;
    off: (name: string, fn: EventListenerOrEventListenerObject) => Node;
  }
}

window.shouldRegenerateGrid = (grid: any, expectedSeed: number) =>
  shouldRegenerateGrid(grid, expectedSeed, (window as any).graphWidth, (window as any).graphHeight);
window.generateGrid = () => generateGrid((window as any).seed, (window as any).graphWidth, (window as any).graphHeight);
window.findCell = (x: number, y: number, radius?: number) => findClosestCell(x, y, radius, (window as any).pack);
window.getPackPolygon = (cellIndex: number) => getPackPolygon(cellIndex, (window as any).pack);
window.getGridPolygon = (cellIndex: number) => getGridPolygon(cellIndex, (window as any).grid);
window.calculateVoronoi = calculateVoronoi;
window.drawHeights = drawHeights;

window.debounce = debounce;
window.parseError = parseError;
window.openURL = openURL;
window.wiki = wiki;
window.link = link;
window.isCtrlClick = isCtrlClick;

// Initialize prompt when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializePrompt);
} else {
  initializePrompt();
}

// console debugging aids: no caller in the codebase by design, they are typed at the devtools prompt
window.drawCellsValue = drawCellsValue;
window.drawPolygons = (data: any[]) => drawPolygons(data, (window as any).terrs, (window as any).grid);
window.drawRouteConnections = () => drawRouteConnections((window as any).packedGraph);
window.drawPoint = drawPoint;
window.drawPath = drawPath;
window.downloadFile = downloadFile;
window.uploadFile = uploadFile;

// classic main.js still calls this one; the rest are imported by their consumers
window.getPrecipitation = getPrecipitation;

window.TYPED_ARRAY_MAX = TYPED_ARRAY_MAX;

export {
  abbreviate,
  applyOption,
  biased,
  C_12,
  calculateVoronoi,
  capitalize,
  clipPoly,
  connectVertices,
  convertTemperature,
  createTypedArray,
  debounce,
  destroyDialogIfExists,
  distanceSquared,
  downloadFile,
  drawCellsValue,
  drawHeights,
  drawPath,
  drawPoint,
  drawPolygons,
  drawRouteConnections,
  each,
  ensureEl,
  findAllCellsInRadius,
  findAllInQuadtree,
  findClosestCell,
  findEl,
  findGridAll,
  findGridCell,
  findPath,
  formatPrice,
  gauss,
  generateDate,
  generateGrid,
  generateSeed,
  getAdjective,
  getArea,
  getAreaUnit,
  getBase64,
  getCellPopulation,
  getColors,
  getComposedPath,
  getCoordinates,
  getFileName,
  getFriendlyHeight,
  getFriendlyPrecipitation,
  getGridPolygon,
  getHeight,
  getIntegerFromSI,
  getIsolines,
  getLatitude,
  getLongitude,
  getMixedColor,
  getNextId,
  getNumberInRange,
  getPackPolygon,
  getPointer,
  getPolesOfInaccessibility,
  getPrecipitation,
  getRandomColor,
  getSegmentId,
  getTemperatureLikeness,
  getTypedArray,
  getVertexPath,
  initializePrompt,
  isCtrlClick,
  isLand,
  isValidJSON,
  isVowel,
  isWater,
  last,
  lerp,
  lim,
  link,
  list,
  minmax,
  normalize,
  nth,
  openURL,
  P,
  Pint,
  parseError,
  parseTransform,
  poissonDiscSampler,
  ra,
  rand,
  rn,
  rollups,
  round,
  rw,
  safeParseJSON,
  sanitizeId,
  shouldRegenerateGrid,
  si,
  speak,
  splitInTwo,
  TYPED_ARRAY_MAX,
  throttle,
  toHEX,
  trimVowels,
  unique,
  uploadFile,
  wiki
};
