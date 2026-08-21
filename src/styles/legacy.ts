// Conversions between the legacy `style` object shapes and the styles store. Only migration
// edges use this: map-file save/load and legacy preset routing. Dies when those write the new
// format natively.
import type { Styles } from "./styles";

type LabelGroupStyle = Styles["labels"]["groups"][string];

const toNumber = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
// legacy read the store as {...BASE_STYLE, ...bag}: a missing key takes the base default,
// an explicit null stays null (= attribute not written). These mirror that merge exactly.
const numOr = (value: unknown, fallback: number | null): number | null =>
  value === undefined ? fallback : value === null ? null : toNumber(value, 0);
const strOr = (value: unknown, fallback: string | null): string | null =>
  value === undefined || value === "" ? fallback : value === null ? null : String(value);

export function labelGroupFromLegacy(legacy: object): LabelGroupStyle {
  const bag = legacy as Record<string, unknown>;
  return {
    attrs: {
      opacity: numOr(bag.opacity, 1),
      fill: strOr(bag.fill, "#3e3e4b"),
      "fill-opacity": numOr(bag["fill-opacity"], null),
      stroke: strOr(bag.stroke, "#3a3a3a"),
      "stroke-width": numOr(bag["stroke-width"], 0),
      "stroke-dasharray": strOr(bag["stroke-dasharray"], null),
      "stroke-linecap": strOr(bag["stroke-linecap"], null),
      "letter-spacing": numOr(bag["letter-spacing"], 0),
      "font-size": strOr(bag["font-size"], "18%") ?? "18%",
      "font-family": strOr(bag["font-family"], "Almendra SC") ?? "Almendra SC",
      style: strOr(bag.style, null),
      filter: strOr(bag.filter, null)
    },
    options: {
      dx: toNumber(bag["data-dx"], 0),
      dy: toNumber(bag["data-dy"], 0)
    }
  };
}

export function labelGroupToLegacy(group: LabelGroupStyle): Record<string, unknown> {
  const legacy: Record<string, unknown> = { ...group.attrs };
  if (group.options.dx) legacy["data-dx"] = group.options.dx;
  if (group.options.dy) legacy["data-dy"] = group.options.dy;
  return legacy;
}

export function labelGroupsFromLegacy(groups: Record<string, object>): Record<string, LabelGroupStyle> {
  return Object.fromEntries(Object.entries(groups).map(([name, group]) => [name, labelGroupFromLegacy(group)]));
}

export function labelGroupsToLegacy(groups: Record<string, LabelGroupStyle>): Record<string, object> {
  return Object.fromEntries(Object.entries(groups).map(([name, group]) => [name, labelGroupToLegacy(group)]));
}

// the legacy preset pipeline (public/modules/ui/style-presets.js) converts through these
globalThis.stylesLegacy = { labelGroupFromLegacy, labelGroupToLegacy, labelGroupsFromLegacy, labelGroupsToLegacy };
