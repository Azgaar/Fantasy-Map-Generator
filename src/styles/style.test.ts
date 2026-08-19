import { describe, expect, test, vi } from "vitest";
import { upgradeLegacyPreset } from "./legacy";
import fixture from "./legacy-default.fixture.json";
import { parseStyleData } from "./schema";
import { buildAttributeOps, createDrawScheduler, getMapStyle, Style, setMapStyle } from "./style";

describe("buildAttributeOps", () => {
  test("flattens a layer's own attrs at the root path", () => {
    const ops = buildAttributeOps({ attrs: { opacity: 0.8, stroke: "#fff" } });
    expect(ops).toEqual(
      expect.arrayContaining([
        { path: [], name: "opacity", value: "0.8" },
        { path: [], name: "stroke", value: "#fff" }
      ])
    );
    expect(ops).toHaveLength(2);
  });

  test("null means remove; numbers are stringified", () => {
    const ops = buildAttributeOps({ attrs: { opacity: null, "stroke-width": 2 } });
    expect(ops).toEqual(
      expect.arrayContaining([
        { path: [], name: "opacity", value: null },
        { path: [], name: "stroke-width", value: "2" }
      ])
    );
  });

  test("child attrs carry a one-element path", () => {
    const ops = buildAttributeOps({ children: { roads: { attrs: { stroke: "#d06324" } } } });
    expect(ops).toEqual([{ path: ["roads"], name: "stroke", value: "#d06324" }]);
  });

  test("a layer's own attrs and its children's are flattened together", () => {
    const ops = buildAttributeOps({
      attrs: { opacity: 1 },
      children: { capital: { attrs: { fill: "#ffffff" } } }
    });
    expect(ops).toEqual([
      { path: [], name: "opacity", value: "1" },
      { path: ["capital"], name: "fill", value: "#ffffff" }
    ]);
  });

  test("undefined node flattens to no ops", () => {
    expect(buildAttributeOps(undefined)).toEqual([]);
  });
});

