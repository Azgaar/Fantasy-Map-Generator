// @vitest-environment jsdom
// The registry is tested against fake layers: ordering, activation and restore are guaranteed without a real map.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LayersState, Layer as LayerType } from "./layers-registry";

type Registry = typeof import("./layers-registry").Layers;
type LayerCtor = typeof import("./layers-registry").Layer;

let Layers: Registry;
let Layer: LayerCtor;

/** the registry is a singleton, so each test gets a freshly evaluated module and a fresh svg fixture */
beforeEach(async () => {
  document.body.innerHTML = /* html */ `<svg id="map"><g id="viewbox"></g></svg>`;
  vi.resetModules();
  ({ Layers, Layer } = await import("./layers-registry"));
});

const groupIds = (parent = "viewbox") => Array.from(document.getElementById(parent)!.children, node => node.id);
const displayOf = (elementId: string) => document.getElementById(elementId)!.style.display;

describe("init", () => {
  it("creates missing groups in registration order", () => {
    Layers.register(
      new Layer({ id: "a", element: "a-el", parent: "viewbox" }),
      new Layer({ id: "b", element: "b-el", parent: "viewbox" })
    );
    Layers.init();

    expect(groupIds()).toEqual(["a-el", "b-el"]);
  });

  it("adopts an existing group and reorders it to match registration order", () => {
    document.getElementById("viewbox")!.innerHTML = /* html */ `<g id="b-el"><circle id="kept" /></g>`;
    Layers.register(
      new Layer({ id: "a", element: "a-el", parent: "viewbox" }),
      new Layer({ id: "b", element: "b-el", parent: "viewbox" })
    );
    Layers.init();

    expect(groupIds()).toEqual(["a-el", "b-el"]);
    expect(document.getElementById("kept")).not.toBeNull(); // adopted, not recreated
  });

  it("creates declared children and applies attrs, appending to the declared parent", () => {
    Layers.register(
      new Layer({
        id: "a",
        element: "a-el",
        parent: "map",
        children: ["one", "two"],
        attrs: { mask: "url(#m)" }
      })
    );
    Layers.init();

    const group = document.getElementById("a-el")!;
    expect(group.parentElement!.id).toBe("map");
    expect(group.getAttribute("mask")).toBe("url(#m)");
    expect(Array.from(group.children, node => node.id)).toEqual(["one", "two"]);
  });

  it("hides layers that are off and leaves alwaysOn layers visible without a style attribute", () => {
    Layers.register(
      new Layer({ id: "a", element: "a-el", parent: "viewbox" }),
      new Layer({ id: "b", element: "b-el", parent: "viewbox", alwaysOn: true })
    );
    Layers.init();

    expect(displayOf("a-el")).toBe("none");
    expect(document.getElementById("b-el")!.hasAttribute("style")).toBe(false);
  });
});

