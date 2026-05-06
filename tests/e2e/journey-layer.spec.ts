import { expect, test } from "./fixtures";

/** Rich path: multiple stops, triple A↔B repetition (directed chord reuse + lanes), then a branch. */
const BACKTRACK_JOURNEY_POINTS: [number, number][] = [
  [400, 300],
  [720, 460],
  [400, 300],
  [720, 460],
  [400, 300],
  [720, 460],
  [560, 190],
];

/** Catalog + `stopIds` from an ordered coord list (reused coords share one waypoint). */
function packJourneyFromCoords(pts: [number, number][]) {
  const waypoints: { id: string; name: string; x: number; y: number }[] = [];
  const keyToId = new Map<string, string>();
  let n = 0;
  const stopIds: string[] = [];
  for (const [x, y] of pts) {
    const key = `${x},${y}`;
    let id = keyToId.get(key);
    if (!id) {
      n += 1;
      id = `t_wp_${n}`;
      keyToId.set(key, id);
      waypoints.push({ id, name: `Stop ${n}`, x, y });
    }
    stopIds.push(id);
  }
  return { stopIds, waypoints };
}

const BACKTRACK_PACK_JOURNEY = packJourneyFromCoords(BACKTRACK_JOURNEY_POINTS);

test.describe("Journey layer", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();

    await page.goto("");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto("?seed=test-seed&width=1280&height=720");

    await page.waitForFunction(() => (window as unknown as { mapId?: unknown }).mapId !== undefined, {
      timeout: 60000,
    });

    await page.waitForTimeout(500);
  });

  test("toggleJourney shows and hides the #journeys SVG group", async ({ page }) => {
    await page.evaluate(() => (window as unknown as { showOptions: () => void }).showOptions());

    let disp = await page.evaluate(() => getComputedStyle(document.getElementById("journeys")!).display);
    expect(disp).toBe("none");

    await page.locator("#toggleJourney").click();
    await page.waitForTimeout(600);
    disp = await page.evaluate(() => getComputedStyle(document.getElementById("journeys")!).display);
    expect(disp).not.toBe("none");

    await page.locator("#toggleJourney").click();
    await page.waitForTimeout(600);
    disp = await page.evaluate(() => getComputedStyle(document.getElementById("journeys")!).display);
    expect(disp).toBe("none");
  });

  test("drawJourney strips stray points key and leaves empty journey", async ({ page }) => {
    const snap = await page.evaluate((pts) => {
      const w = window as unknown as {
        layerIsOn: (id: string) => boolean;
        toggleJourney: () => void;
        pack: { journey: Record<string, unknown> };
        drawJourney: () => void;
      };
      if (!w.layerIsOn("toggleJourney")) w.toggleJourney();
      w.pack.journey = { points: pts };
      w.drawJourney();
      const j = w.pack.journey;
      return {
        pointsPresent: Object.prototype.hasOwnProperty.call(j, "points"),
        stopCount: Array.isArray(j.stopIds) ? j.stopIds.length : -1,
        waypointCount: Array.isArray(j.waypoints) ? j.waypoints.length : -1,
      };
    }, BACKTRACK_JOURNEY_POINTS);

    expect(snap.pointsPresent).toBe(false);
    expect(snap.stopCount).toBe(0);
    expect(snap.waypointCount).toBe(0);
  });

  test("drawJourney renders paths and vertices for journey data", async ({ page }) => {
    await page.evaluate(
      ({ journey }) => {
        const w = window as unknown as {
          layerIsOn: (id: string) => boolean;
          toggleJourney: () => void;
          pack: { journey: typeof journey };
          drawJourney: () => void;
        };
        if (!w.layerIsOn("toggleJourney")) w.toggleJourney();
        w.pack.journey = journey;
        w.drawJourney();
      },
      { journey: BACKTRACK_PACK_JOURNEY },
    );

    const segmentCount = BACKTRACK_JOURNEY_POINTS.length - 1;
    await expect(page.locator("#journeys .journey-segments .journey-segment")).toHaveCount(segmentCount);
    await expect(page.locator("#journeys .journey-segment-stroke")).toHaveCount(segmentCount);
    // Deduped waypoints: only (400,300), (720,460), (560,190)
    await expect(page.locator("#journeys .journey-vertices circle")).toHaveCount(3);
    const arrowN = await page.locator("#journeys .journey-arrow").count();
    expect(arrowN).toBeGreaterThan(segmentCount);
  });

  test("journey stroke-width shrinks in map units when zoom scale increases (screen-constant sizing)", async ({
    page,
  }) => {
    const snap = await page.evaluate((journey: typeof BACKTRACK_PACK_JOURNEY) => {
      const w = window as unknown as {
        layerIsOn: (id: string) => boolean;
        toggleJourney: () => void;
        pack: { journey: typeof journey };
        drawJourney: () => void;
        scale: number;
        syncJourneyZoom: (zoomScale: number) => void;
      };
      if (!w.layerIsOn("toggleJourney")) w.toggleJourney();
      w.pack.journey = journey;
      w.drawJourney();
      const readStrokes = () =>
        [...document.querySelectorAll(".journey-segment-stroke")].map((el) =>
          parseFloat(el.getAttribute("stroke-width") || "NaN"),
        );
      const readWaypointR = () =>
        [...document.querySelectorAll(".journey-waypoint")].map((el) =>
          parseFloat(el.getAttribute("r") || "NaN"),
        );
      const strokeBefore = readStrokes();
      const rBefore = readWaypointR();
      const baseScale =
        typeof w.scale === "number" && Number.isFinite(w.scale) ? w.scale : 1;
      w.syncJourneyZoom(baseScale * 4);
      const strokeAfter = readStrokes();
      const rAfter = readWaypointR();
      return { strokeBefore, strokeAfter, rBefore, rAfter };
    }, BACKTRACK_PACK_JOURNEY);

    const segN = BACKTRACK_JOURNEY_POINTS.length - 1;
    expect(snap.strokeBefore.length).toBe(segN);
    expect(snap.strokeAfter.length).toBe(segN);
    for (const x of snap.strokeBefore) expect(Number.isFinite(x)).toBe(true);
    expect([...new Set(snap.strokeBefore)].length).toBe(1);
    expect([...new Set(snap.strokeAfter)].length).toBe(1);
    expect(snap.strokeAfter[0]).toBeLessThan(snap.strokeBefore[0]);

    expect(snap.rBefore.length).toBe(3);
    expect(snap.rAfter.length).toBe(3);
    for (const x of snap.rBefore) expect(Number.isFinite(x)).toBe(true);
    expect([...new Set(snap.rBefore)].length).toBe(1);
    expect([...new Set(snap.rAfter)].length).toBe(1);
    expect(snap.rAfter[0]).toBeLessThan(snap.rBefore[0]);
  });

  test("journey editor opens from Tools add Journey", async ({ page }) => {
    await page.evaluate(() => (window as unknown as { showOptions: () => void }).showOptions());
    await page.locator("#toolsTab").click();
    await page.locator("#addJourney").click();
    await expect(page.locator("#journeyEditor")).toBeVisible();

    await page.evaluate(() => {
      const $ = (window as unknown as { $: (sel: string) => { dialog: (a: string) => void } }).$;
      $("#journeyEditor").dialog("close");
    });
  });
});
