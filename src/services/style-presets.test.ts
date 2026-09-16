// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Styles } from "@/generators/styles";
import { CUSTOM_PREFIX, StylePresets, SYSTEM_PRESETS } from "./style-presets";

const fetchMock = vi.fn();

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("ERROR", true);
  fetchMock.mockReset();
});

afterEach(() => vi.unstubAllGlobals());

describe("StylePresets.load", () => {
  test("the default preset comes from the bundle, not the network", async () => {
    const loaded = await StylePresets.load("default");
    expect(loaded).toEqual({ name: "default", styles: Styles.defaults });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("a system preset is fetched by name", async () => {
    const preset = { map: {} };
    fetchMock.mockResolvedValue({ json: async () => preset });
    expect(await StylePresets.load("ink")).toEqual({ name: "ink", styles: preset });
    expect(fetchMock.mock.calls[0][0]).toMatch(/^\.\/styles\/ink\.json\?v=/);
  });

  test("a failed fetch falls back to the default with one console.error and keeps the name", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await StylePresets.load("ink")).toEqual({ name: "ink", styles: Styles.defaults });
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  test("a custom preset is read from localStorage and normalized", async () => {
    const name = `${CUSTOM_PREFIX}mine`;
    const doc = structuredClone(Styles.defaults) as any;
    doc.biomes.attrs.filter = "";
    StylePresets.saveCustom(name, JSON.stringify(doc));
    const loaded = await StylePresets.load(name);
    expect(loaded.name).toBe(name);
    expect((loaded.styles as any).biomes.attrs.filter).toBeNull();
  });

  test("a missing or broken custom preset resolves to the default", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await StylePresets.load(`${CUSTOM_PREFIX}gone`)).toEqual({ name: "default", styles: Styles.defaults });
    StylePresets.saveCustom(`${CUSTOM_PREFIX}broken`, "{not json");
    expect(await StylePresets.load(`${CUSTOM_PREFIX}broken`)).toEqual({ name: "default", styles: Styles.defaults });
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });
});

describe("custom presets", () => {
  test("save, list, display and remove", () => {
    const name = `${CUSTOM_PREFIX}mine`;
    StylePresets.saveCustom(name, "{}");
    localStorage.setItem("styleOld", "{}"); // a pre-prefix custom preset
    localStorage.setItem("unrelated", "1");
    expect(StylePresets.listCustom().sort()).toEqual([name, "styleOld"]);
    expect(StylePresets.displayName(name)).toBe("mine [custom]");
    expect(StylePresets.displayName("styleOld")).toBe("Old");
    expect(StylePresets.displayName("ink")).toBe("ink");
    StylePresets.removeCustom(name);
    expect(StylePresets.listCustom()).toEqual(["styleOld"]);
  });

  test("isSystem knows the shipped names", () => {
    for (const name of SYSTEM_PRESETS) expect(StylePresets.isSystem(name)).toBe(true);
    expect(StylePresets.isSystem(`${CUSTOM_PREFIX}default`)).toBe(false);
  });
});
