import { describe, expect, it, vi } from "vitest";
import type { Rng } from "@/utils/rng";
import {
  ALIGNMENTS,
  type Alignment,
  CONTRADICTIONS,
  CULTURAL_VALUES,
  PREVAILING_ALIGNMENT,
  rollAlignment,
  rollFigureTraits,
  rollValues,
  TRAIT_COUNTS,
  traitsRng,
  VICES,
  VIRTUES
} from "./culture-traits";

/** an rng that answers the dice in a fixed order and the word draws from the start of a list */
function fixedRng(faces: number[], word = 0): Rng {
  let i = 0;
  return {
    next: () => 0,
    range: lo => lo,
    int: () => word,
    d: () => faces[Math.min(i++, faces.length - 1)],
    choice: items => items[0],
    chance: () => false
  };
}

const counts = (words: readonly string[]) => {
  const all: Record<string, number> = {};
  for (const word of words) all[word] = (all[word] ?? 0) + 1;
  return all;
};

describe("the alignment tables", () => {
  it("wears 12 faces drawn from the five alignments on every prevailing column", () => {
    for (const parent of ALIGNMENTS) {
      const column = PREVAILING_ALIGNMENT[parent];
      expect(column).toHaveLength(12);
      for (const face of column) expect(ALIGNMENTS).toContain(face);
    }
  });

  it("skews a culture from scratch towards neutral: 6 neutral, 2 lawful, 2 chaotic, 1 good, 1 evil", () => {
    expect(counts(PREVAILING_ALIGNMENT.neutral)).toEqual({ evil: 1, chaotic: 2, neutral: 6, lawful: 2, good: 1 });
  });

  it("weighs every value column as 1d12, redirecting only on the last two faces", () => {
    for (const alignment of ALIGNMENTS) {
      const column = CULTURAL_VALUES[alignment];
      expect(column).toHaveLength(12);
      for (const face of column.slice(0, 10)) expect(typeof face).toBe("string");
      for (const face of column.slice(10)) expect(face).toHaveProperty("redirect");
    }
  });

  it("redirects to another column's top ten, so a redirect can never recurse", () => {
    for (const alignment of ALIGNMENTS) {
      for (const face of CULTURAL_VALUES[alignment].slice(10)) {
        if (typeof face === "string") continue;
        expect(ALIGNMENTS).toContain(face.redirect);
        for (const target of CULTURAL_VALUES[face.redirect].slice(0, 10)) expect(typeof target).toBe("string");
      }
    }
  });

  it("gives every alignment the trait mix the rule table dictates", () => {
    const expected = {
      good: { virtues: 3, vices: 0 },
      lawful: { virtues: 2, vices: 1 },
      neutral: { virtues: 1, vices: 1 },
      chaotic: { virtues: 1, vices: 2 },
      evil: { virtues: 0, vices: 3 }
    };
    expect(TRAIT_COUNTS).toEqual(expected);
    // three traits everywhere but the neutral middle, which carries one of each
    for (const [alignment, { virtues, vices }] of Object.entries(expected)) {
      expect(virtues + vices).toBe(alignment === "neutral" ? 2 : 3);
    }
  });
});

describe("the word lists", () => {
  it("ships 50 lowercase single words on each side, none twice", () => {
    for (const list of [VIRTUES, VICES]) {
      expect(list).toHaveLength(50);
      expect(new Set(list).size).toBe(50);
      for (const word of list) {
        expect(word).toBe(word.toLowerCase());
        expect(word).toMatch(/^[a-z]+$/);
      }
    }
  });

  it("never repeats a word across the two lists", () => {
    const shared = VIRTUES.filter(word => VICES.includes(word));
    expect(shared).toEqual([]);
  });

  it("pairs a virtue with a vice, once each, on every contradiction", () => {
    const paired = new Set<string>();
    for (const [virtue, vice] of CONTRADICTIONS) {
      expect(VIRTUES).toContain(virtue);
      expect(VICES).toContain(vice);
      expect(paired.has(virtue)).toBe(false);
      expect(paired.has(vice)).toBe(false);
      paired.add(virtue);
      paired.add(vice);
    }
  });
});

