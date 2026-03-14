import { lerp, lim, minmax, normalize, rn } from "./numberUtils";
import "./polyfills";

window.rn = rn;
window.lim = lim;
window.minmax = minmax;
window.normalize = normalize;
window.lerp = lerp as typeof window.lerp;

import {
  abbreviate,
  getAdjective,
  isVowel,
  list,
  nth,
  trimVowels,
} from "./languageUtils";

window.vowel = isVowel;
window.trimVowels = trimVowels;
window.getAdjective = getAdjective;
window.nth = nth;
window.abbreviate = abbreviate;
window.list = list;

import {
  createTypedArray,
  getTypedArray,
  last,
  TYPED_ARRAY_MAX_VALUES,
  unique,
} from "./arrayUtils";

window.last = last;
window.unique = unique;
window.getTypedArray = getTypedArray;
window.createTypedArray = createTypedArray;
window.INT8_MAX = TYPED_ARRAY_MAX_VALUES.INT8_MAX;
window.UINT8_MAX = TYPED_ARRAY_MAX_VALUES.UINT8_MAX;
window.UINT16_MAX = TYPED_ARRAY_MAX_VALUES.UINT16_MAX;
window.UINT32_MAX = TYPED_ARRAY_MAX_VALUES.UINT32_MAX;

import {
  biased,
  each,
  gauss,
  generateSeed,
  getNumberInRange,
  P,
  Pint,
  ra,
  rand,
  rw,
} from "./probabilityUtils";

window.rand = rand;
window.P = P;
window.each = each;
window.gauss = gauss;
window.Pint = Pint;
window.ra = ra;
window.rw = rw;
window.biased = biased;
window.getNumberInRange = getNumberInRange;
window.generateSeed = generateSeed;

import { convertTemperature, getIntegerFromSI, si } from "./unitUtils";

window.convertTemperature = (
  temp: number,
  scale: any = (window as any).temperatureScale.value || "°C",
) => convertTemperature(temp, scale);
window.si = si;
window.getInteger = getIntegerFromSI;

import {
  C_12,
  getColors,
  getMixedColor,
  getRandomColor,
  toHEX,
} from "./colorUtils";

window.toHEX = toHEX;
window.getColors = getColors;
window.getRandomColor = getRandomColor;
window.getMixedColor = getMixedColor;
window.C_12 = C_12;

import { getComposedPath, getNextId } from "./nodeUtils";

window.getComposedPath = getComposedPath;
window.getNextId = getNextId;

import { distanceSquared, rollups } from "./functionUtils";

window.rollups = rollups;
window.dist2 = distanceSquared;

import {
  connectVertices,
  findPath,
  getIsolines,
  getPolesOfInaccessibility,
  getVertexPath,
} from "./pathUtils";

window.getIsolines = getIsolines;
window.getPolesOfInaccessibility = getPolesOfInaccessibility;
window.connectVertices = connectVertices;
window.findPath = (start, end, getCost) =>
  findPath(start, end, getCost, (window as any).pack);
window.getVertexPath = (cellsArray) =>
  getVertexPath(cellsArray, (window as any).pack);

import {
  capitalize,
  isValidJSON,
  parseTransform,
  round,
  safeParseJSON,
  sanitizeId,
  splitInTwo,
} from "./stringUtils";

window.round = round;
window.capitalize = capitalize;
window.splitInTwo = splitInTwo;
window.parseTransform = parseTransform;
window.sanitizeId = sanitizeId;

JSON.isValid = isValidJSON;
JSON.safeParse = safeParseJSON;

import { byId } from "./shorthands";

window.byId = byId;
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
    on: (
      name: string,
      fn: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => Node;
    off: (name: string, fn: EventListenerOrEventListenerObject) => Node;
  }
}

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
  shouldRegenerateGrid,
} from "./graphUtils";

window.shouldRegenerateGrid = (grid: any, expectedSeed: number) =>
  shouldRegenerateGrid(
    grid,
    expectedSeed,
    (window as any).graphWidth,
    (window as any).graphHeight,
  );
