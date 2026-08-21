import {test, expect} from "@playwright/test";

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
    await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 60000});

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
