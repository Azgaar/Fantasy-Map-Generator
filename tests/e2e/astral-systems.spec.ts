import { expect, test, type Page } from "@playwright/test";
import { waitForMap } from "./wait-for-map";

// The star markers are a second visual representation of a burg: the tooltip reads them as systems,
// a click opens the System Editor, search reveals them on the systems layer, and zoom culls them to
// the viewport. This spec is the hit-testing parity guard the plan calls for, and the editor
// coverage: its edits are burg writes that redraw the chart.

declare const styles: {
  texture: { options: { href: string } };
  systems: { options: { glow: boolean }; groups: Record<string, { attrs: { fill: string } }> };
};
declare const Layers: { isOn(id: string): boolean; hide(...ids: string[]): void };
declare const pack: import("@/types/PackedGraph").PackedGraph;
declare const Controllers: {
  AstralMode: { enter: () => Promise<void> };
  AstralSystemEditor: { open: (id: number) => void };
  Omnibar: { open: () => void };
};

/** Enter through the controller and wait until the markers are reconciled into the dom */
async function withSystems(page: Page): Promise<void> {
  await page.evaluate(() => Controllers.AstralMode.enter());
  await expect.poll(() => page.evaluate(() => styles.texture.options.href)).toContain("starfield");
  await expect(page.locator("#systems [data-id]").first()).toBeAttached();
}

