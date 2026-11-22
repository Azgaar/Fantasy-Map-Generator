import { describe, expect, it } from "vitest";
import type { NameBase } from "@/data/name-bases";
import { applyRules, doublesRule, getDoubles, setDoubles } from "./sound-rules";

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
    expect(applyRules("boch+heim", [{ match: "\\+heim$", replace: "um" }])).toBe("bochum");
  });

  it("skips a rule that is no valid regex", () => {
    expect(applyRules("abba", [{ match: "(", replace: "" }, doublesRule()])).toBe("aba");
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
