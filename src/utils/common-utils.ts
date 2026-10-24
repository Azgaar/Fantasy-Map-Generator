import { clipPolygon } from "lineclip";
import { last } from "./array-utils";
import { distanceSquared, rn } from "./number-utils";

/**
 * Clip polygon points to graph boundaries
 * @param points - Array of points [[x1, y1], [x2, y2], ...]
 * @param graphWidth - Width of the graph
 * @param graphHeight - Height of the graph
 * @param secure - When truthy, duplicate boundary-crossing points to prevent B-spline
 *   curves from arcing away from map edges (restores original "secure clipping" behavior)
 * @returns Clipped polygon points
 */
export const clipPoly = (points: [number, number][], graphWidth: number, graphHeight: number, secure?: number) => {
  if (points.length < 2) return points;
  if (points.some(point => point === undefined)) {
    ERROR && console.error("Undefined point in clipPoly", points);
    return points;
  }

  const clipped = clipPolygon(points, [0, 0, graphWidth, graphHeight]);

  if (!secure || !clipped.length) return clipped;

  // Duplicate each boundary point twice so the B-spline passes through it
  // rather than arcing away from the map edge (replicates polygonclip secure=1)
  const secured: [number, number][] = [];
  for (const point of clipped) {
    secured.push(point);
    if (point[0] === 0 || point[0] === graphWidth || point[1] === 0 || point[1] === graphHeight) {
      secured.push(point, point);
    }
  }
  return secured;
};

/**
 * Get segment of any point on polyline
 * @param points - Array of points defining the polyline
 * @param point - The point to find the segment for
 * @param step - Step size for segment search (default is 10)
 * @returns The segment ID (1-indexed)
 */
export const getSegmentId = (points: [number, number][], point: [number, number], step: number = 10): number => {
  if (points.length === 2) return 1;

  let minSegment = 1;
  let minDist = Infinity;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    const length = Math.sqrt(distanceSquared(p1, p2));
    const segments = Math.ceil(length / step);
    const dx = (p2[0] - p1[0]) / segments;
    const dy = (p2[1] - p1[1]) / segments;

    for (let s = 0; s < segments; s++) {
      const x = p1[0] + s * dx;
      const y = p1[1] + s * dy;
      const dist = distanceSquared(point, [x, y]);

      if (dist >= minDist) continue;
      minDist = dist;
      minSegment = i + 1;
    }
  }

  return minSegment;
};

/**
 * Creates a debounced function that delays next func call until after ms milliseconds
 * @param func - The function to debounce
 * @param ms - The number of milliseconds to delay
 * @returns The debounced function
 */
export const debounce = <T extends (...args: any[]) => any>(func: T, ms: number) => {
  let isCooldown = false;

  return function (this: any, ...args: Parameters<T>) {
    if (isCooldown) return;
    func.apply(this, args);
    isCooldown = true;
    setTimeout(() => {
      isCooldown = false;
    }, ms);
  };
};

/**
 * Creates a throttled function that only invokes func at most once every ms milliseconds
 * @param func - The function to throttle
 * @param ms - The number of milliseconds to throttle invocations to
 * @returns The throttled function
 */
export const throttle = <T extends (...args: any[]) => any>(func: T, ms: number) => {
  let isThrottled = false;
  let savedArgs: any[] | null = null;
  let savedThis: any = null;

  function wrapper(this: any, ...args: Parameters<T>) {
    if (isThrottled) {
      savedArgs = args;
      savedThis = this;
      return;
    }

    func.apply(this, args);
    isThrottled = true;

    setTimeout(() => {
      isThrottled = false;
      if (savedArgs) {
        wrapper.apply(savedThis, savedArgs as Parameters<T>);
        savedArgs = savedThis = null;
      }
    }, ms);
  }

  return wrapper;
};

const MAX_ERROR_CAUSES = 4;

/** unwrap an error and everything it was caused by, outermost first */
const getErrorChain = (error: Error): Error[] => {
  const chain: Error[] = [];
  let current: unknown = error;

  while (current instanceof Error && chain.length <= MAX_ERROR_CAUSES) {
    chain.push(current);
    current = current.cause;
  }

  return chain;
};

/**
 * Parse error to get the readable string in Chrome and Firefox
 * @param error - The error object to parse
 * @returns Formatted error string with HTML formatting
 */
export const parseError = (error: Error): string => {
  const isFirefox = navigator.userAgent.toLowerCase().indexOf("firefox") > -1;
  const stringify = (e: Error) => (isFirefox ? `${e.toString()} ${e.stack}` : e.stack || e.toString());
  const errorString = getErrorChain(error).map(stringify).join("<br>Caused by: ");
  const regex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|])/gi;
  const errorNoURL = errorString.replace(regex, url => `<i>${last(url.split("/"))}</i>`);
  const errorParsed = errorNoURL.replace(/at /gi, "<br>&nbsp;&nbsp;at ");
  return errorParsed;
};

/**
 * Open URL in a new tab or window
 * @param url - The URL to open
 */
export const openURL = (url: string): void => {
  window.open(url, "_blank");
};

/**
 * Open project wiki-page
 * @param page - The wiki page name/path to open
 */
export const wiki = (page: string): void => {
  window.open(`https://github.com/Azgaar/Fantasy-Map-Generator/wiki/${page}`, "_blank");
};

/**
 * Wrap URL into html a element
 * @param URL - The URL for the link
 * @param description - The link text/description
 * @returns HTML anchor element as a string
 */
export const link = (URL: string, description: string): string => {
  return `<a href="${URL}" rel="noopener" target="_blank">${description}</a>`;
};

/**
 * Check if Ctrl key (or Cmd on Mac) was pressed during an event
 * @param event - The keyboard or mouse event
 * @returns True if Ctrl/Cmd was pressed
 */
export const isCtrlClick = (event: MouseEvent | KeyboardEvent): boolean => {
  // meta key is cmd key on MacOs
  return event.ctrlKey || event.metaKey;
};

/**
 * Convert x coordinate to longitude
 * @param x - The x coordinate
 * @param mapCoordinates - Map coordinates object with lonW and lonT properties
 * @param graphWidth - Width of the graph
 * @param decimals - Number of decimal places (default is 2)
 * @returns Longitude value
 */
export const getLongitude = (x: number, mapCoordinates: any, graphWidth: number, decimals: number = 2): number => {
  return rn(mapCoordinates.lonW + (x / graphWidth) * mapCoordinates.lonT, decimals);
};

/**
 * Convert y coordinate to latitude
 * @param y - The y coordinate
 * @param mapCoordinates - Map coordinates object with latN and latT properties
 * @param graphHeight - Height of the graph
 * @param decimals - Number of decimal places (default is 2)
 * @returns Latitude value
 */
export const getLatitude = (y: number, mapCoordinates: any, graphHeight: number, decimals: number = 2): number => {
  return rn(mapCoordinates.latN - (y / graphHeight) * mapCoordinates.latT, decimals);
};

/**
 * Convert x,y coordinates to longitude,latitude
 * @param x - The x coordinate
 * @param y - The y coordinate
 * @param mapCoordinates - Map coordinates object
 * @param graphWidth - Width of the graph
 * @param graphHeight - Height of the graph
 * @param decimals - Number of decimal places (default is 2)
 * @returns Array with [longitude, latitude]
 */
export const getCoordinates = (
  x: number,
  y: number,
  mapCoordinates: any,
  graphWidth: number,
  graphHeight: number,
  decimals: number = 2
): [number, number] => {
  return [getLongitude(x, mapCoordinates, graphWidth, decimals), getLatitude(y, mapCoordinates, graphHeight, decimals)];
};
