import { describe, expect, it } from "vitest";
import type { Style } from "@/types/style";
import {
  hydrateLegacyPhysicalStyle,
  readLegacyHeightStyle,
  readLegacyOceanStyle,
  readLegacyTextureStyle
} from "./legacy-physical-style-adapter";

const element = (attributes: Record<string, string>): SVGElement =>
  ({ getAttribute: (name: string) => attributes[name] ?? null }) as SVGElement;

const root = (): ParentNode => {
  const elements = new Map([
    ["#oceanLayers", element({ filter: "url(#blur)", layers: "-8,-4,-1" })],
    ["#oceanBase", element({ fill: "#123456" })],
    ["#oceanicPattern", element({ href: "pattern.png", opacity: ".2" })],
    [
      "#oceanHeights",
      element({
        curve: "curveLinearClosed",
        "data-render": "1",
        opacity: ".5",
        relax: "1",
        scheme: "livid",
        skip: "3",
        terracing: "2"
      })
    ],
    [
      "#landHeights",
      element({
        curve: "curveBasisClosed",
        filter: "url(#sepia)",
        opacity: ".8",
        relax: "2",
        scheme: "natural",
        skip: "5",
        terracing: "4"
      })
    ],
    [
      "#texture",
      element({ "data-href": "texture.png", "data-x": "3", "data-y": "4", mask: "url(#water)", opacity: ".25" })
    ]
  ]);
  return { querySelector: (selector: string) => elements.get(selector) ?? null } as unknown as ParentNode;
};

describe("legacy physical style adapter", () => {
  it("reads height and texture attributes without retaining SVG as renderer state", () => {
    expect(readLegacyOceanStyle(root())).toMatchObject({
      bands: { filter: "url(#blur)", layers: "-8,-4,-1" },
      color: "#123456",
      pattern: { href: "pattern.png", opacity: 0.2 }
    });
    expect(readLegacyHeightStyle(root())).toMatchObject({
      land: { filter: "url(#sepia)", scheme: "natural", skip: 5 },
      ocean: { opacity: 0.5, render: true, scheme: "livid" }
    });
    expect(readLegacyTextureStyle(root())).toEqual({
      filter: null,
      href: "texture.png",
      mask: "water",
      opacity: 0.25,
      x: 3,
      y: 4
    });
  });

  it("hydrates only missing semantic sections", () => {
    const style = { mapRenderer: { texture: { href: "saved.png" } } } as unknown as Style;
    hydrateLegacyPhysicalStyle(style, root());
    expect(style.mapRenderer?.texture.href).toBe("saved.png");
    expect(style.mapRenderer?.height.land.scheme).toBe("natural");
  });
});
