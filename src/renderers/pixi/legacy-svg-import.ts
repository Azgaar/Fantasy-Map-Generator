import type { Style } from "@/types/style";
import { hydrateLegacySvgStyle } from "../scene/legacy-style-preset-adapter";
import type { MapStyle } from "../scene/styles";
import type { ToggleablePixiLayer } from "./pixi-layer-visibility-state";

/** Top-level feature groups that existed only as renderer output in SVG-centric map files. */
export const LEGACY_RENDERER_GROUP_SELECTORS = [
  "#viewbox > #ocean",
  "#viewbox > #landmass",
  "#viewbox > #texture",
  "#viewbox > #terrs",
  "#viewbox > #lakes",
  "#viewbox > #biomes",
  "#viewbox > #cells",
  "#viewbox > #gridOverlay",
  "#viewbox > #coordinates",
  "#viewbox > #rivers",
  "#viewbox > #terrain",
  "#viewbox > #relig",
  "#viewbox > #cults",
  "#viewbox > #regions",
  "#viewbox > #provs",
  "#viewbox > #zones",
  "#viewbox > #borders",
  "#viewbox > #routes",
  "#viewbox > #temperature",
  "#viewbox > #coastline",
  "#viewbox > #ice",
  "#viewbox > #goods",
  "#viewbox > #markets",
  "#viewbox > #prec",
  "#viewbox > #population",
  "#viewbox > #emblems",
  "#viewbox > #icons",
  "#viewbox > #labels",
  "#viewbox > #armies",
  "#viewbox > #compass",
  "#viewbox > #tradeAnimation"
] as const;

export function importLegacyRendererStyle(
  appStyle: Pick<Style, "mapRenderer">,
  root: ParentNode,
  burgGroupNames: readonly string[]
): MapStyle {
  return hydrateLegacySvgStyle(appStyle, root, burgGroupNames);
}

export function removeLegacyRendererGroups(root: ParentNode = document): void {
  for (const selector of LEGACY_RENDERER_GROUP_SELECTORS) root.querySelector(selector)?.remove();
  root.querySelector("#coas")?.replaceChildren();
}

export function getLegacyRendererLayerVisibility(root: ParentNode, layer: ToggleablePixiLayer): boolean {
  const element = (selector: string): Element | null => root.querySelector(selector);
  const hasChildren = (selector: string): boolean => Boolean(element(selector)?.hasChildNodes());
  const hasChild = (selector: string, childSelector: string): boolean =>
    Boolean(element(selector)?.querySelector(childSelector));
  const isVisible = (selector: string): boolean => {
    const node = element(selector) as (Element & { style?: CSSStyleDeclaration }) | null;
    return Boolean(node && node.getAttribute("display") !== "none" && node.style?.display !== "none");
  };

  switch (layer) {
    case "rivers":
      return hasChildren("#rivers");
    case "routes":
      return isVisible("#routes") && hasChild("#routes", "path");
    case "population":
      return hasChild("#population", "line");
    case "ice":
      return isVisible("#ice");
    case "burgIcons":
      return isVisible("#icons");
    case "military":
      return isVisible("#armies") && hasChildren("#armies");
    case "markers":
      return hasChild("#markers", "svg");
    case "goods":
      return isVisible("#goods") && hasChildren("#goods");
    case "markets":
      return isVisible("#markets") && hasChildren("#markets");
    default:
      return false;
  }
}
