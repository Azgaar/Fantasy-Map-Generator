import { describe, expect, it } from "vitest";
import type { Burg } from "@/generators/burgs-generator";
import type { Marker } from "@/generators/markers-generator";
import { DEFAULT_PIXI_MAP_STYLE } from "../styles";
import { buildBurgPointSymbolScene, buildMarkerPointSymbolScene } from "./point-symbol-scene";

describe("point symbol scenes", () => {
  it("builds burg icons and port anchors from domain data", () => {
    const burgs: Burg[] = [
      { cell: 0, i: 0, x: 0, y: 0 },
      { cell: 1, group: "capital", i: 1, port: 2, x: 12, y: 8 },
      { cell: 2, group: "town", i: 2, removed: true, x: 30, y: 20 }
    ];

    const scene = buildBurgPointSymbolScene(burgs, DEFAULT_PIXI_MAP_STYLE.burgIcons, 4);

    expect(scene.icons.domainIds).toEqual([1]);
    expect(scene.icons.instances[0]).toMatchObject({ role: "capital", shape: "square", size: 2, x: 12, y: 8 });
    expect(scene.anchors.instances[0]).toMatchObject({ domainId: 1, shape: "anchor" });
  });

  it("applies marker visibility state without mutating entities", () => {
    const markers: Marker[] = [
      { cell: 1, i: 1, icon: "🌋", pinned: true, type: "volcano", x: 10, y: 20 },
      { cell: 2, i: 2, icon: "⚔️", type: "battle", x: 30, y: 40 },
      { cell: 3, hidden: true, i: 3, icon: "?", type: "hidden", x: 50, y: 60 }
    ];

    const scene = buildMarkerPointSymbolScene(
      markers,
      DEFAULT_PIXI_MAP_STYLE.markers,
      { pinnedOnly: true, visibleIds: new Set([1, 2]) },
      "markers:2"
    );

    expect(scene.domainIds).toEqual([1]);
    expect(scene.instances[0]).toMatchObject({ anchorY: 1, icon: "🌋", rescale: true, shape: "bubble" });
    expect(markers).toHaveLength(3);
  });
});
