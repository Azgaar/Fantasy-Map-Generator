import type { BurgGroup } from "@/types/burg-groups";
import type { LabelGroupOptions, LabelGroupType, LabelStyles, LabelsOptions } from "@/types/labels";
import { type LabelWorld, renameLabelReferences } from "@/utils/label-group-transactions";
import {
  createDefaultLabelsOptions,
  deriveLegacyLabelZoom,
  normalizeLabelNameMode,
  validateLabelGroupName,
  validateLabelZoom
} from "@/utils/label-policy";

export function migrateLabelConfiguration({
  current,
  styles,
  world,
  burgGroups,
  resizeOnZoom = true,
  stateMode = "auto",
  provinceStyle
}: {
  current?: Partial<LabelsOptions>;
  styles: LabelStyles;
  world: LabelWorld;
  burgGroups: BurgGroup[];
  resizeOnZoom?: boolean;
  stateMode?: unknown;
  provinceStyle?: LabelStyles["groups"][string];
}): LabelsOptions {
  if (isModernLabelsOptions(current, burgGroups)) {
    return normalizeModernOptions(current, styles, burgGroups, provinceStyle);
  }

  renameLegacyAddedGroup(styles, world);
  renameLegacyProvinceCollision(styles, world);
  resolveLegacyBurgCollisions(styles, world, burgGroups);
  const defaults = createDefaultLabelsOptions(burgGroups);
  const defaultByName = new Map(defaults.groups.map(group => [group.name, group]));
  const groups: LabelGroupOptions[] = [];

  for (const [name, groupStyle] of Object.entries(styles.groups)) {
    const type = getMigratedGroupType(name, world, burgGroups);
    const defaultGroup = defaultByName.get(name);
    const fontSize = getLegacyFontSize(groupStyle, defaultByName, type);
    convertLegacyStyle(groupStyle, fontSize);
    groups.push({
      name,
      type,
      active: true,
      layerDependency: null,
      zoom: deriveLegacyLabelZoom(fontSize),
      mode: name === "states" ? normalizeLabelNameMode(stateMode) : "auto"
    });
    if (defaultGroup) defaultByName.delete(name);
  }

  for (const missing of defaultByName.values()) {
    const index = findDefaultInsertionIndex(groups, missing.type, defaults.groups);
    groups.splice(index, 0, structuredClone(missing));
    styles.groups[missing.name] = getMissingDefaultStyle(missing.type, styles, provinceStyle);
  }

  return { resizeOnZoom, showAll: false, groups };
}

function isModernLabelsOptions(
  value: Partial<LabelsOptions> | undefined,
  burgGroups: BurgGroup[]
): value is LabelsOptions {
  if (
    !value ||
    typeof value.resizeOnZoom !== "boolean" ||
    typeof value.showAll !== "boolean" ||
    !Array.isArray(value.groups)
  ) {
    return false;
  }

  const protectedTypes = new Map<string, LabelGroupType>([
    ["states", "states"],
    ["provinces", "provinces"],
    ["added", "added"],
    ...burgGroups.filter(group => !group.removed).map(group => [group.name, "burgs"] as const)
  ]);
  const names = new Set<string>();
  return value.groups.every(group => {
    if (!group || typeof group !== "object") return false;
    if (typeof group.name !== "string" || validateLabelGroupName(group.name, names)) return false;
    names.add(group.name);
    if (!["states", "burgs", "provinces", "added"].includes(group.type)) return false;
    const protectedType = protectedTypes.get(group.name);
    if (protectedType && group.type !== protectedType) return false;
    if (typeof group.active !== "boolean") return false;
    if (group.layerDependency !== null && typeof group.layerDependency !== "string") return false;
    if (!group.zoom || validateLabelZoom(group.zoom)) return false;
    return ["auto", "short", "full"].includes(group.mode);
  });
}

function normalizeModernOptions(
  current: LabelsOptions,
  styles: LabelStyles,
  burgGroups: BurgGroup[],
  provinceStyle?: LabelStyles["groups"][string]
): LabelsOptions {
  const labels = structuredClone(current);
  const defaults = createDefaultLabelsOptions(burgGroups);
  for (const required of defaults.groups) {
    if (labels.groups.some(group => group.name === required.name)) continue;
    const index = findDefaultInsertionIndex(labels.groups, required.type, defaults.groups);
    labels.groups.splice(index, 0, required);
    styles.groups[required.name] = getMissingDefaultStyle(required.type, styles, provinceStyle);
  }
  return labels;
}

function renameLegacyAddedGroup(styles: LabelStyles, world: LabelWorld): void {
  if (!styles.groups.addedLabels) {
    if (!styles.groups.added) return;
    const migratedName = getCollisionName("added", new Set(Object.keys(styles.groups)));
    styles.groups[migratedName] = styles.groups.added;
    delete styles.groups.added;
    renameLabelReferences(world, "added", migratedName);
    return;
  }
  if (styles.groups.added) {
    const migratedName = getCollisionName("added", new Set(Object.keys(styles.groups)));
    styles.groups[migratedName] = styles.groups.added;
    renameLabelReferences(world, "added", migratedName);
  }
  styles.groups.added = styles.groups.addedLabels;
  delete styles.groups.addedLabels;
  renameLabelReferences(world, "addedLabels", "added");
}

