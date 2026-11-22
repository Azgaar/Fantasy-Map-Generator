import { describe, expect, it } from "vitest";
import type { NameBase, SoundRule } from "@/data/name-bases";
import { applyForeignRules, applyRules, doublesRule, getDoubles, joinParts, setDoubles } from "./sound-rules";

const base = (rules?: NameBase["rules"]): NameBase => ({
  id: "x",
  name: "X",
  length: [5, 9],
  places: { names: [] },
  rules
});

describe("applyRules", () => {
  it("applies the shared rules inside a word only", () => {
    expect(applyRules("baeae")).toBe("bee");
    expect(applyRules("aelia-aeg aeb")).toBe("aelia-aeg aeb");
    expect(applyRules("alllo")).toBe("allo");
    expect(applyRules("llllo")).toBe("lllo"); // a word-initial letter is kept, as the generator always did
    expect(applyRules("saint- -omer")).toBe("saint--omer");
  });

  it("runs a base's rules before the shared ones", () => {
    expect(applyRules("baae", [doublesRule()])).toBe("be");
  });

  it("skips a rule that is no valid regex", () => {
    expect(applyRules("abba", [{ match: "(", replace: "" }, doublesRule()])).toBe("aba");
  });
});

describe("a name made of parts", () => {
  it("is joined by the shared rules, which no plain name meets", () => {
    expect(joinParts("frank+land")).toBe("frankland");
    expect(joinParts("friede+ia")).toBe("friedia"); // a short vowel ending takes the place of the last vowels
    expect(joinParts("io+ia")).toBe("ioia"); // but never the whole part
    expect(joinParts("free+island")).toBe("freeisland");
    expect(joinParts("hal+land")).toBe("haland");
  });

  it("runs the rules a base set at the join, and leaves its word rules to words", () => {
    const rules: SoundRule[] = [
      doublesRule(),
      { match: "([aeiou])\\+u$", replace: "$1", at: "join" },
      { match: "\\+heim$", replace: "um", at: "join" }
    ];
    expect(joinParts("kyoto+u", rules)).toBe("kyoto");
    expect(joinParts("kan+u", rules)).toBe("kanu");
    expect(joinParts("boch+heim", rules)).toBe("bochum");
    expect(joinParts("oak+wood", rules)).toBe("oakwood"); // a form written for the base keeps its doubled letters
    expect(applyRules("wood", rules)).toBe("wod");
  });
});

describe("rules of a kind", () => {
  const rules: SoundRule[] = [
    doublesRule(),
    { match: "th", replace: "f", when: "foreign" },
    { match: "o\\+(?=[^aeiou])", replace: "+", chance: 0.3 },
    { match: "gorod$", replace: "grad", when: "long" },
    { match: "grad$", replace: "", when: "long" }
  ];

  it("keeps the rules for foreign roots to foreign roots", () => {
    expect(applyForeignRules("theodore", rules)).toBe("feodore");
    expect(applyRules("theodore", rules)).toBe("theodore");
    expect(joinParts("theo+dore", rules)).toBe("theodore");
  });

  it("fires a rule with a chance for the names whose roll comes under it", () => {
    expect(joinParts("novo+gorod", rules, { rolls: [0.29] })).toBe("novgorod");
    expect(joinParts("novo+gorod", rules, { rolls: [0.3] })).toBe("novogorod");
    expect(joinParts("novo+gorod", rules)).toBe("novogorod"); // no roll, no chance
  });

  it("runs the rules for long names one at a time, until the name fits", () => {
    const under = (max: number) => ({ fits: (name: string) => name.length <= max });
    expect(joinParts("cherno+gorod", rules, under(11))).toBe("chernogorod");
    expect(joinParts("cherno+gorod", rules, under(10))).toBe("chernograd");
    expect(joinParts("cherno+gorod", rules, under(8))).toBe("cherno");
    expect(joinParts("cherno+gorod", rules)).toBe("chernogorod"); // nothing says it is too long
  });
});

describe("doubles rule", () => {
  it("keeps only the letters given doubled", () => {
    expect(applyRules("allannaa", [doublesRule("ln")])).toBe("allanna");
    expect(applyRules("allannaa", [doublesRule()])).toBe("alana");
    expect(applyRules("a--b]]c^^", [doublesRule("-]^")])).toBe("a--b]]c^^");
  });

  it("reads back the letters it was made of", () => {
    for (const letters of ["", "lt", "-]^\\", "é'"]) expect(getDoubles(base([doublesRule(letters)]))).toBe(letters);
    expect(getDoubles(base())).toBe("");
  });

  it("replaces a base's doubles rule in place, or adds one first", () => {
    const erosion = { match: "heim$", replace: "um" };
    const edited = base([erosion, doublesRule("l")]);
    setDoubles(edited, "nt");
    expect(edited.rules).toEqual([erosion, doublesRule("nt")]);

    const bare = base([erosion]);
    setDoubles(bare, "s");
    expect(bare.rules).toEqual([doublesRule("s"), erosion]);
  });
});
