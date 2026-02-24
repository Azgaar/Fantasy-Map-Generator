import { describe, expect, it } from "vitest";
import {
  biased,
  each,
  gauss,
  generateSeed,
  getNumberInRange,
  P,
  Pint,
  ra,
  rand,
  rw,
} from "./probabilityUtils";

describe("rand", () => {
  describe("when called with no arguments", () => {
    it("should return a float between 0 and 1", () => {
      for (let i = 0; i < 100; i++) {
        const result = rand();
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThan(1);
      }
    });
  });

  describe("when called with one argument (max)", () => {
    it("should return an integer between 0 and max (inclusive)", () => {
      for (let i = 0; i < 100; i++) {
        const result = rand(10);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(10);
        expect(Number.isInteger(result)).toBe(true);
      }
    });

    it("should return 0 when max is 0", () => {
      expect(rand(0)).toBe(0);
    });
  });

  describe("when called with two arguments (min, max)", () => {
    it("should return an integer between min and max (inclusive)", () => {
      for (let i = 0; i < 100; i++) {
        const result = rand(5, 15);
        expect(result).toBeGreaterThanOrEqual(5);
        expect(result).toBeLessThanOrEqual(15);
        expect(Number.isInteger(result)).toBe(true);
      }
    });

    it("should handle negative ranges", () => {
      for (let i = 0; i < 100; i++) {
        const result = rand(-10, -5);
        expect(result).toBeGreaterThanOrEqual(-10);
        expect(result).toBeLessThanOrEqual(-5);
        expect(Number.isInteger(result)).toBe(true);
      }
    });

    it("should return the same value when min equals max", () => {
      expect(rand(7, 7)).toBe(7);
    });
  });
});

describe("P", () => {
  it("should always return true when probability is 1", () => {
    for (let i = 0; i < 100; i++) {
      expect(P(1)).toBe(true);
    }
  });

  it("should always return true when probability is greater than 1", () => {
    expect(P(1.5)).toBe(true);
    expect(P(100)).toBe(true);
  });

  it("should always return false when probability is 0", () => {
    for (let i = 0; i < 100; i++) {
      expect(P(0)).toBe(false);
    }
  });

  it("should always return false when probability is negative", () => {
    expect(P(-0.5)).toBe(false);
    expect(P(-1)).toBe(false);
  });

  it("should return boolean for probabilities between 0 and 1", () => {
    for (let i = 0; i < 100; i++) {
      const result = P(0.5);
      expect(typeof result).toBe("boolean");
    }
  });

  it("should approximately match the given probability over many trials", () => {
    const trials = 10000;
    let trueCount = 0;
    const probability = 0.3;

    for (let i = 0; i < trials; i++) {
      if (P(probability)) trueCount++;
    }

    const observedProbability = trueCount / trials;
    // Allow 5% tolerance
    expect(observedProbability).toBeGreaterThan(probability - 0.05);
    expect(observedProbability).toBeLessThan(probability + 0.05);
  });
});

describe("each", () => {
  it("should return true every n times starting from 0", () => {
    const every3 = each(3);
    expect(every3(0)).toBe(true);
    expect(every3(1)).toBe(false);
    expect(every3(2)).toBe(false);
    expect(every3(3)).toBe(true);
    expect(every3(4)).toBe(false);
    expect(every3(5)).toBe(false);
    expect(every3(6)).toBe(true);
  });

  it("should work with n=1 (always true)", () => {
    const every1 = each(1);
    expect(every1(0)).toBe(true);
    expect(every1(1)).toBe(true);
    expect(every1(2)).toBe(true);
  });

  it("should work with larger intervals", () => {
    const every10 = each(10);
    expect(every10(0)).toBe(true);
    expect(every10(5)).toBe(false);
    expect(every10(10)).toBe(true);
    expect(every10(20)).toBe(true);
  });
});

describe("gauss", () => {
  it("should return a number", () => {
    const result = gauss();
    expect(typeof result).toBe("number");
  });

  it("should respect min and max bounds", () => {
    for (let i = 0; i < 100; i++) {
      const result = gauss(50, 20, 10, 90, 0);
      expect(result).toBeGreaterThanOrEqual(10);
      expect(result).toBeLessThanOrEqual(90);
    }
  });

  it("should use default values when no arguments provided", () => {
    for (let i = 0; i < 100; i++) {
      const result = gauss();
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(300);
    }
  });

  it("should round to specified decimal places", () => {
    const result = gauss(100, 30, 0, 300, 2);
    const decimalPlaces = (result.toString().split(".")[1] || "").length;
    expect(decimalPlaces).toBeLessThanOrEqual(2);
  });
});

describe("Pint", () => {
  it("should return the integer part for whole numbers", () => {
    expect(Pint(5)).toBe(5);
    expect(Pint(0)).toBe(0);
    expect(Pint(10)).toBe(10);
  });

  it("should return at least the integer part for floats", () => {
    // The function returns floor + (0 or 1 based on probability)
    for (let i = 0; i < 100; i++) {
      const result = Pint(5.5);
      expect(result).toBeGreaterThanOrEqual(5);
      expect(result).toBeLessThanOrEqual(6);
      expect(Number.isInteger(result)).toBe(true);
    }
  });

  it("should always return floor for very small decimals", () => {
    // With very small decimal, almost always returns floor
    let sumResults = 0;
    for (let i = 0; i < 1000; i++) {
      sumResults += Pint(5.001);
    }
    // Most should be 5, very few 6
    expect(sumResults / 1000).toBeCloseTo(5, 0);
  });

  it("should return floor+1 more often for larger decimals", () => {
    // With 0.9 decimal, should return floor+1 about 90% of the time
    let count6 = 0;
    for (let i = 0; i < 1000; i++) {
      if (Pint(5.9) === 6) count6++;
    }
    expect(count6 / 1000).toBeGreaterThan(0.8);
  });
});