function renameLegacyProvinceCollision(styles: LabelStyles, world: LabelWorld): void {
  if (!styles.groups.provinces) return;
  const migratedName = getCollisionName("provinces", new Set(Object.keys(styles.groups)));
  styles.groups[migratedName] = styles.groups.provinces;
  delete styles.groups.provinces;
  renameLabelReferences(world, "provinces", migratedName);
}

function resolveLegacyBurgCollisions(styles: LabelStyles, world: LabelWorld, burgGroups: BurgGroup[]): void {
  const names = new Set(Object.keys(styles.groups));
  for (const burgGroup of burgGroups.filter(group => !group.removed)) {
    const name = burgGroup.name;
    if (!styles.groups[name]) continue;
    const hasCustomReferences =
      world.states.some(entity => entity.label?.group === name) ||
      world.provinces.some(entity => entity.label?.group === name) ||
      world.labels.some(label => label.group === name);
    if (!hasCustomReferences) continue;

    const migratedName = getCollisionName(name, names);
    names.add(migratedName);
    styles.groups[migratedName] = { ...styles.groups[name] };
    for (const entities of [world.states, world.provinces]) {
      entities
        .filter(entity => entity.label?.group === name)
        .forEach(entity => {
          entity.label!.group = migratedName;
        });
    }
    world.labels
      .filter(label => label.group === name)
      .forEach(label => {
        label.group = migratedName;
      });
  }
}

function getMigratedGroupType(name: string, world: LabelWorld, burgGroups: BurgGroup[]): LabelGroupType {
  if (name === "states") return "states";
  if (name === "provinces") return "provinces";
  if (name === "added") return "added";
  if (burgGroups.some(group => !group.removed && group.name === name)) return "burgs";

  const counts: [LabelGroupType, number][] = [
    ["states", world.states.filter(entity => entity.label?.group === name).length],
    ["provinces", world.provinces.filter(entity => entity.label?.group === name).length],
    ["burgs", world.burgs.filter(entity => entity.label?.group === name).length],
    ["added", world.labels.filter(label => label.group === name).length]
  ];
  if (counts.every(([, count]) => count === 0)) return "added";
  return counts.reduce((best, candidate) => (candidate[1] > best[1] ? candidate : best))[0];
}

function getLegacyFontSize(
  groupStyle: Record<string, string | number | null>,
  _defaults: Map<string, LabelGroupOptions>,
  type: LabelGroupType
): number {
  const size = Number.parseFloat(String(groupStyle["data-size"] ?? groupStyle["font-size"] ?? ""));
  if (Number.isFinite(size) && size > 0) return size;
  return type === "states" ? 22 : type === "provinces" ? 10 : type === "burgs" ? 4 : 18;
}

function convertLegacyStyle(groupStyle: Record<string, string | number | null>, fontSize: number): void {
  delete groupStyle["data-size"];
  groupStyle["font-size"] = `${fontSize}%`;
}

function getMissingDefaultStyle(
  type: LabelGroupType,
  styles: LabelStyles,
  provinceStyle?: LabelStyles["groups"][string]
): Record<string, string | number | null> {
  if (type === "provinces" && provinceStyle) {
    const visualAttributes = new Set([
      "opacity",
      "fill",
      "stroke",
      "stroke-width",
      "style",
      "letter-spacing",
      "font-size",
      "font-family",
      "filter",
      "data-dx",
      "data-dy"
    ]);
    const visualStyle = Object.fromEntries(
      Object.entries(provinceStyle).filter(([attribute]) => visualAttributes.has(attribute))
    );
    return { ...visualStyle, "font-size": "10%" };
  }
  const sourceName =
    type === "states" ? "states" : type === "provinces" ? "states" : type === "burgs" ? "town" : "added";
  const size = type === "states" ? 22 : type === "provinces" ? 10 : type === "burgs" ? 4 : 18;
  return { ...(styles.groups[sourceName] || {}), "font-size": `${size}%` };
}

function findDefaultInsertionIndex(
  groups: LabelGroupOptions[],
  type: LabelGroupType,
  defaults: LabelGroupOptions[]
): number {
  const desiredOrder = defaults.findIndex(group => group.type === type);
  const next = groups.findIndex(group => {
    const order = defaults.findIndex(defaultGroup => defaultGroup.type === group.type);
    return order !== -1 && order > desiredOrder;
  });
  return next === -1 ? groups.length : next;
}

function getCollisionName(base: string, names: Set<string>): string {
  let candidate = `${base}_migrated`;
  let suffix = 2;
  while (names.has(candidate)) candidate = `${base}_migrated_${suffix++}`;
  return candidate;
}
