import { describe, expect, it } from "vitest";
import { getAdjective, list } from "./language-utils";

describe("list", () => {
  it("joins in English", () => {
    expect(list(["coal", "leather", "arms"])).toBe("coal, leather, and arms");
  });
});

describe("getAdjective", () => {
  it.each([
    ["Martin's Castle", "Martin's Castle"], // a name of several words stands as it is
    ["Terre-Rouge", "Terre-Rouge"],
    ["Wen Guo", "Wen"],
    ["Mihályország", "Mihály"],
    ["Beydistan", "Beydistani"],
    ["Redland", "Redlandic"],
    ["Alainie", "Alainian"],
    ["Aldshire", "Aldshire"],
    ["Wulfstania", "Wulfstanian"]
  ])("tells %s as %s", (noun, adjective) => expect(getAdjective(noun)).toBe(adjective));

  it("gives a noun the same adjective every time, and leaves the ambient sequence where it was", () => {
    const before = Math.random;
    let draws = 0;
    Math.random = () => {
      draws++;
      return 0.5;
    };
    try {
      const nouns = ["Beydistan", "Lantonkham", "Siyamrat", "Kanto", "Valoria"];
      expect(nouns.map(getAdjective)).toEqual(nouns.map(getAdjective));
      expect(draws).toBe(0);
    } finally {
      Math.random = before;
    }
  });
});
