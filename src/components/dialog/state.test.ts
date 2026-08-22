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
    const filters = state.get("burgsOverview", "filters", () => ({ search: "", stateId: -1 }));
    filters.search = "port";
    state.set("burgsOverview", "filters", filters);

    expect(state.get("burgsOverview", "filters", () => ({ search: "new default", stateId: 1 }))).toEqual(filters);
    expect(state.get("statesEditor", "filters", () => ({ search: "" }))).toEqual({ search: "" });
  });

  it("persists filter mutations and sorting", async () => {
    const state = await loadState();
    const filters = state.get("burgsOverview", "filters", () => ({ search: "", stateId: -1 }));
    filters.search = "port";
    state.set("burgsOverview", "filters", filters);
    state.set("burgsOverview", "sorting", { sortBy: "name", alphabetically: true, direction: 1 });

    expect(JSON.parse(localStorage.getItem("fmg-dialog-state")!)).toEqual({
      burgsOverview: {
        filters: { search: "port", stateId: -1 },
        sorting: { sortBy: "name", alphabetically: true, direction: 1 }
      }
    });
  });

  it("restores state in a new session", async () => {
    localStorage.setItem(
      "fmg-dialog-state",
      JSON.stringify({
        goodsEditor: {
          filters: { visibleTags: ["food", "raw"] },
          sorting: { sortBy: "name", alphabetically: true, direction: -1 }
        }
      })
    );

    const state = await loadState();
    const filters = state.get("goodsEditor", "filters", () => ({ visibleTags: [] as string[] }));

    expect(filters.visibleTags).toEqual(["food", "raw"]);
    expect(state.get("goodsEditor", "sorting", () => null)).toEqual({
      sortBy: "name",
      alphabetically: true,
      direction: -1
    });
  });

  it("persists array filters as plain JSON", async () => {
    const state = await loadState();
    const filters = state.get("goodsEditor", "filters", () => ({ visibleTags: [] as string[] }));
    filters.visibleTags = ["food"];
    state.set("goodsEditor", "filters", filters);

    expect(JSON.parse(localStorage.getItem("fmg-dialog-state")!).goodsEditor.filters.visibleTags).toEqual(["food"]);
  });

  it("falls back per field when stored values are malformed", async () => {
    localStorage.setItem(
      "fmg-dialog-state",
      JSON.stringify({
        burgsOverview: {
          filters: { search: 42, stateId: "missing", obsolete: true },
          sorting: { sortBy: [], alphabetically: "yes", direction: "sideways" }
        }
      })
    );

    const state = await loadState();

    expect(state.get("burgsOverview", "filters", () => ({ search: "", stateId: -1 }))).toEqual({
      search: "",
      stateId: -1
    });
    expect(
      state.get("burgsOverview", "sorting", () => ({ sortBy: "name", alphabetically: true, direction: 1 }))
    ).toEqual({ sortBy: "name", alphabetically: true, direction: 1 });
  });

  it("creates default sorting once per dialog", async () => {
    const state = await loadState();
    const initial = state.get("statesEditor", "sorting", () => ({
      sortBy: "name",
      alphabetically: true,
      direction: 1 as const
    }));
    const stored = state.get("statesEditor", "sorting", () => ({
      sortBy: "area",
      alphabetically: false,
      direction: -1 as const
    }));

    expect(stored).toEqual(initial);
    expect(stored?.sortBy).toBe("name");
  });

  it("removes one section without affecting the rest of the dialog state", async () => {
    const state = await loadState();
    state.set("statesEditor", "filters", { search: "coast" });
    state.set("statesEditor", "sorting", { sortBy: "name", alphabetically: true, direction: 1 });
    state.set("statesEditor", "columns", { hidden: ["area"], shown: [] });

    state.remove("statesEditor", "columns");

    expect(JSON.parse(localStorage.getItem("fmg-dialog-state")!).statesEditor).toEqual({
      filters: { search: "coast" },
      sorting: { sortBy: "name", alphabetically: true, direction: 1 }
    });
  });

  it("is cleared only through explicit application-data cleanup", async () => {
    const state = await loadState();
    const filters = state.get("burgsOverview", "filters", () => ({ search: "" }));
    filters.search = "port";
    state.set("burgsOverview", "filters", filters);
    state.set("burgsOverview", "sorting", { sortBy: "name", alphabetically: true, direction: 1 });

    state.clear();

    expect(localStorage.getItem("fmg-dialog-state")).toBeNull();
    expect(state.get("burgsOverview", "filters", () => ({ search: "" }))).toEqual({ search: "" });
    expect(state.get("burgsOverview", "sorting", () => null)).toBeNull();
  });
});
