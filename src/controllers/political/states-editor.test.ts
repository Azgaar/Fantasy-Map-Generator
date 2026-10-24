// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/renderers/layers", () => ({ Layers: { show: vi.fn(), hide: vi.fn(), isOn: () => false } }));
vi.mock("@/ui/tooltips", () => ({ tip: vi.fn(), clearMainTip: vi.fn(), loadingTip: { start: vi.fn(), end: vi.fn() } }));
vi.mock("@/ui/map/viewbox-events", () => ({ applyDefaultViewboxEvents: vi.fn() }));
vi.mock("@/ui/dialog/highlighting", () => ({ applyLineHighlighting: vi.fn() }));
vi.mock("@/ui/map/annex-mode", () => ({
  createAnnexMode: () => ({ toggle: vi.fn(), exit: vi.fn() })
}));
vi.mock("@/controllers", () => ({
  Controllers: {
    StyleEditor: { open: vi.fn() },
    ColorPicker: { open: vi.fn(), close: vi.fn() },
    EmblemsEditor: { open: vi.fn() },
    BurgsOverview: { open: vi.fn() },
    NotesEditor: { open: vi.fn() }
  }
}));
vi.mock("@/renderers/draw-emblems", () => ({ redrawEmblem: vi.fn(), removeEmblem: vi.fn() }));
vi.mock("@/renderers/emblems/renderer", () => ({ EmblemRenderer: { trigger: vi.fn() } }));
vi.mock("@/renderers/overlays/fogging", () => ({ fog: vi.fn(), unfog: vi.fn() }));
vi.mock("@/ui/map/highlight", () => ({ highlightElement: vi.fn(), highlightOutline: vi.fn() }));

import { States } from "@/model/political/states-generator";
import { dialogState } from "@/ui/dialog/state";
import { StatesEditor } from "./states-editor";

describe("StatesEditor", () => {
  beforeEach(() => {
    dialogState.remove("statesEditor", "filters");
    dialogState.remove("statesEditor", "sorting");
    dialogState.remove("statesEditor", "columns");

    document.body.innerHTML = /* html */ `<div id="dialogs"></div><svg id="viewbox"><g id="deftemp"><g id="fog"></g></g></svg>`;
    vi.stubGlobal("$", () => ({
      dialog: vi.fn(),
      one: vi.fn(),
      not: vi.fn().mockReturnThis(),
      each: vi.fn()
    }));
    Object.assign(States, {
      collectStatistics: vi.fn(),
      setLocked: vi.fn()
    });
    vi.stubGlobal("options", {
      app: { mode: null },
      map: {
        units: {
          distance: { scale: 1, unit: "mi" },
          population: { scale: 1000, urbanization: { rate: 0.2 } },
          area: { scale: 1, unit: "mi2" }
        }
      }
    });
    vi.stubGlobal("pack", {
      cells: {
        i: [0, 1, 2],
        state: [0, 1, 2],
        h: [20, 25, 30]
      },
      burgs: [
        { i: 0, name: "Neutral Burg", x: 0, y: 0 },
        { i: 1, name: "Capital One", x: 10, y: 20 },
        { i: 2, name: "Capital Two", x: 30, y: 40 }
      ],
      cultures: [
        { i: 0, name: "Generic" },
        { i: 1, name: "Culture One" },
        { i: 2, name: "Culture Two" }
      ],
      states: [
        { i: 0, name: "Neutrals", cells: 5, area: 50, burgs: 0, tags: [] },
        {
          i: 1,
          name: "Valoria",
          fullName: "Kingdom of Valoria",
          formName: "Kingdom",
          color: "#ff0000",
          capital: 1,
          culture: 1,
          cells: 10,
          area: 100,
          burgs: 1,
          rural: 10,
          urban: 5,
          treasury: 100,
          type: "Generic",
          expansionism: 1,
          tags: ["coastal", "naval"]
        },
        {
          i: 2,
          name: "Oakhaven",
          fullName: "Duchy of Oakhaven",
          formName: "Duchy",
          color: "#00ff00",
          capital: 2,
          culture: 2,
          cells: 8,
          area: 80,
          burgs: 1,
          rural: 8,
          urban: 2,
          treasury: 50,
          type: "Generic",
          expansionism: 1.2,
          tags: ["inland", "trade"]
        }
      ]
    });
  });

  it("renders search bar and table with tags column", () => {
    StatesEditor.open();

    const searchInput = document.getElementById("statesSearch") as HTMLInputElement;
    expect(searchInput).not.toBeNull();

    const header = document.getElementById("statesEditorHeader");
    const tagsCol = header?.querySelector('[data-col="tags"]');
    expect(tagsCol).not.toBeNull();

    const rows = document.querySelectorAll("#statesBodySection .states");
    expect(rows).toHaveLength(3); // Neutrals + 2 states

    const valoriaRow = document.querySelector('#statesBodySection .states[data-id="1"]');
    const tagsInput = valoriaRow?.querySelector(".stateTags") as HTMLInputElement;
    expect(tagsInput).not.toBeNull();
    expect(tagsInput.value).toBe("coastal, naval");
  });

  it("filters states by name via search bar", () => {
    StatesEditor.open();

    const searchInput = document.getElementById("statesSearch") as HTMLInputElement;
    searchInput.value = "valoria";
    searchInput.dispatchEvent(new Event("input"));

    const rows = document.querySelectorAll("#statesBodySection .states");
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute("data-id")).toBe("1");
  });

  it("filters states by tag via search bar", () => {
    StatesEditor.open();

    const searchInput = document.getElementById("statesSearch") as HTMLInputElement;
    searchInput.value = "trade";
    searchInput.dispatchEvent(new Event("input"));

    const rows = document.querySelectorAll("#statesBodySection .states");
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute("data-id")).toBe("2");
  });

  it("filters states specifically by tag when prefixed with #", () => {
    StatesEditor.open();

    const searchInput = document.getElementById("statesSearch") as HTMLInputElement;
    searchInput.value = "#naval";
    searchInput.dispatchEvent(new Event("input"));

    const rows = document.querySelectorAll("#statesBodySection .states");
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute("data-id")).toBe("1");
  });

  it("updates state tags on tag input change", () => {
    StatesEditor.open();

    const valoriaRow = document.querySelector('#statesBodySection .states[data-id="1"]') as HTMLElement;
    const tagsInput = valoriaRow.querySelector(".stateTags") as HTMLInputElement;
    tagsInput.value = "empire, militarist, coastal";
    tagsInput.dispatchEvent(new Event("change", { bubbles: true }));

    expect(pack.states[1].tags).toEqual(["empire", "militarist", "coastal"]);
    expect(tagsInput.value).toBe("empire, militarist, coastal");
    expect(valoriaRow.dataset.tags).toBe("empire, militarist, coastal");
  });
});
