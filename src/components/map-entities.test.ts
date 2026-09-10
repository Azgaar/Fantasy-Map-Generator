// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { MapEntities } from "./map-entities";

beforeEach(() => {
  globalThis.pack = {
    burgs: [0, { i: 1, name: "Vaeltown", note: "A river port" }],
    states: [
      { i: 0, name: "Neutrals" },
      { i: 1, name: "Ardenia", fullName: "Duchy of Ardenia", military: [{ i: 0, name: "1st Cavalry", note: "Elite" }] }
    ],
    markers: [{ i: 4, type: "volcanoes", name: "Mount Doom", note: "Active volcano" }],
    rivers: [0, { i: 1, name: "Ald", type: "River" }],
    features: [0, { i: 1, name: "Mirror Lake", note: "Deep and cold" }],
    zones: [0, { i: 1, name: "Plague" }],
    cultures: [
      { i: 0, name: "Wildlands" },
      { i: 1, name: "Aeloran", note: "Horse people" }
    ],
    routes: [],
    provinces: [],
    journeys: [],
    markets: [],
    addedLabels: [],
    religions: [],
    biomes: [],
    goods: []
  } as unknown as typeof pack;
});

describe("resolveElementId", () => {
  it.each([
    ["burg7", { type: "burg", id: 7 }],
    ["burgLabel7", { type: "burg", id: 7 }],
    ["stateLabel3", { type: "state", id: 3 }],
    ["provinceLabel2", { type: "province", id: 2 }],
    ["river12", { type: "river", id: 12 }],
    ["riverLabel12", { type: "river", id: 12 }],
    ["route5", { type: "route", id: 5 }],
    ["road5", { type: "route", id: 5 }],
    ["routeLabel5", { type: "route", id: 5 }],
    ["feature_9", { type: "feature", id: 9 }],
    ["lake_9", { type: "feature", id: 9 }],
    ["marker4", { type: "marker", id: 4 }],
    ["zone1", { type: "zone", id: 1 }],
    ["journey2", { type: "journey", id: 2 }],
    ["segment2_5", { type: "journey", id: 2 }],
    ["market8", { type: "market", id: 8 }],
    ["addedLabel6", { type: "addedLabel", id: 6 }],
    ["regiment3-1", { type: "regiment", id: 3, sub: 1 }]
  ])("maps %s to its entity", (elementId, expected) => {
    expect(MapEntities.resolveElement(elementId)).toEqual(expected);
  });

  it.each(["freshwater", "viewbox", "", null, undefined, "burg", "notAnId12"])("ignores %s", elementId => {
    expect(MapEntities.resolveElement(elementId)).toBeUndefined();
  });

  it("round-trips a reference through its element id", () => {
    expect(MapEntities.getElementId({ type: "regiment", id: 3, sub: 1 })).toBe("regiment3-1");
    expect(MapEntities.resolveElement(MapEntities.getElementId({ type: "feature", id: 9 })!)).toEqual({
      type: "feature",
      id: 9
    });
  });

  it("has no element for an entity that is not drawn on its own", () => {
    expect(MapEntities.getElementId({ type: "culture", id: 1 })).toBeUndefined();
  });
});

describe("entity on the map", () => {
  it("knows whether the entity is still there", () => {
    expect(Boolean(MapEntities.get({ type: "burg", id: 1 }))).toBe(true);
    expect(Boolean(MapEntities.get({ type: "burg", id: 99 }))).toBe(false);
    expect(Boolean(MapEntities.get({ type: "regiment", id: 1, sub: 0 }))).toBe(true);
  });

  it("gives the position to zoom to, for entities placed on the map", () => {
    globalThis.pack.burgs[1] = { i: 1, name: "Vaeltown", x: 120, y: 340 } as unknown as (typeof pack.burgs)[number];
    expect(MapEntities.getPosition({ type: "burg", id: 1 })).toEqual([120, 340]);
  });

  it("has no position for an entity that is not placed on the map", () => {
    expect(MapEntities.getPosition({ type: "culture", id: 1 })).toBeUndefined();
  });

  it("has no position for an entity that is gone", () => {
    expect(MapEntities.getPosition({ type: "burg", id: 99 })).toBeUndefined();
  });
});

describe("keys", () => {
  it.each([
    [{ type: "burg", id: 1 } as const, "burg:1"],
    [{ type: "regiment", id: 3, sub: 2 } as const, "regiment:3-2"]
  ])("round-trips %o", (ref, key) => {
    expect(MapEntities.key(ref)).toBe(key);
    expect(MapEntities.parseKey(key)).toEqual(ref);
  });

  it("rejects a key of an unknown type", () => {
    expect(MapEntities.parseKey("dragon:1")).toBeUndefined();
    expect(MapEntities.parseKey("burg")).toBeUndefined();
  });
});

