import {test, expect, type Page} from "@playwright/test";
import { waitForMap } from "./wait-for-map";

// Map click at a pack coordinate; callers filter out points hidden under a dialog or the options panel
async function clickMapAt(page: Page, point: [number, number]) {
  const screen = await page.evaluate(([x, y]) => {
    const viewbox = document.getElementById("viewbox") as unknown as SVGGraphicsElement;
    const p = new DOMPoint(x, y).matrixTransform(viewbox.getScreenCTM()!);
    return {x: p.x, y: p.y};
  }, point);
  await page.mouse.click(screen.x, screen.y);
}

async function isMapVisibleAt(page: Page, point: [number, number]) {
  return page.evaluate(([x, y]) => {
    const viewbox = document.getElementById("viewbox") as unknown as SVGGraphicsElement;
    const p = new DOMPoint(x, y).matrixTransform(viewbox.getScreenCTM()!);
    return Boolean(document.elementFromPoint(p.x, p.y)?.closest("#map"));
  }, point);
}

async function openEditor(page: Page, buttonId: string, dialogId: string) {
  await page.click("#optionsTrigger");
  await page.click("#toolsTab");
  await page.click(`#${buttonId}`);
  await page.waitForSelector(`#${dialogId}`, {state: "visible", timeout: 5000});
  await page.waitForTimeout(300);
}

const confirmButton = ".ui-dialog:has(#alert) .ui-dialog-buttonpane button:first-child";
const cancelButton = ".ui-dialog:has(#alert) .ui-dialog-buttonpane button:last-child";

