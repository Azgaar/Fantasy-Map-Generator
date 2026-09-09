import { expect, test } from "@playwright/test";
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
