// @vitest-environment jsdom
// The registry is tested against fake layers: ordering, activation and restore are guaranteed without a real map.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Layer, LayersRegistry, type LayersState, Layers as MapLayers } from "./layers";

let Layers: LayersRegistry;

beforeEach(() => {
  document.body.innerHTML = /* html */ `<svg id="map"><g id="viewbox"></g></svg>`;
});

/** the registry takes its layers up front, so each test builds the one it needs */
const registry = (...layers: Layer[]) => {
  Layers = new LayersRegistry(layers);
  Layers.init();
};

const groupIds = (parent = "viewbox") => Array.from(document.getElementById(parent)!.children, node => node.id);
const displayOf = (elementId: string) => document.getElementById(elementId)!.style.display;

describe("init", () => {
  it("creates missing groups in registration order", () => {
    registry(
      new Layer({ id: "a", element: "a-el", parent: "viewbox" }),
      new Layer({ id: "b", element: "b-el", parent: "viewbox" })
    );

    expect(groupIds()).toEqual(["a-el", "b-el"]);
  });

  it("adopts an existing group and reorders it to match registration order", () => {
    document.getElementById("viewbox")!.innerHTML = /* html */ `<g id="b-el"><circle id="kept" /></g>`;
    registry(
      new Layer({ id: "a", element: "a-el", parent: "viewbox" }),
      new Layer({ id: "b", element: "b-el", parent: "viewbox" })
    );

    expect(groupIds()).toEqual(["a-el", "b-el"]);
    expect(document.getElementById("kept")).not.toBeNull(); // adopted, not recreated
  });

  it("creates declared children and applies attrs, appending to the declared parent", () => {
    registry(
      new Layer({
        id: "a",
        element: "a-el",
        parent: "map",
        children: ["one", "two"].map(id => ({ id, tag: "g" })),
        attrs: { mask: "url(#m)" }
      })
    );

    const group = document.getElementById("a-el")!;
    expect(group.parentElement!.id).toBe("map");
    expect(group.getAttribute("mask")).toBe("url(#m)");
    expect(Array.from(group.children, node => node.id)).toEqual(["one", "two"]);
  });

  it("creates children that are not groups, with their attributes", () => {
    registry(
      new Layer({
        id: "a",
        element: "a-el",
        parent: "viewbox",
        children: [
          { id: "one", tag: "g" },
          { id: "rose", tag: "use", attrs: { href: "#defs-rose" } }
        ]
      })
    );

    const rose = document.getElementById("rose")!;
    expect(Array.from(document.getElementById("a-el")!.children, node => node.id)).toEqual(["one", "rose"]);
    expect(rose.tagName).toBe("use");
    expect(rose.getAttribute("href")).toBe("#defs-rose");
  });

  it("adopts a child that is already in the svg instead of duplicating it", () => {
    document.getElementById("viewbox")!.innerHTML = /* html */ `<g id="a-el"><use id="rose" href="#kept" /></g>`;
    registry(
      new Layer({ id: "a", element: "a-el", parent: "viewbox", children: [{ id: "rose", tag: "use", attrs: {} }] })
    );

    expect(document.querySelectorAll("#a-el use").length).toBe(1);
    expect(document.getElementById("rose")!.getAttribute("href")).toBe("#kept"); // the saved map owns it
  });

  it("hides layers that are off and leaves permanent layers visible without a style attribute", () => {
    registry(
      new Layer({ id: "a", element: "a-el", parent: "viewbox" }),
      new Layer({ id: "b", element: "b-el", parent: "viewbox", permanent: true })
    );

    expect(displayOf("a-el")).toBe("none");
    expect(document.getElementById("b-el")!.hasAttribute("style")).toBe(false);
  });
});

