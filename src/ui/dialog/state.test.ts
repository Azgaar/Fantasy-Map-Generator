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
  it("reset drops layout keys but keeps filters, then notifies the registered parts", async () => {
    const state = await loadState();
    state.set("burgsOverview", "filters", { search: "port" });
    state.set("burgsOverview", "position", { top: 10, left: 20 });
    state.set("burgsOverview", "columns", { hidden: ["treasury"], shown: [] });
    state.set("burgsOverview", "sorting", { sortBy: "name", alphabetically: true, direction: 1 });

    const calls: string[] = [];
    state.onReset("burgsOverview", "sorting", () => calls.push("stale"));
    state.onReset("burgsOverview", "sorting", () => calls.push("sorting"));
    state.onReset("burgsOverview", "columns", () => calls.push("columns"));
    state.onReset("statesEditor", "columns", () => calls.push("other dialog"));
    state.reset("burgsOverview");

    expect(calls).toEqual(["sorting", "columns"]);
    expect(JSON.parse(localStorage.getItem("fmg-dialog-state")!)).toEqual({
      burgsOverview: { filters: { search: "port" } }
    });
  });

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

  it("never stores defaults, so layout is only remembered once the user changes it", async () => {
    const state = await loadState();
    state.get("statesEditor", "sorting", () => ({ sortBy: "name", alphabetically: true, direction: 1 as const }));
    state.get("statesEditor", "columns", () => null);
    state.set("statesEditor", "filters", { search: "coast" });

    expect(state.hasLayout("statesEditor")).toBe(false);
    expect(JSON.parse(localStorage.getItem("fmg-dialog-state")!)).toEqual({
      statesEditor: { filters: { search: "coast" } }
    });

    state.set("statesEditor", "sorting", { sortBy: "area", alphabetically: false, direction: -1 });
    expect(state.hasLayout("statesEditor")).toBe(true);
    expect(state.get<{ sortBy: string } | null>("statesEditor", "sorting", () => null)?.sortBy).toBe("area");
  });

  it("notifies the dialog when its stored state changes", async () => {
    const state = await loadState();
    const seen: boolean[] = [];
    state.onChange("burgsOverview", () => seen.push(state.hasLayout("burgsOverview")));
    state.onChange("statesEditor", () => seen.push(false));

    state.set("burgsOverview", "position", { top: 1, left: 2 });
    state.set("burgsOverview", "filters", { search: "port" });
    state.reset("burgsOverview");

    expect(seen).toEqual([true, true, false]);
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
