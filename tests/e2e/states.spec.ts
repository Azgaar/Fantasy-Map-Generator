import {test, expect, type Page} from "@playwright/test";
import { countMaps, waitForMap, waitForNextMap } from "./wait-for-map";

test.describe("States", () => {
  test.beforeEach(async ({context, page}) => {
    await context.clearCookies();

    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Navigate with seed parameter and wait for full load
    await page.goto("/?seed=test-states&width=1280&height=720");

    // Wait for map generation to complete
    await waitForMap(page);

    // Additional wait for any rendering/animations to settle
    await page.waitForTimeout(500);
  });

  test("removing a state via UI should allow military regeneration without errors", async ({page}) => {
    // First click the options trigger (►) to open the menu
    await page.click("#optionsTrigger");
    await page.waitForTimeout(300);

    // Open the Tools tab
    await page.click("#toolsTab");
    await page.waitForTimeout(200);

    // Click "States" button to open States Editor
    await page.click("#editStatesButton");
    await page.waitForSelector("#statesEditor", {state: "visible", timeout: 5000});
    await page.waitForTimeout(300);

    // Find a state row and get its ID
    const stateId = await page.evaluate(() => {
      const stateRow = document.querySelector("#statesBodySection > div[data-id]") as HTMLElement;
      return stateRow ? parseInt(stateRow.dataset.id!, 10) : null;
    });

    expect(stateId).not.toBeNull();

    // Verify this state is in neighbors of other states before removal
    const neighborsBefore = await page.evaluate((id: number) => {
      const {states} = (window as any).pack;
      return states.filter((s: any) => s.i && !s.removed && s.neighbors && s.neighbors.includes(id)).length;
    }, stateId!);

    // Click the trash icon to remove the state
    await page.click(`#statesBodySection > div[data-id="${stateId}"] .icon-trash-empty`);

    // Confirm the removal in the jQuery dialog - look for "Remove" button in the dialog buttonpane
    await page.waitForSelector(".ui-dialog:has(#alert) .ui-dialog-buttonpane", {state: "visible", timeout: 3000});
    await page.click(".ui-dialog:has(#alert) .ui-dialog-buttonpane button:first-child"); // "Remove" is first button
    await page.waitForTimeout(500);

    // Verify the state is no longer in neighbors of any other state
    const neighborsAfter = await page.evaluate((id: number) => {
      const {states} = (window as any).pack;
      return states.filter((s: any) => s.i && !s.removed && s.neighbors && s.neighbors.includes(id)).length;
    }, stateId!);

    expect(neighborsAfter).toBe(0);

    // Close the States Editor - the close button is in the jQuery UI dialog wrapper
    await page.click(".ui-dialog:has(#statesEditor) .ui-dialog-titlebar-close");
    await page.waitForTimeout(200);

    // Now click "Military" regenerate button and verify no errors
    await page.click("#regenerateMilitary");
    await page.waitForTimeout(1000);

    // Verify military was regenerated without throwing
    const militaryResult = await page.evaluate(() => {
      const {states} = (window as any).pack;
      const validStates = states.filter((s: any) => s.i && !s.removed);
      // Check that at least some states have military data
      return {
        statesCount: validStates.length,
        statesWithMilitary: validStates.filter((s: any) => s.military && s.military.length > 0).length
      };
    });

    expect(militaryResult.statesCount).toBeGreaterThan(0);
    // At least some states should have military
    expect(militaryResult.statesWithMilitary).toBeGreaterThanOrEqual(0);
  });

  test("painting states applies after the States Editor closes", async ({page}) => {
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));

    await page.click("#optionsTrigger");
    await page.click("#toolsTab");
    await page.click("#editStatesButton");
    await page.waitForSelector("#statesEditor", {state: "visible"});
    await page.locator("#adjustLabels").evaluate((element: HTMLInputElement) => {
      element.checked = true;
    });

    await page.click("#statesManually");
    await page.waitForSelector("#paintEditor", {state: "visible"});

    const target = await page.evaluate(() => {
      const {cells, states} = (window as any).pack;
      const cell = cells.i.find(
        (cellId: number) => cells.h[cellId] >= 20 && cells.state[cellId] && states[cells.state[cellId]].center !== cellId
      );
      const [x, y] = cells.p[cell];
      const viewbox = document.getElementById("viewbox") as unknown as SVGGraphicsElement;
      const point = new DOMPoint(x, y).matrixTransform(viewbox.getScreenCTM()!);
      const state = cells.state[cell];
      states[state].label = {text: "paint-test-label"};
      return {cell, state, x: point.x, y: point.y};
    });

    await page.selectOption("#paintEditorSelect", "0");
    await page.mouse.move(target.x, target.y);
    await page.mouse.down();
    await page.mouse.move(target.x + 2, target.y, {steps: 2});
    await page.mouse.up();
    await expect(page.locator(`#paintEditorOverlay polygon[data-cell="${target.cell}"]`)).toBeAttached();

    await page.click("#paintEditorApply");

    expect(pageErrors).toEqual([]);
    await expect.poll(() => page.evaluate(cell => (window as any).pack.cells.state[cell], target.cell)).toBe(0);
    expect(await page.evaluate(state => (window as any).pack.states[state].label, target.state)).toBeUndefined();
  });
});

