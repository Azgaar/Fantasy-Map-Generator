// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Layers } from "@/renderers/layers";
import { tip } from "@/ui/tooltips";
import { ALIGNMENTS, alignmentRank } from "@/data/culture-traits";
import { Options } from "@/model/options/options-model";
import type { Culture } from "@/model/society/cultures-generator";

vi.mock("@/renderers/layers", () => ({ Layers: { show: vi.fn(), hide: vi.fn(), draw: vi.fn() } }));
vi.mock("@/ui/tooltips", () => ({ tip: vi.fn(), clearMainTip: vi.fn() }));
vi.mock("@/ui/dialog/highlighting", () => ({ applyLineHighlighting: vi.fn() }));
vi.mock("@/ui/map/viewbox-events", () => ({ applyDefaultViewboxEvents: vi.fn() }));
vi.mock("@/renderers/draw-legend", () => ({ clearLegend: vi.fn(), drawLegend: vi.fn(), hasLegend: () => false }));
vi.mock("@/ui/dialog/dialog-helpers", async importOriginal => ({
  ...(await importOriginal<typeof import("@/ui/dialog/dialog-helpers")>()),
  closeDialogs: vi.fn(),
  destroyDialog: vi.fn(),
  updateDialog: vi.fn(),
  confirmationDialog: vi.fn()
}));
vi.mock("@/controllers", () => ({
  Controllers: { StyleEditor: { open: vi.fn() }, NamesbaseEditor: { open: vi.fn() } }
}));

import { CulturesEditor } from "@/controllers/society/cultures-editor";

/** a fresh cast per test: the editor mutates the cultures it is given, and a re-roll must not leak */
const makeCultures = (): Culture[] => [
  { i: 0, name: "Wildlands", base: "ENGLI", shield: "round", type: "Generic" },
  {
    i: 1,
    name: "Aeloran",
    base: "ENGLI",
    shield: "round",
    type: "Generic",
    center: 1,
    color: "#111111",
    alignment: "chaotic",
    values: ["passion"]
  },
  {
    i: 2,
    name: "Velic",
    base: "ENGLI",
    shield: "round",
    type: "Generic",
    center: 3,
    color: "#222222",
    alignment: "good",
    values: ["cooperation", "trust"]
  },
  // an old map: no traits
  { i: 3, name: "Thornic", base: "ENGLI", shield: "round", type: "Generic", center: 6, color: "#333333" }
];

const CELLS = 12;

/** every jQuery call the dialog machinery makes is a no-op that keeps chaining */
const chainable = (): any => new Proxy({}, { get: () => () => chainable() });

beforeEach(() => {
  document.body.innerHTML = /* html */ `<div id="dialogs"></div><svg id="debug"></svg><div id="viewbox"></div>`;
  vi.stubGlobal("customization", 0);
  vi.stubGlobal("$", chainable);
  vi.stubGlobal("Layers", Layers);
  const nameBases = [{ id: "ENGLI", name: "English", min: 5, max: 9, d: "ln", m: 0 }];
  vi.stubGlobal("Names", {
    nameBases,
    getNameBase(id: string) {
      return nameBases.find(base => base.id === id);
    }
  });
  vi.stubGlobal("Emblems", { isDiversiform: false, shape: "culture", shields: { types: {} } });

  options = Options.getDefaultOptions();

  const cells = {
    i: Array.from({ length: CELLS }, (_, i) => i),
    h: Array(CELLS).fill(30),
    area: Array(CELLS).fill(1),
    pop: Array(CELLS).fill(10),
    burg: Array(CELLS).fill(0),
    p: Array.from({ length: CELLS }, (_, i) => [i * 10, 0]),
    culture: [0, 1, 1, 2, 2, 2, 3, 3, 3, 1, 2, 3]
  };

  globalThis.pack = { cells, cultures: makeCultures(), burgs: [0] } as unknown as typeof pack;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.getElementById("culturesEditor")?.remove();
});

const body = () => document.getElementById("culturesBody")!;
const row = (cultureId: number) => body().querySelector<HTMLElement>(`div.states[data-id="${cultureId}"]`)!;
const shownNames = () =>
  [...body().querySelectorAll<HTMLInputElement>("div.states .cultureName")].map(input => input.value);
const fixture = (name: string) => pack.cultures.find(culture => culture.name === name)!;

describe("the Cultures editor's trait columns", () => {
  it("shows the alignment as a colored badge and the values as a pair", () => {
    CulturesEditor.open();

    const badge = row(2).querySelector<HTMLElement>('[data-col="alignment"] .cultureAlignment')!;
    expect(badge.textContent).toBe("good");
    expect(badge.getAttribute("style")).toContain("#2a9d4a");
    expect(row(2).querySelector('[data-col="values"]')!.textContent).toBe("cooperation · trust");
  });

  it("emphasizes a dominant value and marks an untyped culture with an em dash", () => {
    CulturesEditor.open();

    expect(row(1).querySelector('[data-col="values"] b')!.textContent).toBe("passion above all");
    expect(row(3).querySelector('[data-col="alignment"]')!.textContent).toBe("—");
    expect(row(3).querySelector('[data-col="values"]')!.textContent).toBe("—");
  });

  it("sorts by alignment in the canonical order, not alphabetically", () => {
    CulturesEditor.open();
    const header = () => body().querySelector<HTMLElement>('[data-sortby="alignment"]')!;
    header().click(); // a numeric column sorts descending first
    header().click(); // and ascending second: good, lawful, neutral, chaotic, evil, then the untyped

    const shown = shownNames();
    const rankOf = (name: string) => alignmentRank(fixture(name).alignment);

    expect(shown[0]).toBe("Velic"); // good, where alphabetical order would put Aeloran
    expect(shown.map(rankOf)).toEqual(shown.map(rankOf).toSorted((a, b) => a - b));
    expect(rankOf(shown.at(-1)!)).toBe(ALIGNMENTS.length); // the untyped, after every real alignment
  });

  it("re-rolls the traits of the unlocked cultures from the toolbar", () => {
    CulturesEditor.open();
    const before = { alignment: fixture("Aeloran").alignment, values: fixture("Aeloran").values };
    const locked = { alignment: fixture("Velic").alignment, values: fixture("Velic").values };
    row(2).querySelector<HTMLElement>('[data-col="lock"]')!.click(); // lock Velic

    document.getElementById("culturesRerollTraits")!.click();

    expect({ alignment: fixture("Velic").alignment, values: fixture("Velic").values }).toEqual(locked);
    expect({ alignment: fixture("Aeloran").alignment, values: fixture("Aeloran").values }).not.toEqual(before);
    expect(row(1).querySelector('[data-col="alignment"]')!.textContent).not.toBe("â€”"); // the table redrew
    expect(tip).toHaveBeenCalledWith(expect.stringContaining("Re-rolled the traits of 2 cultures"), false, "info");
  });

  it("refuses to re-roll while the traits layer is off", () => {
    options.generation.cultures.traits = false;
    CulturesEditor.open();
    const before = { alignment: fixture("Aeloran").alignment, values: fixture("Aeloran").values };

    document.getElementById("culturesRerollTraits")!.click();

    expect(tip).toHaveBeenCalledWith(expect.stringContaining("Culture traits are off"), false, "error");
    expect({ alignment: fixture("Aeloran").alignment, values: fixture("Aeloran").values }).toEqual(before);
  });
});
