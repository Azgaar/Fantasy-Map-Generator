// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Province } from "@/generators/provinces-generator";

const mocks = vi.hoisted(() => ({
  bounds: { scale: 1, x0: 0, y0: 0, x1: 100, y1: 100 },
  deferredTimeouts: [] as Array<() => void>,
  deferTimeout: false,
  reconcile: undefined as
    | ((context: {
        root: ParentNode;
        bounds: { scale: number; x0: number; y0: number; x1: number; y1: number };
      }) => void)
    | undefined,
  emblemRenderer: {
    remove: vi.fn((id: string) => document.getElementById(id)?.remove()),
    trigger: vi.fn()
  },
  layerOn: true
}));

vi.mock("@/components/layers", () => ({ Layers: { isOn: () => mocks.layerOn } }));

vi.mock("@/renderers/emblems/renderer", () => ({ EmblemRenderer: mocks.emblemRenderer }));
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
  return {
    ...actual,
    timeout: (callback: () => void) => {
      if (mocks.deferTimeout) mocks.deferredTimeouts.push(callback);
      else callback();
    }
  };
});

import "@/generators/styles";
import { drawEmblems, redrawEmblem, removeEmblem, renderEmblemDefinitions } from "./draw-emblems";

function renderViewport(): void {
  mocks.reconcile?.({ root: document, bounds: mocks.bounds });
}

