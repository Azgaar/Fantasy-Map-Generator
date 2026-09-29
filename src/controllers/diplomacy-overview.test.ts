// @vitest-environment jsdom
import { select } from "d3";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { State } from "@/generators/states-generator";
import "@/generators/states-generator"; // registers the States global the diplomacy chronicle is read through
import { DiplomacyOverview } from "./diplomacy-overview";

vi.mock("@/components/layers", () => ({ Layers: { show: vi.fn(), hide: vi.fn(), draw: vi.fn(), isOn: () => false } }));
vi.mock("@/renderers/emblems/renderer", () => ({ EmblemRenderer: { trigger: vi.fn() } }));
vi.mock("@/utils", async importOriginal => ({
  ...(await importOriginal<typeof import("@/utils")>()),
  getVertexPath: (cells: number[]) => `M${cells.join()}`
}));
vi.mock("@/components/tooltips", () => ({ tip: vi.fn(), clearMainTip: vi.fn() }));
vi.mock("@/components/viewbox-events", () => ({
  applyDefaultViewboxEvents: vi.fn(() => select("#viewbox").on("click", null).on(".drag", null))
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

/** press a button of the confirmation dialog */
function confirmWith(label: string): void {
  const alert = element<HTMLElement>("#alert");
  dialogs.get(alert)!.buttons![label].call(alert);
}

function action(label: "Apply" | "Discard" | "Undo"): void {
  element<HTMLElement>(`#diplomacyEditor${label}`).click();
}

function choose(relation: string): void {
  element<HTMLInputElement>(`#diplomacyEditor input[value="${relation}"]`).click();
}

function mapClick(cell: number): void {
  element("#viewbox").dispatchEvent(new MouseEvent("click", { clientX: cell, bubbles: true }));
}

/** open the Diplomacy Editor from the overview toolbar; it is loaded through the registry */
async function openEditor(relation?: string): Promise<void> {
  element<HTMLElement>("#diplomacyEditRelations").click();
  await vi.dynamicImportSettled();
  if (relation) choose(relation);
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

const selfId = () => element<HTMLElement>("#diplomacyBodySection .Self").dataset.id;
const chronicle = () => states[0].diplomacy as unknown as string[][];

beforeEach(() => {
  vi.clearAllMocks();
  dialogs = new Map();
  document.body.innerHTML = `<div id="dialogs"><div id="alert"><div id="alertMessage"></div></div></div>
    <svg><g id="viewbox"><g id="statesBody"><path id="state1" d="M1,0" /><path id="state2" d="M2,0" /><path id="state3" d="M3,0" /></g>
    <g id="statesHalo"></g><g id="debug"></g></g></svg>`;
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
  vi.stubGlobal("pack", { states, cells: { i: [0, 1, 2, 3, 4, 5], state: Uint16Array.from([0, 1, 2, 3, 4, 99]) } });
  vi.stubGlobal("Pack", { findCell: (x: number) => (x < 6 ? x : undefined) });
  vi.stubGlobal("customization", 0);
  vi.stubGlobal("tip", vi.fn()); // the registry shows a loading tip through window
  vi.stubGlobal("clearMainTip", vi.fn());
  DiplomacyOverview.open();
  mapClick(1);
});

afterEach(async () => {
  if (document.getElementById("diplomacyOverview")) close("#diplomacyOverview");
  await vi.dynamicImportSettled();
  vi.unstubAllGlobals();
});

describe("Diplomacy Editor", () => {
  test("changes show in the table and the matrix", async () => {
    element<HTMLElement>("#diplomacyShowMatrix").click();
    await openEditor("Vassal");
    await paint([3]);
    expect(element('[data-id="3"] [data-col="relations"]').textContent).toContain("Vassal");
    expect(element('#diplomacyMatrixBody tr[data-id="1"] td:nth-of-type(3)').textContent).toBe("Suzerain");
  });

  test("the edited state follows the overview selection and back", async () => {
    await openEditor();
    element<HTMLElement>('#diplomacyBodySection [data-id="3"] [data-col="name"]').click();
    await vi.dynamicImportSettled();
    expect(element<HTMLSelectElement>("#diplomacyEditorState").value).toBe("3");

    await paint([2], true);
    expect(selfId()).toBe("2");
  });

  test("Discard refreshes the table and keeps the editor open", async () => {
    const before = JSON.stringify(states);
    await openEditor("Enemy");
    await paint([2]);
    expect(element('[data-id="2"] [data-col="relations"]').textContent).toContain("Enemy");
    action("Discard");
    expect(JSON.stringify(states)).toBe(before);
    expect(element('[data-id="2"] [data-col="relations"]').textContent).toContain("Rival");
    expect(document.getElementById("diplomacyEditor")).toBeTruthy();
  });

  test("closing the editor discards changes and restores map selection", async () => {
    const before = JSON.stringify(states);
    await openEditor("Enemy");
    await paint([2, 3]);
    close("#diplomacyEditor");
    expect(JSON.stringify(states)).toBe(before);
    expect(element('[data-id="2"] [data-col="relations"]').textContent).toContain("Rival");
    mapClick(3);
    expect(selfId()).toBe("3");
  });

  test("closing the overview closes the editor and discards its changes", async () => {
    const before = JSON.stringify(states);
    await openEditor("Enemy");
    await paint([2]);
    close("#diplomacyOverview");
    await vi.dynamicImportSettled();
    expect(document.getElementById("diplomacyEditor")).toBeNull();
    expect(JSON.stringify(states)).toBe(before);
    expect(select("#viewbox").on("click")).toBeUndefined();
    expect(document.getElementById("diplomacyMark")).toBeNull();
  });

  test("regenerate asks for confirmation and closes the editor first", async () => {
    const generate = vi.spyOn(States, "generateDiplomacy").mockImplementation(() => {});
    await openEditor("Enemy");
    await paint([2]);
    element<HTMLElement>("#diplomacyRegenerate").click();
    confirmWith("Cancel");
    expect(generate).not.toHaveBeenCalled();
    expect(document.getElementById("diplomacyEditor")).toBeTruthy();

    element<HTMLElement>("#diplomacyRegenerate").click();
    confirmWith("Regenerate");
    await vi.dynamicImportSettled();
    expect(document.getElementById("diplomacyEditor")).toBeNull();
    expect(states[2].diplomacy![1]).toBe("Rival");
    expect(generate).toHaveBeenCalledOnce();
  });
});

describe("selected state", () => {
  test("map and table clicks select the state, which is marked on the map", () => {
    expect(selfId()).toBe("1");
    expect(element("#diplomacyMark path").getAttribute("d")).toBe("M1");
    mapClick(3);
    expect(selfId()).toBe("3");
    expect(element("#diplomacyMark path").getAttribute("d")).toBe("M3");
    element<HTMLElement>('#diplomacyBodySection [data-id="2"] [data-col="name"]').click();
    expect(selfId()).toBe("2");
    mapClick(4);
    mapClick(5);
    expect(selfId()).toBe("2");
  });
});

describe("invalid diplomacy", () => {
  function showInvalidPair(): void {
    states[1].diplomacy![2] = states[2].diplomacy![1] = "x";
    element<HTMLElement>("#diplomacyOverviewRefresh").click();
    element<HTMLElement>("#diplomacyShowMatrix").click();
  }

  test("renders invalid pairs without mutating them", () => {
    showInvalidPair();
    expect(element('[data-id="2"] [data-col="relations"]').textContent).toContain("Invalid");
    expect(document.querySelectorAll("#diplomacyMatrixBody td.x")).toHaveLength(3);
    expect(states[1].diplomacy![2]).toBe("x");
    expect(chronicle()).toEqual([]);
  });

  test("repairs reciprocal vassal relations and refreshes the matrix", async () => {
    showInvalidPair();
    await openEditor("Vassal");
    await paint([2]);
    action("Apply");
    const reloaded = JSON.parse(JSON.stringify(states)) as State[];
    expect(reloaded[2].diplomacy![1]).toBe("Vassal");
    expect(reloaded[1].diplomacy![2]).toBe("Suzerain");
    expect(element('#diplomacyMatrixBody tr[data-id="1"] td:nth-of-type(2)').textContent).toBe("Suzerain");
  });

  test("keeps matrix columns aligned with sparse arrays and removed states", async () => {
    delete states[1].diplomacy![2];
    states[2].diplomacy = undefined;
    element<HTMLElement>("#diplomacyOverviewRefresh").click();
    element<HTMLElement>("#diplomacyShowMatrix").click();
    const row = element('#diplomacyMatrixBody tr[data-id="1"]');
    expect(row.querySelectorAll("td")).toHaveLength(3);
    expect(row.querySelectorAll("td")[2].textContent).toBe("Neutral");
    await openEditor("Suzerain");
    await paint([2]);
    expect(states[2].diplomacy![1]).toBe("Suzerain");
    expect(states[1].diplomacy![2]).toBe("Vassal");
  });
});
