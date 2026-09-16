// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/layers", () => ({ Layers: { show: vi.fn(), hide: vi.fn(), isOn: () => false } }));
vi.mock("@/components/tooltips", () => ({ tip: vi.fn(), clearMainTip: vi.fn() }));
vi.mock("@/components/viewbox-events", () => ({ applyDefaultViewboxEvents: vi.fn() }));
vi.mock("@/components/dialog/highlighting", () => ({ applyLineHighlighting: vi.fn() }));
vi.mock("@/components/dialog/sorting", () => ({ bindColumnSorting: vi.fn(), sortDataByColumns: vi.fn() }));
vi.mock("@/components/dialog/table", () => ({
  initColumnVisibility: vi.fn(),
  renderEditorHeader: () => "",
  renderEditorPagination: vi.fn(),
  initEditorTable: vi.fn()
}));
vi.mock("@/components/annex-mode", () => ({ createAnnexMode: vi.fn() }));
vi.mock("@/components/notes", () => ({ Notes: {} }));
vi.mock("@/controllers", () => ({ Controllers: {} }));
vi.mock("@/generators/emblems-generator", () => ({ Emblems: {} }));
vi.mock("@/renderers/draw-emblems", () => ({ redrawEmblem: vi.fn(), redrawEmblems: vi.fn(), removeEmblem: vi.fn() }));
vi.mock("@/renderers/emblems/renderer", () => ({ EmblemRenderer: { trigger: vi.fn() } }));
vi.mock("@/renderers/overlays/fogging", () => ({ fog: vi.fn(), unfog: vi.fn() }));
vi.mock("@/renderers/overlays/highlight", () => ({ highlightElement: vi.fn(), highlightOutline: vi.fn() }));

import { ProvincesEditor } from "./provinces-editor";

beforeEach(() => {
  document.body.innerHTML = /* html */ `<svg></svg><input id="uiSize" value="1" />
    <div id="alert"><div id="alertMessage"></div></div>`;
  (globalThis as Record<string, unknown>).alertMessage = document.getElementById("alertMessage");
  vi.stubGlobal("$", () => ({ dialog: vi.fn() }));
  (SVGElement.prototype as unknown as { getBBox: () => object }).getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 });

  // a fresh map: the generator leaves province statistics for the editor to collect
  globalThis.pack = {
    cells: {
      i: [0, 1, 2],
      province: [1, 2, 2],
      area: [100, 200, 200],
      pop: [1, 2, 3],
      burg: [0, 0, 0]
    },
    burgs: [{}],
    states: [
      { i: 0, name: "Neutrals" },
      { i: 1, name: "Land", fullName: "Land", color: "#ff0000" }
    ],
    provinces: [
      0,
      { i: 1, state: 1, name: "One", fullName: "One", color: "#00ff00" },
      { i: 2, state: 1, name: "Two", fullName: "Two", color: "#0000ff" }
    ]
  } as unknown as typeof globalThis.pack;
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
