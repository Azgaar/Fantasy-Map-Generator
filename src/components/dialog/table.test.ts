import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dialogState } from "./state";
import {
  buildTracks,
  type EditorColumn,
  getLastVisibleIndex,
  initEditorTable,
  invertColumnVisibility,
  loadHiddenColumns,
  renderEditorHeader,
  restoreDefaultColumnVisibility,
  saveHiddenColumns
} from "./table";

const items = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

afterEach(() => {
  delete (globalThis as Record<string, unknown>).MOBILE;
});

describe("initEditorTable", () => {
  it("slices the first page and reports counts", () => {
    const onUpdate = vi.fn();
    const table = initEditorTable({ getData: () => items(250), onUpdate, pageSize: 100 });
    table.refresh();
    const view = onUpdate.mock.calls[0][0];
    expect(view.rows).toHaveLength(100);
    expect(view.rows[0]).toBe(1);
    expect(view).toMatchObject({ page: 1, totalPages: 3, total: 250 });
    expect(view.all).toHaveLength(250);
  });

  it("goto clamps to the valid page range", () => {
    const onUpdate = vi.fn();
    const table = initEditorTable({ getData: () => items(250), onUpdate, pageSize: 100 });
    table.goto(99);
    expect(table.view().page).toBe(3);
    expect(table.view().rows).toHaveLength(50);
    table.goto(0);
    expect(table.view().page).toBe(1);
  });

  it("keeps the clamped page when the data shrinks on refresh", () => {
    let data = items(250);
    const table = initEditorTable({ getData: () => data, onUpdate: () => {}, pageSize: 100 });
    table.goto(3);
    data = items(120);
    table.refresh();
    expect(table.view().page).toBe(2);
  });

  it("reset returns to page 1", () => {
    const table = initEditorTable({ getData: () => items(250), onUpdate: () => {}, pageSize: 100 });
    table.goto(3);
    table.reset();
    expect(table.view().page).toBe(1);
  });

  it("renders a single page for small datasets", () => {
    const table = initEditorTable({ getData: () => items(5), onUpdate: () => {} });
    table.refresh();
    expect(table.view()).toMatchObject({ page: 1, totalPages: 1, total: 5 });
  });
});

describe("mobile defaults", () => {
  it("pages 250 items into 3 pages when not mobile, 13 pages of 20 when mobile", () => {
    (globalThis as Record<string, unknown>).MOBILE = false;
    const desktop = initEditorTable({ getData: () => items(250), onUpdate: () => {} });
    desktop.refresh();
    expect(desktop.view().totalPages).toBe(3);

    (globalThis as Record<string, unknown>).MOBILE = true;
    const mobile = initEditorTable({ getData: () => items(250), onUpdate: () => {} });
    mobile.refresh();
    expect(mobile.view().totalPages).toBe(13);
    expect(mobile.view().rows).toHaveLength(20);
  });
});