async function centerOf(page: Page, selector: string): Promise<{ x: number; y: number }> {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`${selector} has no box`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** A marker whose centre actually resolves to its star (labels can overlap a marker and shadow it) */
async function starPoint(page: Page): Promise<{ x: number; y: number }> {
  const clean = await page.evaluate(() => {
    const markers = Array.from(document.querySelectorAll<SVGGElement>("#systems [data-id]"));
    for (const marker of markers) {
      const box = marker.getBoundingClientRect();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      if (document.elementFromPoint(x, y)?.closest("#systems [data-id]") === marker) return { x, y };
    }
    return null;
  });
  if (!clean) throw new Error("no marker is unobscured by a label");
  return clean;
}

// FMG's version-update changelog opens a dialog over the map centre and eats the wheel: dismiss it
async function dismissChangelog(page: Page): Promise<void> {
  if (await page.locator("#alert").isVisible().catch(() => false))
    await page.evaluate(() => window.closeDialogs?.());
}

const viewScale = (page: Page) =>
  page.evaluate(() => {
    const viewbox = document.getElementById("viewbox") as unknown as SVGGraphicsElement;
    return viewbox.transform.baseVal.consolidate()?.matrix.a ?? 1;
  });

test.describe("Astral systems", () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto("/?seed=astral-systems&width=1280&height=720");
    await waitForMap(page);
    await page.waitForTimeout(300);
  });

  test("the tooltip reads a marker as a system", async ({ page }) => {
    await withSystems(page);
    await page.evaluate(() => Layers.hide("labels")); // state labels can shadow a marker's centre
    const point = await starPoint(page);
    await page.mouse.move(point.x, point.y);
    await page.mouse.move(point.x + 1, point.y); // the handler is debounced: nudge it awake

    const tooltip = page.locator("#tooltip");
    await expect(tooltip).toContainText("-class", { timeout: 5000 });
    await expect(tooltip).toContainText("Click to edit");
  });

  test("clicking a marker opens the System Editor", async ({ page }) => {
    await withSystems(page);
    const point = await centerOf(page, "#system1");
    await page.mouse.click(point.x, point.y);

    await expect(page.locator("#astralSystemEditor")).toBeVisible();
    await page.locator(".ui-dialog:has(#astralSystemEditor) .ui-dialog-titlebar-close").click();
  });

  test("clicking a system's label in astral opens the System Editor", async ({ page }) => {
    await withSystems(page);
    await page.locator("#labels text[data-label-type='burg'][data-id='1']").first().click();
    await expect(page.locator("#astralSystemEditor")).toBeVisible();
  });

  test("renaming a system updates its label", async ({ page }) => {
    await withSystems(page);
    await page.evaluate(() => Controllers.AstralSystemEditor.open(1));

    await page.fill("#systemName", "Kessel");
    await expect(page.locator("#labels text[data-label-type='burg'][data-id='1']").first()).toContainText("Kessel");
  });

  test("a population change rolls a star onto the readout, preview and chart", async ({ page }) => {
    await withSystems(page);
    await page.evaluate(() => Controllers.AstralSystemEditor.open(1));

    await page.fill("#systemPopulation", "500");
    await page.dispatchEvent("#systemPopulation", "change");

    // the class is a roll now: whatever came up, every reading of the burg must agree on it
    const cls = await page.evaluate(() =>
      (document.getElementById("systemClass")!.textContent ?? "").split("-class")[0].trim()
    );
    expect(cls).toMatch(/^[BAFGKM]$/);

    const fill = await page.evaluate(letter => styles.systems.groups[letter].attrs.fill, cls);
    await expect(page.locator("#systemStarShape")).toHaveAttribute("fill", fill);
    await expect(page.locator(`#systems [data-group='${cls}'] #system1`)).toBeAttached();

    // the readout follows the class: the primary is the chart's star now
    await expect(page.locator("#systemStarsBody tr").first()).toContainText(`${cls} V`);
  });

  test("opening a system shows the generated star and planet readout", async ({ page }) => {
    await withSystems(page);
    await page.evaluate(() => Controllers.AstralSystemEditor.open(1));

    await expect(page.locator("#systemStarsBody tr").first()).toContainText("Primary");
    await expect(page.locator("#systemReadoutTotals")).toContainText("Total mass");
    await expect(page.locator("#systemReadoutTotals")).toContainText("Snow line");

    const counts = await page.evaluate(() => ({
      totals: document.getElementById("systemReadoutTotals")!.textContent ?? "",
      planets: document.getElementById("systemPlanetsBody")!.querySelectorAll("tr").length
    }));
    expect(counts.totals).toMatch(new RegExp(`\\b${counts.planets} planets?\\b`));
    for (const row of await page.locator("#systemPlanetsBody tr").all())
      await expect(row.locator("td")).toHaveCount(10);
  });

  test("the class line and the star table agree", async ({ page }) => {
    await withSystems(page);
    await page.evaluate(() => Controllers.AstralSystemEditor.open(1));

    const classLine = (await page.locator("#systemClass").textContent()) ?? "";
    const spectral = classLine.split("-class")[0].trim();
    const primaryRow = page.locator("#systemStarsBody tr").first();
    await expect(primaryRow).toContainText("Primary");
    await expect(primaryRow).toContainText(spectral);
    await expect(primaryRow).toContainText(" V");
  });

  test("closing and reopening leaves the readout byte-identical", async ({ page }) => {
    await withSystems(page);
    const readout = () =>
      page.evaluate(() => ({
        stars: document.getElementById("systemStarsBody")!.innerHTML,
        totals: document.getElementById("systemReadoutTotals")!.innerHTML,
        planets: document.getElementById("systemPlanetsBody")!.innerHTML
      }));

    await page.evaluate(() => Controllers.AstralSystemEditor.open(1));
    const first = await readout();

    await page.locator(".ui-dialog:has(#astralSystemEditor) .ui-dialog-titlebar-close").click();
    await expect(page.locator("#astralSystemEditor")).toHaveCount(0);
    await page.evaluate(() => Controllers.AstralSystemEditor.open(1));

    expect(await readout()).toEqual(first);
  });

  test("opening the editor adds no keys to the burg record", async ({ page }) => {
    await withSystems(page);
    const keys = await page.evaluate(() => Object.keys(pack.burgs[1]).join(","));

    await page.evaluate(() => Controllers.AstralSystemEditor.open(1));
    await expect(page.locator("#systemPlanetsBody tr").first()).toBeAttached();
    await page.locator(".ui-dialog:has(#astralSystemEditor) .ui-dialog-titlebar-close").click();
    await expect(page.locator("#astralSystemEditor")).toHaveCount(0);

    expect(await page.evaluate(() => Object.keys(pack.burgs[1]).join(","))).toBe(keys);
  });

  test("a capital toggle draws its ring in the preview and on the chart", async ({ page }) => {
    await withSystems(page);
    const id = await page.evaluate(() => {
      const burg = pack.burgs.find(
        b => b.i && !b.removed && !b.capital && b.state && pack.states[b.state] && !pack.states[b.state].removed
      );
      Controllers.AstralSystemEditor.open(burg.i);
      return burg.i;
    });

    await page.click("#systemCapital");

    await expect(page.locator("#systemStarShape circle.capital")).toBeAttached();
    await expect(page.locator(`#systems #system${id} circle.capital`)).toBeAttached();
  });

  test("removing a system closes the dialog and clears the marker", async ({ page }) => {
    await withSystems(page);
    const id = await page.evaluate(() => {
      const burg = pack.burgs.find(
        b => b.i && !b.removed && !b.capital && !pack.markets?.some(m => m.centerBurgId === b.i)
      );
      Controllers.AstralSystemEditor.open(burg.i);
      return burg.i;
    });

    await page.click("#systemRemove");
    await page.locator(".ui-dialog:has(#alert) button", { hasText: "Remove" }).click();

    await expect(page.locator("#astralSystemEditor")).toHaveCount(0);
    await expect(page.locator(`#systems #system${id}`)).toHaveCount(0);
  });

  test("search reveals the burg on the systems layer and outlines the marker", async ({ page }) => {
    await withSystems(page);
    await page.evaluate(() => Layers.hide("systems"));
    const name = await page.evaluate(() => pack.burgs[1].name);

    await page.keyboard.press("Space"); // the plain-Space omnibar hotkey
    if (!(await page.locator("#omnibar-input").count()))
      await page.evaluate(() => Controllers.Omnibar.open()); // focus guards may eat the hotkey
    await expect(page.locator("#omnibar-input")).toBeFocused();
    await page.fill("#omnibar-input", name);
    await expect(page.locator("#omnibar-list [role='option']").first()).toBeVisible();
    await page.keyboard.press("Enter");

    // the mode-aware reveal shows the systems layer, not burgIcons
    await expect.poll(() => page.evaluate(() => Layers.isOn("systems"))).toBe(true);
    await expect.poll(() => viewScale(page)).toBeGreaterThan(1);
    await expect(page.locator("#debug .highlighted")).toHaveCount(1, { timeout: 5000 });
  });

  test("zoom culls markers to the viewport", async ({ page }) => {
    await withSystems(page);
    await dismissChangelog(page); // the version popup covers the map centre and eats the wheel
    const full = await page.locator("#systems [data-id]").count();
    expect(full).toBeGreaterThan(0);

    await page.mouse.move(640, 360);
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -240);
    await page.waitForTimeout(800);

    // the gesture really zoomed before we judge the culling by its result
    const scale = await viewScale(page);
    expect(scale).toBeGreaterThan(1);
    const zoomed = await page.locator("#systems [data-id]").count();
    expect(zoomed).toBeLessThan(full);
    // what stays on screen is still a working marker
    await expect(page.locator("#systems [data-id] circle.star").first()).toBeAttached();
  });
});