describe("show and hide", () => {
  const setup = () => {
    const draw = vi.fn();
    const erase = vi.fn();
    registry(new Layer({ id: "a", element: "a-el", parent: "viewbox", draw, erase }));
    return { draw, erase };
  };

  it("turns the layer on, draws it once and makes it visible", () => {
    const { draw } = setup();
    Layers.show("a");

    expect(Layers.isOn("a")).toBe(true);
    expect(displayOf("a-el")).toBe("");
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it("turns the layer off, erases it once and hides it", () => {
    const { draw, erase } = setup();
    Layers.show("a");
    draw.mockClear();
    Layers.hide("a");

    expect(Layers.isOn("a")).toBe(false);
    expect(displayOf("a-el")).toBe("none");
    expect(erase).toHaveBeenCalledTimes(1);
  });

  it("does not erase a layer that is already off", () => {
    const { erase } = setup();
    Layers.hide("a");

    expect(erase).not.toHaveBeenCalled();
  });

  // a permanent layer has no off state: presets already skip it, and so must a direct call
  it("ignores a permanent layer, leaving it on, visible and intact", () => {
    const erase = vi.fn();
    registry(new Layer({ id: "s", element: "s-el", parent: "viewbox", permanent: true, erase }));
    Layers.hide("s");
    Layers.toggle("s");

    expect(Layers.isOn("s")).toBe(true);
    expect(displayOf("s-el")).toBe("");
    expect(erase).not.toHaveBeenCalled();
  });

  it("does not redraw a layer that is already on", () => {
    const { draw, erase } = setup();
    Layers.show("a");
    Layers.show("a");

    expect(draw).toHaveBeenCalledTimes(1);
    expect(erase).not.toHaveBeenCalled();
  });

  it("draws only the layers that were off", () => {
    const drawn: string[] = [];
    const make = (id: string) =>
      new Layer({ id, element: `${id}-el`, parent: "viewbox", draw: () => void drawn.push(id) });
    registry(make("a"), make("b"));
    Layers.show("a");
    drawn.length = 0;

    Layers.show("a", "b");

    expect(drawn).toEqual(["b"]);
  });

  it("toggles between the two states", () => {
    setup();
    Layers.toggle("a");
    expect(Layers.isOn("a")).toBe(true);
    Layers.toggle("a");
    expect(Layers.isOn("a")).toBe(false);
  });

  it("throws on an id that is not registered", () => {
    setup();
    expect(() => Layers.get("nope")).toThrow();
    expect(Layers.has("nope")).toBe(false);
    expect(Layers.has("a")).toBe(true);
  });
});

describe("erase", () => {
  it("clears emblem content while preserving its parent groups", () => {
    registry(MapLayers.get("emblems"));
    Layers.restore({ order: ["emblems"], active: ["emblems"] });
    document.getElementById("stateEmblems")!.innerHTML = /* html */ `<use data-i="1" />`;

    Layers.hide("emblems");

    expect(Array.from(document.getElementById("emblems")!.children, node => node.id)).toEqual([
      "burgEmblems",
      "provinceEmblems",
      "stateEmblems"
    ]);
    expect(document.querySelector("#stateEmblems > use")).toBeNull();
  });

  it("clears declared children and removes everything else by default", () => {
    registry(new Layer({ id: "a", element: "a-el", parent: "viewbox", children: [{ id: "kept", tag: "g" }] }));
    Layers.show("a");
    document.getElementById("kept")!.innerHTML = /* html */ `<circle />`;
    document.getElementById("a-el")!.insertAdjacentHTML("beforeend", /* html */ `<g id="dropped"></g>`);

    Layers.hide("a");

    expect(Array.from(document.getElementById("a-el")!.children, node => node.id)).toEqual(["kept"]);
    expect(document.getElementById("kept")!.children.length).toBe(0);
  });

  it("keeps a declared child that is not a group, content and all", () => {
    registry(
      new Layer({
        id: "a",
        element: "a-el",
        parent: "viewbox",
        children: [{ id: "rose", tag: "use", attrs: { href: "#defs-rose" } }]
      })
    );
    Layers.show("a");
    document.getElementById("a-el")!.insertAdjacentHTML("beforeend", /* html */ `<circle id="dropped" />`);

    Layers.hide("a");
    Layers.eraseAll();

    expect(document.getElementById("dropped")).toBeNull();
    expect(document.getElementById("rose")!.getAttribute("href")).toBe("#defs-rose"); // skeleton, not content
  });

  it("eraseAll drops the content of every viewbox layer, on or off, keepContent included", () => {
    const erase = vi.fn();
    registry(
      new Layer({ id: "a", element: "a-el", parent: "viewbox", keepContent: true }),
      new Layer({ id: "b", element: "b-el", parent: "viewbox", children: [{ id: "kept", tag: "g" }] }),
      new Layer({ id: "c", element: "c-el", parent: "viewbox", erase }),
      new Layer({ id: "chrome", element: "chrome-el", parent: "map" })
    );
    Layers.show("a");
    document.getElementById("a-el")!.innerHTML = /* html */ `<circle id="dropped-a" />`;
    document.getElementById("kept")!.innerHTML = /* html */ `<circle id="dropped-b" />`;
    document.getElementById("chrome-el")!.innerHTML = /* html */ `<circle id="chrome-content" />`;

    Layers.eraseAll();

    expect(document.getElementById("dropped-a")).toBeNull();
    expect(document.getElementById("kept")!.children.length).toBe(0); // declared children survive, empty
    expect(erase).toHaveBeenCalledTimes(1); // erased even though the layer is off
    expect(document.getElementById("chrome-content")).not.toBeNull(); // chrome is not map content
    expect([Layers.isOn("a"), Layers.isOn("b")]).toEqual([true, false]); // state is untouched
  });

  it("keeps the content when keepContent is set", () => {
    registry(new Layer({ id: "a", element: "a-el", parent: "viewbox", keepContent: true }));
    Layers.show("a");
    document.getElementById("a-el")!.innerHTML = /* html */ `<circle id="kept" />`;

    Layers.hide("a");

    expect(document.getElementById("kept")).not.toBeNull();
    expect(displayOf("a-el")).toBe("none");
  });
});

describe("draw", () => {
  const setup = () => {
    const calls: string[] = [];
    const make = (id: string) =>
      new Layer({ id, element: `${id}-el`, parent: "viewbox", draw: () => void calls.push(id) });
    registry(make("a"), make("b"), make("c"));
    return calls;
  };

  it("invokes callbacks in registration order regardless of argument order", () => {
    const calls = setup();
    Layers.show("a", "b");
    calls.length = 0;

    Layers.draw("b", "a");

    expect(calls).toEqual(["a", "b"]);
  });

  it("skips layers that are off", () => {
    const calls = setup();
    Layers.show("a", "c");
    calls.length = 0;

    Layers.draw("a", "b", "c");

    expect(calls).toEqual(["a", "c"]);
  });

  it("drawAll draws every active layer in order", () => {
    const calls = setup();
    Layers.show("a", "c");
    calls.length = 0;

    Layers.drawAll();

    expect(calls).toEqual(["a", "c"]);
  });
});

describe("setActive", () => {
  it("turns on the listed layers, turns off the rest and preserves permanent layers", () => {
    registry(
      new Layer({ id: "a", element: "a-el", parent: "viewbox" }),
      new Layer({ id: "b", element: "b-el", parent: "viewbox" }),
      new Layer({ id: "s", element: "s-el", parent: "viewbox", permanent: true })
    );
    Layers.show("a");

    Layers.set(["b"]);

    expect([Layers.isOn("a"), Layers.isOn("b"), Layers.isOn("s")]).toEqual([false, true, true]);
    expect(Layers.state.active).toEqual(["b"]); // permanent layers are structural, not saved state
  });

  it("draws only the layers that were off and ignores unknown ids", () => {
    const draws: string[] = [];
    const make = (id: string) =>
      new Layer({ id, element: `${id}-el`, parent: "viewbox", draw: () => void draws.push(id) });
    registry(make("a"), make("b"));
    Layers.show("a");
    draws.length = 0;

    Layers.set(["a", "b", "gone"]);

    expect(draws).toEqual(["b"]);
  });
});

describe("move", () => {
  const register = () => {
    registry(...["a", "b", "c"].map(id => new Layer({ id, element: `${id}-el`, parent: "viewbox" })));
  };

  it("reorders the registry and the svg together", () => {
    register();
    Layers.move("c", "a"); // c before a

    expect(Layers.all.map(layer => layer.id)).toEqual(["c", "a", "b"]);
    expect(groupIds()).toEqual(["c-el", "a-el", "b-el"]);
  });

  it("moves the layer to the end when no successor is given", () => {
    register();
    Layers.move("a");

    expect(Layers.all.map(layer => layer.id)).toEqual(["b", "c", "a"]);
    expect(groupIds()).toEqual(["b-el", "c-el", "a-el"]);
  });

  it("keeps the layer registered when it is moved before itself", () => {
    register();
    Layers.move("b", "b");

    expect(Layers.all.map(layer => layer.id)).toEqual(["a", "b", "c"]);
    expect(groupIds()).toEqual(["a-el", "b-el", "c-el"]);
  });

  // the layer used to be spliced out before the successor was resolved, so a throw left it
  // deregistered: its group stayed in the svg, rendered but no longer under the registry
  it("leaves the registry untouched when the successor is not registered", () => {
    register();
    expect(() => Layers.move("b", "nope" as never)).toThrow();

    expect(Layers.all.map(layer => layer.id)).toEqual(["a", "b", "c"]);
    expect(Layers.has("b")).toBe(true);
    expect(groupIds()).toEqual(["a-el", "b-el", "c-el"]);
  });

  // the panel lists every parent in one list, so a drag can name a successor the svg cannot honour:
  // the order must stay realisable, or the panel and the saved order claim a z-order that never renders
  it("keeps a layer among its own parent's layers when the successor is in another parent", () => {
    registry(
      new Layer({ id: "a", element: "a-el", parent: "viewbox" }),
      new Layer({ id: "b", element: "b-el", parent: "viewbox" }),
      new Layer({ id: "bar", element: "bar-el", parent: "map" }),
      new Layer({ id: "top", element: "top-el", parent: "map" })
    );
    Layers.move("a", "top"); // past a layer that lives outside the viewbox

    expect(Layers.all.map(layer => layer.id)).toEqual(["b", "a", "bar", "top"]);
    expect(groupIds()).toEqual(["b-el", "a-el"]);
    expect(groupIds("map")).toEqual(["viewbox", "bar-el", "top-el"]);
  });
});

describe("restore", () => {
  const register = (ids = ["a", "b", "c"]) => {
    const draw = vi.fn();
    const erase = vi.fn();
    registry(...ids.map(id => new Layer({ id, element: `${id}-el`, parent: "viewbox", draw, erase })));
    return { draw, erase };
  };

  it("applies order and active state without drawing or erasing", () => {
    const { draw, erase } = register();
    Layers.show("a");
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
    Layers.show("a", "c");
    Layers.move("c", "a");
    const saved: LayersState = JSON.parse(JSON.stringify(Layers.state));

    Layers.restore(saved);

    expect(Layers.state).toEqual(saved);
  });
});

describe("subscribe", () => {
  it("notifies once per operation and stops after unsubscribing", () => {
    registry(new Layer({ id: "a", element: "a-el", parent: "viewbox" }));

    const listener = vi.fn();
    const unsubscribe = Layers.subscribe(listener);

    Layers.show("a");
    expect(listener).toHaveBeenCalledTimes(1);

    Layers.hide("a");
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    Layers.show("a");
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
