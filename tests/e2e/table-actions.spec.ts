import { expect, test, type Page } from "@playwright/test";
import { waitForMap } from "./wait-for-map";

// Each row action has a column of its own, so the icons line up down the table. That makes the cells
// positional: a row that emits a different number of cells than the header shifts every column after it
const TABLES: [dialogId: string, controller: string][] = [
  ["biomesEditor", "BiomesEditor"],
  ["burgsOverview", "BurgsOverview"],
  ["culturesEditor", "CulturesEditor"],
  ["diplomacyEditor", "DiplomacyEditor"],
  ["goodsEditor", "GoodsEditor"],
  ["labelsOverview", "LabelsOverview"],
  ["marketsOverview", "MarketsOverview"],
  ["markersOverview", "MarkersOverview"],
  ["militaryOverview", "MilitaryOverview"],
  ["provincesEditor", "ProvincesEditor"],
  ["religionsEditor", "ReligionsEditor"],
  ["riversOverview", "RiversOverview"],
  ["routesOverview", "RoutesOverview"],
  ["statesEditor", "StatesEditor"],
  ["zonesEditor", "ZonesEditor"]
];

// the actions each table gives a column of its own, in row order
const ACTION_COLUMNS: Record<string, string[]> = {
  biomesEditor: ["note", "wiki", "remove"],
  burgsOverview: ["edit", "lock", "remove"],
  culturesEditor: ["note", "locate", "lock", "remove"],
  goodsEditor: ["note", "edit", "remove"],
  labelsOverview: ["visibility", "reset", "locate"],
  marketsOverview: ["note", "remove"],
  markersOverview: ["edit", "locate", "remove"],
  militaryOverview: ["regiments"],
  provincesEditor: ["note", "independence", "locate", "focus", "lock", "remove"],
  religionsEditor: ["note", "locate", "lock", "remove"],
  riversOverview: ["edit", "remove"],
  routesOverview: ["edit", "lock", "remove"],
  statesEditor: ["note", "locate", "focus", "lock", "remove"],
  zonesEditor: ["note", "reorder", "focus", "visibility", "remove"]
};

async function survey(page: import("@playwright/test").Page, dialogId: string, controller: string) {
  const actions = ACTION_COLUMNS[dialogId] ?? [];
  return page.evaluate(async ([id, name, actionKeys]) => {
    await (window as any).Controllers[name].open();
    await new Promise(resolve => setTimeout(resolve, 500));

    const dialog = document.getElementById(id);
    if (!dialog) return { id, error: "dialog did not open" };

    const header = document.getElementById(`${id}Header`);
    const headerCells = header ? header.querySelectorAll(":scope > [data-col]").length : 0;
    const rows = [...dialog.querySelectorAll<HTMLElement>(".states")];
    if (!rows.length) return { id, error: "no rows rendered" };

    const rowCellCounts = [...new Set(rows.map(row => row.querySelectorAll(":scope > [data-col]").length))];
    const clipped = rows
      .flatMap(row => [...row.querySelectorAll<HTMLElement>(":scope > [data-col]")])
      .filter(cell => (actionKeys as readonly string[]).includes(cell.dataset.col ?? ""))
      .filter(cell => cell.scrollWidth > cell.clientWidth)
      .map(cell => ({ col: cell.dataset.col, over: cell.scrollWidth - cell.clientWidth }));

    // the button rides in the last column, which every table keeps permanent and at least 1.4em wide
    const button = document.getElementById(`${id}ColumnsButton`);
    const buttonHost = button?.closest<HTMLElement>("[data-col]") ?? null;
    const headerColumns = [...(header?.querySelectorAll<HTMLElement>(":scope > [data-col]") ?? [])];
    const em = header ? Number.parseFloat(getComputedStyle(header).fontSize) : 0;
    const lastCell = headerColumns.at(-1);
    return {
      id,
      headerCells,
      rowCellCounts,
      clipped,
      buttonColumn: buttonHost?.dataset.col ?? null,
      lastColumn: lastCell?.dataset.col ?? null,
      lastColumnEm: lastCell && em ? +(lastCell.getBoundingClientRect().width / em).toFixed(2) : 0,
      // what actually matters: the whole button is inside the dialog, not cut off at its edge
      buttonVisible: Boolean(
        button && button.getBoundingClientRect().right <= dialog.getBoundingClientRect().right + 0.5
      ),
      columns: headerColumns.map(c => c.dataset.col)
    };
  }, [dialogId, controller, actions] as const);
}