test.describe("Annex by clicking on the map", () => {
  test.beforeEach(async ({context, page}) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto("/?seed=test-annex&width=1280&height=720");
    await waitForMap(page);
    await page.waitForTimeout(500);
  });

  async function pickTwoStates(page: Page) {
    const candidates: {i: number; pole: [number, number]}[] = await page.evaluate(() =>
      (window as any).pack.states
        .filter((s: any) => s.i && !s.removed)
        .map((s: any) => ({i: s.i, pole: (window as any).pack.cells.p[s.center]}))
    );
    const visible: {i: number; pole: [number, number]}[] = [];
    for (const c of candidates) {
      if (await isMapVisibleAt(page, c.pole)) visible.push(c);
      if (visible.length === 2) break;
    }
    expect(visible.length).toBe(2);
    return visible;
  }

  test("annexes a state into the first clicked state after confirmation", async ({page}) => {
    await openEditor(page, "editStatesButton", "statesEditor");
    const [parent, child] = await pickTwoStates(page);

    await page.click("#statesAnnex");
    await expect(page.locator("#statesAnnex")).toHaveClass(/pressed/);

    await clickMapAt(page, parent.pole);
    await clickMapAt(page, child.pole);

    await page.waitForSelector(confirmButton, {state: "visible", timeout: 3000});
    await expect(page.locator(".ui-dialog:has(#alert)")).toContainText("removed");
    const parentFill = await page.locator(`#statesBody #state${parent.i}`).getAttribute("d");
    await page.click(confirmButton);
    await page.waitForTimeout(300);

    // the states layer is redrawn: the annexing state's fill now covers the annexed cells
    expect(await page.locator(`#statesBody #state${parent.i}`).getAttribute("d")).not.toBe(parentFill);
    expect(await page.locator(`#statesBody #state${child.i}`).count()).toBe(0);
    const borders = await page.locator("#borders").innerHTML();
    await page.evaluate(() => Layers.draw("borders"));
    expect(await page.locator("#borders").innerHTML()).toBe(borders);

    const result = await page.evaluate(
      ([p, c]) => {
        const {states, cells} = (window as any).pack;
        let childCells = 0;
        for (let i = 0; i < cells.state.length; i++) if (cells.state[i] === c) childCells++;
        return {removed: Boolean(states[c].removed), parentAlive: !states[p].removed, childCells};
      },
      [parent.i, child.i]
    );
    expect(result).toEqual({removed: true, parentAlive: true, childCells: 0});
    await expect(page.locator("#statesAnnex")).not.toHaveClass(/pressed/);
    expect(await page.evaluate(() => (0, eval)("customization"))).toBe(0);
  });

  test("cancelling the confirmation leaves states untouched and clears the preview", async ({page}) => {
    await openEditor(page, "editStatesButton", "statesEditor");
    const [parent, child] = await pickTwoStates(page);

    await page.click("#statesAnnex");
    await clickMapAt(page, parent.pole);
    await clickMapAt(page, child.pole);

    await page.waitForSelector(cancelButton, {state: "visible", timeout: 3000});
    await page.click(cancelButton);
    await page.waitForTimeout(300);

    const removed = await page.evaluate(c => Boolean((window as any).pack.states[c].removed), child.i);
    expect(removed).toBe(false);
    expect(await page.locator("#debug .annex-preview").count()).toBe(0);
    await expect(page.locator("#statesAnnex")).not.toHaveClass(/pressed/);
  });

  test("shift keeps the mode open so several states can be staged", async ({page}) => {
    await openEditor(page, "editStatesButton", "statesEditor");
    const [parent, child] = await pickTwoStates(page);

    await page.click("#statesAnnex");
    await clickMapAt(page, parent.pole);
    await page.keyboard.down("Shift");
    await clickMapAt(page, child.pole);
    await page.keyboard.up("Shift");

    expect(await page.locator(".ui-dialog:has(#alert):visible").count()).toBe(0);
    await expect(page.locator("#statesAnnex")).toHaveClass(/pressed/);
    expect(await page.locator("#debug .annex-preview polygon").count()).toBeGreaterThan(0);

    // pressing the button again ends the session and asks for confirmation
    await page.click("#statesAnnex");
    await page.waitForSelector(confirmButton, {state: "visible", timeout: 3000});
    await page.click(cancelButton);
  });

  test("annexes a province into another province of the same state", async ({page}) => {
    await openEditor(page, "editProvincesButton", "provincesEditor");

    const candidates: {i: number; state: number; pole: [number, number]}[] = await page.evaluate(() =>
      (window as any).pack.provinces
        .filter((p: any) => p.i && !p.removed)
        .map((p: any) => ({i: p.i, state: p.state, pole: (window as any).pack.cells.p[p.center]}))
    );
    let pair: typeof candidates | undefined;
    for (const a of candidates) {
      if (!(await isMapVisibleAt(page, a.pole))) continue;
      for (const b of candidates) {
        if (b.i === a.i || b.state !== a.state) continue;
        if (await isMapVisibleAt(page, b.pole)) {
          pair = [a, b];
          break;
        }
      }
      if (pair) break;
    }
    expect(pair).toBeDefined();
    const [parent, child] = pair!;

    await page.click("#provincesAnnex");
    await clickMapAt(page, parent.pole);
    await clickMapAt(page, child.pole);

    await page.waitForSelector(confirmButton, {state: "visible", timeout: 3000});
    await page.click(confirmButton);
    await page.waitForTimeout(300);

    const result = await page.evaluate(
      ([p, c]) => {
        const {provinces, cells} = (window as any).pack;
        let childCells = 0;
        for (let i = 0; i < cells.province.length; i++) if (cells.province[i] === c) childCells++;
        return {removed: Boolean(provinces[c].removed), parentAlive: !provinces[p].removed, childCells};
      },
      [parent.i, child.i]
    );
    expect(result).toEqual({removed: true, parentAlive: true, childCells: 0});
    await expect(page.locator("#provincesAnnex")).not.toHaveClass(/pressed/);
  });

  test("refuses to annex a province from a different state", async ({page}) => {
    await openEditor(page, "editProvincesButton", "provincesEditor");

    const candidates: {i: number; state: number; pole: [number, number]}[] = await page.evaluate(() =>
      (window as any).pack.provinces
        .filter((p: any) => p.i && !p.removed)
        .map((p: any) => ({i: p.i, state: p.state, pole: (window as any).pack.cells.p[p.center]}))
    );
    let pair: typeof candidates | undefined;
    for (const a of candidates) {
      if (!(await isMapVisibleAt(page, a.pole))) continue;
      const b = candidates.find(x => x.state !== a.state);
      if (b && (await isMapVisibleAt(page, b.pole))) {
        pair = [a, b];
        break;
      }
    }
    expect(pair).toBeDefined();
    const [parent, foreign] = pair!;

    await page.click("#provincesAnnex");
    await clickMapAt(page, parent.pole);
    await clickMapAt(page, foreign.pole);
    await page.waitForTimeout(200);

    expect(await page.locator(".ui-dialog:has(#alert):visible").count()).toBe(0);
    await expect(page.locator("#provincesAnnex")).toHaveClass(/pressed/);
    expect(await page.locator("#debug .annex-preview .annex-child").count()).toBe(0);
    const removed = await page.evaluate(c => Boolean((window as any).pack.provinces[c].removed), foreign.i);
    expect(removed).toBe(false);
  });
});

declare const pack: import("@/types/PackedGraph").PackedGraph;

