import { describe, expect, it } from "vitest";
import { GOODS_DATA } from "@/data/goods";
import { parseExpression } from "./goods-distribution-editor";

const shape = (expr: string) => parseExpression(expr)?.map(group => group.map(condition => condition.fnId));

describe("parseExpression", () => {
  it("reads every default good's distribution", () => {
    for (const { name, distribution } of GOODS_DATA)
      if (distribution) expect(parseExpression(distribution), name).not.toBeNull();
  });

  it("multiplies out an OR nested in an AND", () => {
    expect(shape("biome(4, 6) && (river() || random(30))")).toEqual([
      ["biome", "river"],
      ["biome", "random"]
    ]);
    expect(shape("(minHeight(40) || (minHeight(20) && elevation())) && biome(1)")).toEqual([
      ["minHeight", "biome"],
      ["minHeight", "elevation", "biome"]
    ]);
  });

  it("gives up on what the builder cannot show", () => {
    expect(parseExpression("!(river() || random(30))")).toBeNull();
    expect(parseExpression("unknown(1)")).toBeNull();
  });
});
