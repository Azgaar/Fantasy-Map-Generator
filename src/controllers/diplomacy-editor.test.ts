// @vitest-environment jsdom
import { select } from "d3";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import type { State } from "@/generators/states-generator";
import { DiplomacyEditor } from "./diplomacy-editor";

vi.mock("@/components/layers", () => ({ Layers: { show: vi.fn(), hide: vi.fn(), isOn: () => false } }));
vi.mock("@/renderers/emblems/renderer", () => ({ EmblemRenderer: { trigger: vi.fn() } }));
vi.mock("@/components/tooltips", () => ({ tip: vi.fn(), clearMainTip: vi.fn() }));
vi.mock("@/components/viewbox-events", () => ({
  applyDefaultViewboxEvents: vi.fn(() => select("#viewbox").on("click", null))
}));
vi.mock("@/components/dialog/highlighting", () => ({ applyLineHighlighting: vi.fn() }));
vi.mock("@/components/dialog/sorting", () => ({
  bindColumnSorting: vi.fn(),
  sortDataByColumns: (_id: string, rows: State[]) => rows
}));
vi.mock("@/components/dialog/dialog-helpers", async importOriginal => ({
  ...(await importOriginal<typeof import("@/components/dialog/dialog-helpers")>()),
  closeDialogs: vi.fn()
}));
vi.mock("@/components/dialog/table", () => ({
  initColumnVisibility: vi.fn(),
  renderEditorHeader: () => "",
  renderEditorPagination: vi.fn(),
  initEditorTable: ({ getData, onUpdate }: { getData: () => State[]; onUpdate: (view: unknown) => void }) => ({
    reset: () => {
      const rows = getData();
      onUpdate({ rows, all: rows });
    }
  })
}));

interface DialogOptions {
  close?: () => void;
  buttons?: Record<string, (this: HTMLElement) => void>;
}

let dialogs: Map<HTMLElement, DialogOptions>;
let states: State[];

function element<T extends Element = HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing ${selector}`);
  return el;
}

function close(selector: string): void {
  dialogs.get(element<HTMLElement>(selector))?.close?.();
}

function action(label: string): void {
  const dialog = element<HTMLElement>("#diplomacyRelations");
  dialogs.get(dialog)!.buttons![label].call(dialog);
}

function choose(relation: string): void {
  element<HTMLInputElement>(`#relationsForm input[value="${relation}"]`).click();
}

function mapClick(cell: number): void {
  element("#viewbox").dispatchEvent(new MouseEvent("click", { clientX: cell, bubbles: true }));
}

function editRow(state = 2): void {
  element<HTMLElement>(`#diplomacyBodySection [data-id="${state}"] .changeRelations`).click();
}

const chronicle = () => states[0].diplomacy as unknown as string[][];

beforeEach(() => {
  vi.clearAllMocks();
  dialogs = new Map();
  document.body.innerHTML = `<div id="dialogs"><div id="alert"><div id="alertMessage"></div></div></div>
    <svg><g id="viewbox"><g id="statesBody"></g><g id="statesHalo"></g><g id="debug"></g></g></svg>`;
  vi.stubGlobal("$", (target: string | HTMLElement) => {
    const el = typeof target === "string" ? element<HTMLElement>(target) : target;
    return {
      dialog: (options: string | DialogOptions) => {
        if (options === "close") dialogs.get(el)?.close?.();
        else if (options === "destroy") {
          dialogs.delete(el);
          el.classList.remove("ui-dialog-content");
        } else if (typeof options === "object") {
          dialogs.set(el, { ...dialogs.get(el), ...options });
          el.classList.add("ui-dialog-content");
        }
      }
    };
  });
  states = [
    { i: 0, name: "Neutrals", diplomacy: [] },
    { i: 1, name: "One", fullName: "State One", diplomacy: ["x", "x", "Rival", "Neutral", "x"] },
    { i: 2, name: "Two", fullName: "State Two", diplomacy: ["x", "Rival", "x", "Ally", "x"] },
    { i: 3, name: "Three", fullName: "State Three", diplomacy: ["x", "Neutral", "Ally", "x", "x"] },
    { i: 4, name: "Removed", removed: true, diplomacy: ["x", "x", "x", "x", "x"] }
  ] as State[];
  vi.stubGlobal("pack", { states, cells: { state: Uint16Array.from([0, 1, 2, 3, 4, 99]) } });
  vi.stubGlobal("Pack", { findCell: (x: number) => (x < 6 ? x : undefined) });
  vi.stubGlobal("customization", 0);
  DiplomacyEditor.open();
  mapClick(1);
});

