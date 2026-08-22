import { beforeEach, describe, expect, it, vi } from "vitest";

const loadState = async () => {
  vi.resetModules();
  return (await import("./state")).dialogState;
};

beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    removeItem: (key: string) => void store.delete(key),
    setItem: (key: string, value: string) => void store.set(key, value)
  };
});

describe("dialog state", () => {
  it("creates filters once per dialog", async () => {
    const state = await loadState();
    const filters = state.getFilters("burgsOverview", () => ({ search: "", stateId: -1 }));
    filters.search = "port";
    state.setFilters("burgsOverview", filters);

    expect(state.getFilters("burgsOverview", () => ({ search: "new default", stateId: 1 }))).toEqual(filters);
    expect(state.getFilters("statesEditor", () => ({ search: "" }))).toEqual({ search: "" });
  });

  it("persists filter mutations and sorting", async () => {
    const state = await loadState();
    const filters = state.getFilters("burgsOverview", () => ({ search: "", stateId: -1 }));
    filters.search = "port";
    state.setFilters("burgsOverview", filters);
    state.setSorting("burgsOverview", { sortBy: "name", alphabetically: true, direction: 1 });

    expect(JSON.parse(localStorage.getItem("fmgDialogState")!)).toEqual({
      burgsOverview: {
        filters: { search: "port", stateId: -1 },
        sorting: { sortBy: "name", alphabetically: true, direction: 1 }
      }
    });
  });

  it("restores state in a new session", async () => {
    localStorage.setItem(
      "fmgDialogState",
      JSON.stringify({
        goodsEditor: {
          filters: { visibleTags: ["food", "raw"] },
          sorting: { sortBy: "name", alphabetically: true, direction: -1 }
        }
      })
    );

    const state = await loadState();
    const filters = state.getFilters("goodsEditor", () => ({ visibleTags: [] as string[] }));

    expect(filters.visibleTags).toEqual(["food", "raw"]);
    expect(state.getSorting("goodsEditor")).toEqual({ sortBy: "name", alphabetically: true, direction: -1 });
  });

  it("persists array filters as plain JSON", async () => {
    const state = await loadState();
    const filters = state.getFilters("goodsEditor", () => ({ visibleTags: [] as string[] }));
    filters.visibleTags = ["food"];
    state.setFilters("goodsEditor", filters);

    expect(JSON.parse(localStorage.getItem("fmgDialogState")!).goodsEditor.filters.visibleTags).toEqual(["food"]);
  });

  it("falls back per field when stored values are malformed", async () => {
    localStorage.setItem(
      "fmgDialogState",
      JSON.stringify({
        burgsOverview: {
          filters: { search: 42, stateId: "missing", obsolete: true },
          sorting: { sortBy: [], alphabetically: "yes", direction: 0 }
        }
      })
    );

    const state = await loadState();

    expect(state.getFilters("burgsOverview", () => ({ search: "", stateId: -1 }))).toEqual({
      search: "",
      stateId: -1
    });
    expect(state.getSorting("burgsOverview")).toBeUndefined();
  });

  it("creates default sorting once per dialog", async () => {
    const state = await loadState();
    const initial = state.getSorting("statesEditor", () => ({ sortBy: "name", alphabetically: true, direction: 1 }));
    const stored = state.getSorting("statesEditor", () => ({ sortBy: "area", alphabetically: false, direction: -1 }));

    expect(stored).toBe(initial);
    expect(stored?.sortBy).toBe("name");
  });

  it("is cleared only through explicit application-data cleanup", async () => {
    const state = await loadState();
    const filters = state.getFilters("burgsOverview", () => ({ search: "" }));
    filters.search = "port";
    state.setFilters("burgsOverview", filters);
    state.setSorting("burgsOverview", { sortBy: "name", alphabetically: true, direction: 1 });

    state.clear();

    expect(localStorage.getItem("fmgDialogState")).toBeNull();
    expect(state.getFilters("burgsOverview", () => ({ search: "" }))).toEqual({ search: "" });
    expect(state.getSorting("burgsOverview")).toBeUndefined();
  });
});