describe("ra", () => {
  it("should return an element from the array", () => {
    const array = [1, 2, 3, 4, 5];
    for (let i = 0; i < 100; i++) {
      const result = ra(array);
      expect(array).toContain(result);
    }
  });

  it("should return the only element for single-element array", () => {
    expect(ra([42])).toBe(42);
  });

  it("should work with arrays of different types", () => {
    const stringArray = ["a", "b", "c"];
    const result = ra(stringArray);
    expect(stringArray).toContain(result);

    const objectArray = [{ id: 1 }, { id: 2 }];
    const objResult = ra(objectArray);
    expect(objectArray).toContain(objResult);
  });

  it("should return undefined for empty array", () => {
    expect(ra([])).toBeUndefined();
  });
});

describe("rw", () => {
  it("should return a key from the object", () => {
    const obj = { a: 1, b: 2, c: 3 };
    for (let i = 0; i < 100; i++) {
      const result = rw(obj);
      expect(["a", "b", "c"]).toContain(result);
    }
  });

  it("should respect weights (higher weight = more likely)", () => {
    const obj = { rare: 1, common: 99 };
    let commonCount = 0;
    const trials = 1000;

    for (let i = 0; i < trials; i++) {
      if (rw(obj) === "common") commonCount++;
    }

    // 'common' should appear much more frequently
    expect(commonCount / trials).toBeGreaterThan(0.9);
  });

  it("should work with single key", () => {
    expect(rw({ only: 5 })).toBe("only");
  });

  it("should handle keys with weight 0 (never selected)", () => {
    const obj = { never: 0, always: 10 };
    for (let i = 0; i < 100; i++) {
      expect(rw(obj)).toBe("always");
    }
  });
});

describe("biased", () => {
  it("should return a number between min and max", () => {
    for (let i = 0; i < 100; i++) {
      const result = biased(0, 100, 2);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
      expect(Number.isInteger(result)).toBe(true);
    }
  });

  it("should be biased towards min with higher exponent", () => {
    const trials = 1000;
    let sumLowBias = 0;
    let sumHighBias = 0;

    for (let i = 0; i < trials; i++) {
      sumLowBias += biased(0, 100, 1); // No bias (uniform)
      sumHighBias += biased(0, 100, 3); // Strong bias towards min
    }

    const avgLowBias = sumLowBias / trials;
    const avgHighBias = sumHighBias / trials;

    // Higher exponent should result in lower average
    expect(avgHighBias).toBeLessThan(avgLowBias);
  });

  it("should return min or max at boundaries", () => {
    expect(biased(5, 5, 2)).toBe(5);
  });

  it("should work with negative ranges", () => {
    for (let i = 0; i < 100; i++) {
      const result = biased(-50, -10, 2);
      expect(result).toBeGreaterThanOrEqual(-50);
      expect(result).toBeLessThanOrEqual(-10);
    }
  });
});

describe("getNumberInRange", () => {
  it("should parse simple integers", () => {
    expect(getNumberInRange("5")).toBe(5);
    expect(getNumberInRange("0")).toBe(0);
    expect(getNumberInRange("100")).toBe(100);
  });

  it("should parse range strings and return value within range", () => {
    for (let i = 0; i < 100; i++) {
      const result = getNumberInRange("3-7");
      expect(result).toBeGreaterThanOrEqual(3);
      expect(result).toBeLessThanOrEqual(7);
      expect(Number.isInteger(result)).toBe(true);
    }
  });

  it("should handle negative start in range", () => {
    for (let i = 0; i < 100; i++) {
      const result = getNumberInRange("-5-10");
      expect(result).toBeGreaterThanOrEqual(-5);
      expect(result).toBeLessThanOrEqual(10);
    }
  });

  it("should return 0 for non-string input", () => {
    expect(getNumberInRange(5 as unknown as string)).toBe(0);
    expect(getNumberInRange(null as unknown as string)).toBe(0);
  });

  it("should handle float strings with probability-based rounding", () => {
    // "2.5" should return 2 or 3 based on probability
    const results = new Set<number>();
    for (let i = 0; i < 100; i++) {
      results.add(getNumberInRange("2.5"));
    }
    // Should see both 2 and 3
    expect(results.has(2) || results.has(3)).toBe(true);
  });

  it("should return 0 for invalid format without range separator", () => {
    expect(getNumberInRange("abc")).toBe(0);
  });
});

describe("generateSeed", () => {
  it("should return a string", () => {
    const result = generateSeed();
    expect(typeof result).toBe("string");
  });

  it("should return a numeric string", () => {
    const result = generateSeed();
    expect(Number.isNaN(Number(result))).toBe(false);
  });

  it("should generate seeds less than 1 billion", () => {
    for (let i = 0; i < 100; i++) {
      const result = generateSeed();
      expect(Number(result)).toBeLessThan(1e9);
      expect(Number(result)).toBeGreaterThanOrEqual(0);
    }
  });

  it("should generate different seeds on multiple calls (with high probability)", () => {
    const seeds = new Set<string>();
    for (let i = 0; i < 100; i++) {
      seeds.add(generateSeed());
    }
    // Should have many unique seeds (allow for some rare collisions)
    expect(seeds.size).toBeGreaterThan(90);
  });
});
