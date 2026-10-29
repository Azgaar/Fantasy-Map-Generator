import { describe, expect, it } from "vitest";
import { generateSystem, generateSystemPlanets } from "./system";

const SEED = "test-seed/astral/system/1";

function expectFinite(value: number | null | undefined) {
  expect(value).not.toBeNull();
  expect(value).not.toBeUndefined();
  expect(Number.isFinite(value as number)).toBe(true);
}

describe("the astro system port", () => {
  it("is deterministic across calls", () => {
    expect(generateSystem(SEED, { primaryType: "G" })).toEqual(generateSystem(SEED, { primaryType: "G" }));
  });

  it("forces the primary class and main-sequence luminosity", () => {
    for (const spectral of ["G", "F", "K", "A", "B", "M"]) {
      const system = generateSystem(SEED, { primaryType: spectral });
      expect(system.star.primary.spectral).toBe(spectral);
      expect(system.star.primary.lumClass).toBe("V");
    }
  });

  it("caps planets at ten for every class", () => {
    for (const spectral of ["G", "F", "K", "A", "B", "M"]) {
      for (let index = 0; index < 20; index += 1) {
        const system = generateSystem(`${SEED}/${spectral}/${index}`, { primaryType: spectral });
        expect(system.planets.length).toBeLessThanOrEqual(10);
      }
    }
  });

  it("keeps planet orbits, radii, periods and moons finite", () => {
    for (const spectral of ["G", "F", "K", "A", "B", "M"]) {
      const system = generateSystem(`${SEED}/${spectral}`, { primaryType: spectral });

      for (const planet of system.planets) {
        expectFinite(planet.orbit);
        expect(planet.orbit).toBeGreaterThan(0);
        expectFinite(planet.radius);
        expect(planet.radius).toBeGreaterThan(0);
        expectFinite(planet.periodDays);
        expect(planet.periodDays).toBeGreaterThan(0);
        expectFinite(planet.eccentricity);
        expectFinite(planet.minorAxis);
        expectFinite(planet.insolation);
        expectFinite(planet.HI);

        for (const moon of planet.moons) {
          expectFinite(moon.orbit);
          expectFinite(moon.radius);
          expectFinite(moon.density);
          expectFinite(moon.hydrographics);
          expectFinite(moon.insolation);
          expectFinite(moon.HI);
          expectFinite(moon.pos.x);
          expectFinite(moon.pos.y);
        }

        for (const moonOrbit of planet.orbits) expectFinite(moonOrbit);
      }
    }
  });

  it("keeps companion masses, separations and periods finite", () => {
    for (let index = 0; index < 30; index += 1) {
      const system = generateSystem(`${SEED}/companions/${index}`, { primaryType: "G" });

      for (const companion of system.star.companions) {
        expectFinite(companion.mass);
        expect(companion.mass).toBeGreaterThan(0);
        expectFinite(companion.separationAU);
        expect(companion.separationAU).toBeGreaterThan(0);
        expectFinite(companion.periodYears);
        expect(companion.periodYears).toBeGreaterThan(0);
        expectFinite(companion.massRatio);
        expect(companion.massRatio).toBeGreaterThanOrEqual(0.08);
        expect(companion.massRatio).toBeLessThanOrEqual(0.98);
      }
    }
  });

  it("lays every body out on finite coordinates", () => {
    const system = generateSystem(SEED, { primaryType: "G" });

    expectFinite(system.star.primary.pos?.x);
    expectFinite(system.star.primary.pos?.y);

    for (const companion of system.star.companions) {
      expectFinite(companion.pos?.x);
      expectFinite(companion.pos?.y);
    }

    for (const planet of system.planets) {
      expectFinite(planet.pos?.x);
      expectFinite(planet.pos?.y);
      for (const moon of planet.moons) {
        expectFinite(moon.pos.x);
        expectFinite(moon.pos.y);
      }
    }
  });

  it("totals the star masses and builds a Bode ladder", () => {
    const system = generateSystem(SEED, { primaryType: "G" });
    const mass = system.star.primary.mass + system.star.companions.reduce((sum, star) => sum + star.mass, 0);

    expect(system.star.totalMass).toBeCloseTo(mass, 2);
    expect(system.star.orbits).toHaveLength(18);
    for (const orbit of system.star.orbits) {
      expectFinite(orbit);
      expect(orbit).toBeGreaterThan(0);
    }
  });

  it("has no NaN anywhere in a generated system", () => {
    const system = generateSystem(SEED, { primaryType: "K" });

    const hasNaN = (value: unknown): boolean => {
      if (typeof value === "number") return Number.isNaN(value);
      if (Array.isArray(value)) return value.some(hasNaN);
      if (value && typeof value === "object") return Object.values(value).some(hasNaN);
      return false;
    };

    expect(hasNaN(system)).toBe(false);
  });

  it("rolls planet summaries off their own stream", () => {
    const system = generateSystem(SEED, { primaryType: "G" });
    const first = generateSystemPlanets(SEED, system.star);
    const second = generateSystemPlanets(SEED, system.star);

    expect(first).toEqual(second);
    expect(first.length).toBe(system.planets.length);
  });
});
