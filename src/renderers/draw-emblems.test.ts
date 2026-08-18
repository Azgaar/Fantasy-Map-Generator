// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Province } from "@/generators/provinces-generator";

const mocks = vi.hoisted(() => ({
  bounds: { scale: 1, x0: 0, y0: 0, x1: 100, y1: 100 },
  reconcile: undefined as
    | ((context: {
        root: ParentNode;
        bounds: { scale: number; x0: number; y0: number; x1: number; y1: number };
      }) => void)
    | undefined,
  isOn: vi.fn(() => true)
}));

vi.mock("@/components/layers", () => ({ Layers: { isOn: mocks.isOn } }));
vi.mock("@/renderers/viewport/viewport-renderer", async importOriginal => {
  const actual = await importOriginal<typeof import("@/renderers/viewport/viewport-renderer")>();
  return {
    ...actual,
    ViewportLayers: {
      register: ({ render }: { render: typeof mocks.reconcile }) => {
        mocks.reconcile = render;
        return {
          render: () => render?.({ root: document, bounds: mocks.bounds }),
          unregister: vi.fn()
        };
      }
    }
  };
});
vi.mock("d3", async importOriginal => {
  const actual = await importOriginal<typeof import("d3")>();
  return { ...actual, timeout: (callback: () => void) => void callback() };
});

import { drawEmblems, redrawEmblem, removeEmblem, renderEmblems } from "./draw-emblems";

beforeEach(() => {
  document.body.innerHTML = /* html */ `
    <input id="hideEmblems" type="checkbox" />
    <svg>
      <g id="emblems">
        <g id="burgEmblems" data-size="1"></g>
        <g id="provinceEmblems" data-size="1"></g>
        <g id="stateEmblems" data-size="1"></g>
      </g>
    </svg>
  `;

  Object.assign(globalThis, {
    TIME: false,
    graphWidth: 1000,
    graphHeight: 500,
    pack: {
      cells: {
        p: [
          [0, 0],
          [50, 50],
          [500, 50]
        ]
      },
      burgs: [{ i: 0 }],
      provinces: [{ i: 0 }],
      states: [
        { i: 0 },
        { i: 1, center: 1, coa: { shield: "heater", t1: "gules" } },
        { i: 2, center: 2, coa: { shield: "heater", t1: "azure" } }
      ]
    },
    EmblemRenderer: { remove: vi.fn(), trigger: vi.fn() }
  });
  Object.assign(mocks.bounds, { scale: 1, x0: 0, y0: 0, x1: 100, y1: 100 });
  mocks.isOn.mockReturnValue(true);
});

