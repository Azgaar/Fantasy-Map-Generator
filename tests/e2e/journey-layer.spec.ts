import { expect, test } from "@playwright/test";

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

/** Synthetic burgs at unique coords + `stops` legs (reused coords share one burg id). */
function backtrackBurgJourneyFixture(pts: [number, number][]) {
  const keyToBurgI = new Map<string, number>();
  let nextI = 910001;
  const burgs: { i: number; x: number; y: number; name: string; removed: boolean }[] = [];
  const stops: { kind: "burg"; id: number }[] = [];
  for (const [x, y] of pts) {
    const key = `${x},${y}`;
    let bi = keyToBurgI.get(key);
    if (bi == null) {
      bi = nextI++;
      keyToBurgI.set(key, bi);
      burgs.push({ i: bi, x, y, name: `BT ${bi}`, removed: false });
    }
    stops.push({ kind: "burg" as const, id: bi });
  }
  return { journey: { stops }, burgsToPush: burgs };
}

const BACKTRACK_FIXTURE = backtrackBurgJourneyFixture(BACKTRACK_JOURNEY_POINTS);

test.describe("Journey layer", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();

    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto("/?seed=test-seed&width=1280&height=720");

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
        stopsLen: Array.isArray(j.stops) ? j.stops.length : -1,
        legacyStopIds: Object.prototype.hasOwnProperty.call(j, "stopIds"),
      };
    }, BACKTRACK_JOURNEY_POINTS);

    expect(snap.pointsPresent).toBe(false);
    expect(snap.stopsLen).toBe(0);
    expect(snap.legacyStopIds).toBe(false);
  });

  test("drawJourney resolves a burg stop ref using pack.burgs positions", async ({ page }) => {
    await page.evaluate(() => {
      const w = window as unknown as {
        layerIsOn: (id: string) => boolean;
        toggleJourney: () => void;
        pack: {
          burgs: Array<{ i: number; x: number; y: number; name?: string; removed?: boolean }>;
          journey: { stops: { kind: string; id: number }[] };
        };
        drawJourney: () => void;
      };
      if (!w.layerIsOn("toggleJourney")) w.toggleJourney();
      const testI = 999001;
      w.pack.burgs.push({
        i: testI,
        x: 400,
        y: 300,
        name: "E2E journey burg",
        removed: false,
      });
      w.pack.journey = { stops: [{ kind: "burg", id: testI }] };
      w.drawJourney();
    });

    await expect(page.locator("#journeys .journey-vertices circle")).toHaveCount(1);
    await expect(page.locator("#journeys .journey-segments .journey-segment")).toHaveCount(0);
  });

  test("drawJourney renders paths and vertices for journey data", async ({ page }) => {
    await page.evaluate(
      ({ journey, burgsToPush }) => {
        const w = window as unknown as {
          layerIsOn: (id: string) => boolean;
          toggleJourney: () => void;
          pack: {
            journey: typeof journey;
            burgs: Array<{ i: number; x: number; y: number; name: string; removed: boolean }>;
          };
          drawJourney: () => void;
        };
        if (!w.layerIsOn("toggleJourney")) w.toggleJourney();
        for (const b of burgsToPush) w.pack.burgs.push(b);
        w.pack.journey = journey;
        w.drawJourney();
      },
      { journey: BACKTRACK_FIXTURE.journey, burgsToPush: BACKTRACK_FIXTURE.burgsToPush },
    );

    const segmentCount = BACKTRACK_JOURNEY_POINTS.length - 1;
    await expect(page.locator("#journeys .journey-segments .journey-segment")).toHaveCount(segmentCount);
    await expect(page.locator("#journeys .journey-segment-stroke")).toHaveCount(segmentCount);
    // Deduped vertices: three distinct burg positions
    await expect(page.locator("#journeys .journey-vertices circle")).toHaveCount(3);
    const arrowN = await page.locator("#journeys .journey-arrow").count();
    expect(arrowN).toBeGreaterThan(segmentCount);
  });

  test("journey stroke-width shrinks in map units when zoom scale increases (screen-constant sizing)", async ({
    page,
  }) => {
    const snap = await page.evaluate(
      ({
        journey,
        burgsToPush,
      }: {
        journey: typeof BACKTRACK_FIXTURE.journey;
        burgsToPush: typeof BACKTRACK_FIXTURE.burgsToPush;
      }) => {
      const w = window as unknown as {
        layerIsOn: (id: string) => boolean;
        toggleJourney: () => void;
        pack: {
          journey: typeof journey;
          burgs: Array<{ i: number; x: number; y: number; name: string; removed: boolean }>;
        };
        drawJourney: () => void;
        scale: number;
        syncJourneyZoom: (zoomScale: number) => void;
      };
      if (!w.layerIsOn("toggleJourney")) w.toggleJourney();
      for (const b of burgsToPush) w.pack.burgs.push(b);
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
    },
    { journey: BACKTRACK_FIXTURE.journey, burgsToPush: BACKTRACK_FIXTURE.burgsToPush },
    );

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