afterEach(() => {
  if (document.getElementById("diplomacyEditor")) close("#diplomacyEditor");
  vi.unstubAllGlobals();
});

describe("diplomacy bulk edits", () => {
  test("skips an existing ally while recording the actual changed pair", () => {
    editRow();
    choose("Ally");
    mapClick(3);
    action("Apply");
    expect(states[2].diplomacy).toEqual(["x", "Ally", "x", "Ally", "x"]);
    expect(states[1].diplomacy![2]).toBe("Ally");
    expect(chronicle()).toEqual([["Defence pact", "Two entered into defensive pact with One"]]);
  });

  test("applies to other targets even when the clicked row already has the chosen relation", () => {
    editRow();
    mapClick(3);
    action("Apply");
    expect(states[2].diplomacy![3]).toBe("Rival");
    expect(states[3].diplomacy![2]).toBe("Rival");
    expect(chronicle()).toEqual([["Rivalization", "Two and Three became rivals"]]);
  });

  test("uses each target's former relation for war termination history", () => {
    states[2].diplomacy![3] = states[3].diplomacy![2] = "Enemy";
    editRow();
    choose("Friendly");
    mapClick(3);
    action("Apply");
    expect(chronicle().map(entry => entry[0])).toEqual(["Relations change", "War termination"]);
  });
});

describe("invalid diplomacy", () => {
  function showInvalidPair(): void {
    states[1].diplomacy![2] = states[2].diplomacy![1] = "x";
    element<HTMLElement>("#diplomacyEditorRefresh").click();
    element<HTMLElement>("#diplomacyShowMatrix").click();
  }

  test("renders invalid pairs without mutating them and keeps only the diagonal uneditable", () => {
    showInvalidPair();
    expect(element('[data-id="2"] .changeRelations').textContent).toContain("Invalid");
    expect(document.querySelectorAll("#diplomacyMatrixBody td.x")).toHaveLength(3);
    element<HTMLElement>('#diplomacyMatrixBody tr[data-id="1"] td.x').click();
    expect(document.getElementById("diplomacyRelations")).toBeNull();
    expect(states[1].diplomacy![2]).toBe("x");
    expect(chronicle()).toEqual([]);
  });

  test("requires an explicit replacement and repairs reciprocal vassal relations", () => {
    showInvalidPair();
    element<HTMLElement>('#diplomacyMatrixBody tr[data-id="1"] td[data-id="2"]').click();
    action("Apply");
    expect(tip).toHaveBeenCalledWith("Please choose a relation", false, "warn");
    expect(states[1].diplomacy![2]).toBe("x");
    choose("Vassal");
    action("Apply");
    const reloaded = JSON.parse(JSON.stringify(states)) as State[];
    expect(reloaded[1].diplomacy![2]).toBe("Vassal");
    expect(reloaded[2].diplomacy![1]).toBe("Suzerain");
    expect(element('#diplomacyMatrixBody tr[data-id="2"] td[data-id="1"]').textContent).toBe("Suzerain");
  });

  test("repairs a broken inverse even if the selected direction already matches", () => {
    states[1].diplomacy![2] = "x";
    editRow();
    action("Apply");
    expect(states[1].diplomacy![2]).toBe("Rival");
    expect(chronicle()).toHaveLength(1);
  });

  test("keeps matrix columns aligned with sparse arrays and removed states", () => {
    delete states[1].diplomacy![2];
    states[2].diplomacy = undefined;
    element<HTMLElement>("#diplomacyEditorRefresh").click();
    element<HTMLElement>("#diplomacyShowMatrix").click();
    const row = element('#diplomacyMatrixBody tr[data-id="1"]');
    expect(row.querySelectorAll("td")).toHaveLength(3);
    expect(row.querySelector('td[data-id="3"]')!.textContent).toBe("Neutral");
    element<HTMLElement>('#diplomacyMatrixBody tr[data-id="2"] td[data-id="1"]').click();
    choose("Suzerain");
    action("Apply");
    expect(states[2].diplomacy![1]).toBe("Suzerain");
    expect(states[1].diplomacy![2]).toBe("Vassal");
  });

  test("explicit reset repairs invalid pairs and preserves self, neutral and removed entries", () => {
    showInvalidPair();
    element<HTMLElement>("#diplomacyReset").click();
    expect(states[1].diplomacy).toEqual(["x", "x", "Neutral", "Neutral", "x"]);
    expect(states[2].diplomacy![1]).toBe("Neutral");
    expect(states[4].diplomacy![1]).toBe("x");
    expect(chronicle()).toEqual([]);
  });
});

