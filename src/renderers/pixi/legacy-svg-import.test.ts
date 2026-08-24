import { describe, expect, it, vi } from "vitest";
import type { Style } from "@/types/style";
import {
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
});