describe("viewport emblem rendering", () => {
  it("only materializes and renders definitions for emblems inside the viewport", () => {
    drawEmblems();

    const uses = document.querySelectorAll<SVGUseElement>("#stateEmblems use");
    expect(uses).toHaveLength(1);
    expect(uses[0].dataset.i).toBe("1");
    expect(uses[0].getAttribute("href")).toBe("#stateCOA1");
    expect(EmblemRenderer.trigger).toHaveBeenCalledTimes(1);
    expect(EmblemRenderer.trigger).toHaveBeenCalledWith("stateCOA1", pack.states[1].coa);

    Object.assign(mocks.bounds, { x0: 450, x1: 550 });
    renderEmblems();

    const pannedUses = document.querySelectorAll<SVGUseElement>("#stateEmblems use");
    expect(pannedUses).toHaveLength(1);
    expect(pannedUses[0].dataset.i).toBe("2");
    expect(EmblemRenderer.trigger).toHaveBeenCalledTimes(2);
  });

  it("keeps an edited emblem scene and DOM in sync", () => {
    drawEmblems();
    expect(document.querySelector("#stateEmblems use[data-i='1']")).not.toBeNull();

    pack.states[1].coa.size = 0;
    redrawEmblem("state", 1);

    expect(pack.states[1].coa.size).toBe(0);
    expect(document.querySelector("#stateEmblems use[data-i='1']")).toBeNull();
  });

  it("materializes an emblem added after the scene was built", () => {
    drawEmblems();

    pack.provinces.push({ i: 1, center: 1, coa: { shield: "heater", t1: "gules" } } as Province);
    redrawEmblem("province", 1);

    expect(document.querySelector("#provinceEmblems use[data-i='1']")).not.toBeNull();
  });

  it("removes a province emblem when the province is removed", () => {
    pack.provinces.push({ i: 1, center: 1, coa: { shield: "heater", t1: "gules" } } as Province);
    drawEmblems();
    expect(document.querySelector("#provinceEmblems use[data-i='1']")).not.toBeNull();

    pack.provinces[1] = { i: 1, removed: true } as Province;
    removeEmblem("province", 1);

    expect(document.querySelector("#provinceEmblems use[data-i='1']")).toBeNull();
  });

  it("does not rematerialize an entity removed after the scene was built", () => {
    drawEmblems();
    expect(document.querySelector("#stateEmblems use[data-i='1']")).not.toBeNull();

    pack.states[1] = { i: 1, removed: true } as (typeof pack.states)[number];
    document.querySelector("#stateEmblems use[data-i='1']")?.remove();
    renderEmblems();

    expect(document.querySelector("#stateEmblems use[data-i='1']")).toBeNull();
  });

  it("removes an emblem from the viewport scene through the renderer API", () => {
    drawEmblems();

    removeEmblem("state", 1);
    renderEmblems();

    expect(document.querySelector("#stateEmblems use[data-i='1']")).toBeNull();
  });

  it("persists the moved position on the COA belonging to the dragged use", () => {
    Object.assign(mocks.bounds, { x1: 600 });
    drawEmblems();
    const use = document.querySelector<SVGUseElement>("#stateEmblems use[data-i='2']")!;

    pack.states[2].coa.x = 125;
    pack.states[2].coa.y = 75;
    redrawEmblem("state", Number(use.dataset.i));

    expect(pack.states[1].coa.x).toBeUndefined();
    expect(pack.states[2].coa).toMatchObject({ x: 125, y: 75 });

    Object.assign(mocks.bounds, { x0: 700, x1: 800 });
    renderEmblems();
    Object.assign(mocks.bounds, { x0: 0, x1: 200 });
    renderEmblems();

    const restored = document.querySelector<SVGUseElement>("#stateEmblems use[data-i='2']")!;
    const fontSize = Number(document.querySelector("#stateEmblems")!.getAttribute("font-size"));
    expect(Number(restored.getAttribute("x")) + fontSize / 2).toBe(125);
    expect(Number(restored.getAttribute("y")) + fontSize / 2).toBe(75);
  });

  it("keeps a manually positioned emblem fixed during a full layer redraw", () => {
    pack.states[1].coa.x = 50;
    pack.states[1].coa.y = 50;
    pack.cells.p[2] = [50, 50];

    drawEmblems();

    const restored = document.querySelector<SVGUseElement>("#stateEmblems use[data-i='1']")!;
    const fontSize = Number(document.querySelector("#stateEmblems")!.getAttribute("font-size"));
    expect(Number(restored.getAttribute("x")) + fontSize / 2).toBe(50);
    expect(Number(restored.getAttribute("y")) + fontSize / 2).toBe(50);
  });

  it("persists an edited size on the COA across viewport rematerialization", () => {
    drawEmblems();

    pack.states[1].coa.size = 2.5;
    redrawEmblem("state", 1);

    expect(pack.states[1].coa.size).toBe(2.5);
    expect(document.querySelector("#stateEmblems use[data-i='1']")?.getAttribute("width")).toBe("2.5em");

    Object.assign(mocks.bounds, { x0: 700, x1: 800 });
    renderEmblems();
    Object.assign(mocks.bounds, { x0: 0, x1: 100 });
    renderEmblems();

    expect(document.querySelector("#stateEmblems use[data-i='1']")?.getAttribute("width")).toBe("2.5em");
  });
});
