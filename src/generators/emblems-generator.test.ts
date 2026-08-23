import { describe, expect, it } from "vitest";
import { EmblemsGenerator } from "./emblems-generator";

describe("EmblemsGenerator", () => {
  it("selects shield shapes from explicit data without reading the DOM", () => {
    const emblems = new EmblemsGenerator();
    globalThis.pack = {
      cultures: [
        { i: 0, shield: "round" },
        { i: 1, shield: "polish" }
      ],
      states: [{ i: 0 }, { i: 1, coa: { shield: "hessen", t1: "gules" } }]
    } as unknown as typeof pack;

    expect(emblems.getShield(1, undefined, "culture")).toBe("polish");
    expect(emblems.getShield(1, 1, "state")).toBe("hessen");
    expect(emblems.getShield(1, undefined, "french")).toBe("french");
  });
});
