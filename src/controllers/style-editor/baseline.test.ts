import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/controllers/style-preset", () => ({ parsePreset: vi.fn((json: unknown) => json) }));
vi.mock("@/services/style-presets", () => ({
  StylePresetsService: {
    load: vi.fn(),
    isSystem: (name: string) => name === "ink" || name === "default"
  }
}));

import { parsePreset } from "@/controllers/style-preset";
import { StylePresetsService } from "@/services/style-presets";
import { Baseline } from "./baseline";

const PRESET = {
  rivers: { attrs: { opacity: null, fill: "#5d97bb", filter: null } },
  labels: { groups: { capital: { attrs: { opacity: 1, "stroke-linecap": null } } } },
  burgIcons: {
    groups: {
      city: {
        groups: {
          icons: { attrs: { fill: "#ffffff" }, options: { size: 1 } },
          anchors: { attrs: { fill: "#000000" } }
        }
      }
    }
  }
};

async function baseline(): Promise<Baseline> {
  vi.mocked(StylePresetsService.load).mockResolvedValue({ name: "fmgStyle_test", styles: PRESET });
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
      groups: {
        city: {
          groups: {
            icons: { attrs: { fill: "#ffffff" }, options: { size: 1 } },
            anchors: { attrs: { fill: "#000000" } }
          }
        }
      }
    }
  });
});

describe("Baseline.diffAt", () => {
  test("is undefined for a path the preset does not define: a missing container or a missing key", async () => {
    const preset = await baseline();
    expect(preset.diffAt(["labels", "groups", "mine", "attrs", "opacity"])).toBeUndefined();
    expect(preset.diffAt(["rivers", "attrs", "mask"])).toBeUndefined();
    expect(preset.diffAt(["zones", "attrs", "opacity"])).toBeUndefined();
  });

  test("compares by value, null and undefined alike, and carries the preset value", async () => {
    const preset = await baseline();
    expect(preset.diffAt(["rivers", "attrs", "fill"])).toEqual({ changed: false, presetValue: "#5d97bb" });
    styles.rivers.attrs.fill = "#000000";
    expect(preset.diffAt(["rivers", "attrs", "fill"])).toEqual({ changed: true, presetValue: "#5d97bb" });
    delete (styles.rivers.attrs as Record<string, unknown>).filter; // removed attr vs preset null: the same
    expect(preset.diffAt(["rivers", "attrs", "filter"])).toEqual({ changed: false, presetValue: null });
    styles.labels.groups.capital.attrs["stroke-linecap"] = "round";
    expect(preset.diffAt(["labels", "groups", "capital", "attrs", "stroke-linecap"])?.changed).toBe(true);
  });

  test("compares a burg group's anchors part", async () => {
    const preset = await baseline();
    const burg = ["burgIcons", "groups", "city"];
    styles.burgIcons.groups.city.groups.icons.attrs.fill = "#123456";
    expect(preset.diffAt([...burg, "groups", "icons", "attrs", "fill"])).toEqual({
      changed: true,
      presetValue: "#ffffff"
    });
    styles.burgIcons.groups.city.groups.anchors.attrs.fill = "#123456";
    expect(preset.diffAt([...burg, "groups", "anchors", "attrs", "fill"])).toEqual({
      changed: true,
      presetValue: "#000000"
    });
  });
});

describe("Baseline.load", () => {
  test("parses the loaded preset and caches system presets only", async () => {
    vi.mocked(StylePresetsService.load).mockImplementation(async name => ({ name, styles: { map: {} } }));
    expect(await Baseline.load("ink")).toBeInstanceOf(Baseline);
    expect(await Baseline.load("ink")).toBe(await Baseline.load("ink"));
    expect(StylePresetsService.load).toHaveBeenCalledTimes(1);
    await Baseline.load("fmgStyle_mine");
    await Baseline.load("fmgStyle_mine");
    expect(StylePresetsService.load).toHaveBeenCalledTimes(3);
    expect(parsePreset).toHaveBeenCalledWith({ map: {} });
  });

  test("is undefined when the name resolves to another preset or is not a preset", async () => {
    vi.mocked(StylePresetsService.load).mockResolvedValue({ name: "default", styles: {} });
    expect(await Baseline.load("fmgStyle_gone")).toBeUndefined();
    vi.mocked(parsePreset).mockReturnValueOnce(undefined);
    vi.mocked(StylePresetsService.load).mockResolvedValue({ name: "fmgStyle_junk", styles: 42 });
    expect(await Baseline.load("fmgStyle_junk")).toBeUndefined();
  });
});
