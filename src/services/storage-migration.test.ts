// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { migrateStoredOptions } from "./storage-migration";

const storedOptions = () => JSON.parse(localStorage.getItem("options") ?? "null");
const storedLocks = () => JSON.parse(localStorage.getItem("locks") ?? "null");

beforeEach(() => localStorage.clear());

describe("migrateStoredOptions", () => {
  it("folds the keys an older browser kept per option into the stored options", () => {
    localStorage.setItem("statesNumber", "33");
    localStorage.setItem("template", "atoll");
    localStorage.setItem("distanceUnit", "leagues");
    localStorage.setItem("urbanization", "1.5");

    migrateStoredOptions();

    expect(storedOptions()).toEqual({
      states: { limit: 33 },
      heightmap: { template: "atoll" },
      units: { distance: { unit: "leagues" }, population: { urbanization: { rate: 1.5 } } }
    });
    expect(localStorage.getItem("statesNumber")).toBeNull();
  });

  it("turns the keys that held a value into the locks they stood for", () => {
    localStorage.setItem("template", "atoll");
    localStorage.setItem("prec", "180");

    migrateStoredOptions();

    expect(storedLocks()).toEqual(["template", "prec"]);
  });

  it("derives the cell count from the Points step, which is all the old key held", () => {
    localStorage.setItem("points", "6");

    migrateStoredOptions();

    expect(storedOptions().graph).toEqual({ density: 6, cellsDesired: 30000 });
    expect(storedLocks()).toEqual(["points"]);
  });

  it("parses the groups that were kept as JSON of their own, and the comma-separated winds", () => {
    localStorage.setItem("winds", "0,45,90,135,180,225");
    localStorage.setItem("burg-groups", JSON.stringify([{ name: "town" }]));
    localStorage.setItem("options-transports", JSON.stringify([{ i: 1, name: "Cart" }]));

    migrateStoredOptions();

    expect(storedOptions()).toEqual({
      climate: { winds: [0, 45, 90, 135, 180, 225] },
      burgs: { groups: [{ name: "town" }] },
      transports: [{ i: 1, name: "Cart" }]
    });
    expect(storedLocks()).toBeNull(); // none of these was ever lockable
  });

  it("leaves a browser that already has the current layout alone", () => {
    localStorage.setItem("options", '{"states":{"limit":7}}');
    localStorage.setItem("statesNumber", "33");

    migrateStoredOptions();

    expect(storedOptions()).toEqual({ states: { limit: 7 } });
    expect(localStorage.getItem("statesNumber")).toBe("33"); // not ours to consume
  });

  it("writes nothing on a first visit", () => {
    migrateStoredOptions();
    expect(localStorage.length).toBe(0);
  });
});
