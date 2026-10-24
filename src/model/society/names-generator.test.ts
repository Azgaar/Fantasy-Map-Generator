import { describe, expect, it } from "vitest";
import { Names } from "./names-generator";

describe("Names.calculateChain", () => {
  it("splits CJK names into single-character syllables", () => {
    const chain = Names.calculateChain("长安,洛阳,ソウル,서울");
    expect(chain[""]).toEqual(["长", "洛", "ソ", "서"]);
    expect(chain.长).toEqual(["安"]);
    expect(chain.安).toEqual([""]);
    expect(chain.ウ).toEqual(["ル"]);
    expect(chain.서).toEqual(["울"]);
  });

  it("keeps multi-letter syllables for alphabetic names", () => {
    expect(Names.calculateChain("Chester")[""]).toEqual(["ches"]);
  });
});