describe("rollAlignment", () => {
  it("draws the neutral column when a culture starts from scratch", () => {
    const rng = traitsRng("alignment", "culture", 1);
    const drawn = Array.from({ length: 2000 }, () => rollAlignment(rng));
    const share = drawn.filter(face => face === "neutral").length / drawn.length;
    expect(share).toBeGreaterThan(0.45);
    expect(share).toBeLessThan(0.55);
  });

  it("draws the parent's column otherwise", () => {
    for (const parent of ALIGNMENTS) {
      const rng = traitsRng(`prevailing-${parent}`, "culture", 1);
      const allowed = new Set(PREVAILING_ALIGNMENT[parent]);
      for (let i = 0; i < 200; i++) expect(allowed).toContain(rollAlignment(rng, parent));
    }
  });

  it("follows the 1d12 faces in order", () => {
    expect(rollAlignment(fixedRng([1]), "good")).toBe("evil");
    expect(rollAlignment(fixedRng([12]), "good")).toBe("good");
    expect(rollAlignment(fixedRng([9]), "chaotic")).toBe("neutral");
  });
});

describe("rollValues", () => {
  it("returns two values a culture prizes", () => {
    expect(rollValues(fixedRng([2, 10]), "lawful")).toEqual(["justice", "honor"]);
  });

  it("follows a redirect into the other column's top ten", () => {
    // good face 11 sends the roll to the lawful column, where face 7 is loyalty
    expect(rollValues(fixedRng([11, 7, 10]), "good")).toEqual(["loyalty", "love"]);
  });

  it("collapses a duplicate roll into one dominant value", () => {
    expect(rollValues(fixedRng([6]), "chaotic")).toEqual(["celebration"]);
  });

  it("never returns a value no column lists", () => {
    const known = new Set(
      Object.values(CULTURAL_VALUES)
        .flat()
        .filter(face => typeof face === "string")
    );
    const rng = traitsRng("values", "culture", 3);
    for (let i = 0; i < 200; i++) {
      const values = rollValues(rng, "neutral");
      expect(values.length === 1 || values.length === 2).toBe(true);
      for (const value of values) expect(known).toContain(value);
    }
  });
});

describe("rollFigureTraits", () => {
  const alignments = ALIGNMENTS as readonly Alignment[];

  it("draws the counts the alignment dictates, from the right list", () => {
    for (const alignment of alignments) {
      const rng = traitsRng(`traits-${alignment}`, "figure", 1);
      for (let i = 0; i < 100; i++) {
        const { virtues, vices } = rollFigureTraits(rng, alignment);
        expect(virtues).toHaveLength(TRAIT_COUNTS[alignment].virtues);
        expect(vices).toHaveLength(TRAIT_COUNTS[alignment].vices);
        for (const word of virtues) expect(VIRTUES).toContain(word);
        for (const word of vices) expect(VICES).toContain(word);
      }
    }
  });

  it("never draws a word twice, nor both halves of a contradiction", () => {
    const antonyms = new Map(
      CONTRADICTIONS.flatMap(([virtue, vice]) => [
        [virtue, vice],
        [vice, virtue]
      ])
    );
    for (const alignment of alignments) {
      const rng = traitsRng(`contradictions-${alignment}`, "figure", 7);
      for (let i = 0; i < 300; i++) {
        const { virtues, vices } = rollFigureTraits(rng, alignment);
        const drawn = [...virtues, ...vices];
        expect(new Set(drawn).size).toBe(drawn.length);
        for (const word of drawn) expect(drawn).not.toContain(antonyms.get(word));
      }
    }
  });

  it("rolls from its own stream, never from Math.random", () => {
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("a trait roll touched the main stream");
    });
    try {
      const rng = traitsRng("quiet", "figure", 1);
      expect(() => rollFigureTraits(rng, "neutral")).not.toThrow();
      expect(() => rollValues(rng, "evil")).not.toThrow();
    } finally {
      random.mockRestore();
    }
  });
});
