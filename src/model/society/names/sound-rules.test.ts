import { describe, expect, it } from "vitest";
import type { NameBase, SoundRule } from "@/types/names";
import { SoundRules } from "./sound-rules";

const base = (rules?: NameBase["rules"]): NameBase => ({
  id: "x",
  name: "X",
  length: [5, 9],
  places: { names: [] },
  rules
});

describe("SoundRules.apply", () => {
  it("applies the shared rules inside a word only", () => {
    expect(SoundRules.apply("baeae")).toBe("bee");
    expect(SoundRules.apply("aelia-aeg aeb")).toBe("aelia-aeg aeb");
    expect(SoundRules.apply("alllo")).toBe("allo");
    expect(SoundRules.apply("llllo")).toBe("lllo"); // a word-initial letter is kept, as the generator always did
    expect(SoundRules.apply("saint- -omer")).toBe("saint--omer");
  });

  it("runs a base's rules before the shared ones", () => {
    expect(SoundRules.apply("baae", [SoundRules.doublesRule()])).toBe("be");
  });

  it("skips a rule that is no valid regex", () => {
    expect(SoundRules.apply("abba", [{ match: "(", replace: "" }, SoundRules.doublesRule()])).toBe("aba");
  });
});

describe("a name made of parts", () => {
  it("is joined by the shared rules, which no plain name meets", () => {
    expect(SoundRules.join("frank+land")).toBe("frankland");
    expect(SoundRules.join("friede+ia")).toBe("friedia"); // a short vowel ending takes the place of the last vowels
    expect(SoundRules.join("io+ia")).toBe("ioia"); // but never the whole part
    expect(SoundRules.join("free+island")).toBe("freeisland");
    expect(SoundRules.join("hal+land")).toBe("haland");
  });

  it("runs the rules a base set at the join, and leaves its word rules to words", () => {
    const rules: SoundRule[] = [
      SoundRules.doublesRule(),
      { match: "([aeiou])\\+u$", replace: "$1", at: "join" },
      { match: "\\+heim$", replace: "um", at: "join" }
    ];
    expect(SoundRules.join("kyoto+u", rules)).toBe("kyoto");
    expect(SoundRules.join("kan+u", rules)).toBe("kanu");
    expect(SoundRules.join("boch+heim", rules)).toBe("bochum");
    expect(SoundRules.join("oak+wood", rules)).toBe("oakwood"); // a form written for the base keeps its doubled letters
    expect(SoundRules.apply("wood", rules)).toBe("wod");
  });
});

describe("rules of a kind", () => {
  const rules: SoundRule[] = [
    SoundRules.doublesRule(),
    { match: "th", replace: "f", when: "foreign" },
    { match: "o\\+(?=[^aeiou])", replace: "+", chance: 0.3 },
    { match: "gorod$", replace: "grad", when: "long" },
    { match: "grad$", replace: "", when: "long" }
  ];

  it("keeps the rules for foreign roots to foreign roots", () => {
    expect(SoundRules.applyForeign("theodore", rules)).toBe("feodore");
    expect(SoundRules.apply("theodore", rules)).toBe("theodore");
    expect(SoundRules.join("theo+dore", rules)).toBe("theodore");
  });

  it("fires a rule with a chance for the names whose roll comes under it", () => {
    expect(SoundRules.join("novo+gorod", rules, { rolls: [0.29] })).toBe("novgorod");
    expect(SoundRules.join("novo+gorod", rules, { rolls: [0.3] })).toBe("novogorod");
    expect(SoundRules.join("novo+gorod", rules)).toBe("novogorod"); // no roll, no chance
  });

  it("runs the rules for long names one at a time, until the name fits", () => {
    const under = (max: number) => ({ fits: (name: string) => name.length <= max });
    expect(SoundRules.join("cherno+gorod", rules, under(11))).toBe("chernogorod");
    expect(SoundRules.join("cherno+gorod", rules, under(10))).toBe("chernograd");
    expect(SoundRules.join("cherno+gorod", rules, under(8))).toBe("cherno");
    expect(SoundRules.join("cherno+gorod", rules)).toBe("chernogorod"); // nothing says it is too long
  });
});

describe("doubles rule", () => {
  it("keeps only the letters given doubled", () => {
    expect(SoundRules.apply("allannaa", [SoundRules.doublesRule("ln")])).toBe("allanna");
    expect(SoundRules.apply("allannaa", [SoundRules.doublesRule()])).toBe("alana");
    expect(SoundRules.apply("a--b]]c^^", [SoundRules.doublesRule("-]^")])).toBe("a--b]]c^^");
  });

  it("reads back the letters it was made of", () => {
    for (const letters of ["", "lt", "-]^\\", "é'"])
      expect(SoundRules.getDoubles(base([SoundRules.doublesRule(letters)]))).toBe(letters);
    expect(SoundRules.getDoubles(base())).toBe("");
  });

  it("replaces a base's doubles rule in place, or adds one first", () => {
    const erosion = { match: "heim$", replace: "um" };
    const edited = base([erosion, SoundRules.doublesRule("l")]);
    SoundRules.setDoubles(edited, "nt");
    expect(edited.rules).toEqual([erosion, SoundRules.doublesRule("nt")]);

    const bare = base([erosion]);
    SoundRules.setDoubles(bare, "s");
    expect(bare.rules).toEqual([SoundRules.doublesRule("s"), erosion]);
  });
});
