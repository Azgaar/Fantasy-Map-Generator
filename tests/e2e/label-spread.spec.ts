import {expect, test, type Page, type TestInfo} from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

type LabelType = "state" | "province" | "burg" | "river" | "route" | "added";

interface Placement {
  id: string;
  type: LabelType;
  entityId: number;
  dx: number;
  dy: number;
  startOffset: number;
}

interface ReferencePlacement extends Partial<Placement> {
  id: string;
  type: LabelType;
  entityId: number;
}

interface ReferenceFixture {
  scene: {
    seed: string;
    width: number;
    height: number;
    scale: number;
    x: number;
    y: number;
    pathLabelMinZoom: number;
  };
  referencePlacements: ReferencePlacement[];
}

const fixtureDirectory = path.join(__dirname, "../fixtures/label-spread");
const reference = JSON.parse(
  fs.readFileSync(path.join(fixtureDirectory, "reference.json"), "utf8")
) as ReferenceFixture;

test.describe("Label spread golden scene", () => {
  test("matches the hand-arranged cartographic reference", async ({page}, testInfo) => {
    await openScene(page);
    const baseline = await getDisplayedPlacements(page);
    await attachScreenshot(page, testInfo, "baseline");

    await applyReferencePlacements(page);
    await attachScreenshot(page, testInfo, "reference");

    await openScene(page);

    await page.keyboard.press("Shift+L");
    await page.locator("#labelsSpread").click();
    await expect(page.locator("#labelsSpreadApply")).toBeVisible({timeout: 30_000});

    const automatic = await getDisplayedPlacements(page);
    const invalidPaths = await getInvalidPathPlacements(page);
    await attachScreenshot(page, testInfo, "automatic");

    const changed = automatic.filter(next => placementChanged(baseline.find(({id}) => id === next.id), next));
    const expectedIds = new Set(reference.referencePlacements.map(({id}) => id));
    const unexpected = changed.filter(({id, type}) => type !== "river" && type !== "route" && !expectedIds.has(id));
    const shiftedPaths = automatic.filter(after => {
      if (after.type !== "river" && after.type !== "route") return false;
      const before = baseline.find(({id}) => id === after.id);
      return !before || before.dx !== after.dx || before.dy !== after.dy;
    });
    const errors = reference.referencePlacements.map(target => placementError(target, automatic));

    expect(unexpected.map(({id}) => id), "labels moved outside the hand-arranged reference").toEqual([]);
    expect(
      shiftedPaths.map(({id}) => id),
      "River and Route labels must move only by changing startOffset"
    ).toEqual([]);
    expect(invalidPaths, "River and Route labels must stay within 20–80% and read left-to-right").toEqual([]);
    expect(Math.max(...errors), "automatic placement deviates from the hand-arranged reference").toBeLessThan(2);
  });
});

async function openScene(page: Page): Promise<void> {
  const {seed, width, height, scale, x, y, pathLabelMinZoom} = reference.scene;
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(`/?seed=${seed}&width=${width}&height=${height}&scale=${scale}&x=${x}&y=${y}`);
  await page.waitForFunction(() => (window as typeof window & {mapId?: number}).mapId !== undefined, undefined, {
    timeout: 120_000
  });
  await page.waitForTimeout(2_000);
  await page.evaluate(minZoom => {
    const globals = window as typeof window & {
      options: {labels: {groups: {name: string; zoom: {min: number | null}}[]}};
      drawLabels: () => void;
      ViewportLayers: {renderNow: () => void};
    };
    for (const group of globals.options.labels.groups) {
      if (group.name === "river" || group.name === "route") group.zoom.min = minZoom;
    }
    globals.drawLabels();
    globals.ViewportLayers.renderNow();
  }, pathLabelMinZoom);
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({content: "#tooltip {display: none !important}"});
  await expect(page.locator("#labels-route text").first()).toBeVisible();
}

