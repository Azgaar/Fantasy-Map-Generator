import { describe, it, expect } from "vitest";
import { generateName } from "./name-generator";
import { generateEmblem } from "./emblem-generator";
import { generateDiplomacy } from "./diplomacy-generator";

describe("Names, Heraldry, & Diplomacy Generators", () => {
  it("should generate seedable name structures", () => {
    const name1 = generateName("roman", "seed-xyz");
    const name2 = generateName("roman", "seed-xyz");
    const name3 = generateName("elven", "seed-xyz");

    expect(name1).toBe(name2);
    expect(name1).not.toBe(name3);
    expect(name1.length).toBeGreaterThan(2);
  });

  it("should output valid SVG emblems for flags and shields", () => {
    const emblem = generateEmblem("heraldry-seed");
    expect(emblem).toContain("<svg");
    expect(emblem).toContain("viewBox=\"0 0 100 100\"");
    expect(emblem).toContain("clip-path");
    expect(emblem).toContain("</svg>");
  });

  it("should generate a consistent pairwise diplomacy matrix", () => {
    const mockStates = [
      { id: 1, name: "State 1", color: "#111", capital: 1, center: 1 },
      { id: 2, name: "State 2", color: "#222", capital: 2, center: 2 },
      { id: 3, name: "State 3", color: "#333", capital: 3, center: 3 }
    ];

    const relations = generateDiplomacy(mockStates, "diplo-seed");
    // 3 states pairwise combination = n*(n-1)/2 = 3
    expect(relations.length).toBe(3);
    for (const r of relations) {
      expect(r.threat).toBeGreaterThanOrEqual(0);
      expect(r.threat).toBeLessThanOrEqual(100);
      expect(["Alliance", "Friendly", "Neutral", "Suspicious", "War"]).toContain(r.type);
    }
  });
});