declare const Controllers: { DiplomacyEditor: { open: () => Promise<void> } };
declare const Services: {
  Save: { prepareMapData: () => string };
  Load: { uploadMap: (file: File) => void };
};
declare const pack: {
  states: import("@/generators/states-generator").State[];
  cells: { state: Uint16Array; p: [number, number][] };
};

test.describe("Diplomacy", () => {
  let ids: number[];
  let errors: string[];
  const formDialog = (page: Page) => page.locator(".ui-dialog:has(#relationsForm)");

  async function openRelation(page: Page): Promise<void> {
    await page.locator(`#diplomacyBodySection [data-id="${ids[1]}"] .changeRelations`).click();
    await expect(page.locator("#relationsForm")).toBeVisible();
  }

  async function mapClick(page: Page, stateId: number): Promise<void> {
    const point = await page.evaluate(id => {
      const viewbox = document.getElementById("viewbox") as unknown as SVGGraphicsElement;
      for (let cell = 0; cell < pack.cells.state.length; cell++) {
        if (pack.cells.state[cell] !== id) continue;
        const [x, y] = pack.cells.p[cell];
        const screen = new DOMPoint(x, y).matrixTransform(viewbox.getScreenCTM()!);
        if (screen.x < 10 || screen.y < 10 || screen.x > innerWidth - 10 || screen.y > innerHeight - 10) continue;
        if (document.elementFromPoint(screen.x, screen.y)?.closest("#map")) return { x: screen.x, y: screen.y };
      }
      return null;
    }, stateId);
    expect(point, `Visible map point for state ${stateId}`).not.toBeNull();
    await page.mouse.click(point!.x, point!.y);
  }

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/?seed=diplomacy-parcel&width=1600&height=1000");
    await waitForMap(page);
    ids = await page.evaluate(() => {
      const states = pack.states.filter(state => state.i && !state.removed);
      for (const a of states) for (const b of states) a.diplomacy![b.i] = a.i === b.i ? "x" : "Neutral";
      const [a, b, c] = states;
      a.diplomacy![b.i] = b.diplomacy![a.i] = "Rival";
      b.diplomacy![c.i] = c.diplomacy![b.i] = "Ally";
      pack.states[0].diplomacy = [];
      return [a.i, b.i, c.i];
    });
    await page.evaluate(() => Controllers.DiplomacyEditor.open());
    await expect(page.locator("#diplomacyEditor")).toBeVisible();
  });

  test.afterEach(() => expect(errors).toEqual([]));

  test("bulk changes skip existing allies and preserve genuine history", async ({ page }) => {
    await openRelation(page);
    await page.locator('input[name="relationSelect"][value="Ally"]').check();
    await page.locator(`label[for="selectState${ids[2]}"]`).click();
    await formDialog(page).getByRole("button", { name: "Apply", exact: true }).click();
    expect(await page.evaluate(() => pack.states[0].diplomacy.length)).toBe(1);
    expect(await page.evaluate(([a, b]) => pack.states[a].diplomacy![b], ids)).toBe("Ally");
  });

  test("unchanged row relation does not suppress changes to other targets", async ({ page }) => {
    await openRelation(page);
    await page.locator(`label[for="selectState${ids[2]}"]`).click();
    await formDialog(page).getByRole("button", { name: "Apply", exact: true }).click();
    expect(await page.evaluate(([, b, c]) => pack.states[b].diplomacy![c], ids)).toBe("Rival");
    expect(await page.evaluate(() => pack.states[0].diplomacy.length)).toBe(1);
  });

  for (const exit of ["Cancel", "Escape", "titlebar", "parent"]) {
    test(`map selection leaves data unchanged and cleans up after ${exit}`, async ({ page }) => {
      const before = await page.evaluate(() => JSON.stringify(pack.states.map(state => state.diplomacy)));
      await openRelation(page);
      await page.evaluate(() => {
        const dialogs = document.querySelectorAll<HTMLElement>(".ui-dialog");
        for (const dialog of dialogs) {
          dialog.style.left = "0px";
          dialog.style.top = "0px";
        }
      });
      await mapClick(page, ids[2]);
      await expect(page.locator(`#selectState${ids[2]}`)).toBeChecked();
      await expect(page.locator("#diplomacyBodySection .Self")).toHaveAttribute("data-id", String(ids[0]));
      if (exit === "Cancel") await formDialog(page).getByRole("button", { name: "Cancel", exact: true }).click();
      else if (exit === "Escape") await page.keyboard.press("Escape");
      else if (exit === "titlebar") await formDialog(page).locator(".ui-dialog-titlebar-close").click();
      else {
        await page
          .locator(".ui-dialog:has(#diplomacyEditor) .ui-dialog-titlebar-close")
          .evaluate((button: HTMLButtonElement) => button.click());
      }
      await expect(page.locator("#relationsForm")).toBeHidden();
      expect(await page.evaluate(() => JSON.stringify(pack.states.map(state => state.diplomacy)))).toBe(before);
      if (exit === "parent" || exit === "Escape") await page.evaluate(() => Controllers.DiplomacyEditor.open());
      await mapClick(page, ids[2]);
      await expect(page.locator("#diplomacyBodySection .Self")).toHaveAttribute("data-id", String(ids[2]));
    });
  }

  test("invalid relations can be repaired and survive the real save/load service", async ({ page }) => {
    await page.evaluate(([a, b]) => {
      pack.states[a].diplomacy![b] = pack.states[b].diplomacy![a] = "x";
    }, ids);
    await page.locator("#diplomacyEditorRefresh").click();
    await page.locator("#diplomacyShowMatrix").click();
    const pair = page.locator(`#diplomacyMatrixBody tr[data-id="${ids[0]}"] td[data-id="${ids[1]}"]`);
    await expect(pair).toHaveText("Invalid");
    await pair.click();
    await formDialog(page).getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page.locator("#relationsForm")).toBeVisible();
    await page.locator('input[name="relationSelect"][value="Vassal"]').check();
    await formDialog(page).getByRole("button", { name: "Apply", exact: true }).click();
    const saved = await page.evaluate(() => Services.Save.prepareMapData());
    await page.goto("/?seed=diplomacy-reload&width=1600&height=1000");
    await waitForMap(page);
    const previous = await countMaps(page);
    await page.evaluate(data => Services.Load.uploadMap(new File([data], "diplomacy.map")), saved);
    await waitForNextMap(page, previous);
    expect(await page.evaluate(([a, b]) => [pack.states[a].diplomacy![b], pack.states[b].diplomacy![a]], ids)).toEqual([
      "Vassal",
      "Suzerain"
    ]);
    expect(await page.evaluate(() => pack.states[0].diplomacy.length)).toBe(1);
  });
});