describe("Style.fromJSON", () => {
  test("routes a legacy (selector-keyed) preset through upgradeLegacyPreset", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const style = Style.fromJSON(fixture);
    // the upgrader owns applyStaticDefaults, so its output is already the whole legacy branch
    const expected = upgradeLegacyPreset(fixture as Record<string, Record<string, unknown>>);
    expect(style.toJSON()).toEqual(expected);
    warn.mockRestore();
  });

  test("routes a current-format preset through parseStyleData, untouched", () => {
    const input = { routes: { children: { roads: { attrs: { stroke: "#d06324" } } } } };
    expect(Style.fromJSON(input).toJSON()).toEqual(parseStyleData(input));
  });

  test("a new-format document is taken at its word - no static defaults are injected", () => {
    // the legacy upgrader supplies the three attrs an old preset could not carry; on this branch
    // their absence is the author's choice, so nothing is added and nothing is warned about
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const data = Style.fromJSON({ routes: { attrs: { stroke: "#d06324" } } }).toJSON();
    expect(data.fogging).toBeUndefined();
    expect(data.vignette).toBeUndefined();
    expect(data.labels).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test("rejects non-object input", () => {
    expect(() => Style.fromJSON(null)).toThrow(TypeError);
    expect(() => Style.fromJSON("nope")).toThrow(TypeError);
  });
});

describe("Style.toJSON round-trip", () => {
  test("fromJSON(x).toJSON() deep-equals parseStyleData(x) for a current-format doc", () => {
    const input = {
      heightmap: { children: { landHeights: { options: { scheme: "bright", terracing: 3 } } } },
      states: { children: { statesHalo: { options: { width: 10 } } } }
    };
    expect(Style.fromJSON(input).toJSON()).toEqual(parseStyleData(input));
  });

  test("toJSON returns a detached copy - mutating it doesn't affect the instance", () => {
    const style = Style.fromJSON({ routes: { attrs: { opacity: 0.9 } } });
    const json = style.toJSON();
    (json.routes as { attrs?: Record<string, unknown> }).attrs!.opacity = 0;
    expect((style.toJSON().routes as { attrs?: Record<string, unknown> }).attrs?.opacity).toBe(0.9);
  });
});

describe("Style getters/setters", () => {
  test("options() defaults to {} when nothing was set, at every depth", () => {
    const style = Style.fromJSON({});
    expect(style.options("markers")).toEqual({});
    expect(style.options("heightmap", "landHeights")).toEqual({});
    expect(style.options("anchors", "capital")).toEqual({});
  });

  test("setAttr/options round-trip at the layer level", () => {
    const style = Style.fromJSON({});
    style.setAttr("routes", "opacity", 0.9);
    expect(style.toJSON().routes?.attrs?.opacity).toBe(0.9);
  });

  test("setAttr/round-trip at the child level", () => {
    const style = Style.fromJSON({});
    style.setAttr("routes", "roads", "stroke", "#803a2b");
    expect(style.toJSON().routes?.children?.roads?.attrs?.stroke).toBe("#803a2b");
  });

  test("setAttr/round-trip on a burg-type group (an ordinary child of the anchors layer)", () => {
    const style = Style.fromJSON({});
    style.setAttr("anchors", "capital", "fill", "#ffffff");
    expect(style.toJSON().anchors?.children?.capital?.attrs?.fill).toBe("#ffffff");
  });

  test("setOptions merges rather than replaces", () => {
    const style = Style.fromJSON({});
    style.setOptions("heightmap", "landHeights", { scheme: "bright" });
    style.setOptions("heightmap", "landHeights", { terracing: 3 });
    expect(style.options("heightmap", "landHeights")).toEqual({ scheme: "bright", terracing: 3 });
  });

  test("setOptions on a burg-type group", () => {
    const style = Style.fromJSON({});
    style.setOptions("burgIcons", "capital", { size: 2, icon: "#icon-square" });
    expect(style.options("burgIcons", "capital")).toEqual({ size: 2, icon: "#icon-square" });
  });

  test("setAttr with null schedules removal and is retained as an explicit null, not deleted", () => {
    const style = Style.fromJSON({ routes: { attrs: { opacity: 0.9 } } });
    style.setAttr("routes", "opacity", null);
    expect(style.toJSON().routes?.attrs).toEqual({ opacity: null });
  });
});

describe("Style setter typing (compile-time)", () => {
  test("valid calls typecheck", () => {
    const style = Style.fromJSON({});
    style.setAttr("routes", "opacity", 0.9);
    style.setAttr("routes", "roads", "stroke", "#000");
    style.setAttr("anchors", "capital", "fill", "#000");
    style.setOptions("markers", { rescale: 2 });
    style.setOptions("heightmap", "landHeights", { scheme: "bright" });
    style.setOptions("burgIcons", "capital", { size: 2 });
    expect(style.options("burgIcons", "capital").size).toBe(2);
  });

  // The API is two parameters wide - layer and child. burg icon and anchor groups are ordinary
  // children of two ordinary layers, so there is no third level to address.
  test("a third addressing parameter is a compile error", () => {
    const style = Style.fromJSON({});
    // @ts-expect-error options() takes a layer and at most a child
    style.options("burgIcons", "burgIcons", "capital");
    // @ts-expect-error setAttr takes a layer, an optional child, then name and value
    style.setAttr("burgIcons", "burgIcons", "capital", "fill", "#000");
    // @ts-expect-error setOptions takes a layer, an optional child, then the patch
    style.setOptions("burgIcons", "burgIcons", "capital", { size: 2 });
  });

  test("bad attr name is a compile error", () => {
    const style = Style.fromJSON({});
    // @ts-expect-error "not-a-real-attr" isn't in Attrs
    style.setAttr("routes", "not-a-real-attr", "x");
  });

  test("bad attr value type is a compile error", () => {
    const style = Style.fromJSON({});
    // @ts-expect-error opacity is a number, not a string
    style.setAttr("routes", "opacity", "not-a-number");
  });

  test("bad child id is a compile error", () => {
    const style = Style.fromJSON({});
    // @ts-expect-error "notAChild" isn't declared under heightmap
    style.setOptions("heightmap", "notAChild", { scheme: "bright" });
  });

  // Child typing must not degrade to a bare `string` for layers outside childOptionsSchema, or
  // both calls below compile: a typo on a declared-children layer, and any string on a
  // childless one.
  test("a typo'd child on a layer that HAS declared children is a compile error", () => {
    const style = Style.fromJSON({});
    // @ts-expect-error "roadz" isn't one of routes' declared children ("roads"/"trails"/"searoutes")
    style.setAttr("routes", "roadz", "stroke", "#000");
  });

  test("any child on a layer with NO declared children is a compile error", () => {
    const style = Style.fromJSON({});
    // @ts-expect-error "markers" has no children at all - ChildId<"markers"> is `never`
    style.setAttr("markers", "whatever", "fill", "#000");
  });

  test("a declared child on a layer with declared children compiles", () => {
    const style = Style.fromJSON({});
    style.setAttr("routes", "roads", "stroke", "#000");
    expect(true).toBe(true);
  });

  test("an attrs-only declared child (no options schema) compiles", () => {
    const style = Style.fromJSON({});
    // statesBody has no entry in ChildOptions (only statesHalo does); it must still be a valid
    // setAttr child because it IS in DECLARED_CHILDREN.
    style.setAttr("states", "statesBody", "fill", "#000");
    expect(true).toBe(true);
  });
});

describe("createDrawScheduler", () => {
  const owner = {}; // stand-in for the editing Style instance the scheduler batches per

  test("no-ops when raf is undefined (node/SSR env)", () => {
    const draw = vi.fn();
    const schedule = createDrawScheduler(undefined, draw);
    schedule(owner, "routes");
    expect(draw).not.toHaveBeenCalled();
  });

  test("batches multiple schedule() calls before the frame into one draw() call", () => {
    let queued: (() => void) | undefined;
    const raf = vi.fn((cb: () => void) => {
      queued = cb;
      return 1;
    });
    const draw = vi.fn();
    const schedule = createDrawScheduler(raf, draw);

    schedule(owner, "routes");
    schedule(owner, "labels");
    schedule(owner, "routes"); // duplicate, still one entry in the batched Set

    expect(raf).toHaveBeenCalledTimes(1); // only the first schedule() in a frame requests one
    expect(draw).not.toHaveBeenCalled();

    queued?.();

    expect(draw).toHaveBeenCalledTimes(1);
    expect(draw).toHaveBeenCalledWith(owner, "routes", "labels");
  });

  test("a new frame is requested again after a flush", () => {
    const frames: (() => void)[] = [];
    const raf = vi.fn((cb: () => void) => {
      frames.push(cb);
      return frames.length;
    });
    const draw = vi.fn();
    const schedule = createDrawScheduler(raf, draw);

    schedule(owner, "routes");
    frames[0]();
    schedule(owner, "labels");
    frames[1]();

    expect(raf).toHaveBeenCalledTimes(2);
    expect(draw).toHaveBeenNthCalledWith(1, owner, "routes");
    expect(draw).toHaveBeenNthCalledWith(2, owner, "labels");
  });

  test("edits from two owners in one frame are drawn as one batch each, never merged", () => {
    let queued: (() => void) | undefined;
    const raf = vi.fn((cb: () => void) => {
      queued = cb;
      return 1;
    });
    const draw = vi.fn();
    const schedule = createDrawScheduler(raf, draw);
    const other = {};

    schedule(owner, "routes");
    schedule(other, "labels");
    queued?.();

    expect(draw).toHaveBeenCalledTimes(2);
    expect(draw).toHaveBeenCalledWith(owner, "routes");
    expect(draw).toHaveBeenCalledWith(other, "labels");
  });
});

describe("getMapStyle", () => {
  // the only suite in this file that touches the module-level `mapStyle`, so the unset state it
  // asserts first is the module's genuine initial state
  test("throws before setMapStyle, and returns the instance after it", () => {
    expect(() => getMapStyle()).toThrow(/setMapStyle/);

    const style = Style.fromJSON({});
    setMapStyle(style);
    expect(getMapStyle()).toBe(style);
  });
});
