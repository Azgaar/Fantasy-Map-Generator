// @vitest-environment jsdom
import { select } from "d3";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Layers } from "@/components/layers";
import { tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import type { State } from "@/generators/states-generator";
import "@/generators/states-generator"; // registers the States global the diplomacy chronicle is read through
import { DiplomacyEditor } from "./diplomacy-editor";

vi.mock("@/components/layers", () => ({ Layers: { show: vi.fn(), hide: vi.fn(), draw: vi.fn() } }));
vi.mock("@/utils", async importOriginal => ({
  ...(await importOriginal<typeof import("@/utils")>()),
  getVertexPath: (cells: number[]) => `M${cells.join()}`
}));
vi.mock("@/components/tooltips", () => ({ tip: vi.fn(), clearMainTip: vi.fn() }));
vi.mock("@/components/viewbox-events", () => ({
  applyDefaultViewboxEvents: vi.fn(() => select("#viewbox").on("click", null).on(".drag", null))
}));

interface DialogOptions {
  close?: () => void;
}

let dialogs: Map<HTMLElement, DialogOptions>;
let states: State[];

function element<T extends Element = HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing ${selector}`);
  return el;
}

function action(label: "Apply" | "Discard" | "Undo"): void {
  element<HTMLElement>(`#diplomacyEditor${label}`).click();
}

function choose(relation: string): void {
  element<HTMLInputElement>(`#diplomacyEditor input[value="${relation}"]`).click();
}

/** drag over the cells; the test Pack.findCell maps x to the cell */
async function paint(cells: number[], shiftKey = false): Promise<void> {
  const viewbox = element("#viewbox");
  const view = document.defaultView!;
  const mouseEvent = (type: string, clientX: number) => {
    const event = new view.MouseEvent(type, { bubbles: true, button: 0, buttons: 1, clientX, clientY: 0, shiftKey });
    Object.defineProperty(event, "view", { value: view });
    return event;
  };
  viewbox.dispatchEvent(mouseEvent("mousedown", cells[0]));
  for (const cell of cells.slice(1)) view.dispatchEvent(mouseEvent("mousemove", cell));
  view.dispatchEvent(mouseEvent("mouseup", cells.at(-1)!));
  await new Promise(resolve => setTimeout(resolve, 0));
}

const checkedRelation = () =>
  document.querySelector<HTMLInputElement>('input[name="diplomacyRelation"]:checked')?.value;
const chronicle = () => states[0].diplomacy as unknown as string[][];
const edited = () => element<HTMLSelectElement>("#diplomacyEditorState").value;
const fill = (id: number) => element(`#state${id}`).getAttribute("fill");