test("every row lines up with its header, and no action cell is clipped", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("version", "99.0.0"));
  await page.goto("/?seed=table-actions&width=1400&height=800");
  await waitForMap(page);

  // conditional actions render on some rows only: force the widest variant each table can produce
  await page.evaluate(() => {
    const { pack } = window as any;
    const custom = structuredClone(pack.biomes[5]);
    custom.i = pack.biomes.length;
    custom.name = "Custom Biome"; // a custom biome with no cells also offers a remove icon
    pack.biomes.push(custom);
  });

  const problems: unknown[] = [];
  for (const [dialogId, controller] of TABLES) {
    const result = await survey(page, dialogId, controller);
    if ("error" in result) {
      problems.push(result);
      continue;
    }
    // one cell count across every row, and it matches the header
    if (result.rowCellCounts.length !== 1 || result.rowCellCounts[0] !== result.headerCells) problems.push(result);
    else if (result.clipped.length) problems.push({ id: result.id, clipped: result.clipped });
    // the button must sit in the last column, which has to be wide enough to show it
    else if (result.buttonColumn !== result.lastColumn) problems.push(result);
    else if ((result.lastColumnEm ?? 0) < 1.4 || !result.buttonVisible) problems.push(result);
  }

  expect(problems).toEqual([]);
});

test("each action sits in its own column", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("version", "99.0.0"));
  await page.goto("/?seed=table-actions&width=1400&height=800");
  await waitForMap(page);

  for (const [dialogId, controller] of TABLES) {
    const expected = ACTION_COLUMNS[dialogId];
    if (!expected) continue;
    const result = await survey(page, dialogId, controller);
    expect("error" in result ? result : result.columns?.slice(-expected.length), dialogId).toEqual(expected);
  }
});

// These tables route the click by class rather than by element id, so renaming the icon breaks the
// button silently unless the listener is renamed with it
const NOTE_TABLES: [dialogId: string, controller: string, noteType: string][] = [
  ["biomesEditor", "BiomesEditor", "biome"],
  ["culturesEditor", "CulturesEditor", "culture"],
  ["goodsEditor", "GoodsEditor", "good"],
  ["marketsOverview", "MarketsOverview", "market"],
  ["provincesEditor", "ProvincesEditor", "province"],
  ["religionsEditor", "ReligionsEditor", "religion"],
  ["statesEditor", "StatesEditor", "state"],
  ["zonesEditor", "ZonesEditor", "zone"]
];

test("the note icon opens the Notes Editor on the row's entity", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("version", "99.0.0"));
  await page.goto("/?seed=table-actions&width=1400&height=800");
  await waitForMap(page);

  // the Notes Editor is a lazily imported module: pay for the fetch before timing any click
  await page.evaluate(() => (window as any).Controllers.NotesEditor.open({ type: "state", id: 1 }));
  await page.waitForSelector("#notesEditor", { timeout: 30000 });

  for (const [dialogId, controller, noteType] of NOTE_TABLES) {
    const opened = await page.evaluate(async ([id, name]) => {
      const controllers = (window as any).Controllers;
      document.getElementById("notesEditor")?.remove();
      await controllers[name].open();
      await new Promise(resolve => setTimeout(resolve, 500));

      // a table may lead with a pseudo-row (No religion, Wildlands) whose action cells are empty
      const icon = document.querySelector<HTMLElement>(`#${id} .states [data-col="note"].icon-book`);
      if (!icon) return { error: "no note icon in any row" };

      // an icon class with no glyph behind it renders as an empty box
      const glyph = getComputedStyle(icon, "::before").content.replace(/"/g, "");
      icon.click();
      await new Promise(resolve => setTimeout(resolve, 700));

      return { glyph, selected: document.querySelector<HTMLSelectElement>("#notesSelect")?.value ?? null };
    }, [dialogId, controller] as const);

    expect(opened.error, dialogId).toBeUndefined();
    expect(opened.glyph, dialogId).toBeTruthy();
    expect(opened.selected, dialogId).toContain(`${noteType}:`);
  }
});

declare const pack: import("@/types/PackedGraph").PackedGraph;
declare const Controllers: { GoodsEditor: { open: () => Promise<void> } };