describe("show and hide", () => {
  const setup = () => {
    const draw = vi.fn();
    const erase = vi.fn();
    const layer = new Layer({ id: "a", element: "a-el", parent: "viewbox", draw, erase });
    Layers.register(layer);
    Layers.init();
    return { layer, draw, erase };
  };

  it("turns the layer on, draws it once and makes it visible", () => {
    const { layer, draw } = setup();
    Layers.show(layer);

    expect(layer.isOn).toBe(true);
    expect(displayOf("a-el")).toBe("");
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it("turns the layer off, erases it once and hides it", () => {
    const { layer, draw, erase } = setup();
    Layers.show(layer);
    draw.mockClear();
    Layers.hide(layer);

    expect(layer.isOn).toBe(false);
    expect(displayOf("a-el")).toBe("none");
    expect(erase).toHaveBeenCalledTimes(1);
  });

  it("does not erase a layer that is already off", () => {
    const { layer, erase } = setup();
    Layers.hide(layer);

    expect(erase).not.toHaveBeenCalled();
  });

  it("redraws a layer that is already on without erasing it", () => {
    const { layer, draw, erase } = setup();
    Layers.show(layer);
    Layers.show(layer);

    expect(draw).toHaveBeenCalledTimes(2);
    expect(erase).not.toHaveBeenCalled();
  });

  it("toggles between the two states", () => {
    const { layer } = setup();
    Layers.toggle(layer);
    expect(layer.isOn).toBe(true);
    Layers.toggle(layer);
    expect(layer.isOn).toBe(false);
  });
});

describe("erase", () => {
  it("clears declared children and removes everything else by default", () => {
    const layer = new Layer({ id: "a", element: "a-el", parent: "viewbox", children: ["kept"] });
    Layers.register(layer);
    Layers.init();
    Layers.show(layer);
    document.getElementById("kept")!.innerHTML = /* html */ `<circle />`;
    document.getElementById("a-el")!.insertAdjacentHTML("beforeend", /* html */ `<g id="dropped"></g>`);

    Layers.hide(layer);

    expect(Array.from(document.getElementById("a-el")!.children, node => node.id)).toEqual(["kept"]);
    expect(document.getElementById("kept")!.children.length).toBe(0);
  });

  it("keeps the content when keepContent is set", () => {
    const layer = new Layer({ id: "a", element: "a-el", parent: "viewbox", keepContent: true });
    Layers.register(layer);
    Layers.init();
    Layers.show(layer);
    document.getElementById("a-el")!.innerHTML = /* html */ `<circle id="kept" />`;

    Layers.hide(layer);

    expect(document.getElementById("kept")).not.toBeNull();
    expect(displayOf("a-el")).toBe("none");
  });
});

describe("draw", () => {
  const setup = () => {
    const calls: string[] = [];
    const make = (id: string) =>
      new Layer({ id, element: `${id}-el`, parent: "viewbox", draw: () => void calls.push(id) });
    const [a, b, c] = [make("a"), make("b"), make("c")];
    Layers.register(a, b, c);
    Layers.init();
    return { a, b, c, calls };
  };

  it("invokes callbacks in registration order regardless of argument order", () => {
    const { a, b, calls } = setup();
    Layers.show(a, b);
    calls.length = 0;

    Layers.draw(b, a);

    expect(calls).toEqual(["a", "b"]);
  });

  it("skips layers that are off", () => {
    const { a, b, c, calls } = setup();
    Layers.show(a, c);
    calls.length = 0;

    Layers.draw(a, b, c);

    expect(calls).toEqual(["a", "c"]);
  });

  it("drawAll draws every active layer in order", () => {
    const { a, c, calls } = setup();
    Layers.show(a, c);
    calls.length = 0;

    Layers.drawAll();

    expect(calls).toEqual(["a", "c"]);
  });
});

describe("setActive", () => {
  it("turns on the listed layers, turns off the rest and preserves alwaysOn layers", () => {
    const a = new Layer({ id: "a", element: "a-el", parent: "viewbox" });
    const b = new Layer({ id: "b", element: "b-el", parent: "viewbox" });
    const structural = new Layer({ id: "s", element: "s-el", parent: "viewbox", alwaysOn: true });
    Layers.register(a, b, structural);
    Layers.init();
    Layers.show(a);

    Layers.setActive([b]);

    expect([a.isOn, b.isOn, structural.isOn]).toEqual([false, true, true]);
    expect(Layers.state.active).toEqual(["b"]); // alwaysOn layers are structural, not saved state
  });

  it("draws only the layers that were off", () => {
    const draws: string[] = [];
    const make = (id: string) =>
      new Layer({ id, element: `${id}-el`, parent: "viewbox", draw: () => void draws.push(id) });
    const [a, b] = [make("a"), make("b")];
    Layers.register(a, b);
    Layers.init();
    Layers.show(a);
    draws.length = 0;

    Layers.setActive([a, b]);

    expect(draws).toEqual(["b"]);
  });
});

describe("move", () => {
  const register = () => {
    const layers = ["a", "b", "c"].map(id => new Layer({ id, element: `${id}-el`, parent: "viewbox" }));
    Layers.register(...layers);
    Layers.init();
    return layers as [LayerType, LayerType, LayerType];
  };

  it("reorders the registry and the svg together", () => {
    const [a, , c] = register();
    Layers.move(c, a); // c before a

    expect(Layers.all.map(layer => layer.id)).toEqual(["c", "a", "b"]);
    expect(groupIds()).toEqual(["c-el", "a-el", "b-el"]);
  });

  it("moves the layer to the end when no successor is given", () => {
    const [a] = register();
    Layers.move(a);

    expect(Layers.all.map(layer => layer.id)).toEqual(["b", "c", "a"]);
    expect(groupIds()).toEqual(["b-el", "c-el", "a-el"]);
  });
});

describe("restore", () => {
  const register = (ids = ["a", "b", "c"]) => {
    const draw = vi.fn();
    const erase = vi.fn();
    const layers = ids.map(id => new Layer({ id, element: `${id}-el`, parent: "viewbox", draw, erase }));
    Layers.register(...layers);
    Layers.init();
    return { layers, draw, erase };
  };

  it("applies order and active state without drawing or erasing", () => {
    const { draw, erase } = register();
    Layers.show(Layers.get("a")!);
    draw.mockClear();

    Layers.restore({ order: ["c", "b", "a"], active: ["b"] });

    expect(Layers.all.map(layer => layer.id)).toEqual(["c", "b", "a"]);
    expect(groupIds()).toEqual(["c-el", "b-el", "a-el"]);
    expect(Layers.state.active).toEqual(["b"]);
    expect(displayOf("a-el")).toBe("none");
    expect(draw).not.toHaveBeenCalled();
    expect(erase).not.toHaveBeenCalled();
  });

  it("ignores ids the build does not know", () => {
    register();
    Layers.restore({ order: ["gone", "c", "a", "b"], active: ["c", "missing"] });

    expect(Layers.all.map(layer => layer.id)).toEqual(["c", "a", "b"]);
    expect(Layers.state.active).toEqual(["c"]);
  });

  it("slots layers the saved order lacks after their registration-order predecessor", () => {
    register(["a", "b", "c", "d"]);
    Layers.restore({ order: ["d", "a"], active: [] }); // b and c are unknown to the saved order

    // b and c follow a, the layer they were registered after
    expect(Layers.all.map(layer => layer.id)).toEqual(["d", "a", "b", "c"]);
    expect(groupIds()).toEqual(["d-el", "a-el", "b-el", "c-el"]);
  });

  it("round-trips the state produced by the registry", () => {
    register();
    Layers.show(Layers.get("a")!, Layers.get("c")!);
    Layers.move(Layers.get("c")!, Layers.get("a")!);
    const saved: LayersState = JSON.parse(JSON.stringify(Layers.state));

    Layers.restore(saved);

    expect(Layers.state).toEqual(saved);
  });
});

describe("subscribe", () => {
  it("notifies once per operation and stops after unsubscribing", () => {
    const layer = new Layer({ id: "a", element: "a-el", parent: "viewbox" });
    Layers.register(layer);
    Layers.init();

    const listener = vi.fn();
    const unsubscribe = Layers.subscribe(listener);

    Layers.show(layer);
    expect(listener).toHaveBeenCalledTimes(1);

    Layers.hide(layer);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    Layers.show(layer);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
