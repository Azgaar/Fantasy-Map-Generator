import { describe, expect, it, vi } from "vitest";
import type { Style } from "@/types/style";
import {
  getLegacyRendererLayerVisibility,
  importLegacyRendererStyle,
  LEGACY_RENDERER_GROUP_SELECTORS,
  removeLegacyRendererGroups
} from "./legacy-svg-import";

const element = (attributes: Record<string, string>): SVGElement =>
  ({
    getAttribute: (name: string) => attributes[name] ?? null,
    style: { getPropertyValue: (name: string) => attributes[`style:${name}`] ?? "" }
  }) as unknown as SVGElement;

describe("legacy SVG renderer import", () => {
  it("hydrates semantic style before imported renderer groups are discarded", () => {
    const elements = new Map<string, SVGElement>([
      ["#landmass", element({ fill: "#c0ffee", opacity: "0.75" })],
      ["#statesBody", element({ opacity: "0.42" })],
      ["#stateBorders", element({ stroke: "#123456", "stroke-width": "2.5" })],
      ["#burgIcons > g#capital", element({ fill: "#abcdef", "font-size": "1.8" })]
    ]);
    const root = { querySelector: (selector: string) => elements.get(selector) ?? null } as unknown as ParentNode;
    const appStyle = {} as Pick<Style, "mapRenderer">;

    const style = importLegacyRendererStyle(appStyle, root, ["capital"]);

    expect(style.landmass).toEqual({ color: "#c0ffee", opacity: 0.75 });
    expect(style.states.opacity).toBe(0.42);
    expect(style.borders.state).toMatchObject({ color: "#123456", width: 2.5 });
    expect(style.burgIcons.icons.roles.capital).toMatchObject({ fill: "#abcdef", size: 1.8 });
    expect(appStyle.mapRenderer).toEqual(style);
  });

  it("removes only known renderer groups and clears imported emblem definitions", () => {
    const remove = vi.fn();
    const replaceChildren = vi.fn();
    const root = {
      querySelector: (selector: string) =>
        selector === "#coas"
          ? { replaceChildren }
          : LEGACY_RENDERER_GROUP_SELECTORS.includes(selector as never)
            ? { remove }
            : null
    } as unknown as ParentNode;

    removeLegacyRendererGroups(root);

    expect(remove).toHaveBeenCalledTimes(LEGACY_RENDERER_GROUP_SELECTORS.length);
    expect(replaceChildren).toHaveBeenCalledOnce();
  });

  it("imports legacy visibility from rendered SVG content instead of domain data", () => {
    const legacyElement = (options: { children?: boolean; display?: string; matches?: string[] } = {}) =>
      ({
        getAttribute: (name: string) => (name === "display" ? (options.display ?? null) : null),
        hasChildNodes: () => Boolean(options.children),
        querySelector: (selector: string) => (options.matches?.includes(selector) ? {} : null),
        style: { display: options.display ?? "" }
      }) as unknown as Element;
    const elements = new Map<string, Element>([
      ["#rivers", legacyElement()],
      ["#routes", legacyElement({ children: true, matches: ["path"] })],
      ["#population", legacyElement({ matches: ["line"] })],
      ["#ice", legacyElement({ display: "none" })],
      ["#icons", legacyElement({ display: "none" })],
      ["#armies", legacyElement({ children: true })],
      ["#markers", legacyElement({ matches: ["svg"] })],
      ["#goods", legacyElement({ children: true })],
      ["#markets", legacyElement({ children: true, display: "none" })]
    ]);
    const root = { querySelector: (selector: string) => elements.get(selector) ?? null } as unknown as ParentNode;

    expect(getLegacyRendererLayerVisibility(root, "rivers")).toBe(false);
    expect(getLegacyRendererLayerVisibility(root, "routes")).toBe(true);
    expect(getLegacyRendererLayerVisibility(root, "population")).toBe(true);
    expect(getLegacyRendererLayerVisibility(root, "ice")).toBe(false);
    expect(getLegacyRendererLayerVisibility(root, "burgIcons")).toBe(false);
    expect(getLegacyRendererLayerVisibility(root, "military")).toBe(true);
    expect(getLegacyRendererLayerVisibility(root, "markers")).toBe(true);
    expect(getLegacyRendererLayerVisibility(root, "goods")).toBe(true);
    expect(getLegacyRendererLayerVisibility(root, "markets")).toBe(false);
  });
});
