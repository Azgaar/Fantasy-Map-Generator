import { beforeEach, describe, expect, it } from "vitest";
import type { LegendItem } from "@/types/Legend";
import { Legends } from "./legends";

const states: LegendItem[] = [[1, "#ff0000", "Alpha"]];
const zones: LegendItem[] = [["zone1", "#0000ff", "Gamma, delta"]];

beforeEach(() => {
  globalThis.pack = {} as typeof pack;
  Legends.initiate();
});

describe("Legends", () => {
  it("starts a map with no boxes", () => {
    expect(pack.legends).toEqual([]);
    expect(Legends.has("States")).toBe(false);
  });

  it("adds a box, then replaces its items in place", () => {
    Legends.set("States", states);
    Legends.set("Zones", zones);
    Legends.set("States", [[2, "#00ff00", "Beta"]]);

    expect(pack.legends).toEqual([
      { name: "States", items: [[2, "#00ff00", "Beta"]] },
      { name: "Zones", items: zones }
    ]);
  });

  it("removes the named box alone", () => {
    Legends.set("States", states);
    Legends.set("Zones", zones);
    Legends.remove("States");

    expect(Legends.has("States")).toBe(false);
    expect(pack.legends).toEqual([{ name: "Zones", items: zones }]);
  });
});
