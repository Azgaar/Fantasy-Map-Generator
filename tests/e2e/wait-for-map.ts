// The app announces a finished map by bumping `window.mapsGenerated` (see src/components/lifecycle.ts).
// It counts the maps produced this session, so one seam answers both "is a map ready?" and "is this
// a different map from the one I saw before?" - which a bare boolean flag cannot.
import type { Page } from "@playwright/test";

const DEFAULT_TIMEOUT = 120000;

const readCount = () => (window as unknown as { mapsGenerated?: number }).mapsGenerated ?? 0;

/** Wait until the app has generated or loaded a map */
export function waitForMap(page: Page, timeout = DEFAULT_TIMEOUT): Promise<unknown> {
  return page.waitForFunction(readCount, undefined, { timeout }).then(handle => handle.jsonValue());
}

/** How many maps the page has produced so far. Pair with `waitForNextMap` to await the one after */
export function countMaps(page: Page): Promise<number> {
  return page.evaluate(readCount);
}

/** Wait until the app has produced a map beyond the `previous` count */
export function waitForNextMap(page: Page, previous: number, timeout = DEFAULT_TIMEOUT): Promise<unknown> {
  return page.waitForFunction(
    seen => ((window as unknown as { mapsGenerated?: number }).mapsGenerated ?? 0) > seen,
    previous,
    { timeout }
  );
}