describe("hidden columns persistence", () => {
  const COLUMNS = [
    { key: "name", label: "Name", permanent: true },
    { key: "population", label: "Population" },
    { key: "treasury", label: "Treasury" }
  ];

  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k)
    };
    dialogState.clear();
  });

  it("round-trips the hidden set", () => {
    saveHiddenColumns("burgsOverview", new Set(["treasury"]), COLUMNS);
    expect(loadHiddenColumns("burgsOverview", COLUMNS)).toEqual(new Set(["treasury"]));
  });

  it("defaults to all visible", () => {
    expect(loadHiddenColumns("burgsOverview", COLUMNS).size).toBe(0);
  });

  it("defaults hidden columns to not visible", () => {
    const columns = [...COLUMNS, { key: "type", label: "Type", hidden: true }];
    expect(loadHiddenColumns("burgsOverview", columns)).toEqual(new Set(["type"]));
  });

  it("ignores legacy stored visibility", () => {
    localStorage.setItem("columnsHidden:statesEditor", '["population"]');
    const columns = [...COLUMNS, { key: "type", label: "Type", hidden: true }];
    expect(loadHiddenColumns("statesEditor", columns)).toEqual(new Set(["type"]));
    expect(localStorage.getItem("columnsHidden:statesEditor")).toBe('["population"]');
  });

  it("drops unknown and permanent keys on load", () => {
    saveHiddenColumns("burgsOverview", new Set(["name", "ghost", "population"]), COLUMNS);
    expect(loadHiddenColumns("burgsOverview", COLUMNS)).toEqual(new Set(["population"]));
  });

  it("ignores corrupted legacy storage", () => {
    localStorage.setItem("columnsHidden:burgsOverview", "{not json");
    expect(loadHiddenColumns("burgsOverview", COLUMNS).size).toBe(0);
  });

  const MOBILE_COLUMNS = [
    { key: "name", label: "Name", permanent: true },
    { key: "population", label: "Population", mobileHidden: true },
    { key: "treasury", label: "Treasury" }
  ];

  it("defaults to mobileHidden columns when nothing is stored and MOBILE is true", () => {
    (globalThis as Record<string, unknown>).MOBILE = true;
    expect(loadHiddenColumns("burgsOverview", MOBILE_COLUMNS)).toEqual(new Set(["population"]));
  });

  it("defaults to nothing hidden when nothing is stored and MOBILE is false", () => {
    (globalThis as Record<string, unknown>).MOBILE = false;
    expect(loadHiddenColumns("burgsOverview", MOBILE_COLUMNS).size).toBe(0);
  });

  it("honours an explicitly stored empty array over mobile defaults", () => {
    (globalThis as Record<string, unknown>).MOBILE = true;
    saveHiddenColumns("burgsOverview", new Set(), MOBILE_COLUMNS);
    expect(loadHiddenColumns("burgsOverview", MOBILE_COLUMNS).size).toBe(0);
  });

  it("honours an explicitly stored set over mobile defaults", () => {
    (globalThis as Record<string, unknown>).MOBILE = true;
    saveHiddenColumns("burgsOverview", new Set(["treasury"]), MOBILE_COLUMNS);
    expect(loadHiddenColumns("burgsOverview", MOBILE_COLUMNS)).toEqual(new Set(["treasury"]));
  });

  it("combines hidden and mobileHidden defaults on mobile", () => {
    (globalThis as Record<string, unknown>).MOBILE = true;
    const columns = [...MOBILE_COLUMNS, { key: "type", label: "Type", hidden: true }];
    expect(loadHiddenColumns("burgsOverview", columns)).toEqual(new Set(["population", "type"]));
  });

  it("remembers when a default-hidden column is explicitly shown", () => {
    const columns = [...COLUMNS, { key: "type", label: "Type", hidden: true }];
    saveHiddenColumns("statesEditor", new Set(), columns);
    expect(loadHiddenColumns("statesEditor", columns).size).toBe(0);
  });

  it("restores the default visibility after a saved override", () => {
    const columns = [...COLUMNS, { key: "type", label: "Type", hidden: true }];
    saveHiddenColumns("statesEditor", new Set(["treasury"]), columns);

    expect(restoreDefaultColumnVisibility("statesEditor", columns)).toEqual(new Set(["type"]));
    expect(loadHiddenColumns("statesEditor", columns)).toEqual(new Set(["type"]));
  });

  it("inverts configurable column visibility and persists it", () => {
    const columns = [...COLUMNS, { key: "type", label: "Type", hidden: true }];
    saveHiddenColumns("statesEditor", new Set(["treasury"]), columns);

    expect(invertColumnVisibility("statesEditor", columns)).toEqual(new Set(["population", "type"]));
    expect(loadHiddenColumns("statesEditor", columns)).toEqual(new Set(["population", "type"]));
  });
});

