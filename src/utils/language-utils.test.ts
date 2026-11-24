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
});