beforeEach(() => {
  document.body.innerHTML = /* html */ `
    <svg>
      <g id="emblems">
        <g id="burgEmblems" data-size="1"></g>
        <g id="provinceEmblems" data-size="1"></g>
        <g id="stateEmblems" data-size="1"></g>
      </g>
      <g id="coas"></g>
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
    options: { emblems: { showAll: false } },
    EmblemRenderer: mocks.emblemRenderer
  });
  Object.assign(mocks.bounds, { scale: 2, x0: 0, y0: 0, x1: 100, y1: 100 });
  mocks.deferredTimeouts.length = 0;
  mocks.deferTimeout = false;
  mocks.emblemRenderer.remove.mockClear();
  mocks.emblemRenderer.trigger.mockClear();
  mocks.layerOn = true;
});

describe("viewport emblem rendering", () => {
  it("retries a full draw when an emblem is added during the deferred collision pass", () => {
    mocks.deferTimeout = true;
    drawEmblems();

    pack.provinces.push({ i: 1, center: 1, coa: { shield: "heater", t1: "gules" } } as Province);
    redrawEmblem("province", 1);

    mocks.deferredTimeouts.shift()!();
    mocks.deferTimeout = false;
    mocks.deferredTimeouts.shift()!();

    expect(document.querySelector("#provinceEmblems use[data-i='1']")).not.toBeNull();
  });

  it("only materializes and renders definitions for emblems inside the viewport", () => {
    drawEmblems();

    const uses = document.querySelectorAll<SVGUseElement>("#stateEmblems use");
    expect(uses).toHaveLength(1);
    expect(uses[0].dataset.i).toBe("1");
    expect(uses[0].getAttribute("href")).toBe("#stateCOA1");
    expect(mocks.emblemRenderer.trigger).toHaveBeenCalledTimes(1);
    expect(mocks.emblemRenderer.trigger).toHaveBeenCalledWith("stateCOA1", pack.states[1].coa);

    Object.assign(mocks.bounds, { x0: 450, x1: 550 });
    renderViewport();

    const pannedUses = document.querySelectorAll<SVGUseElement>("#stateEmblems use");
    expect(pannedUses).toHaveLength(1);
    expect(pannedUses[0].dataset.i).toBe("2");
    expect(mocks.emblemRenderer.trigger).toHaveBeenCalledTimes(2);
  });

  it("shows out-of-range emblem groups only when showAll is enabled", () => {
    drawEmblems();

    mocks.bounds.scale = 0.1;
    renderViewport();
    expect(document.getElementById("stateEmblems")?.classList).toContain("hidden");
    expect(document.querySelectorAll("#stateEmblems > use")).toHaveLength(0);

    options.emblems.showAll = true;
    renderViewport();
    expect(document.getElementById("stateEmblems")?.classList).not.toContain("hidden");
    expect(document.querySelectorAll("#stateEmblems > use")).toHaveLength(1);
  });

  it("keeps an edited emblem scene and DOM in sync", () => {
    drawEmblems();
    expect(document.querySelector("#stateEmblems use[data-i='1']")).not.toBeNull();

    pack.states[1].coa.size = 0;
    redrawEmblem("state", 1);

    expect(pack.states[1].coa.size).toBe(0);
    expect(document.querySelector("#stateEmblems use[data-i='1']")).toBeNull();
  });

  it("keeps the definition of an emblem hidden by a zero size, as the editors render the same one", () => {
    drawEmblems();

    pack.states[1].coa.size = 0;
    redrawEmblem("state", 1);
    expect(mocks.emblemRenderer.remove).not.toHaveBeenCalled();

    // a later reconcile and a full redraw must not free it either
    renderViewport();
    drawEmblems();
    expect(mocks.emblemRenderer.remove).not.toHaveBeenCalled();

    pack.states[1].coa.size = 1;
    redrawEmblem("state", 1);
    expect(document.querySelector("#stateEmblems use[data-i='1']")).not.toBeNull();
  });

  it("frees the definition once the entity itself loses its coat of arms", () => {
    drawEmblems();

    pack.states[1] = { i: 1, removed: true } as unknown as (typeof pack.states)[number];
    renderViewport();

    expect(mocks.emblemRenderer.remove).toHaveBeenCalledWith("stateCOA1");
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
    renderViewport();

    expect(document.querySelector("#stateEmblems use[data-i='1']")).toBeNull();
  });

  it("removes definitions for invalid entities during reconciliation", () => {
    document.querySelector("#coas")!.innerHTML = '<g id="stateCOA1"></g><g id="provinceCOA1"></g>';
    pack.provinces.push({ i: 1, center: 1, coa: { shield: "heater", t1: "gules" } } as Province);
    drawEmblems();

    pack.states[1] = { i: 1, removed: true } as (typeof pack.states)[number];
    pack.provinces[1] = { i: 1, removed: true } as Province;
    renderViewport();

    expect(document.getElementById("stateCOA1")).toBeNull();
    expect(document.getElementById("provinceCOA1")).toBeNull();
  });

  it("frees the shields panning left behind, sparing the ones still on screen", () => {
    drawEmblems();
    const coas = document.getElementById("coas")!;
    // shields rendered for emblems the view has since left behind, plus the two that are still referenced
    for (let i = 0; i < 250; i++) coas.insertAdjacentHTML("beforeend", `<g id="burgCOA${i}"></g>`);
    coas.insertAdjacentHTML("beforeend", '<g id="stateCOA1"></g><g id="stateCOA2"></g>');
    // stateCOA2 sits outside the viewport, so only an open dialog keeps it alive
    document.body.insertAdjacentHTML("beforeend", '<svg id="dialog"><use href="#stateCOA2"></use></svg>');

    renderViewport();

    expect(document.getElementById("stateCOA1")).not.toBeNull(); // the map shows it
    expect(document.getElementById("stateCOA2")).not.toBeNull(); // the dialog shows it
    expect(coas.children).toHaveLength(2);
  });

  it("keeps the shields on hand while the view is showing them", () => {
    drawEmblems();
    const coas = document.getElementById("coas")!;
    for (let i = 0; i < 250; i++) {
      coas.insertAdjacentHTML("beforeend", `<g id="burgCOA${i}"></g>`);
      document.getElementById("burgEmblems")!.insertAdjacentHTML("beforeend", `<use href="#burgCOA${i}"></use>`);
    }

    renderViewport();

    expect(coas.children).toHaveLength(250);
  });

  it("removes definitions for entities omitted by a full redraw", () => {
    document.querySelector("#coas")!.innerHTML = '<g id="stateCOA1"></g><g id="stateCOA2"></g>';
    drawEmblems();
    expect(document.getElementById("stateCOA1")).not.toBeNull();

    pack.states[1] = { i: 1, removed: true } as (typeof pack.states)[number];
    drawEmblems();

    expect(document.getElementById("stateCOA1")).toBeNull();
    expect(document.getElementById("stateCOA2")).not.toBeNull();
  });

  it("removes an emblem from the viewport scene through the renderer API", () => {
    drawEmblems();

    removeEmblem("state", 1);
    renderViewport();

    expect(document.querySelector("#stateEmblems use[data-i='1']")).toBeNull();
  });

  it("resolves export definitions from pack data when a viewport scene is not ready", async () => {
    pack.states.push({ i: 3, center: 1, coa: { shield: "heater", t1: "gules" } } as (typeof pack.states)[number]);
    document.querySelector("#stateEmblems")!.insertAdjacentHTML("beforeend", '<use data-i="3" />');

    await renderEmblemDefinitions(document);

    expect(mocks.emblemRenderer.trigger).toHaveBeenCalledWith("stateCOA3", pack.states[3].coa);
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
    renderViewport();
    Object.assign(mocks.bounds, { x0: 0, x1: 200 });
    renderViewport();

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

  it("updates an emblem when its pole changes without replacing the COA", () => {
    drawEmblems();

    pack.states[1].pole = [75, 75];
    renderViewport();

    const use = document.querySelector<SVGUseElement>("#stateEmblems use[data-i='1']")!;
    const fontSize = Number(document.querySelector("#stateEmblems")!.getAttribute("font-size"));
    expect(Number(use.getAttribute("x")) + fontSize / 2).toBe(75);
    expect(Number(use.getAttribute("y")) + fontSize / 2).toBe(75);
  });

  it("persists an edited size on the COA across viewport rematerialization", () => {
    drawEmblems();

    pack.states[1].coa.size = 2.5;
    redrawEmblem("state", 1);

    expect(pack.states[1].coa.size).toBe(2.5);
    expect(document.querySelector("#stateEmblems use[data-i='1']")?.getAttribute("width")).toBe("2.5em");

    Object.assign(mocks.bounds, { x0: 700, x1: 800 });
    renderViewport();
    Object.assign(mocks.bounds, { x0: 0, x1: 100 });
    renderViewport();

    expect(document.querySelector("#stateEmblems use[data-i='1']")?.getAttribute("width")).toBe("2.5em");
  });
  it("does not rematerialize emblems while the layer is off", () => {
    drawEmblems();
    expect(document.querySelectorAll("#stateEmblems > use")).toHaveLength(1);

    // Layers.hide clears the declared parent groups before the next viewport render
    document.getElementById("stateEmblems")!.replaceChildren();
    mocks.layerOn = false;
    renderViewport();

    expect(document.querySelectorAll("#stateEmblems > use")).toHaveLength(0);

    mocks.layerOn = true;
    renderViewport();
    expect(document.querySelectorAll("#stateEmblems > use")).toHaveLength(1);
  });
});
