// @vitest-environment jsdom

import { stratify } from "d3";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";

let cleanupOrigins: typeof import("./hierarchy-tree").cleanupOrigins;

describe("hierarchy tree ancestry shadow nodes", () => {
  beforeAll(async () => {
    document.body.innerHTML = `<div id="dialogs"></div>`;
    const mod = await import("./hierarchy-tree");
    cleanupOrigins = mod.cleanupOrigins;
  });
  beforeEach(() => {
    document.body.innerHTML = `<div id="dialogs"></div>`;
  });

  test("does not create shadow nodes when cultures have no ancestry", () => {
    const cultures = [
      { i: 0, name: "Wildlands", origins: [null] },
      { i: 1, name: "Shwazen", origins: [0] },
      { i: 2, name: "Angshire", origins: [0] }
    ];

    const result = cleanupOrigins(cultures as any);
    expect(result.some(c => c.shadow)).toBe(false);
    expect(result.map(c => c.i)).toEqual([0, 1, 2]);
    expect(result[1].origins).toEqual([0]);
    expect(result[2].origins).toEqual([0]);
  });

  test("groups cultures of the same ancestry under a common shadow origin", () => {
    const cultures = [
      { i: 0, name: "Wildlands", origins: [null] },
      { i: 1, name: "Quenian", ancestry: "Elfish", origins: [0] },
      { i: 2, name: "Eldar", ancestry: "Elfish", origins: [0] },
      { i: 3, name: "Dunirr", ancestry: "Dwarven", origins: [0] },
      { i: 4, name: "Shwazen", origins: [0] }
    ];

    const result = cleanupOrigins(cultures as any);
    const shadowNodes = result.filter(c => c.shadow);
    expect(shadowNodes).toHaveLength(2);

    const elfishShadow = shadowNodes.find(s => s.name === "Elfish");
    const dwarvenShadow = shadowNodes.find(s => s.name === "Dwarven");

    expect(elfishShadow).toBeDefined();
    expect(dwarvenShadow).toBeDefined();
    expect(elfishShadow!.origins).toEqual([0]);
    expect(dwarvenShadow!.origins).toEqual([0]);
    expect(elfishShadow!.i).toBeLessThan(0);
    expect(dwarvenShadow!.i).toBeLessThan(0);
    expect(elfishShadow!.code).toBe("El");
    expect(dwarvenShadow!.code).toBe("Dw");

    const quenian = result.find(c => c.i === 1)!;
    const eldar = result.find(c => c.i === 2)!;
    const dunirr = result.find(c => c.i === 3)!;
    const shwazen = result.find(c => c.i === 4)!;

    // Cultures with ancestry should point to their ancestry shadow node
    expect(quenian.origins[0]).toBe(elfishShadow!.i);
    expect(eldar.origins[0]).toBe(elfishShadow!.i);
    expect(dunirr.origins[0]).toBe(dwarvenShadow!.i);

    // Culture without ancestry points to 0
    expect(shwazen.origins[0]).toBe(0);

    // Original cultures array is not mutated
    expect(cultures[1].origins).toEqual([0]);
    expect(cultures[2].origins).toEqual([0]);
  });

  test("preserves parent culture when a culture already has an origin within the ancestry", () => {
    const cultures = [
      { i: 0, name: "Wildlands", origins: [null] },
      { i: 1, name: "Quenian", ancestry: "Elfish", origins: [0] },
      { i: 2, name: "Eldar", ancestry: "Elfish", origins: [1] }
    ];

    const result = cleanupOrigins(cultures as any);
    const elfishShadow = result.find(c => c.shadow && c.name === "Elfish")!;
    expect(elfishShadow).toBeDefined();

    const quenian = result.find(c => c.i === 1)!;
    const eldar = result.find(c => c.i === 2)!;

    expect(quenian.origins[0]).toBe(elfishShadow.i);
    expect(eldar.origins[0]).toBe(1);
  });

  test("can be stratified into a valid d3 hierarchy tree", () => {
    const cultures = [
      { i: 0, name: "Wildlands", origins: [null] },
      { i: 1, name: "Quenian", ancestry: "Elfish", origins: [0] },
      { i: 2, name: "Eldar", ancestry: "Elfish", origins: [0] },
      { i: 3, name: "Dunirr", ancestry: "Dwarven", origins: [0] },
      { i: 4, name: "Shwazen", origins: [0] }
    ];

    const elements = cleanupOrigins(cultures as any);
    const root = stratify<any>()
      .id(d => String(d.i))
      .parentId(d => (d.origins[0] == null ? null : String(d.origins[0])))(elements);

    expect(root).toBeDefined();
    expect(root.id).toBe("0");

    // Children of root: shadow nodes + Shwazen (4)
    const childNames = root.children?.map(c => c.data.name);
    expect(childNames).toContain("Elfish");
    expect(childNames).toContain("Dwarven");
    expect(childNames).toContain("Shwazen");

    const elfishNode = root.children!.find(c => c.data.name === "Elfish");
    expect(elfishNode?.children?.map(c => c.data.name)).toEqual(["Quenian", "Eldar"]);

    const dwarvenNode = root.children!.find(c => c.data.name === "Dwarven");
    expect(dwarvenNode?.children?.map(c => c.data.name)).toEqual(["Dunirr"]);
  });

  test("ignores removed cultures when constructing shadow nodes", () => {
    const cultures = [
      { i: 0, name: "Wildlands", origins: [null] },
      { i: 1, name: "Quenian", ancestry: "Elfish", origins: [0], removed: true },
      { i: 2, name: "Eldar", ancestry: "Elfish", origins: [0] }
    ];

    const result = cleanupOrigins(cultures as any);
    expect(result.some(c => c.i === 1)).toBe(false);
    const shadowNodes = result.filter(c => c.shadow);
    expect(shadowNodes).toHaveLength(1);
    expect(result.find(c => c.i === 2)!.origins[0]).toBe(shadowNodes[0].i);
  });

  test("assigns unique codes to shadow nodes avoiding existing culture codes", () => {
    const cultures = [
      { i: 0, name: "Wildlands", origins: [null] },
      { i: 1, name: "Elendil", code: "El", ancestry: "Elfish", origins: [0] },
      { i: 2, name: "Eldar", code: "Ed", ancestry: "Elfish", origins: [0] }
    ];

    const result = cleanupOrigins(cultures as any);
    const elfishShadow = result.find(c => c.shadow && c.name === "Elfish")!;
    expect(elfishShadow.code).not.toBe("El");
    expect(elfishShadow.code).toBeTruthy();
  });
});