beforeEach(() => {
  vi.clearAllMocks();
  dialogs = new Map();
  document.body.innerHTML = `<div id="dialogs"></div>
    <svg><g id="viewbox"><g id="statesBody"><path id="state1" d="M1,0" /><path id="state2" d="M2,0" /><path id="state3" d="M3,0" /></g>
    <g id="statesHalo"></g><g id="debug"></g></g></svg>`;
  vi.stubGlobal("$", (target: string | HTMLElement) => {
    const el = typeof target === "string" ? element<HTMLElement>(target) : target;
    return {
      dialog: (options: string | DialogOptions) => {
        if (options === "close") dialogs.get(el)?.close?.();
        else if (typeof options === "object") dialogs.set(el, options);
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
  vi.stubGlobal("pack", { states, cells: { i: [0, 1, 2, 3, 4, 5], state: Uint16Array.from([0, 1, 2, 3, 4, 99]) } });
  vi.stubGlobal("Pack", { findCell: (x: number) => (x < 6 ? x : undefined) });
  vi.stubGlobal("customization", 0);
});

afterEach(() => {
  DiplomacyEditor.close();
  vi.unstubAllGlobals();
});

describe("painting relations", () => {
  test("sets the chosen relation to the edited state, one drag per undo", async () => {
    DiplomacyEditor.open(1);
    choose("Vassal");
    await paint([2, 3, 4, 5]);
    expect(states[2].diplomacy![1]).toBe("Vassal");
    expect(states[3].diplomacy![1]).toBe("Vassal");
    expect(states[1].diplomacy).toEqual(["x", "x", "Suzerain", "Suzerain", "x"]);
    expect(states[4].diplomacy![1]).toBe("x");
    expect(chronicle()).toEqual([]);
    expect(fill(3)).toBe("#87CEFA");

    await paint([3]);
    expect(element<HTMLButtonElement>("#diplomacyEditorUndo").disabled).toBe(false);
    action("Undo");
    expect(states[1].diplomacy).toEqual(["x", "x", "Rival", "Neutral", "x"]);
    expect(element<HTMLButtonElement>("#diplomacyEditorUndo").disabled).toBe(true);
  });

  test("a click changes one state; Apply records the history", async () => {
    DiplomacyEditor.open(1);
    choose("Ally");
    await paint([3]);
    expect(states[3].diplomacy![1]).toBe("Ally");
    expect(states[1].diplomacy![3]).toBe("Ally");
    expect(chronicle()).toEqual([]);
    action("Apply");
    expect(chronicle()).toEqual([["Defence pact", "Three entered into defensive pact with One"]]);
  });

  test("Apply records the net change of each pair once", async () => {
    DiplomacyEditor.open(1);
    choose("Enemy");
    await paint([2, 3]);
    choose("Ally");
    await paint([2]);
    choose("Neutral");
    await paint([3]);
    action("Apply");
    // Two went Rival → Enemy → Ally; Three went Neutral → Enemy → Neutral
    expect(chronicle()).toEqual([["Defence pact", "Two entered into defensive pact with One"]]);
  });

  test("ignores drags that start outside a state", async () => {
    DiplomacyEditor.open(1);
    choose("Enemy");
    const before = JSON.stringify(states);
    await paint([0, 2]);
    await paint([4, 2]);
    expect(JSON.stringify(states)).toBe(before);
  });

  test("starts with the first relation and remembers the last chosen one", async () => {
    vi.resetModules();
    const { DiplomacyEditor: fresh } = await import("./diplomacy-editor");
    fresh.open(1);
    expect(checkedRelation()).toBe("Ally");
    choose("Rival");
    fresh.close();

    fresh.open(1);
    expect(checkedRelation()).toBe("Rival");
    await paint([3]);
    expect(states[3].diplomacy![1]).toBe("Rival");
    fresh.close();
  });

  test("uses the former relation for war termination history", async () => {
    states[2].diplomacy![1] = states[1].diplomacy![2] = "Enemy";
    DiplomacyEditor.open(1);
    choose("Friendly");
    await paint([2]);
    action("Apply");
    expect(chronicle()).toEqual([
      [
        "War termination",
        "Two and One agreed to cease fire and signed a peace treaty",
        "Two-Onean relations changed to friendly"
      ]
    ]);
  });

  test("repairs a broken inverse of the same relation without a record", async () => {
    states[1].diplomacy![2] = "x";
    DiplomacyEditor.open(1);
    choose("Rival");
    await paint([2]);
    action("Apply");
    expect(states[1].diplomacy![2]).toBe("Rival");
    expect(chronicle()).toEqual([]);
  });
});

describe("edited state", () => {
  test("shift + click, the dropdown and reopening select the state and notify", async () => {
    const onSelect = vi.fn();
    DiplomacyEditor.open(1, { onSelect });
    choose("Enemy");
    await paint([3], true);
    expect(edited()).toBe("3");
    expect(onSelect).toHaveBeenLastCalledWith(3);
    expect(chronicle()).toEqual([]);
    await paint([2]);
    expect(states[2].diplomacy![3]).toBe("Enemy");

    const stateSelect = element<HTMLSelectElement>("#diplomacyEditorState");
    stateSelect.value = "2";
    stateSelect.dispatchEvent(new Event("change"));
    expect(onSelect).toHaveBeenLastCalledWith(2);

    DiplomacyEditor.open(1);
    expect(edited()).toBe("1");
    expect(document.querySelectorAll("#diplomacyEditor")).toHaveLength(1);
    DiplomacyEditor.open(4);
    expect(edited()).toBe("1");
    expect(onSelect).toHaveBeenCalledTimes(3);
  });

  test("marks the edited state on the map", async () => {
    DiplomacyEditor.open(1);
    expect(element("#diplomacyMark path").getAttribute("d")).toBe("M1");
    await paint([3], true);
    expect(document.querySelectorAll("#diplomacyMark")).toHaveLength(1);
    expect(element("#diplomacyMark path").getAttribute("d")).toBe("M3");
    DiplomacyEditor.close();
    expect(document.getElementById("diplomacyMark")).toBeNull();
  });

  test("falls back to the first state and lists short names", () => {
    DiplomacyEditor.open();
    expect(edited()).toBe("1");
    expect([...element<HTMLSelectElement>("#diplomacyEditorState").options].map(o => o.text)).toEqual([
      "One",
      "Three",
      "Two"
    ]);
  });
});

describe("lifecycle", () => {
  test("Apply keeps the changes", async () => {
    const onClose = vi.fn();
    DiplomacyEditor.open(1, { onClose });
    choose("Enemy");
    await paint([3]);
    action("Apply");
    expect(document.getElementById("diplomacyEditor")).toBeNull();
    expect(states[3].diplomacy![1]).toBe("Enemy");
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("Discard reverts every change and its history but keeps the editor open", async () => {
    const onClose = vi.fn();
    const before = JSON.stringify(states);
    DiplomacyEditor.open(1, { onClose });
    const discard = element<HTMLButtonElement>("#diplomacyEditorDiscard");
    expect(discard.disabled).toBe(true);
    choose("Enemy");
    await paint([2]);
    await paint([3]);
    expect(discard.disabled).toBe(false);

    action("Discard");
    expect(JSON.stringify(states)).toBe(before);
    expect(chronicle()).toEqual([]);
    expect(discard.disabled).toBe(true);
    expect(element<HTMLButtonElement>("#diplomacyEditorUndo").disabled).toBe(true);
    expect(document.getElementById("diplomacyEditor")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    await paint([3]);
    expect(states[3].diplomacy![1]).toBe("Enemy");
  });

  test("closing discards changes and restores map events", async () => {
    const onClose = vi.fn();
    const before = JSON.stringify(states);
    DiplomacyEditor.open(1, { onClose });
    choose("Enemy");
    await paint([2, 3]);
    DiplomacyEditor.close();
    expect(JSON.stringify(states)).toBe(before);
    expect(document.getElementById("diplomacyEditor")).toBeNull();
    expect(applyDefaultViewboxEvents).toHaveBeenCalledOnce();
    expect(Layers.draw).toHaveBeenCalledWith("states");
    expect(select("#viewbox").on("mousedown.drag")).toBeUndefined();
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("needs at least 2 states", () => {
    states[2].removed = states[3].removed = true;
    DiplomacyEditor.open(1);
    expect(document.getElementById("diplomacyEditor")).toBeNull();
    expect(tip).toHaveBeenCalledWith("There should be at least 2 states to edit the diplomacy", false, "error");
  });
});
