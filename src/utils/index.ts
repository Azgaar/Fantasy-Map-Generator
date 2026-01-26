import "./polyfills";

import { rn, lim, minmax, normalize, lerp } from "./numberUtils";
window.rn = rn;
window.lim = lim;
window.minmax = minmax;
window.normalize = normalize;
window.lerp = lerp as typeof window.lerp;

import { isVowel, trimVowels, getAdjective, nth, abbreviate, list } from "./languageUtils";
window.vowel = isVowel;
window.trimVowels = trimVowels;
window.getAdjective = getAdjective;
window.nth = nth;
window.abbreviate = abbreviate;
window.list = list;

import { last, unique, deepCopy, getTypedArray, createTypedArray, TYPED_ARRAY_MAX_VALUES } from "./arrayUtils";
window.last = last;
window.unique = unique;
window.deepCopy = deepCopy;
window.getTypedArray = getTypedArray;
window.createTypedArray = createTypedArray;
window.INT8_MAX = TYPED_ARRAY_MAX_VALUES.INT8_MAX;
window.UINT8_MAX = TYPED_ARRAY_MAX_VALUES.UINT8_MAX;
window.UINT16_MAX = TYPED_ARRAY_MAX_VALUES.UINT16_MAX;
window.UINT32_MAX = TYPED_ARRAY_MAX_VALUES.UINT32_MAX;

import { rand, P, each, gauss, Pint, biased, generateSeed, getNumberInRange, ra, rw } from "./probabilityUtils";
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

import { convertTemperature, si, getIntegerFromSI } from "./unitUtils";
window.convertTemperature = (temp:number, scale: any = (window as any).temperatureScale.value || "°C") => convertTemperature(temp, scale);
window.si = si;
window.getInteger = getIntegerFromSI;

import { toHEX, getColors, getRandomColor, getMixedColor, C_12 } from "./colorUtils";
window.toHEX = toHEX;
window.getColors = getColors;
window.getRandomColor = getRandomColor;
window.getMixedColor = getMixedColor;
window.C_12 = C_12;

import { getComposedPath, getNextId } from "./nodeUtils";
window.getComposedPath = getComposedPath;
window.getNextId = getNextId;

import { rollups, distanceSquared } from "./functionUtils";
window.rollups = rollups;
window.dist2 = distanceSquared;

import { getIsolines, getPolesOfInaccessibility, connectVertices, findPath, getVertexPath } from "./pathUtils";
window.getIsolines = getIsolines;
window.getPolesOfInaccessibility = getPolesOfInaccessibility;
window.connectVertices = connectVertices;
window.findPath = (start, end, getCost) => findPath(start, end, getCost, (window as any).pack);
window.getVertexPath = (cellsArray) => getVertexPath(cellsArray, (window as any).pack);

import { round, capitalize, splitInTwo, parseTransform, isValidJSON, safeParseJSON, sanitizeId } from "./stringUtils";
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
    on: (name: string, fn: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => Node;
    off: (name: string, fn: EventListenerOrEventListenerObject) => Node;
  }
}

import { shouldRegenerateGrid, generateGrid, findGridAll, findGridCell, findClosestCell, calculateVoronoi, findAllCellsInRadius, getPackPolygon, getGridPolygon, poissonDiscSampler, isLand, isWater, findAllInQuadtree, drawHeights } from "./graphUtils";
window.shouldRegenerateGrid = (grid: any, expectedSeed: number) => shouldRegenerateGrid(grid, expectedSeed, (window as any).graphWidth, (window as any).graphHeight);
window.generateGrid = () => generateGrid((window as any).seed, (window as any).graphWidth, (window as any).graphHeight);
window.findGridAll = (x: number, y: number, radius: number) => findGridAll(x, y, radius, (window as any).grid);
window.findGridCell = (x: number, y: number) => findGridCell(x, y, (window as any).grid);
window.findCell = (x: number, y: number, radius?: number) => findClosestCell(x, y, radius, (window as any).pack);
window.findAll = (x: number, y: number, radius: number) => findAllCellsInRadius(x, y, radius, (window as any).pack);
window.getPackPolygon = (cellIndex: number) => getPackPolygon(cellIndex, (window as any).pack);
window.getGridPolygon = (cellIndex: number) => getGridPolygon(cellIndex, (window as any).grid);
window.calculateVoronoi = calculateVoronoi;
window.poissonDiscSampler = poissonDiscSampler;
window.findAllInQuadtree = findAllInQuadtree;
window.drawHeights = drawHeights;
window.isLand = (i: number) => isLand(i, (window as any).pack);
window.isWater = (i: number) => isWater(i, (window as any).pack);

import { clipPoly, getSegmentId, debounce, throttle, parseError, getBase64, openURL, wiki, link, isCtrlClick, generateDate, getLongitude, getLatitude, getCoordinates, initializePrompt } from "./commonUtils";
window.clipPoly = (points: [number, number][], secure?: number) => clipPoly(points, graphWidth, graphHeight, secure);
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
window.getLongitude = (x: number, decimals?: number) => getLongitude(x, mapCoordinates, graphWidth, decimals);
window.getLatitude = (y: number, decimals?: number) => getLatitude(y, mapCoordinates, graphHeight, decimals);
window.getCoordinates = (x: number, y: number, decimals?: number) => getCoordinates(x, y, mapCoordinates, graphWidth, graphHeight, decimals);

// Initialize prompt when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePrompt);
} else {
  initializePrompt();
}

import { drawCellsValue, drawPolygons, drawRouteConnections, drawPoint, drawPath } from "./debugUtils";
window.drawCellsValue = (data:any[]) => drawCellsValue(data, (window as any).pack);
window.drawPolygons = (data: any[]) => drawPolygons(data, (window as any).terrs, (window as any).grid);
window.drawRouteConnections = () => drawRouteConnections((window as any).packedGraph);
window.drawPoint = drawPoint;
window.drawPath = drawPath;


export {
  rn,
  lim,
  minmax,
  normalize,
  lerp,
  isVowel,
  trimVowels,
  getAdjective,
  nth,
  abbreviate,
  list,
  last,
  unique,
  deepCopy,
  getTypedArray,
  createTypedArray,
  TYPED_ARRAY_MAX_VALUES,
  rand,
  P,
  each,
  gauss,
  Pint,
  biased,
  generateSeed,
  getNumberInRange,
  ra,
  rw,
  convertTemperature,
  si,
  getIntegerFromSI,
  toHEX,
  getColors,
  getRandomColor,
  getMixedColor,
  C_12,
  getComposedPath,
  getNextId,
  rollups,
  distanceSquared,
  getIsolines,
  getPolesOfInaccessibility,
  connectVertices,
  findPath,
  getVertexPath,
  round,
  capitalize,
  splitInTwo,
  parseTransform,
  isValidJSON,
  safeParseJSON,
  sanitizeId,
  byId,
  shouldRegenerateGrid,
  generateGrid,
  findGridAll,
  findGridCell,
  findClosestCell,
  calculateVoronoi,
  findAllCellsInRadius,
  getPackPolygon,
  getGridPolygon,
  poissonDiscSampler,
  isLand,
  isWater,
  findAllInQuadtree,
  drawHeights,
  clipPoly,
  getSegmentId,
  debounce,
  throttle,
  parseError,
  getBase64,
  openURL,
  wiki,
  link,
  isCtrlClick,
  generateDate,
  getLongitude,
  getLatitude,
  getCoordinates,
  initializePrompt,
  drawCellsValue,
  drawPolygons,
  drawRouteConnections,
  drawPoint,
  drawPath
}