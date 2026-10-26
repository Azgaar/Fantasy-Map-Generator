import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateSystemDetails, systemDetailsFor } from "./details";

const INPUT = { seed: "test-seed/astral/system/1", systemName: "Kessel", spectral: "G" };
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const PLANET_TYPES = ["rocky", "super-Earth/sub-Neptune", "Neptune-like", "gas giant"];

let savedOptions: typeof options;

beforeEach(() => {
  savedOptions = globalThis.options;
  globalThis.options = {
    map: {
      seed: "map-seed",
      units: { population: { scale: 1000, urbanization: { rate: 0.1 } } }
    }
  } as unknown as typeof options;
});

afterEach(() => {
  globalThis.options = savedOptions;
});

describe("generated system details", () => {
  it("is deterministic for the same inputs", () => {
    expect(generateSystemDetails(INPUT)).toEqual(generateSystemDetails(INPUT));
  });

  it("forces the chart's spectral class and a main-sequence primary", () => {
    for (const spectral of ["G", "F", "K", "A", "B", "M"]) {
      const details = generateSystemDetails({ ...INPUT, spectral });
      expect(details.stars[0].spectral).toBe(spectral);
      expect(details.stars[0].luminosityClass).toBe("V");
    }
  });

  it("names planets with Roman numerals and moons with letters", () => {
    const details = generateSystemDetails({ ...INPUT, systemName: "Kessel" });

    details.planets.forEach((planet, index) => {
      expect(planet.name).toBe(`Kessel ${ROMAN[index]}`);
      planet.moons.forEach((moon, moonIndex) => {
        expect(moon).toBe(`${planet.name} ${String.fromCharCode(97 + moonIndex)}`);
      });
    });
  });

  it("keeps the astro pre-classification as the planet type", () => {
    const details = generateSystemDetails(INPUT);
    for (const planet of details.planets) expect(PLANET_TYPES).toContain(planet.type);
  });

  it("reports the totals and the snow line", () => {
    const details = generateSystemDetails(INPUT);
    const starMass = details.stars.reduce((sum, star) => sum + star.massSolar, 0);

    expect(details.totalMassSolar).toBeCloseTo(starMass, 3);
    expect(details.snowLineAU).toBeCloseTo(2.7 * Math.sqrt(details.stars[0].luminositySolar), 10);
    expect(details.planetCount).toBe(details.planets.length);
    expect(details.planetCount).toBeLessThanOrEqual(10);
  });

  it("labels the primary and its companions", () => {
    const details = generateSystemDetails(INPUT);

    expect(details.stars[0].role).toBe("Primary");
    details.stars.slice(1).forEach((star, index) => {
      expect(star.role).toBe(index === 0 ? "Secondary" : `Companion ${index + 2}`);
      expect(star.luminosityClass).toBeNull();
      expect(Number.isFinite(star.luminositySolar)).toBe(true);
      expect(Number.isFinite(star.separationAU)).toBe(true);
      expect(Number.isFinite(star.periodYears)).toBe(true);
      expect(Number.isFinite(star.massRatio)).toBe(true);
    });
  });

  it("gives every row finite display values", () => {
    const details = generateSystemDetails(INPUT);

    for (const star of details.stars) {
      expect(Number.isFinite(star.massSolar)).toBe(true);
      expect(star.massSolar).toBeGreaterThan(0);
      expect(Number.isFinite(star.luminositySolar)).toBe(true);
      expect(star.luminositySolar).toBeGreaterThan(0);
      expect(star.color).toMatch(/^rgb\(/);
    }

    for (const planet of details.planets) {
      expect(Number.isFinite(planet.orbitAU)).toBe(true);
      expect(planet.orbitAU).toBeGreaterThan(0);
      expect(Number.isFinite(planet.radiusEarth)).toBe(true);
      expect(planet.radiusEarth).toBeGreaterThan(0);
      expect(Number.isFinite(Number(planet.gravity))).toBe(true);
      expect(Number.isFinite(Number(planet.temperatureC))).toBe(true);
      expect(planet.temperature).toBeTruthy();
      expect(planet.atmosphere).toBeTruthy();
      expect(planet.water).toBeGreaterThanOrEqual(0);
      expect(planet.water).toBeLessThanOrEqual(100);
      expect(planet.habitability).toBeTruthy();
      expect(planet.hi).toBeGreaterThanOrEqual(1);
      expect(planet.hi).toBeLessThanOrEqual(5);
      expect(Number.isFinite(planet.periodDays)).toBe(true);
      expect(planet.periodDays).toBeGreaterThan(0);
      expect(planet.color).toBeTruthy();
    }
  });

  it("handles a system with no planets", () => {
    let details = generateSystemDetails({ ...INPUT, seed: "empty", spectral: "B" });
    for (let index = 0; index < 100 && details.planetCount > 0; index += 1) {
      details = generateSystemDetails({ ...INPUT, seed: `empty/${index}`, spectral: "B" });
    }

    expect(details.planetCount).toBe(0);
    expect(details.planets).toEqual([]);
    expect(details.stars.length).toBeGreaterThan(0);
  });
});

describe("the burg wrapper", () => {
  it("seeds from the map and the burg id, with the population's class", () => {
    const burg = { i: 7, name: "Kessel", population: 500 };

    expect(systemDetailsFor(burg)).toEqual(
      generateSystemDetails({
        seed: "map-seed/astral/system/7",
        systemName: "Kessel",
        spectral: "A"
      })
    );
  });

  it("falls back to a plain system name", () => {
    expect(systemDetailsFor({ i: 8, population: 10 }).planets[0]?.name).toMatch(/^System /);
  });
});
