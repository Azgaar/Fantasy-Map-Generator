import type { BurgGroup } from "@/types/burg-groups";
import type {
  LabelGroupOptions,
  LabelGroupType,
  LabelNameMode,
  LabelsOptions,
  LabelType,
  LabelZoomBounds
} from "@/types/labels";

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

export function getLabelParentFontSize(scale: number, resizeOnZoom: boolean): number {
  if (!resizeOnZoom) return 100;
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return Math.max(Math.round(((100 + 100 / safeScale) / 2) * 100) / 100, 1);
}

export function isLabelGroupVisible({
  labelsLayerOn,
  labels,
  group,
  scale,
  layerIsOn
}: {
  labelsLayerOn: boolean;
  labels: Pick<LabelsOptions, "showAll">;
  group: LabelGroupOptions;
  scale: number;
  layerIsOn: (layerId: string) => boolean;
}): boolean {
  if (!labelsLayerOn) return false;
  if (labels.showAll) return true;
  if (group.active === false) return false;
  if (group.zoom.min !== null && scale < group.zoom.min) return false;
  if (group.zoom.max !== null && scale > group.zoom.max) return false;
  return !group.layerDependency || layerIsOn(group.layerDependency);
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

export function getDefaultLabelGroupName(type: LabelGroupType, burgGroups: BurgGroup[]): string {
  if (type !== "burg") return DEFAULT_LABEL_GROUPS[type];
  return burgGroups.find(group => group.isDefault && !group.removed)?.name || "town";
}

export function resolveLabelGroup(
  type: LabelType,
  requestedGroup: string | undefined,
  labels: LabelsOptions,
  burgGroups: BurgGroup[]
): string {
  const fallback = getDefaultLabelGroupName(type, burgGroups);
  const requested = requestedGroup || fallback;
  return labels.groups.some(group => group.name === requested) ? requested : fallback;
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
  type: LabelGroupType,
  layerDependency: string | null,
  zoom: LabelZoomBounds,
  isDefault = false
): LabelGroupOptions {
  return { name, type, active: true, layerDependency, zoom, mode: "auto", isDefault };
}

function roundZoom(value: number): number {
  return Math.round(value * 100) / 100;
}