async function getInvalidPathPlacements(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const invalid: string[] = [];
    for (const text of document.querySelectorAll<SVGTextElement>(
      "#labels text[data-label-type='river'], #labels text[data-label-type='route']"
    )) {
      const textPath = text.querySelector<SVGTextPathElement>("textPath");
      const href = textPath?.getAttribute("href");
      const path = href ? document.querySelector<SVGPathElement>(href) : null;
      if (!textPath || !path) continue;

      const startOffset = Number.parseFloat(textPath.getAttribute("startOffset") || "50");
      const pathLength = path.getTotalLength();
      const textLength = textPath.getComputedTextLength();
      const start = (pathLength * startOffset) / 100 - textLength / 2;
      const end = start + textLength;
      let previous = path.getPointAtLength(start);
      let upright = start >= 0 && end <= pathLength;
      for (let index = 1; upright && index <= 16; index++) {
        const point = path.getPointAtLength(start + ((end - start) * index) / 16);
        const dx = point.x - previous.x;
        const distance = Math.hypot(dx, point.y - previous.y);
        if (distance && dx / distance < -0.02) upright = false;
        previous = point;
      }
      if (startOffset < 20 || startOffset > 80 || !upright) invalid.push(text.id);
    }
    return invalid;
  });
}

async function applyReferencePlacements(page: Page): Promise<void> {
  await page.evaluate(placements => {
    const globals = window as typeof window & {
      Labels: {
        getEntity: (
          type: LabelType,
          id: number
        ) => {label?: {dx?: number; dy?: number; startOffset?: number}} | undefined;
      };
      drawLabels: () => void;
      ViewportLayers: {renderNow: () => void};
    };
    for (const placement of placements) {
      const label = globals.Labels.getEntity(placement.type, placement.entityId)?.label;
      if (!label) throw new Error(`Missing reference label ${placement.id}`);
      if (placement.dx !== undefined) label.dx = placement.dx;
      if (placement.dy !== undefined) label.dy = placement.dy;
      if (placement.startOffset !== undefined) label.startOffset = placement.startOffset;
    }
    globals.drawLabels();
    globals.ViewportLayers.renderNow();
  }, reference.referencePlacements);
}

async function getDisplayedPlacements(page: Page): Promise<Placement[]> {
  return page.evaluate(() => {
    const globals = window as typeof window & {
      Labels: {
        getEntity: (type: LabelType, id: number) => {label?: Placement} | undefined;
      };
    };
    const mapBounds = document.querySelector<SVGSVGElement>("#map")!.getBoundingClientRect();
    return [...document.querySelectorAll<SVGTextElement>("#labels text[data-label-type][data-id]")]
      .filter(element => {
        const rect = element.getBoundingClientRect();
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.right > mapBounds.left &&
          rect.left < mapBounds.right &&
          rect.bottom > mapBounds.top &&
          rect.top < mapBounds.bottom
        );
      })
      .map(element => {
        const type = element.dataset.labelType as LabelType;
        const entityId = Number(element.dataset.id);
        const label = globals.Labels.getEntity(type, entityId)?.label;
        return {
          id: element.id,
          type,
          entityId,
          dx: label?.dx || 0,
          dy: label?.dy || 0,
          startOffset: label?.startOffset ?? 50
        };
      });
  });
}

function placementChanged(before: Placement | undefined, after: Placement): boolean {
  if (!before) return true;
  return (
    before.dx !== after.dx ||
    before.dy !== after.dy ||
    before.startOffset !== after.startOffset
  );
}

function placementError(target: ReferencePlacement, placements: Placement[]): number {
  const actual = placements.find(({id}) => id === target.id);
  if (!actual) return Number.POSITIVE_INFINITY;
  const pointError = Math.hypot((target.dx || 0) - actual.dx, (target.dy || 0) - actual.dy);
  const offsetError = Math.abs((target.startOffset ?? 50) - actual.startOffset) / 10;
  return pointError + offsetError;
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await testInfo.attach(name, {body: await page.screenshot(), contentType: "image/png"});
}
