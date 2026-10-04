// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Options } from "@/components/options-model";
import type { Biome } from "@/generators/biomes-generator";
import { Styles } from "@/generators/styles";
import { ReliefPoolEditor } from "./relief-pool-editor";
import "@/components/shared/slider-input";
import Alea from "alea";
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
  vi.stubGlobal("aleaPRNG", Alea);
  document.body.innerHTML = '<div id="dialogs"></div>';
  globalThis.styles = Styles.parse(undefined);
  globalThis.options = Options.getDefaultOptions();
  globalThis.pack = {
    biomes: [
      {},
      { i: 1, name: "Forest", iconsDensity: 120, icons: { deciduous: { weight: 3 }, conifer: { weight: 1 } } }
    ],
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
    expect(biome().icons).toEqual({ deciduous: { weight: 3 }, conifer: { weight: 1 } }); // nothing is written before Apply
  });

  it("writes the edited pool and density on Apply", () => {
    const weight = document.querySelector<HTMLInputElement>('.entry[data-entry="conifer"] .weight')!;
    weight.value = "5";
    weight.dispatchEvent(new Event("change", { bubbles: true }));
    click('.entry[data-entry="deciduous"] .icon-trash-empty');
    document.querySelector<HTMLInputElement>("#reliefPoolEditor slider-input input[type=number]")!.value = "40";

    buttons.Apply();

    expect(biome().icons).toEqual({ conifer: { weight: 5 } });
    expect(biome().iconsDensity).toBe(40);
  });

  it("writes nothing on Cancel", () => {
    click('#reliefPoolEditor .types button[data-entry="grass"]');
    buttons.Cancel();
    expect(biome().icons).toEqual({ deciduous: { weight: 3 }, conifer: { weight: 1 } });
  });

  it("re-places the biome's lowland relief from the applied pool", () => {
    pack.relief = [{ type: "grass", x: 0, y: 0, s: 1 }];
    const regenerate = vi.spyOn(Relief, "regenerate").mockImplementation(() => {
      expect(biome().icons).toEqual({ deciduous: { weight: 3 }, conifer: { weight: 1 }, grass: { weight: 1 } }); // the pool is applied first
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

    expect(rule.icons).toEqual({ hill: { weight: 1 }, vulcan: { weight: 1 } });
    expect(rule.density).toBe(Relief.getDefaultRules()[2].density);
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

    expect(rule.icons).toEqual({ hill: { weight: 1 } });
    expect(save).not.toHaveBeenCalled();
  });

  it("writes nothing to a biome of a map replaced while its pool is open", () => {
    const old = biome();
    pack.biomes = [{}, { ...old, icons: {} }] as typeof pack.biomes;
    click('#reliefPoolEditor .types button[data-entry="grass"]');
    buttons["Apply and re-place"]();

    expect(old.icons).toEqual({ deciduous: { weight: 3 }, conifer: { weight: 1 } });
    expect(biome().icons).toEqual({});
  });

  it("writes an entry's size, leaving it out at 1", () => {
    const size = document.querySelector<HTMLInputElement>('.entry[data-entry="conifer"] .size')!;
    size.value = "1.5";
    size.dispatchEvent(new Event("change", { bubbles: true }));
    buttons.Apply();
    expect(biome().icons).toEqual({ deciduous: { weight: 3 }, conifer: { weight: 1, size: 1.5 } });

    ReliefPoolEditor.open({ biome: 1 });
    const reset = document.querySelector<HTMLInputElement>('.entry[data-entry="conifer"] .size')!;
    reset.value = "1";
    reset.dispatchEvent(new Event("change", { bubbles: true }));
    buttons.Apply();
    expect(biome().icons.conifer).toEqual({ weight: 1 });
  });

  it("writes a rule's size range, dragging a bound moved past the other", () => {
    const rule = options.map.relief.rules[2];
    vi.spyOn(Options, "save").mockImplementation(() => {});
    ReliefPoolEditor.open({ rule });
    const min = document.querySelector<HTMLInputElement>('.ruleSize [data-bound="min"]')!;
    min.value = "20";
    min.dispatchEvent(new Event("change", { bubbles: true }));
    expect(document.querySelector<HTMLInputElement>('.ruleSize [data-bound="max"]')!.value).toBe("20");
    buttons.Apply();
    expect(rule.size).toEqual({ min: 20, max: 20 });
  });

  it("previews the pool, resizing one entry's icons and keeping every placement", () => {
    const uses = () =>
      Array.from(document.querySelectorAll("#reliefPoolEditor .patch use"), use => ({
        href: use.getAttribute("href"),
        cx: Number(use.getAttribute("x")) + Number(use.getAttribute("width")) / 2,
        s: Number(use.getAttribute("width"))
      }));
    const before = uses();
    expect(before.length).toBeGreaterThan(0);

    const size = document.querySelector<HTMLInputElement>('.entry[data-entry="conifer"] .size')!;
    size.value = "2";
    size.dispatchEvent(new Event("input", { bubbles: true }));

    // bigger boxes end lower, so they may draw later, as on the map: compare placements, not drawing order
    const placed = (list: ReturnType<typeof uses>) =>
      list
        .map(use => ({ ...use, cx: Math.round(use.cx) }))
        .sort((a, b) => a.cx - b.cx || a.href!.localeCompare(b.href!));
    const [was, now] = [placed(before), placed(uses())];
    const conifer = (href: string | null) => href?.includes("conifer");
    expect(now.map(({ href, cx }) => ({ href, cx }))).toEqual(was.map(({ href, cx }) => ({ href, cx })));
    for (const [i, use] of now.entries()) {
      expect(use.s).toBeCloseTo(conifer(use.href) ? was[i].s * 2 : was[i].s, 1);
    }
    expect(biome().icons.conifer).toEqual({ weight: 1 }); // a live edit stays in the draft
  });

  it("previews nothing for an empty pool or a zero density", () => {
    const slider = document.querySelector<HTMLInputElement>("#reliefPoolEditor slider-input input[type=number]")!;
    slider.value = "0";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelectorAll("#reliefPoolEditor .patch use")).toHaveLength(0);
    expect(document.querySelector("#reliefPoolEditor .patch .empty")).not.toBeNull();
  });

  it("restores the biome's default pool and density, written on Apply", () => {
    click("#reliefPoolEditor .restore");
    expect(entries()).toEqual([
      ["dune", "3", "30%"],
      ["cactus", "6", "60%"],
      ["deadTree", "1", "10%"]
    ]); // biome 1 is the hot desert on a new map
    expect(biome().icons).toEqual({ deciduous: { weight: 3 }, conifer: { weight: 1 } });

    buttons.Apply();
    expect(biome().icons).toEqual({ dune: { weight: 3 }, cactus: { weight: 6 }, deadTree: { weight: 1 } });
    expect(biome().iconsDensity).toBe(3);
  });

  it("restores a default rule's pool and size, and offers nothing to restore for a rule of the user's own", () => {
    vi.spyOn(Options, "save").mockImplementation(() => {});
    const hills = options.map.relief.rules[2];
    Object.assign(hills, { icons: { dune: { weight: 2, size: 3 } }, density: 40, size: { min: 1, max: 2 } });
    ReliefPoolEditor.open({ rule: hills });
    click("#reliefPoolEditor .restore");
    const { icons, density, size } = Relief.getDefaultRules()[2];
    expect(document.querySelector<HTMLInputElement>('.ruleSize [data-bound="max"]')!.value).toBe(String(size.max));
    buttons.Apply();
    expect(hills).toMatchObject({ icons, density, size });

    ReliefPoolEditor.open({ rule: { ...hills, name: "Desert hills" } });
    expect(document.querySelector("#reliefPoolEditor .restore")).toBeNull();
  });
});