test.describe("State and province refresh", () => {
  let errors: string[];

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem("preset", "landmass"));
    await page.goto("/?seed=state-refresh&width=1600&height=1000");
    await waitForMap(page);
  });

  test.afterEach(() => expect(errors).toEqual([]));

  for (const visible of [true, false]) {
    for (const filtered of [true, false]) {
      test(`recolour updates the map and list with layer ${visible ? "on" : "off"} and ${filtered ? "one state" : "all states"}`, async ({
        page
      }) => {
        await openEditor(page, "editProvincesButton", "provincesEditor");
        const provinces = await page.evaluate(() => pack.provinces.filter(p => p.i && !p.removed));
        const state = filtered ? provinces[0].state : -1;
        await page.selectOption("#provincesFilterState", String(state));
        if (!visible) await page.evaluate(() => Layers.hide("provinces"));
        await page.click("#provincesRecolor");

        const after = await page.evaluate(() => pack.provinces.filter(p => p.i && !p.removed));
        const changed = after.filter(p => provinces.find(old => old.i === p.i)!.color !== p.color);
        expect(changed.length).toBeGreaterThan(0);
        if (filtered) {
          expect(changed.every(p => p.state === state)).toBe(true);
          expect(provinces.some(p => p.state !== state)).toBe(true);
        }
        expect(await page.evaluate(() => Layers.isOn("provinces"))).toBe(true);
        const mismatches = await page.evaluate(() => {
          const map = pack.provinces
            .filter(
              p => p.i && !p.removed && document.getElementById(`province${p.i}`)?.getAttribute("fill") !== p.color
            )
            .map(p => p.i);
          const rows = Array.from(document.querySelectorAll<HTMLElement>("#provincesBodySection [data-id]"));
          const table = rows
            .filter(
              row =>
                row.querySelector("fill-box")?.getAttribute("fill") !== pack.provinces[Number(row.dataset.id)].color
            )
            .map(row => row.dataset.id);
          return { map, table, rows: rows.length };
        });
        expect(mismatches.rows).toBeGreaterThan(0);
        expect(mismatches.map).toEqual([]);
        expect(mismatches.table).toEqual([]);
        await expect(page.locator("#provincesFilterState")).toHaveValue(String(state));
      });
    }

    test(`creating a state refreshes fills and borders with layers ${visible ? "on" : "off"}`, async ({ page }) => {
      await openEditor(page, "editStatesButton", "statesEditor");
      if (!visible) await page.evaluate(() => Layers.hide("states", "borders"));
      const candidates = await page.evaluate(() => {
        const { cells, burgs } = pack;
        return Array.from(cells.i)
          .filter(
            i =>
              cells.h[i] >= 20 &&
              cells.state[i] &&
              !burgs[cells.burg[i]]?.capital &&
              cells.c[i].every(c => cells.state[c] === cells.state[i])
          )
          .map(i => ({ i, point: cells.p[i] }));
      });
      let target: (typeof candidates)[number] | undefined;
      for (const candidate of candidates) {
        if (await isMapVisibleAt(page, candidate.point)) {
          target = candidate;
          break;
        }
      }
      expect(target).toBeDefined();
      const newState = await page.evaluate(() => pack.states.length);
      const oldBorders = await page.locator("#borders").innerHTML();
      await page.click("#statesAdd");
      await clickMapAt(page, target!.point);

      expect(await page.evaluate(i => pack.cells.state[i], target!.i)).toBe(newState);
      await expect(page.locator(`#statesBody #state${newState}`)).toHaveAttribute("d", /\S/);
      expect(await page.locator("#borders").innerHTML()).not.toBe(oldBorders);
      const rendered = await page.evaluate(() =>
        ["statesBody", "borders"].map(id => document.getElementById(id)!.innerHTML)
      );
      await page.evaluate(() => Layers.draw("states", "borders"));
      expect(
        await page.evaluate(() => ["statesBody", "borders"].map(id => document.getElementById(id)!.innerHTML))
      ).toEqual(rendered);
      expect(await page.evaluate(() => [Layers.isOn("states"), Layers.isOn("borders")])).toEqual([true, true]);
    });
  }

  test("locating a province capital works before labels have been enabled", async ({ page }) => {
    expect(await page.evaluate(() => Layers.isOn("labels"))).toBe(false);
    await expect(page.locator("#labels text")).toHaveCount(0);
    await openEditor(page, "editProvincesButton", "provincesEditor");
    await page.selectOption("#provincesFilterState", "-1");
    const capital = page.locator("#provincesBodySection .icon-star-empty:not(.placeholder)").first();
    const burg = await capital.evaluate(element => {
      const id = Number(element.closest<HTMLElement>("[data-id]")!.dataset.id);
      return pack.burgs[pack.provinces[id].burg];
    });
    await capital.click();
    await expect
      .poll(() =>
        page.evaluate(({ x, y }) => {
          const matrix = (document.getElementById("viewbox") as unknown as SVGGraphicsElement).getScreenCTM()!;
          const point = new DOMPoint(x, y).matrixTransform(matrix);
          return (
            Math.abs(matrix.a - 8) < 0.01 &&
            Math.abs(point.x - innerWidth / 2) < 1 &&
            Math.abs(point.y - innerHeight / 2) < 1
          );
        }, burg)
      )
      .toBe(true);
    expect(await page.evaluate(() => Layers.isOn("labels"))).toBe(false);
    await expect(page.locator("#labels text")).toHaveCount(0);
  });
});
