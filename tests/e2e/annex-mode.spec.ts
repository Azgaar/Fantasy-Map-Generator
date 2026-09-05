import {test, expect, type Page} from "@playwright/test";

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
    await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 60000});
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
