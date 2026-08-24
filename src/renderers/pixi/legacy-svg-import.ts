import type { Style } from "@/types/style";
import { hydrateLegacySvgStyle } from "../scene/legacy-style-preset-adapter";
import type { MapStyle } from "../scene/styles";

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
