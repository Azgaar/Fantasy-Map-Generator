import { last, TYPED_ARRAY_MAX, unique } from "./arrayUtils";
import { abbreviate, getAdjective, isVowel, list, nth, trimVowels } from "./languageUtils";
import { lerp, lim, minmax, normalize, rn } from "./numberUtils";
import "./polyfills";
import { C_12, getCardinalColor, getColors, getMixedColor, getRandomColor, toHEX } from "./colorUtils";
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
import { isLand, isWater, SEA_LEVEL } from "./heightUtils";
import { applyOption, ensureEl, findEl, getComposedPath, getNextId, getPointer } from "./nodeUtils";
import { connectVertices, findPath, getIsolines, getPolesOfInaccessibility, getVertexPath } from "./pathUtils";
import { biased, each, gauss, generateSeed, getNumberInRange, P, Pint, ra, rand, rw } from "./probabilityUtils";
import { findAllInQuadtree } from "./quadtree";
import {
  capitalize,
  escapeHtml,
  isValidJSON,
  parseTransform,
  round,
  safeParseJSON,
  sanitizeId,
  setInlineStyleProperty,
  splitInTwo,
  toCsvField
} from "./stringUtils";
import {
  convertSpeed,
  convertTemperature,
  formatPrice,
  formatSpeed,
  getArea,
  getAreaUnit,
  getCellPopulation,
  getDistanceUnit,
  getDistanceUnitRatio,
  getFriendlyHeight,
  getFriendlyPrecipitation,
  getHeight,
  getIntegerFromSI,
  getKmInDistanceUnit,
  getPrecipitation,
  getTemperatureLikeness,
  parseSpeed,
  si
} from "./unitUtils";

window.rn = rn;
window.minmax = minmax;
window.normalize = normalize;

window.nth = nth;
window.list = list;

window.last = last;
window.unique = unique;

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
window.setInlineStyleProperty = setInlineStyleProperty;

JSON.isValid = isValidJSON;
JSON.safeParse = safeParseJSON;

declare global {
  interface JSON {
    isValid: (str: string) => boolean;
    safeParse: (str: string) => any;
  }
}

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

window.TYPED_ARRAY_MAX = TYPED_ARRAY_MAX;

export {
  abbreviate,
  applyOption,
  biased,
  C_12,
  capitalize,
  clipPoly,
  connectVertices,
  convertSpeed,
  convertTemperature,
  debounce,
  distanceSquared,
  downloadFile,
  drawCellsValue,
  drawPath,
  drawPoint,
  drawPolygons,
  drawRouteConnections,
  each,
  ensureEl,
  escapeHtml,
  findAllInQuadtree,
  findEl,
  findPath,
  formatPrice,
  formatSpeed,
  gauss,
  generateDate,
  generateSeed,
  getAdjective,
  getArea,
  getAreaUnit,
  getBase64,
  getCardinalColor,
  getCellPopulation,
  getColors,
  getComposedPath,
  getCoordinates,
  getDistanceUnit,
  getDistanceUnitRatio,
  getFileName,
  getFriendlyHeight,
  getFriendlyPrecipitation,
  getHeight,
  getIntegerFromSI,
  getIsolines,
  getKmInDistanceUnit,
  getLatitude,
  getLongitude,
  getMixedColor,
  getNextId,
  getNumberInRange,
  getPointer,
  getPolesOfInaccessibility,
  getPrecipitation,
  getRandomColor,
  getSegmentId,
  getTemperatureLikeness,
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
  parseSpeed,
  parseTransform,
  ra,
  rand,
  rn,
  rollups,
  round,
  rw,
  SEA_LEVEL,
  safeParseJSON,
  sanitizeId,
  setInlineStyleProperty,
  si,
  speak,
  splitInTwo,
  TYPED_ARRAY_MAX,
  throttle,
  toCsvField,
  toHEX,
  trimVowels,
  unique,
  uploadFile,
  wiki
};
