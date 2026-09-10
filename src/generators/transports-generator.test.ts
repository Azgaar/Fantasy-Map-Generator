import { beforeEach, describe, expect, it } from "vitest";

describe("transport defaults and saved-set upgrade", () => {
  let Transports: any;

  beforeEach(async () => {
    (globalThis as any).options = { map: {} };
    await import("./transports-generator");
    Transports = (globalThis as any).Transports;
    options.map.transports = Transports.getDefaults();
  });

  it("ships aviation bound to skyports: airplanes fly, the helicopter hops within range", () => {
    const byName = Object.fromEntries(Transports.getDefaults().map((t: any) => [t.name, t]));
    expect(byName.Aircraft.domain).toBe("flight");
    expect(byName["Modern Airplane"].domain).toBe("flight");
    expect(byName.Helicopter.domain).toBe("rotor");
    expect(byName.Helicopter.range).toBe(600);
    expect(byName.Dirigible.domain).toBe("air");
    expect(byName.Teleport.domain).toBe("air");
  });

  it("upgrades a stored set from before the domains existed, leaving custom types alone", () => {
    options.map.transports = [
      { i: 15, name: "Aircraft", speed: 120, domain: "air", hoursPerDay: 4 },
      { i: 17, name: "Helicopter", speed: 220, domain: "air", hoursPerDay: 6 },
      { i: 16, name: "Dirigible", speed: 20, domain: "air", hoursPerDay: 24 },
      { i: 21, name: "Giant eagle", speed: 90, domain: "air", hoursPerDay: 10 }
    ] as never;
    const byName = Object.fromEntries(Transports.all.map((t: any) => [t.name, t]));
    expect(byName.Aircraft.domain).toBe("flight");
    expect(byName.Helicopter.domain).toBe("rotor");
    expect(byName.Helicopter.range).toBe(600);
    expect(byName.Dirigible.domain).toBe("air");
    expect(byName["Giant eagle"].domain).toBe("air");
  });

  it("getRange falls back to the default helicopter range", () => {
    expect(Transports.getRange("Helicopter")).toBe(600);
    expect(Transports.getRange("Nonsense")).toBe(600);
  });
});