describe("shared entity geometry and context", () => {
  it("keeps an anchor position distinct from the full geometry used to fit a territory", () => {
    pack.states[1].pole = [100, 200];
    pack.cells = {
      i: new Uint16Array([0, 1, 2]),
      state: new Uint16Array([1, 0, 1]),
      p: [
        [10, 20],
        [30, 40],
        [50, 60]
      ]
    } as unknown as typeof pack.cells;
    const ref = { type: "state", id: 1 } as const;
    expect(MapEntities.getPosition(ref)).toEqual([100, 200]);
    expect(MapEntities.getPoints(ref)).toEqual([
      [10, 20],
      [50, 60]
    ]);
    pack.burgs[1].state = 1;
    expect(MapEntities.getContext({ type: "burg", id: 1 })).toBe("Duchy of Ardenia");
  });

  it("includes real zero IDs and excludes placeholders and removed entities", () => {
    pack.routes = [
      { i: 0, name: "First road" },
      { i: 5, removed: true }
    ] as unknown as typeof pack.routes;
    pack.biomes = [{ i: 0, name: "Marine" }] as typeof pack.biomes;
    expect(MapEntities.collect("route").map(({ ref }) => ref.id)).toEqual([0]);
    expect(MapEntities.collect("biome").map(({ ref }) => ref.id)).toEqual([0]);
    expect(MapEntities.collect("state").map(({ ref }) => ref.id)).toEqual([1]);
    pack.burgs[1].removed = true;
    expect(MapEntities.get({ type: "burg", id: 1 })).toBeUndefined();
  });

  it("resolves sparse IDs and regiment zero without relying on array positions", () => {
    pack.routes = [
      {
        i: 42,
        name: "Mountain trail",
        points: [
          [10, 20, 0],
          [30, 40, 1]
        ]
      }
    ] as typeof pack.routes;
    const ref = { type: "route", id: 42 } as const;
    expect(MapEntities.collect("route")[0].entity).toBe(pack.routes[0]);
    expect(MapEntities.getName(ref)).toBe("Mountain trail");
    expect(MapEntities.getPoints(ref)).toEqual([
      [10, 20],
      [30, 40]
    ]);
    expect(MapEntities.collect("regiment")[0].ref).toEqual({ type: "regiment", id: 1, sub: 0 });
  });

  it("filters invalid geometry and gives non-spatial goods no points", () => {
    pack.cells = {
      p: [
        [10, 20],
        [NaN, 5]
      ]
    } as unknown as typeof pack.cells;
    pack.rivers[1].cells = [0, 1, -1];
    expect(MapEntities.getPoints({ type: "river", id: 1 })).toEqual([[10, 20]]);
    expect(MapEntities.getPoints({ type: "good", id: 1 })).toEqual([]);
  });

  it.each(["burg:NaN", "burg:-1", "burg:1-2", "regiment:1", "regiment:1-2-3", "burg:1:2"])(
    "rejects malformed reference %s",
    key => expect(MapEntities.parseKey(key)).toBeUndefined()
  );
});

describe("map event targets", () => {
  it.each([
    ['<g id="burgIcons"><g data-id="0"><circle id="target"/></g></g>', { type: "burg", id: 0 }],
    [
      '<g id="labels"><text data-label-type="burg" data-id="2"><tspan id="target"/></text></g>',
      { type: "burg", id: 2 }
    ],
    [
      '<g id="labels"><text data-label-type="added" data-id="3"><tspan id="target"/></text></g>',
      { type: "addedLabel", id: 3 }
    ],
    ['<g id="coastline"><g><use id="target" data-f="1"/></g></g>', { type: "feature", id: 1 }],
    ['<g id="markers"><g id="marker0"><g><g><path id="target"/></g></g></g></g>', { type: "marker", id: 0 }],
    ['<g id="journeys"><g id="journey2"><path id="segment2_5"/></g></g>', { type: "journey", id: 2 }]
  ])("resolves nested SVG markup %s", (markup, expected) => {
    document.body.innerHTML = `<svg id="map"><g id="viewbox">${markup}</g></svg>`;
    const target = document.getElementById("target") || document.getElementById("segment2_5");
    expect(MapEntities.resolveTarget(target)).toEqual(expected);
  });

  it("does not confuse a layer or untyped data-id with an entity", () => {
    document.body.innerHTML = '<svg id="map"><g id="viewbox"><g id="rivers"><path data-id="2"/></g></g></svg>';
    expect(MapEntities.resolveTarget(document.querySelector("path"))).toBeUndefined();
    expect(MapEntities.resolveTarget(null)).toBeUndefined();
  });
});
