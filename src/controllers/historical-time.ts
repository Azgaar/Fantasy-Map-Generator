// The historical view's year, readable by renderers without importing the view controller (which imports them)
let epochStart: number | null = null;

/** the start year of the epoch on screen, or null in the present */
export const getViewedEpochStart = (): number | null => epochStart;

export const setViewedEpochStart = (year: number | null): void => {
  epochStart = year;
};
