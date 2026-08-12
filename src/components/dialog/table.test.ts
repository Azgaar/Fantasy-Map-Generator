import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildTracks,
  type EditorColumn,
  initEditorTable,
  loadHiddenColumns,
  renderEditorHeader,
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
    { key: "name", label: "Name", hideable: false },
    { key: "population", label: "Population" },
    { key: "treasury", label: "Treasury" }
  ];

  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v)
    };
  });

  it("round-trips the hidden set", () => {
    saveHiddenColumns("burgs", new Set(["treasury"]));
    expect(loadHiddenColumns("burgs", COLUMNS)).toEqual(new Set(["treasury"]));
  });

  it("defaults to all visible", () => {
    expect(loadHiddenColumns("burgs", COLUMNS).size).toBe(0);
  });

  it("drops unknown and non-hideable keys on load", () => {
    saveHiddenColumns("burgs", new Set(["name", "ghost", "population"]));
    expect(loadHiddenColumns("burgs", COLUMNS)).toEqual(new Set(["population"]));
  });

  it("survives corrupted storage", () => {
    localStorage.setItem("columnsHidden:burgs", "{not json");
    expect(loadHiddenColumns("burgs", COLUMNS).size).toBe(0);
  });

  const MOBILE_COLUMNS = [
    { key: "name", label: "Name", hideable: false },
    { key: "population", label: "Population", mobileHidden: true },
    { key: "treasury", label: "Treasury" }
  ];

  it("defaults to mobileHidden columns when nothing is stored and MOBILE is true", () => {
    (globalThis as Record<string, unknown>).MOBILE = true;
    expect(loadHiddenColumns("burgs", MOBILE_COLUMNS)).toEqual(new Set(["population"]));
  });

  it("defaults to nothing hidden when nothing is stored and MOBILE is false", () => {
    (globalThis as Record<string, unknown>).MOBILE = false;
    expect(loadHiddenColumns("burgs", MOBILE_COLUMNS).size).toBe(0);
  });

  it("honours an explicitly stored empty array over mobile defaults", () => {
    (globalThis as Record<string, unknown>).MOBILE = true;
    saveHiddenColumns("burgs", new Set());
    expect(loadHiddenColumns("burgs", MOBILE_COLUMNS).size).toBe(0);
  });

  it("honours an explicitly stored set over mobile defaults", () => {
    (globalThis as Record<string, unknown>).MOBILE = true;
    saveHiddenColumns("burgs", new Set(["treasury"]));
    expect(loadHiddenColumns("burgs", MOBILE_COLUMNS)).toEqual(new Set(["treasury"]));
  });
});

const COLUMNS = [
  { key: "locate", width: "1.4em", hideable: false },
  {
    key: "name",
    label: "Route",
    width: "8em",
    fill: true,
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
  { key: "actions", width: "4em", hideable: false }
];

describe("buildTracks", () => {
  it("emits one track per visible column, in order", () => {
    expect(buildTracks(COLUMNS, new Set())).toBe("1.4em minmax(8em, 1fr) 8em 6em 4em");
  });

  it("drops the tracks of hidden columns", () => {
    expect(buildTracks(COLUMNS, new Set(["group", "length"]))).toBe("1.4em minmax(8em, 1fr) 4em");
  });

  it("falls back to auto for a column with no declared width", () => {
    expect(buildTracks([{ key: "x" }], new Set())).toBe("auto");
  });
});

describe("renderEditorHeader", () => {
  const html = renderEditorHeader({ id: "routesHeader", columns: COLUMNS, columnsButtonId: "routesToggleColumns" });

  it("wraps the cells in a header div with the given id", () => {
    expect(html.startsWith('<div id="routesHeader" class="header">')).toBe(true);
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
    expect(actionsCell.includes('id="routesToggleColumns"')).toBe(true);
  });

  it("anchors the button to the last non-hideable column, even if it isn't last overall", () => {
    const columns: EditorColumn[] = [
      { key: "locate", hideable: false },
      { key: "name", label: "Name", hideable: false },
      { key: "extra", label: "Extra" }
    ];
    const anchored = renderEditorHeader({ id: "h", columns, columnsButtonId: "toggle" });
    const nameCell = anchored.slice(anchored.indexOf('data-col="name"'), anchored.indexOf('data-col="extra"'));
    expect(nameCell.includes('id="toggle"')).toBe(true);
    expect(anchored.slice(anchored.indexOf('data-col="extra"')).includes('id="toggle"')).toBe(false);
  });
});