test.describe("Goods display filter", () => {
  let initial: { i: number; visible: boolean; matches: boolean }[];
  let errors: string[];

  async function filterGoods(page: Page) {
    await page.click("#goodsTagsFilter");
    await page.locator('#alert input[value="batch-a"]').check();
    await page.locator('#alert input[value="batch-b"]').check();
    await page.locator(".ui-dialog:has(#alert)").getByRole("button", { name: "Apply", exact: true }).click();
  }

  async function expectFilteredVisibility(page: Page, visible: boolean) {
    const expected = initial.map(good => ({ i: good.i, visible: good.matches ? visible : good.visible }));
    expect(await page.evaluate(() => pack.goods.map(({ i, visible }) => ({ i, visible })))).toEqual(expected);
    await expect(page.locator("#goodsDisplayed")).toHaveText(String(expected.filter(good => good.visible).length));
    await expect(page.locator("#goodsNumber")).toHaveText(String(initial.length));
    await expect(page.locator("#goodsDisplayAll")).toHaveJSProperty("checked", visible);
    await expect(page.locator("#goodsDisplayAll")).toHaveJSProperty("indeterminate", false);
    const rows = page.locator("#goodsBody .goodDisplayed");
    expect(
      await rows.evaluateAll(
        (inputs, value) => inputs.every(input => (input as HTMLInputElement).checked === value),
        visible
      )
    ).toBe(true);
  }

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem("version", "99.0.0"));
    await page.goto("/?seed=goods-filter&width=1600&height=1000");
    await waitForMap(page);
    initial = await page.evaluate(() => {
      pack.goods.forEach((good, index) => {
        good.tags = index === 0 ? ["batch-a"] : ["unrelated"];
        good.visible = index > 0 && index % 2 === 0;
      });
      const firstId = Math.max(...pack.goods.map(good => good.i)) + 1;
      for (let index = 0; index < 104; index++) {
        pack.goods.push({
          ...structuredClone(pack.goods[0]),
          i: firstId + index,
          name: `Filter test ${index}`,
          tags: [index % 2 ? "batch-a" : "batch-b"],
          visible: false
        });
      }
      const cell = pack.cells.i.find(i => pack.cells.h[i] >= 20)!;
      pack.cells.good[cell] = pack.goods[0].i;
      return pack.goods.map(good => ({
        i: good.i,
        visible: Boolean(good.visible),
        matches: good.tags[0] !== "unrelated"
      }));
    });
    await page.evaluate(() => Controllers.GoodsEditor.open());
    await expect(page.locator("#goodsEditor")).toBeVisible();
  });

  test.afterEach(() => expect(errors).toEqual([]));

  test("bulk show and hide affect every matching page and preserve unrelated goods", async ({ page }) => {
    await filterGoods(page);
    await page.locator("#goodsFooter .editorPageNext").click();
    await expect(page.locator("#goodsBody .goodDisplayed")).toHaveCount(5);
    await page.locator("#goodsDisplayAll").check();
    await expectFilteredVisibility(page, true);
    await expect(page.locator("#goodsFooter .editorPageInput")).toHaveValue("2");
    expect(await page.locator(`#goodsIcons [data-i="${initial[0].i}"]`).count()).toBeGreaterThan(0);

    await page.locator("#goodsDisplayAll").uncheck();
    await expectFilteredVisibility(page, false);
    await expect(page.locator(`#goodsIcons [data-i="${initial[0].i}"]`)).toHaveCount(0);
    await expect(page.locator("#goodsFooter .editorPageInput")).toHaveValue("2");
  });

  test("master checkbox follows filtered goods and individual row changes", async ({ page }) => {
    await page.evaluate(() => {
      for (const good of pack.goods) if (good.tags[0] !== "unrelated") good.visible = true;
    });
    await filterGoods(page);
    await expectFilteredVisibility(page, true);
    await page.locator("#goodsBody .goodDisplayed").first().uncheck();
    await expect(page.locator("#goodsDisplayAll")).not.toBeChecked();
    await expect(page.locator("#goodsDisplayAll")).toHaveJSProperty("indeterminate", true);
    const count = initial.filter(good => good.matches || good.visible).length - 1;
    await expect(page.locator("#goodsDisplayed")).toHaveText(String(count));
    await page.locator("#goodsDisplayAll").check();
    await expectFilteredVisibility(page, true);
  });

  test("clearing the filter restores bulk actions and counts for the whole catalogue", async ({ page }) => {
    await filterGoods(page);
    await page.click("#goodsTagsFilter");
    await page.locator(".ui-dialog:has(#alert)").getByRole("button", { name: "Clear filter", exact: true }).click();
    await page.locator("#goodsDisplayAll").check();
    expect(await page.evaluate(() => pack.goods.every(good => good.visible))).toBe(true);
    await expect(page.locator("#goodsDisplayed")).toHaveText(String(initial.length));
    await expect(page.locator("#goodsDisplayAll")).toHaveJSProperty("indeterminate", false);
    await page.locator("#goodsDisplayAll").uncheck();
    expect(await page.evaluate(() => pack.goods.every(good => !good.visible))).toBe(true);
    await expect(page.locator("#goodsDisplayed")).toHaveText("0");
    await expect(page.locator("#goodsIcons > *")).toHaveCount(0);
  });

  test("a filter with no matching goods disables the bulk checkbox", async ({ page }) => {
    await filterGoods(page);
    await page.evaluate(() => {
      for (const good of pack.goods) good.tags = ["unrelated"];
    });
    await page.click("#goodsEditorRefresh");
    await expect(page.locator("#goodsBody .goodDisplayed")).toHaveCount(0);
    await expect(page.locator("#goodsDisplayAll")).toBeDisabled();
    await expect(page.locator("#goodsDisplayAll")).not.toBeChecked();
    await expect(page.locator("#goodsDisplayAll")).toHaveJSProperty("indeterminate", false);
    expect(await page.evaluate(() => pack.goods.map(({ i, visible }) => ({ i, visible })))).toEqual(
      initial.map(({ i, visible }) => ({ i, visible }))
    );
    await expect(page.locator("#goodsDisplayed")).toHaveText(String(initial.filter(good => good.visible).length));
  });
});
