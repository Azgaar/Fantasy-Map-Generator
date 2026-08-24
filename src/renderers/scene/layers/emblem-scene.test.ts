import { describe, expect, it } from "vitest";
import type { MapRenderWorld } from "../render-world";
import { DEFAULT_PIXI_MAP_STYLE } from "../styles";
import { buildEmblemScene } from "./emblem-scene";

describe("buildEmblemScene", () => {
  it("builds deterministic collision-resolved groups without mutating heraldry data", () => {
    const world = createWorld();
    const before = structuredClone(world);
    const style = { ...DEFAULT_PIXI_MAP_STYLE.emblems, filter: "url(#dropShadow)" };

    const first = buildEmblemScene(world, { height: 60, width: 100 }, style, "revision:1");
    const second = buildEmblemScene(world, { height: 60, width: 100 }, style, "revision:1");

    expect(first).toEqual(second);
    expect(first.groups.map(group => [group.type, group.items.length])).toEqual([
      ["burg", 1],
      ["province", 1],
      ["state", 1]
    ]);
    expect(first.domainIds).toEqual(["burg:3", "province:2", "state:1"]);
    expect(new Set(first.groups.flatMap(group => group.items.map(item => `${item.x}:${item.y}`))).size).toBe(3);
    expect(first.unsupportedEffects).toEqual(["emblems:url(#dropShadow)"]);
    expect(world).toEqual(before);
  });

  it("changes the texture revision only when heraldry or texture-affecting style changes", () => {
    const world = createWorld();
    const initial = buildEmblemScene(world, { height: 60, width: 100 }, DEFAULT_PIXI_MAP_STYLE.emblems, 1);
    const same = buildEmblemScene(world, { height: 60, width: 100 }, DEFAULT_PIXI_MAP_STYLE.emblems, 2);
    world.states[0].coa.t1 = "azure";
    const changed = buildEmblemScene(world, { height: 60, width: 100 }, DEFAULT_PIXI_MAP_STYLE.emblems, 3);

    expect(initial.groups[2].items[0].textureKey).toBe(same.groups[2].items[0].textureKey);
    expect(changed.groups[2].items[0].textureKey).not.toBe(initial.groups[2].items[0].textureKey);
    expect(changed.revision).toBe(3);
  });

  it("retains embedded custom emblem data and omits explicitly hidden emblems", () => {
    const world = createWorld();
    world.burgs[0].coa = { custom: true, customData: "data:image/png;base64,crest", size: 0, t1: "" };
    world.provinces[0].coa = { custom: true, customData: "data:image/png;base64,crest", size: 2, t1: "" };

    const scene = buildEmblemScene(world, { height: 60, width: 100 }, DEFAULT_PIXI_MAP_STYLE.emblems, 1);

    expect(scene.domainIds.includes("burg:3")).toBe(false);
    expect(scene.groups[1].items[0]).toMatchObject({
      coa: { custom: true, customData: "data:image/png;base64,crest" },
      size: expect.any(Number)
    });
  });
});

function createWorld(): MapRenderWorld {
  const coa = (t1: string) => ({ size: 1, t1 });
  return {
    burgs: [{ cell: 0, coa: coa("vert"), i: 3, x: 25, y: 25 }],
    cells: { p: [[25, 25]] },
    provinces: [
      { burg: 0, center: 0, coa: coa("or"), color: "#fff", formName: "", fullName: "", i: 2, name: "", state: 1 }
    ],
    states: [
      {
        capital: 0,
        center: 0,
        coa: coa("gules"),
        culture: 0,
        expansionism: 1,
        i: 1,
        name: "",
        pollTax: 0,
        salesTax: 0,
        treasury: 0,
        type: "Generic"
      }
    ]
  } as unknown as MapRenderWorld;
}
