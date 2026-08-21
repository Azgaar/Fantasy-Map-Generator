// Conversions between the legacy `style` object shapes and the styles store. Only migration
// edges use this: map-file save/load and legacy preset routing. Dies when those write the new
// format natively.
import { type Styles, styles } from "./styles";

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

type BurgGroupStyle = Styles["burgIcons"]["burgIcons"]["groups"][string];

// legacy wrote stored burg-group bags to the DOM verbatim with no per-key defaults; only
// size and icon are required by the renderer (anchors ignore icon - they always draw #icon-anchor)
export function burgGroupFromLegacy(legacy: object): BurgGroupStyle {
  const bag = legacy as Record<string, unknown>;
  return {
    attrs: {
      opacity: numOr(bag.opacity, null),
      fill: strOr(bag.fill, null),
      "fill-opacity": numOr(bag["fill-opacity"], null),
      stroke: strOr(bag.stroke, null),
      "stroke-width": numOr(bag["stroke-width"], null),
      "stroke-dasharray": strOr(bag["stroke-dasharray"], null),
      "stroke-linecap": strOr(bag["stroke-linecap"], null),
      "stroke-linejoin": strOr(bag["stroke-linejoin"], null),
      filter: strOr(bag.filter, null)
    },
    options: {
      size: toNumber(bag["font-size"], 1),
      icon: strOr(bag["data-icon"], null) ?? "#icon-circle"
    }
  };
}

// the style editor edits burg groups on the DOM; drawing harvests them back into the store
export function burgGroupFromElement(el: Element): BurgGroupStyle {
  const bag: Record<string, string> = {};
  for (const { name, value } of Array.from(el.attributes)) bag[name] = value;
  return burgGroupFromLegacy(bag);
}

export function burgGroupToLegacy(group: BurgGroupStyle, withIcon = true): Record<string, unknown> {
  const legacy: Record<string, unknown> = { ...group.attrs, "font-size": group.options.size };
  if (withIcon) legacy["data-icon"] = group.options.icon;
  return legacy;
}

export function burgGroupsFromLegacy(groups: Record<string, object>): Record<string, BurgGroupStyle> {
  return Object.fromEntries(Object.entries(groups).map(([name, group]) => [name, burgGroupFromLegacy(group)]));
}

export function burgGroupsToLegacy(groups: Record<string, BurgGroupStyle>, withIcon: boolean): Record<string, object> {
  return Object.fromEntries(Object.entries(groups).map(([name, group]) => [name, burgGroupToLegacy(group, withIcon)]));
}

export function reliefFromLegacy(legacy: object): Styles["relief"]["options"] {
  const bag = legacy as Record<string, unknown>;
  return {
    set: strOr(bag.set, null) ?? "simple",
    size: toNumber(bag.size, 1),
    density: toNumber(bag.density, 0.4)
  };
}

// the map file's style record keeps the legacy shape until persistence migrates, so files
// stay loadable on master in both directions
export function stylesToLegacy(): Record<string, unknown> {
  return {
    labels: { groups: labelGroupsToLegacy(styles.labels.groups) },
    burgIcons: burgGroupsToLegacy(styles.burgIcons.burgIcons.groups, true),
    anchors: burgGroupsToLegacy(styles.burgIcons.anchors.groups, false),
    relief: { ...styles.relief.options }
  };
}

export function stylesFromLegacy(json: unknown): void {
  const legacy = (typeof json === "object" && json !== null ? json : {}) as Record<string, any>;
  if (legacy.labels?.groups) styles.labels.groups = labelGroupsFromLegacy(legacy.labels.groups);
  if (legacy.burgIcons) styles.burgIcons.burgIcons.groups = burgGroupsFromLegacy(legacy.burgIcons);
  if (legacy.anchors) styles.burgIcons.anchors.groups = burgGroupsFromLegacy(legacy.anchors);
  if (legacy.relief) styles.relief.options = reliefFromLegacy(legacy.relief);
}

// the legacy preset pipeline (public/modules/ui/style-presets.js) converts through these
globalThis.stylesLegacy = {
  labelGroupFromLegacy,
  labelGroupToLegacy,
  labelGroupsFromLegacy,
  labelGroupsToLegacy,
  burgGroupFromLegacy,
  burgGroupFromElement,
  burgGroupToLegacy,
  burgGroupsFromLegacy,
  burgGroupsToLegacy,
  reliefFromLegacy,
  stylesToLegacy,
  stylesFromLegacy
};
