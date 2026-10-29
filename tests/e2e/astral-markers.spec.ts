import { expect, test, type Page } from "@playwright/test";
import { waitForMap } from "./wait-for-map";

// Markers are read as anomalies in Astral: a type's default icon swaps to its space reading and
// the tooltip names it. The marker record keeps its fantasy type and icon — leaving the view
// restores the chart exactly.

declare const pack: import("@/types/packed-graph").PackedGraph;
declare const Layers: { show(...ids: string[]): void };
declare const Controllers: {
  AstralMarkers: { apply: () => void };
  AstralMode: { enter: () => Promise<void>; exit: () => Promise<void> };
};

const READINGS: Record<string, string> = {
  volcanoes: "Nova remnants",
  "hot-springs": "Plasma plumes",
  "sacred-forests": "Garden worlds",
  inns: "Way stations",
  "water-sources": "Ice claims",
  mines: "Mines"
};

async function pickMarker(page: Page): Promise<{ id: number; reading: string }> {
  const types = Object.keys(READINGS);
  const found = await page.evaluate(list => {
    const marker = pack.markers.find(m => m.type && list.includes(m.type) && !m.hidden && m.icon);
    return marker ? { id: marker.i, type: marker.type as string } : null;
  }, types);
  if (!found) throw new Error(`no anomaly-type marker on this seed: ${types.join(", ")}`);
  return { id: found.id, reading: READINGS[found.type] };
}

const readIcon = (page: Page, id: number) =>
  page.evaluate(markerId => document.querySelector(`#marker${markerId} use`)?.getAttribute("href") ?? null, id);

const showMarkers = (page: Page) => page.evaluate(() => Layers.show("markers"));

// FMG's version-update changelog opens a dialog over the map centre and eats the wheel: dismiss it
async function dismissChangelog(page: Page): Promise<void> {
  if (await page.locator("#alert").isVisible().catch(() => false))
    await page.evaluate(() => window.closeDialogs?.());
}

test.describe("Astral anomalies", () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto("/?seed=astral-markers&width=1280&height=720");
    await waitForMap(page);
    await page.waitForTimeout(300);
  });

  test("astral reads a marker as an anomaly and restores it on leaving", async ({ page }) => {
    const { id, reading } = await pickMarker(page);
    await showMarkers(page);
    const fantasyIcon = await readIcon(page, id);
    expect(fantasyIcon).toMatch(/^#/);

    await page.evaluate(() => Controllers.AstralMode.enter());
    await showMarkers(page);
    await expect.poll(() => readIcon(page, id)).not.toBe(fantasyIcon);

    await dismissChangelog(page);
    const box = await page.locator(`#marker${id}`).boundingBox();
    if (!box) throw new Error(`marker ${id} has no box`);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.move(x + 1, y); // the handler is debounced: nudge it awake
    await expect(page.locator("#tooltip")).toContainText(reading, { timeout: 5000 });

    // the note box reads the anomaly too: the fantasy legend is not shown in Astral
    await expect(page.locator("#notes")).toBeVisible();
    const shownNote = (await page.locator("#notesBody").textContent())?.trim() ?? "";
    const storedNote = await page.evaluate(markerId => pack.markers.find(m => m.i === markerId)?.note ?? "", id);
    expect(shownNote).not.toBe(storedNote.trim());
    expect(shownNote.length).toBeGreaterThan(0);

    await page.evaluate(() => Controllers.AstralMode.exit());
    await showMarkers(page);
    await expect.poll(() => readIcon(page, id)).toBe(fantasyIcon);

    // the record never changed: the reading is a view, not a conversion
    const stored = await page.evaluate(markerId => pack.markers.find(m => m.i === markerId)?.icon, id);
    expect(`#${stored}`).toBe(fantasyIcon);
  });

  test("the conversion rewrites the legend and icon, keeping the original below a divider", async ({ page }) => {
    const { id } = await pickMarker(page);
    await showMarkers(page);
    const read = (markerId: number) =>
      page.evaluate((i: number) => {
        const marker = pack.markers.find(m => m.i === i);
        return { note: marker?.note ?? "", icon: marker?.icon ?? "", name: marker?.name ?? "" };
      }, markerId);
    const before = await read(id);

    await page.evaluate(() => Controllers.AstralMarkers.apply());
    await page.locator(".ui-dialog:has(#alert) button", { hasText: "Convert" }).click();

    const after = await read(id);
    expect(after.note).toContain("<hr>");
    expect(after.note.startsWith("<hr>")).toBe(false);
    expect(after.note.split("<hr>")[1] ?? "").toBe(before.note); // the original text, kept whole
    expect(after.icon).not.toBe(before.icon);
    expect(after.icon).toMatch(/^glyph-/);
    if (before.name) expect(after.name).toBe(before.name); // authored names survive

    // the chart redraws with the converted icon; the record carries it, so both views show it
    await expect.poll(() => readIcon(page, id)).toBe(`#${after.icon}`);

    // idempotent: a second run leaves the converted marker alone
    await page.evaluate(() => Controllers.AstralMarkers.apply());
    await page.waitForTimeout(200);
    expect((await read(id)).note).toBe(after.note);
  });
});