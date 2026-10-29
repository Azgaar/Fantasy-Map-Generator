import { describe, expect, it } from "vitest";
import { Icons } from "@/model/icons";
import { Markers } from "@/model/story/markers-generator";
import { ANOMALY_FAMILIES, astralLegend, MARKER_READINGS, readingOf } from "./astral-markers";

describe("astral marker readings", () => {
  // the cold transform of the markers generator can outlast the default budget under load
  it("covers every default marker config type", async () => {
    await import("@/model/story/markers-generator");
    const types = Markers.getConfig().map(entry => entry.type);
    expect(types.length).toBeGreaterThan(30);
    expect(types.filter(type => !MARKER_READINGS[type])).toEqual([]);
  }, 60000);

  it("gives every reading a name and an icon that resolves to a glyph", () => {
    for (const [type, { reading, icon }] of Object.entries(MARKER_READINGS)) {
      expect(reading.trim(), type).not.toBe("");
      expect(Icons.reference(icon), type).toMatch(/^glyph-/);
    }
  });

  it("reads a known type and leaves an unknown one alone", () => {
    expect(readingOf("dungeons")?.reading).toBe("derelicts");
    expect(readingOf("volcano")).toBeUndefined();
    expect(readingOf(undefined)).toBeUndefined();
  });
});

describe("astral marker legends", () => {
  it("has a legend family for every reading", () => {
    expect(Object.keys(MARKER_READINGS).filter(type => !ANOMALY_FAMILIES[type])).toEqual([]);
  });

  it("writes a stable legend from two seeded picks", () => {
    for (const type of Object.keys(MARKER_READINGS)) {
      const legend = astralLegend(type, `${type}|seed`);
      expect(legend, type).toBeTruthy();
      expect(astralLegend(type, `${type}|seed`), type).toBe(legend); // same marker, same legend
    }
    expect(astralLegend("volcano", "seed")).toBeUndefined();
  });

  it("varies across markers within a family", () => {
    const legends = new Set(Array.from({ length: 24 }, (_, i) => astralLegend("ruins", `marker|${i}`)));
    expect(legends.size).toBeGreaterThan(1);
  });
});
