import { describe, expect, it } from "vitest";
import { Corpora } from "./corpora";

describe("Corpora.chainOf", () => {
  it("splits CJK names into single-character syllables", () => {
    const chain = Corpora.chainOf(["长安", "洛阳", "ソウル", "서울"]);
    expect(chain[""]).toEqual(["长", "洛", "ソ", "서"]);
    expect(chain.长).toEqual(["安"]);
    expect(chain.安).toEqual([""]);
    expect(chain.ウ).toEqual(["ル"]);
    expect(chain.서).toEqual(["울"]);
  });

  it("keeps multi-letter syllables for alphabetic names", () => {
    expect(Corpora.chainOf(["Chester"])[""]).toEqual(["ches"]);
  });
});

describe("Corpora.cut", () => {
  const names = ["Waldbach", "Kord", "Ama", "Wald"];

  it("keeps three letters at least and closes as the base's names do", () => {
    expect(Corpora.cut("waldbach", names, 1)).toBe("wald");
    expect(Corpora.cut("amadea", names, 1)).toBe("ama");
    expect(Corpora.cut("kord", names, 1)).toBe("kord");
  });
});
