import { describe, expect, it } from "vitest";
import { Appropriation } from "./appropriation";
import { Names } from "./names-generator";

const into = (id: string) => (root: string) => Appropriation.adapt(root, Names.find(id)!);

describe("Appropriation.adapt", () => {
  it("respells letters a base never writes with the nearest it does", () => {
    expect(into("ruthenian")("william")).toBe("viliam"); // no w, and no doubled letters
    expect(into("korean")("frank")).toBe("prank");
    expect(into("english")("björn")).toBe("bjorn");
    expect(into("italian")("kursk")).toMatch(/^cursc/);
  });

  it("runs the rules a base keeps for foreign roots", () => {
    const ruthenian = into("ruthenian");
    expect(ruthenian("theodore")).toBe("feodore");
    expect(ruthenian("harald")).toBe("garald");
    expect(ruthenian("augustus")).toBe("avgustus");
    expect(ruthenian("quintus")).toBe("kvintus");
    expect(into("english")("zhitomir")).toBe("jitomir");
  });

  it("parts consonants in a base of open syllables and ends the root in a vowel", () => {
    const hawaiian = into("hawaiian")("frank");
    expect(hawaiian).toMatch(/^[^aeiou]?([aeiou]+[^aeiou]?)*[aeiou]$/); // no two consonants together, a vowel last
    expect(into("japanese")("frank")).toMatch(/[aeiou]$/);
  });

  it("ends a root in a vowel only where it ends the word and the base's names end in vowels", () => {
    expect(into("italian")("frank")).toBe("franco");
    expect(Appropriation.adapt("frank", Names.find("italian")!, false)).toBe("franc");
    expect(into("german")("yaroslav")).toBe("yaroslav");
    expect(into("english")("eadric")).toBe("eadric");
  });

  it("leaves a root alone in a base with no names to measure it by", () => {
    expect(Appropriation.adapt("frank", Names.composeBase("empty", "Empty", [3, 9], []))).toBe("frank");
  });
});
