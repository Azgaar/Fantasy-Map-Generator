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
  initEditorTable: vi.fn(() => ({ goto: vi.fn() }))
}));
vi.mock("@/components/annex-mode", () => ({ createAnnexMode: vi.fn() }));
vi.mock("@/components/notes", () => ({ Notes: { getIcon: () => "" } }));
vi.mock("@/controllers", () => ({ Controllers: {} }));
vi.mock("@/generators/emblems-generator", () => ({ Emblems: {} }));
vi.mock("@/renderers/draw-emblems", () => ({ redrawEmblem: vi.fn(), redrawEmblems: vi.fn(), removeEmblem: vi.fn() }));
vi.mock("@/renderers/emblems/renderer", () => ({ EmblemRenderer: { trigger: vi.fn() } }));
vi.mock("@/renderers/overlays/fogging", () => ({ fog: vi.fn(), unfog: vi.fn() }));
vi.mock("@/renderers/overlays/highlight", () => ({ highlightElement: vi.fn(), highlightOutline: vi.fn() }));

import { initEditorTable } from "@/components/dialog/table";
import { tip } from "@/components/tooltips";
import { Cultures } from "@/generators/cultures-generator";
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
      h: [30, 30, 30],
      culture: [1, 1, 2],
      pop: [1, 2, 3],
      burg: [0, 0, 0]
    },
    burgs: [{}],
    cultures: [
      { i: 0, name: "Wildlands" },
      { i: 1, name: "Trow" },
      { i: 2, name: "Elladan" }
    ],
    states: [
      { i: 0, name: "Neutrals" },
      { i: 1, name: "Land", fullName: "Land", color: "#ff0000" }
    ],
    provinces: [
      0,
      { i: 1, state: 1, center: 0, name: "One", fullName: "One", color: "#00ff00" },
      { i: 2, state: 1, center: 1, culture: 0, name: "Two", fullName: "Two", color: "#0000ff" }
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

describe("province culture column", () => {
  it("calculates composition on hover, falls back on old maps, and preserves an edited official culture", () => {
    ProvincesEditor.showChart(); // fills in the statistics needed to render the rows
    document.body.insertAdjacentHTML(
      "beforeend",
      `
      <div id="provincesBodySection"></div><div id="provincesFooter"></div>
      <span id="provincesFooterNumber"></span><span id="provincesFooterBurgs"></span>
      <span id="provincesFooterArea"></span><span id="provincesFooterPopulation"></span>`
    );
    const onUpdate = vi.mocked(initEditorTable).mock.calls[0][0].onUpdate;
    const rows = pack.provinces.slice(1);
    const view = { rows, all: rows, page: 0, totalPages: 1, total: 2 };
    const breakdown = vi.spyOn(Cultures, "getPopulationBreakdown");
    onUpdate(view);
    expect(breakdown).not.toHaveBeenCalled();

    const select = document.querySelector<HTMLSelectElement>('[data-id="1"] .provinceCulture')!;
    expect(select.value).toBe("1"); // no saved culture: use the old map's center cell
    expect(document.querySelector<HTMLSelectElement>('[data-id="2"] .provinceCulture')!.value).toBe("0");
    select.dispatchEvent(new Event("mouseenter"));
    expect(tip).toHaveBeenLastCalledWith("Official culture: Trow<br>Culture breakdown: Trow 100%");

    select.value = "2";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(pack.provinces[1].culture).toBe(2);
    expect(tip).toHaveBeenLastCalledWith("Official culture: Elladan<br>Culture breakdown: Trow 100%");
    expect(pack.cells.culture[0]).toBe(1);
    pack.provinces = JSON.parse(JSON.stringify(pack.provinces));
    onUpdate({ ...view, rows: pack.provinces.slice(1), all: pack.provinces.slice(1) });
    expect(document.querySelector<HTMLSelectElement>('[data-id="1"] .provinceCulture')!.value).toBe("2");
    breakdown.mockRestore();
  });
});
