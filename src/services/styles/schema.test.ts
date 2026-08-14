import { describe, expect, test, vi } from "vitest";
import { parseStyle } from "./schema";

describe("parseStyle", () => {
  test("accepts a valid nested style and preserves unknown presentation keys", () => {
    const input = {
      layers: {
        routes: {
          presentation: { opacity: 0.9, mask: "url(#land)", "future-attr": "kept" },
          children: { roads: { presentation: { stroke: "#d06d5b", "stroke-width": 0.7 } } }
        }
      }
    };
    const style = parseStyle(input);
    expect(style.layers.routes?.presentation?.["future-attr"]).toBe("kept");
    expect(style.layers.routes?.children?.roads.presentation?.stroke).toBe("#d06d5b");
  });

  test("presentation null means remove-attribute and survives parsing", () => {
    const style = parseStyle({ layers: { rivers: { presentation: { filter: null } } } });
    expect(style.layers.rivers?.presentation?.filter).toBeNull();
  });

  test("strips an invalid typed option with a warning instead of failing the preset", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const style = parseStyle({ layers: { terrain: { options: { set: "colored", size: "not-a-number" } } } });
    expect(style.layers.terrain?.options).toEqual({ set: "colored" });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("terrain"), expect.anything());
    warn.mockRestore();
  });

  test("drops unknown layer ids with a warning (outdated preset survives)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const style = parseStyle({ layers: { notALayer: { presentation: { opacity: 1 } }, cells: {} } });
    expect((style.layers as any).notALayer).toBeUndefined();
    expect(style.layers.cells).toEqual({});
    warn.mockRestore();
  });

  test("rejects a non-object", () => {
    expect(() => parseStyle("nope")).toThrow();
  });

  test("falls back to a layerId/* wildcard child options schema", () => {
    const style = parseStyle({
      layers: { burgIcons: { children: { skyport: { options: { size: 2, bogus: "nope" } } } } }
    });
    expect(style.layers.burgIcons?.children?.skyport.options).toEqual({ size: 2 });
  });

  test("children recurse more than one level", () => {
    const style = parseStyle({
      layers: { labels: { children: { capital: { children: { inner: { presentation: { opacity: 1 } } } } } } }
    });
    expect(style.layers.labels?.children?.capital.children?.inner.presentation?.opacity).toBe(1);
  });
});
