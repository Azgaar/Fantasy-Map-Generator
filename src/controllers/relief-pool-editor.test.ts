// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Options } from "@/components/options-model";
import type { Biome } from "@/generators/biomes-generator";
import { Styles } from "@/generators/styles";
import { ReliefPoolEditor } from "./relief-pool-editor";
import "@/components/shared/slider-input";
import "@/generators/relief-generator"; // installs the Relief global

const picked = vi.hoisted(() => ({ id: "" }));
vi.mock("@/components/icons", () => ({
  Icons: {
    html: (id: string) => `<svg data-icon="${id}"></svg>`,
    href: (id: string) => `#${id}`,
    paintAttributes: () => "",
    name: (id: string) => id,
    retry: vi.fn().mockResolvedValue(undefined),
    formatFrame: (frame: number[]) => frame.join(" ")
  }
}));
vi.mock("@/controllers", () => ({
  Controllers: { IconPicker: { open: ({ onPick }: { onPick: (id: string) => void }) => onPick(picked.id) } }
}));
vi.mock("@/components/tooltips", () => ({ tip: vi.fn() }));
vi.mock("@/components/layers", () => ({ Layers: { isOn: () => true, show: vi.fn() } }));
vi.mock("@/renderers/draw-relief-icons", () => ({ redrawRelief: vi.fn() }));
vi.mock("@/components/dialog/dialog-helpers", async importOriginal => ({
  ...(await importOriginal<typeof import("@/components/dialog/dialog-helpers")>()),
  confirmationDialog: ({ onConfirm }: { onConfirm: () => void }) => onConfirm()
}));

type Buttons = Record<string, () => void>;
let buttons: Buttons = {};
const biome = (): Biome => pack.biomes[1];
const entries = () =>
  Array.from(document.querySelectorAll<HTMLElement>("#reliefPoolEditor .entry"), entry => [
    entry.dataset.entry,
    entry.querySelector<HTMLInputElement>(".weight")!.value,
    entry.querySelector(".share")!.textContent
  ]);
const click = (selector: string) =>
  document.querySelector(selector)!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

// jsdom lays nothing out: the previews keep their frames
Object.assign(SVGElement.prototype, { getBBox: () => ({ x: 0, y: 0, width: 0, height: 0 }) });

beforeEach(() => {
  document.body.innerHTML = '<div id="dialogs"></div>';
  globalThis.styles = Styles.parse(undefined);
  globalThis.options = Options.getDefaultOptions();
  globalThis.pack = {
    biomes: [{}, { i: 1, name: "Forest", iconsDensity: 120, icons: { deciduous: 3, conifer: 1 } }],
    relief: []
  } as unknown as typeof pack;
  window.$ = vi.fn(() => ({
    dialog: (options: unknown) => {
      if (typeof options === "object") buttons = (options as { buttons: Buttons }).buttons;
    }
  })) as unknown as typeof window.$;
  ReliefPoolEditor.open({ biome: 1 });
});

describe("ReliefPoolEditor", () => {
  it("lists the pool's entries with their weights and shares", () => {
    expect(entries()).toEqual([
      ["deciduous", "3", "75%"],
      ["conifer", "1", "25%"]
    ]);
  });

  it("adds a type, raises the weight of one already there, and adds a picked icon as a reference", () => {
    click('#reliefPoolEditor .types button[data-entry="grass"]');
    click('#reliefPoolEditor .types button[data-entry="conifer"]');
    picked.id = "custom-a";
    click("#reliefPoolEditor .any");

    expect(entries().map(([entry, weight]) => [entry, weight])).toEqual([
      ["deciduous", "3"],
      ["conifer", "2"],
      ["grass", "1"],
      ["custom-a", "1"]
    ]);
    expect(biome().icons).toEqual({ deciduous: 3, conifer: 1 }); // nothing is written before Apply
  });

  it("writes the edited pool and density on Apply", () => {
    const weight = document.querySelector<HTMLInputElement>('.entry[data-entry="conifer"] .weight')!;
    weight.value = "5";
    weight.dispatchEvent(new Event("change", { bubbles: true }));
    click('.entry[data-entry="deciduous"] .icon-trash-empty');
    document.querySelector<HTMLInputElement>("#reliefPoolEditor slider-input input[type=number]")!.value = "40";

    buttons.Apply();

    expect(biome().icons).toEqual({ conifer: 5 });
    expect(biome().iconsDensity).toBe(40);
  });

  it("writes nothing on Cancel", () => {
    click('#reliefPoolEditor .types button[data-entry="grass"]');
    buttons.Cancel();
    expect(biome().icons).toEqual({ deciduous: 3, conifer: 1 });
  });

  it("re-places the biome's lowland relief from the applied pool", () => {
    pack.relief = [{ type: "grass", x: 0, y: 0, s: 1 }];
    const regenerate = vi.spyOn(Relief, "regenerate").mockImplementation(() => {
      expect(biome().icons).toEqual({ deciduous: 3, conifer: 1, grass: 1 }); // the pool is applied first
    });
    vi.spyOn(Relief, "iconsOn").mockReturnValue([]);
    const isPoolCell = vi.spyOn(Relief, "isPoolCell").mockReturnValue(true);
    click('#reliefPoolEditor .types button[data-entry="grass"]');

    buttons["Apply and re-place"]();

    expect(regenerate).toHaveBeenCalledOnce();
    regenerate.mock.calls[0][0](7);
    expect(isPoolCell).toHaveBeenCalledWith(7, 1); // the biome's own cells
  });

  it("edits a relief rule's pool and density in place", () => {
    const rule = options.map.relief.rules[2];
    const save = vi.spyOn(Options, "save").mockImplementation(() => {});
    ReliefPoolEditor.open({ rule });
    click('#reliefPoolEditor .types button[data-entry="vulcan"]');
    buttons.Apply();

    expect(rule.icons).toEqual({ hill: 1, vulcan: 1 });
    expect(rule.density).toBe(100);
    expect(save).toHaveBeenCalled();
  });

  it("writes nothing to a rule removed while its pool is open", () => {
    const rule = options.map.relief.rules[2];
    const save = vi.spyOn(Options, "save").mockImplementation(() => {});
    save.mockClear();
    ReliefPoolEditor.open({ rule });
    options.map.relief.rules = options.map.relief.rules.filter(other => other !== rule);
    click('#reliefPoolEditor .types button[data-entry="vulcan"]');
    buttons.Apply();

    expect(rule.icons).toEqual({ hill: 1 });
    expect(save).not.toHaveBeenCalled();
  });

  it("writes nothing to a biome of a map replaced while its pool is open", () => {
    const old = biome();
    pack.biomes = [{}, { ...old, icons: {} }] as typeof pack.biomes;
    click('#reliefPoolEditor .types button[data-entry="grass"]');
    buttons["Apply and re-place"]();

    expect(old.icons).toEqual({ deciduous: 3, conifer: 1 });
    expect(biome().icons).toEqual({});
  });
});
