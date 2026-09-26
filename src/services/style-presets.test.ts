// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import "@/generators/relief-generator"; // the models own the icon sets that tell references from text
import "@/generators/burgs-generator";
import "@/generators/goods-generator";
import { Styles } from "@/generators/styles";
import { CUSTOM_PREFIX, StylePresetsService, SYSTEM_PRESETS } from "./style-presets";

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
    const loaded = await StylePresetsService.load("default");
    expect(loaded).toEqual({ name: "default", styles: Styles.defaults });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("a system preset is fetched by name", async () => {
    const preset = { map: {} };
    fetchMock.mockResolvedValue({ ok: true, json: async () => preset });
    expect(await StylePresetsService.load("ink")).toEqual({ name: "ink", styles: preset });
    expect(fetchMock.mock.calls[0][0]).toMatch(/^\.\/styles\/ink\.json\?v=/);
  });

  test("a failed fetch falls back to the default with one console.error and the error message", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await StylePresetsService.load("ink")).toEqual({
      name: "default",
      styles: Styles.defaults,
      error: "Cannot fetch style preset ink"
    });
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  test("a preset the server refuses resolves to the default with an error", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    expect(await StylePresetsService.load("ink")).toEqual({
      name: "default",
      styles: Styles.defaults,
      error: "Cannot fetch style preset ink"
    });
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  test("a custom preset is read from localStorage and normalized", async () => {
    const name = `${CUSTOM_PREFIX}mine`;
    const doc = structuredClone(Styles.defaults) as any;
    doc.biomes.attrs.filter = "";
    StylePresetsService.saveCustom(name, JSON.stringify(doc));
    const loaded = await StylePresetsService.load(name);
    expect(loaded.name).toBe(name);
    expect((loaded.styles as any).biomes.attrs.filter).toBeNull();
  });

  test("a missing or broken custom preset resolves to the default", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await StylePresetsService.load(`${CUSTOM_PREFIX}gone`)).toEqual({
      name: "default",
      styles: Styles.defaults,
      error: `Custom style ${CUSTOM_PREFIX}gone is not found in localStorage`
    });
    StylePresetsService.saveCustom(`${CUSTOM_PREFIX}broken`, "{not json");
    expect(await StylePresetsService.load(`${CUSTOM_PREFIX}broken`)).toEqual({
      name: "default",
      styles: Styles.defaults,
      error: `Custom style ${CUSTOM_PREFIX}broken stored in localStorage is not valid`
    });
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });
});

describe("custom presets", () => {
  test("save, list, display and remove", () => {
    const name = `${CUSTOM_PREFIX}mine`;
    StylePresetsService.saveCustom(name, "{}");
    localStorage.setItem("fmgStyle_old", "{}"); // the pre-1.154 prefix
    localStorage.setItem("unrelated", "1");
    expect(StylePresetsService.listCustom().sort()).toEqual([name, "fmgStyle_old"]);
    expect(StylePresetsService.displayName(name)).toBe("mine [custom]");
    expect(StylePresetsService.displayName("fmgStyle_old")).toBe("old [custom]");
    expect(StylePresetsService.displayName("ink")).toBe("ink");
    StylePresetsService.removeCustom(name);
    expect(StylePresetsService.listCustom()).toEqual(["fmgStyle_old"]);
  });

  test("isSystem knows the shipped names", () => {
    for (const name of SYSTEM_PRESETS) expect(StylePresetsService.isSystem(name)).toBe(true);
    expect(StylePresetsService.isSystem(`${CUSTOM_PREFIX}default`)).toBe(false);
  });
});
