import type { LabelGroup, LabelNameMode, LabelType, LabelZoomBounds } from "@/generators/labels-generator";
import type { BurgGroup } from "@/types/burg-groups";
import type { LabelsOptions } from "@/types/labels";

export const LABEL_ZOOM_MIN = 0.01;
export const LABEL_ZOOM_MAX = 200;
export const DEFAULT_LABEL_GROUPS: Record<Exclude<LabelType, "burg">, string> = {
  state: "state",
  province: "province",
  river: "river",
  route: "route",
  added: "added"
};

const IDENTIFIER_PATTERN = /^[\p{L}_][\p{L}\p{N}_-]*$/u;

export function deriveLegacyLabelZoom(fontSize: number): LabelZoomBounds {
  if (!Number.isFinite(fontSize) || fontSize <= 0) return { min: null, max: null };
  const min = roundZoom(12 / fontSize - 1);
  const max = roundZoom(120 / fontSize - 1);
  return { min: min > 0 ? min : null, max: max > 0 ? max : null };
}

export function validateLabelZoom(zoom: unknown): string | null {
  if (!zoom || typeof zoom !== "object") return "Zoom bounds must include minimum and maximum values";
  const bounds = zoom as Partial<LabelZoomBounds>;
  for (const bound of ["min", "max"] as const) {
    if (!(bound in bounds)) return `Zoom ${bound} is required`;
    const value = bounds[bound];
    if (value === null) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) return `Zoom ${bound} must be a finite number`;
    if (value < LABEL_ZOOM_MIN || value > LABEL_ZOOM_MAX) {
      return `Zoom ${bound} must be between ${LABEL_ZOOM_MIN} and ${LABEL_ZOOM_MAX}`;
    }
  }
  const { min, max } = bounds as LabelZoomBounds;
  return min !== null && max !== null && min > max ? "Minimum zoom cannot be greater than maximum zoom" : null;
}

export function validateLabelGroupName(name: string, existingNames: Iterable<string> = []): string | null {
  if (!IDENTIFIER_PATTERN.test(name)) {
    return "Group name must start with a letter or underscore and contain only letters, digits, underscores, or dashes";
  }
  return new Set(existingNames).has(name) ? "Label Group names must be unique" : null;
}

export function getDefaultLabelGroupName(type: LabelType, burgGroups: BurgGroup[]): string {
  if (type !== "burg") return DEFAULT_LABEL_GROUPS[type];
  return burgGroups.find(group => group.isDefault && !group.removed)?.name || "town";
}

export function createDefaultLabelsOptions(burgGroups: BurgGroup[]): LabelsOptions {
  const burgs = burgGroups
    .filter(group => !group.removed)
    .toSorted((a, b) => a.order - b.order)
    .map(group => createGroup(group.name, "burg", null, deriveLegacyLabelZoom(group.isDefault ? 4 : 3)));
  return {
    resizeOnZoom: true,
    showAll: false,
    groups: [
      createGroup("river", "river", "toggleRivers", { min: 8, max: 14 }, true),
      createGroup("route", "route", "toggleRoutes", { min: 8, max: 14 }, true),
      ...burgs,
      createGroup("province", "province", "toggleProvinces", { min: 1, max: 15 }, true),
      createGroup("added", "added", null, { min: 0.2, max: 5.5 }, true),
      createGroup("state", "state", null, { min: null, max: 4.5 }, true)
    ]
  };
}

export function isProtectedLabelGroup(name: string, burgGroups: BurgGroup[]): boolean {
  return (
    Object.values(DEFAULT_LABEL_GROUPS).includes(name) ||
    burgGroups.some(group => !group.removed && group.name === name)
  );
}

export function normalizeLabelNameMode(value: unknown): LabelNameMode {
  return value === "short" || value === "full" ? value : "auto";
}

function createGroup(
  name: string,
  type: LabelType,
  layerDependency: string | null,
  zoom: LabelZoomBounds,
  isDefault = false
): LabelGroup {
  return { name, type, active: true, layerDependency, zoom, mode: "auto", isDefault };
}

function roundZoom(value: number): number {
  return Math.round(value * 100) / 100;
}