window.generateGrid = () =>
  generateGrid(
    (window as any).seed,
    (window as any).graphWidth,
    (window as any).graphHeight,
  );
window.findGridAll = (x: number, y: number, radius: number) =>
  findGridAll(x, y, radius, (window as any).grid);
window.findGridCell = (x: number, y: number) =>
  findGridCell(x, y, (window as any).grid);
window.findCell = (x: number, y: number, radius?: number) =>
  findClosestCell(x, y, radius, (window as any).pack);
window.findAll = (x: number, y: number, radius: number) =>
  findAllCellsInRadius(x, y, radius, (window as any).pack);
window.getPackPolygon = (cellIndex: number) =>
  getPackPolygon(cellIndex, (window as any).pack);
window.getGridPolygon = (cellIndex: number) =>
  getGridPolygon(cellIndex, (window as any).grid);
window.calculateVoronoi = calculateVoronoi;
window.poissonDiscSampler = poissonDiscSampler;
window.findAllInQuadtree = findAllInQuadtree;
window.drawHeights = drawHeights;
window.isLand = (i: number) => isLand(i, (window as any).pack);
window.isWater = (i: number) => isWater(i, (window as any).pack);

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
  throttle,
  wiki,
} from "./commonUtils";

window.clipPoly = (points: [number, number][]) =>
  clipPoly(points, graphWidth, graphHeight);
window.getSegmentId = getSegmentId;
window.debounce = debounce;
window.throttle = throttle;
window.parseError = parseError;
window.getBase64 = getBase64;
window.openURL = openURL;
window.wiki = wiki;
window.link = link;
window.isCtrlClick = isCtrlClick;
window.generateDate = generateDate;
window.getLongitude = (x: number, decimals?: number) =>
  getLongitude(x, mapCoordinates, graphWidth, decimals);
window.getLatitude = (y: number, decimals?: number) =>
  getLatitude(y, mapCoordinates, graphHeight, decimals);
window.getCoordinates = (x: number, y: number, decimals?: number) =>
  getCoordinates(x, y, mapCoordinates, graphWidth, graphHeight, decimals);

// Initialize prompt when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializePrompt);
} else {
  initializePrompt();
}

import {
  drawCellsValue,
  drawPath,
  drawPoint,
  drawPolygons,
  drawRouteConnections,
} from "./debugUtils";

window.drawCellsValue = (data: any[]) =>
  drawCellsValue(data, (window as any).pack);
window.drawPolygons = (data: any[]) =>
  drawPolygons(data, (window as any).terrs, (window as any).grid);
window.drawRouteConnections = () =>
  drawRouteConnections((window as any).packedGraph);
window.drawPoint = drawPoint;
window.drawPath = drawPath;

export {
  abbreviate,
  biased,
  byId,
  C_12,
  calculateVoronoi,
  capitalize,
  clipPoly,
  connectVertices,
  convertTemperature,
  createTypedArray,
  debounce,
  distanceSquared,
  drawCellsValue,
  drawHeights,
  drawPath,
  drawPoint,
  drawPolygons,
  drawRouteConnections,
  each,
  findAllCellsInRadius,
  findAllInQuadtree,
  findClosestCell,
  findGridAll,
  findGridCell,
  findPath,
  gauss,
  generateDate,
  generateGrid,
  generateSeed,
  getAdjective,
  getBase64,
  getColors,
  getComposedPath,
  getCoordinates,
  getGridPolygon,
  getIntegerFromSI,
  getIsolines,
  getLatitude,
  getLongitude,
  getMixedColor,
  getNextId,
  getNumberInRange,
  getPackPolygon,
  getPolesOfInaccessibility,
  getRandomColor,
  getSegmentId,
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
  splitInTwo,
  TYPED_ARRAY_MAX_VALUES,
  throttle,
  toHEX,
  trimVowels,
  unique,
  wiki,
};
