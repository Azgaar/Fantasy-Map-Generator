// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Options } from "@/components/options-model";
import { Styles } from "@/generators/styles";
import { ReliefRulesEditor } from "./relief-rules-editor";
import "@/generators/relief-generator"; // installs the Relief global

vi.mock("@/components/icons", () => ({
  Icons: {
    html: (id: string) => `<svg data-icon="${id}"></svg>`,
    href: (id: string) => `#${id}`,
    name: (id: string) => id,
    retry: vi.fn().mockResolvedValue(undefined),
    formatFrame: (frame: number[]) => frame.join(" ")
  }
}));
vi.mock("@/controllers/relief-pool-editor", async importOriginal => ({
  ...(await importOriginal<typeof import("@/controllers/relief-pool-editor")>()),
  ReliefPoolEditor: { open: vi.fn() }
}));
const limitation = vi.hoisted(() => ({ allowed: [] as number[] }));
vi.mock("@/components/dialog/limitation-picker", () => ({
  limitationTip: () => "",
  pickLimitation: ({ onApply }: { onApply: (allowed: number[]) => void }) => onApply(limitation.allowed)
}));
vi.mock("@/components/layers", () => ({ Layers: { isOn: () => true, show: vi.fn() } }));
vi.mock("@/renderers/draw-relief-icons", () => ({ redrawRelief: vi.fn() }));
vi.mock("@/components/dialog/dialog-helpers", async importOriginal => ({
  ...(await importOriginal<typeof import("@/components/dialog/dialog-helpers")>()),
  confirmationDialog: ({ onConfirm }: { onConfirm: () => void }) => onConfirm()
}));

const click = (element: Element) => element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
let dragged: () => void = () => {};
const names = () =>
  Array.from(
    document.querySelectorAll<HTMLInputElement>('#reliefRulesEditor [data-field="name"]'),
    input => input.value
  );
const row = (index: number) =>
  document.querySelector<HTMLElement>(`#reliefRulesEditor .states[data-index="${index}"]`)!;
const press = (action: "Add" | "Restore" | "Replace") => click(document.getElementById(`reliefRulesEditor${action}`)!);
const edit = (index: number, field: string, value: string) => {
  const input = row(index).querySelector<HTMLInputElement>(`[data-field="${field}"]`)!;
  input.value = value;
  input.dispatchEvent(new Event("change", { bubbles: true }));
};

Object.assign(SVGElement.prototype, { getBBox: () => ({ x: 0, y: 0, width: 0, height: 0 }) });

beforeEach(() => {
  document.body.innerHTML = '<div id="dialogs"></div>';
  globalThis.styles = Styles.parse(undefined);
  globalThis.options = Options.getDefaultOptions();
  globalThis.pack = { biomes: [] } as unknown as typeof pack;
  window.$ = vi.fn(() => ({
    dialog: vi.fn(),
    one: vi.fn(),
    sortable: ({ update }: { update: () => void }) => {
      dragged = update;
    }
  })) as unknown as typeof window.$;
  ReliefRulesEditor.open();
});

describe("ReliefRulesEditor", () => {
  it("lists the rules in the order they are checked", () => {
    expect(names()).toEqual(["Snowy mountains", "Mountains", "Hills"]);
  });

  it("writes edited bounds, an empty temperature bound as open", () => {
    edit(2, "height.min", "45");
    edit(0, "temperature.max", "");
    edit(1, "size.max", "30");
    edit(2, "height.max", "5"); // below land: clamped

    const [snowy, mountains, hills] = options.map.relief.rules;
    expect(hills.height).toEqual({ min: 45, max: 20 });
    expect(snowy.temperature).toEqual({ min: null, max: null });
    expect(mountains.size.max).toBe(30);
  });

  it("limits a rule to the picked biomes, and lifts the limit when all are picked", () => {
    const biomes = () => row(2).querySelector(".ruleBiomes")!;
    limitation.allowed = [4, 9];
    click(biomes());
    expect(options.map.relief.rules[2].biomes).toEqual([4, 9]);
    expect(biomes().textContent).toBe("2 biomes");

    limitation.allowed = [];
    click(biomes());
    expect(options.map.relief.rules[2]).not.toHaveProperty("biomes");
    expect(biomes().textContent).toBe("all");
  });

  it("reorders, removes and adds rules", () => {
    row(1).after(row(0)); // dragged below
    dragged();
    expect(names()).toEqual(["Mountains", "Snowy mountains", "Hills"]);

    click(row(0).querySelector(".icon-trash-empty")!);
    press("Add");
    expect(names()).toEqual(["Snowy mountains", "Hills", "New rule"]);

    press("Restore");
    expect(options.map.relief.rules).toEqual(Relief.getDefaultRules());
  });

  it("re-places only the cells whose rule changed what it places", () => {
    globalThis.grid = { cells: { temp: [10, 10, 10] } } as unknown as typeof grid;
    globalThis.pack = {
      cells: { i: [0, 1, 2], h: [80, 60, 30], g: [0, 1, 2], biome: [9, 4, 4] },
      biomes: [],
      relief: [{}]
    } as unknown as typeof pack;
    const regenerate = vi.spyOn(Relief, "regenerate").mockImplementation(() => {});
    vi.spyOn(Relief, "iconsOn").mockReturnValue([]);

    edit(1, "name", "Peaks"); // a rename places nothing new
    edit(2, "size.max", "20"); // the hills

    const pending = () => document.getElementById("reliefRulesEditorPending")!.style.display;
    expect(pending()).toBe("");
    press("Replace");
    expect(pending()).toBe("none");
    const covers = regenerate.mock.calls[0][0];
    expect([0, 1, 2].map(covers)).toEqual([false, true, false]);

    press("Replace"); // the map now follows the rules
    expect([0, 1, 2].map(regenerate.mock.calls[1][0])).toEqual([false, false, false]);
  });
});