describe("map target selection lifecycle", () => {
  test("keeps the subject fixed, toggles valid targets and synchronizes select-all", () => {
    editRow();
    const before = JSON.stringify(states);
    const self = element("#diplomacyBodySection .Self");
    mapClick(3);
    expect(element<HTMLInputElement>("#selectState3").checked).toBe(true);
    expect(element("#selectAllNoneBtn").classList.contains("pressed")).toBe(true);
    expect(element("#diplomacyBodySection .Self")).toBe(self);
    for (const cell of [0, 2, 4, 5, 8]) mapClick(cell);
    expect(JSON.stringify(states)).toBe(before);
    element<HTMLInputElement>("#selectState3").click();
    expect(element("#selectAllNoneBtn").classList.contains("pressed")).toBe(false);
    element<HTMLElement>("#selectAllNoneBtn").click();
    expect(element<HTMLInputElement>("#selectState3").checked).toBe(true);
    mapClick(3);
    expect(element<HTMLInputElement>("#selectState3").checked).toBe(false);
  });

  test.each(["Apply", "Cancel", "close"])("restores map selection after %s", exit => {
    const previous = select("#viewbox").on("click");
    editRow();
    mapClick(3);
    const before = JSON.stringify(states);
    if (exit === "close") close("#diplomacyRelations");
    else action(exit);
    if (exit !== "Apply") expect(JSON.stringify(states)).toBe(before);
    expect(document.getElementById("diplomacyRelations")).toBeNull();
    expect(select("#viewbox").on("click")).toBe(previous);
    mapClick(3);
    expect(element<HTMLElement>("#diplomacyBodySection .Self").dataset.id).toBe("3");
  });

  test("closing the editor discards the pending selection and restores default map events", () => {
    editRow();
    choose("Enemy");
    mapClick(3);
    const before = JSON.stringify(states);
    close("#diplomacyEditor");
    expect(document.getElementById("diplomacyRelations")).toBeNull();
    expect(JSON.stringify(states)).toBe(before);
    expect(applyDefaultViewboxEvents).toHaveBeenCalledOnce();
    expect(select("#viewbox").on("click")).toBeUndefined();
  });

  test("reopening the relation dialog replaces the pending selection without stacking handlers", () => {
    const previous = select("#viewbox").on("click");
    editRow();
    mapClick(3);
    editRow(3);
    expect(document.querySelectorAll("#diplomacyRelations")).toHaveLength(1);
    expect(document.querySelectorAll("#stateSelectionContainer input:checked")).toHaveLength(1);
    action("Cancel");
    expect(select("#viewbox").on("click")).toBe(previous);
  });
});