const COLUMNS = [
  { key: "locate", width: "1.4em", permanent: true },
  {
    key: "name",
    label: "Route",
    width: "8em",
    sortBy: (r: { name: string }) => r.name,
    sortType: "alpha" as const
  },
  { key: "group", label: "Group", width: "8em", sortBy: (r: { group: string }) => r.group, sortType: "alpha" as const },
  {
    key: "length",
    label: "Length",
    width: "6em",
    sortBy: (r: { length: number }) => r.length,
    defaultSort: "desc" as const
  },
  { key: "actions", width: "4em", permanent: true }
];

describe("buildTracks", () => {
  it("emits one track per visible column, in order", () => {
    expect(buildTracks(COLUMNS, new Set())).toBe("1.4em 8em 8em 6em 4em");
  });

  it("drops the tracks of hidden columns", () => {
    expect(buildTracks(COLUMNS, new Set(["group", "length"]))).toBe("1.4em 8em 4em");
  });

  it("falls back to auto for a column with no declared width", () => {
    expect(buildTracks([{ key: "x" }], new Set())).toBe("auto");
  });
});

describe("getLastVisibleIndex", () => {
  it("returns the index of the last column that is not hidden", () => {
    expect(getLastVisibleIndex(COLUMNS, new Set(["length", "actions"]))).toBe(2);
  });

  it("returns -1 when every column is hidden", () => {
    expect(getLastVisibleIndex(COLUMNS, new Set(COLUMNS.map(column => column.key)))).toBe(-1);
  });
});

describe("renderEditorHeader", () => {
  const html = renderEditorHeader({ dialogId: "routesOverview", columns: COLUMNS });

  it("wraps the cells in a header div with the given id", () => {
    expect(html.startsWith('<div id="routesOverviewHeader" class="header">')).toBe(true);
    expect(html.endsWith("</div>")).toBe(true);
  });

  it("gives every column a cell tagged with its key", () => {
    for (const key of ["locate", "name", "group", "length", "actions"]) {
      expect(html.includes(`data-col="${key}"`)).toBe(true);
    }
  });

  it("marks sortable columns and their sort type", () => {
    expect(html.includes('data-col="name" class="sortable alphabetically" data-sortby="name"')).toBe(true);
  });

  it("uses the column label as the default sorting tip", () => {
    expect(
      html.includes(
        'data-col="name" class="sortable alphabetically" data-sortby="name" data-tip="Click to sort by Route"'
      )
    ).toBe(true);
  });

  it("preserves an explicitly configured sorting tip", () => {
    const custom = renderEditorHeader({
      dialogId: "example",
      columns: [{ key: "value", label: "Value", sortBy: () => 0, tip: "Custom sorting help" }]
    });
    expect(custom.includes('data-tip="Custom sorting help"')).toBe(true);
    expect(custom.includes("Click to sort by Value")).toBe(false);
  });

  it("leaves structural columns unsortable", () => {
    const locateCell = html.slice(html.indexOf('data-col="locate"'), html.indexOf('data-col="name"'));
    expect(locateCell.includes("sortable")).toBe(false);
    expect(locateCell.includes("data-sortby")).toBe(false);
  });

  it("applies the initial sort icon to the default-sorted column", () => {
    expect(html.includes('data-col="length" class="sortable icon-sort-number-down" data-sortby="length"')).toBe(true);
  });

  it("puts the columns button in the last cell", () => {
    const actionsCell = html.slice(html.indexOf('data-col="actions"'));
    expect(actionsCell.includes('id="routesOverviewColumnsButton"')).toBe(true);
  });

  it("anchors the button to the last initially visible column", () => {
    const columns: EditorColumn[] = [
      { key: "locate", permanent: true },
      { key: "name", label: "Name", permanent: true },
      { key: "extra", label: "Extra", hidden: true }
    ];
    const anchored = renderEditorHeader({ dialogId: "example", columns });
    const nameCell = anchored.slice(anchored.indexOf('data-col="name"'), anchored.indexOf('data-col="extra"'));
    expect(nameCell.includes('id="exampleColumnsButton"')).toBe(true);
    expect(anchored.slice(anchored.indexOf('data-col="extra"')).includes('id="exampleColumnsButton"')).toBe(false);
  });
});
