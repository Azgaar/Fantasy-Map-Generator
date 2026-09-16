import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../style-presets", () => ({ parsePreset: vi.fn((json: unknown) => json) }));
vi.mock("@/services/style-presets", () => ({
  StylePresets: {
    load: vi.fn(),
    isSystem: (name: string) => name === "ink" || name === "default"
  }
}));

import { StylePresets } from "@/services/style-presets";
import { parsePreset } from "../style-presets";
import { Baseline, type PathSelection, storePath } from "./baseline";

const sel = (element: string, group?: string, path?: string[]): PathSelection =>
  ({ element, group, path: path ?? (group ? [element, "groups", group] : [element]) }) as PathSelection;

const PRESET = {
  rivers: { attrs: { opacity: null, fill: "#5d97bb", filter: null } },
  labels: { groups: { capital: { attrs: { opacity: 1, "stroke-linecap": null } } } },
  burgIcons: {
    burgIcons: { groups: { city: { attrs: { fill: "#ffffff" }, options: { size: 1 } } } },
    anchors: { groups: { city: { attrs: { fill: "#000000" } } } }
  }
};

async function baseline(): Promise<Baseline> {
  vi.mocked(StylePresets.load).mockResolvedValue({ name: "fmgStyle_test", styles: PRESET });
  return (await Baseline.load("fmgStyle_test"))!;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("ERROR", false);
  vi.stubGlobal("styles", {
    rivers: { attrs: { opacity: null, fill: "#5d97bb", filter: null } },
    labels: {
      groups: {
        capital: { attrs: { opacity: 1, "stroke-linecap": null } },
        mine: { attrs: { opacity: 0.5 } }
      }
    },
    burgIcons: {
      burgIcons: { groups: { city: { attrs: { fill: "#ffffff" }, options: { size: 1 } } } },
      anchors: { groups: { city: { attrs: { fill: "#000000" } } } }
    }
  });
});

describe("storePath", () => {
  test("hangs a relative path off the selection's node", () => {
    expect(storePath(sel("rivers"), ["attrs", "fill"])).toEqual(["rivers", "attrs", "fill"]);
    expect(storePath(sel("labels", "capital"), ["attrs", "opacity"])).toEqual([
      "labels",
      "groups",
      "capital",
      "attrs",
      "opacity"
    ]);
  });

  test("routes the composed burg icon form to its two records", () => {
    const burg = sel("burgIcons", "city", ["burgIcons", "burgIcons", "groups", "city"]);
    expect(storePath(burg, ["attrs", "fill"])).toEqual(["burgIcons", "burgIcons", "groups", "city", "attrs", "fill"]);
    expect(storePath(burg, ["anchors", "attrs", "fill"])).toEqual([
      "burgIcons",
      "anchors",
      "groups",
      "city",
      "attrs",
      "fill"
    ]);
  });
});

describe("Baseline.diffAt", () => {
  test("is undefined for a path the preset does not define: a missing container or a missing key", async () => {
    const preset = await baseline();
    expect(preset.diffAt(sel("labels", "mine"), ["attrs", "opacity"])).toBeUndefined();
    expect(preset.diffAt(sel("rivers"), ["attrs", "mask"])).toBeUndefined();
    expect(preset.diffAt(sel("zones"), ["attrs", "opacity"])).toBeUndefined();
  });

  test("compares by value, null and undefined alike, and carries the preset value", async () => {
    const preset = await baseline();
    expect(preset.diffAt(sel("rivers"), ["attrs", "fill"])).toEqual({ changed: false, presetValue: "#5d97bb" });
    styles.rivers.attrs.fill = "#000000";
    expect(preset.diffAt(sel("rivers"), ["attrs", "fill"])).toEqual({ changed: true, presetValue: "#5d97bb" });
    delete (styles.rivers.attrs as Record<string, unknown>).filter; // removed attr vs preset null: the same
    expect(preset.diffAt(sel("rivers"), ["attrs", "filter"])).toEqual({ changed: false, presetValue: null });
    styles.labels.groups.capital.attrs["stroke-linecap"] = "round";
    expect(preset.diffAt(sel("labels", "capital"), ["attrs", "stroke-linecap"])?.changed).toBe(true);
  });

  test("maps the anchors subsection to the anchors record", async () => {
    const preset = await baseline();
    const burg = sel("burgIcons", "city", ["burgIcons", "burgIcons", "groups", "city"]);
    styles.burgIcons.anchors.groups.city.attrs.fill = "#123456";
    expect(preset.diffAt(burg, ["attrs", "fill"])?.changed).toBe(false);
    expect(preset.diffAt(burg, ["anchors", "attrs", "fill"])).toEqual({ changed: true, presetValue: "#000000" });
  });
});

describe("Baseline.load", () => {
  test("parses the loaded preset and caches system presets only", async () => {
    vi.mocked(StylePresets.load).mockImplementation(async name => ({ name, styles: { map: {} } }));
    expect(await Baseline.load("ink")).toBeInstanceOf(Baseline);
    expect(await Baseline.load("ink")).toBe(await Baseline.load("ink"));
    expect(StylePresets.load).toHaveBeenCalledTimes(1);
    await Baseline.load("fmgStyle_mine");
    await Baseline.load("fmgStyle_mine");
    expect(StylePresets.load).toHaveBeenCalledTimes(3);
    expect(parsePreset).toHaveBeenCalledWith({ map: {} });
  });

  test("is undefined when the name resolves to another preset or is not a preset", async () => {
    vi.mocked(StylePresets.load).mockResolvedValue({ name: "default", styles: {} });
    expect(await Baseline.load("fmgStyle_gone")).toBeUndefined();
    vi.mocked(parsePreset).mockReturnValueOnce(undefined);
    vi.mocked(StylePresets.load).mockResolvedValue({ name: "fmgStyle_junk", styles: 42 });
    expect(await Baseline.load("fmgStyle_junk")).toBeUndefined();
  });
});
