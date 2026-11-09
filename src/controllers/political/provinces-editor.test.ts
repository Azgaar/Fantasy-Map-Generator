// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/renderers/layers", () => ({ Layers: { show: vi.fn(), hide: vi.fn(), draw: vi.fn(), isOn: () => false } }));
vi.mock("@/ui/tooltips", () => ({ tip: vi.fn(), clearMainTip: vi.fn(), loadingTip: { start: vi.fn(), end: vi.fn() } }));
vi.mock("@/ui/map/viewbox-events", () => ({ applyDefaultViewboxEvents: vi.fn() }));
vi.mock("@/ui/dialog/highlighting", () => ({ applyLineHighlighting: vi.fn() }));
vi.mock("@/ui/dialog/sorting", () => ({
  bindColumnSorting: vi.fn(),
  sortDataByColumns: (_id: string, data: unknown[]) => data
}));
vi.mock("@/ui/map/annex-mode", () => ({ createAnnexMode: () => ({ toggle: vi.fn() }) }));
vi.mock("@/model/story/notes", () => ({ Notes: {} }));
vi.mock("@/controllers", () => ({ Controllers: {} }));
vi.mock("@/model/political/emblems-generator", () => ({ Emblems: {} }));
vi.mock("@/renderers/draw-emblems", () => ({ redrawEmblem: vi.fn(), redrawEmblems: vi.fn(), removeEmblem: vi.fn() }));
vi.mock("@/renderers/emblems/renderer", () => ({ EmblemRenderer: { trigger: vi.fn() } }));
vi.mock("@/renderers/overlays/fogging", () => ({ fog: vi.fn(), unfog: vi.fn() }));
vi.mock("@/ui/map/highlight", () => ({ highlightElement: vi.fn(), highlightOutline: vi.fn() }));

import { Names } from "@/model/society/names-generator";
import { Layers } from "@/renderers/layers";
import { Dialog } from "@/ui/dialog/dialog";
import { DIALOGS_MARKUP } from "@/ui/dialog/dialog-testing";
import { dialogState } from "@/ui/dialog/state";
import { ProvincesEditor } from "./provinces-editor";

beforeEach(() => {
  vi.clearAllMocks();
  dialogState.clear();
  document.body.innerHTML = /* html */ `<svg></svg><input id="uiSize" value="1" />${DIALOGS_MARKUP}`;
  (SVGElement.prototype as unknown as { getBBox: () => object }).getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 });

  // a fresh map: the generator leaves province statistics for the editor to collect
  globalThis.pack = {
    cells: {
      i: [0, 1, 2],
      province: [1, 2, 2],
      area: [100, 200, 200],
      pop: [1, 2, 3],
      burg: [0, 0, 0],
      culture: [2, 0, 2],
      development: [0, 0, 0]
    },
    burgs: [{}],
    states: [
      { i: 0, name: "Neutrals" },
      { i: 1, name: "Land", fullName: "Land", color: "#ff0000", culture: 1 }
    ],
    provinces: [
      0,
      { i: 1, state: 1, center: 0, name: "One", fullName: "One", color: "#00ff00", burg: 0 },
      { i: 2, state: 1, center: 1, name: "Two", fullName: "Two", color: "#0000ff", burg: 0 }
    ]
  } as unknown as typeof globalThis.pack;
});

afterEach(() => {
  Dialog.destroy("provincesEditor");
  vi.restoreAllMocks();
});

describe("ProvincesEditor name regeneration", () => {
  beforeEach(() => {
    vi.spyOn(Names, "getCultureShort").mockImplementation(culture => `Culture${culture}`);
    vi.spyOn(Names, "getState").mockImplementation(name => name);
  });

  it("uses each province's local culture, including Wildlands, and updates names and labels", () => {
    Object.assign(pack.provinces[1], { fullName: "County of One", label: { text: "One|County", dx: 5 } });
    ProvincesEditor.open();
    document.querySelector<HTMLButtonElement>("#regenerateProvinceNames")!.click();

    expect(pack.provinces[1]).toMatchObject({
      name: "Culture2",
      fullName: "County of Culture2",
      label: { text: "Culture2|County", dx: 5 }
    });
    expect(pack.provinces[2].name).toBe("Culture0");
    expect(document.querySelector<HTMLInputElement>('[data-id="1"] .name')!.value).toBe("Culture2");
    expect(Layers.draw).toHaveBeenCalledExactlyOnceWith("labels");
  });

  it("respects locks, removed provinces, and both state and search filters", () => {
    pack.provinces[1].lock = true;
    pack.provinces[2].tags = ["selected"];
    pack.provinces.push(
      { ...pack.provinces[2], i: 3, name: "Other state", state: 2 },
      { ...pack.provinces[2], i: 4, name: "Removed", removed: true },
      { ...pack.provinces[2], i: 5, name: "Search excluded", tags: [] }
    );
    pack.provinces[1].tags = ["selected"];
    dialogState.set("provincesEditor", "filters", { stateId: 1, search: "selected" });
    ProvincesEditor.open();
    document.querySelector<HTMLButtonElement>("#regenerateProvinceNames")!.click();

    expect(pack.provinces.slice(1).map(province => province.name)).toEqual([
      "One",
      "Culture0",
      "Other state",
      "Removed",
      "Search excluded"
    ]);
    expect(Names.getCultureShort).toHaveBeenCalledExactlyOnceWith(0);
  });

  it("renames matching provinces beyond the first table page", () => {
    for (let i = 3; i <= 105; i++) pack.provinces.push({ ...pack.provinces[1], i, name: `Province${i}` });
    ProvincesEditor.open();
    expect(document.querySelector('[data-id="105"]')).toBeNull();
    document.querySelector<HTMLButtonElement>("#regenerateProvinceNames")!.click();

    expect(pack.provinces[105].name).toBe("Culture2");
    expect(Names.getCultureShort).toHaveBeenCalledTimes(105);
  });
});

describe("ProvincesEditor.showChart", () => {
  it("sizes the treemap from freshly collected statistics without opening the editor", () => {
    ProvincesEditor.showChart();

    const heights = [...document.querySelectorAll("#provincesTree rect")].map(rect => +rect.getAttribute("height")!);
    expect(heights).toHaveLength(2);
    for (const height of heights) expect(height).toBeGreaterThan(0);
    expect(pack.provinces[1]).toMatchObject({ area: 100, rural: 1 });
    expect(pack.provinces[2]).toMatchObject({ area: 400, rural: 5 });
  });
});
