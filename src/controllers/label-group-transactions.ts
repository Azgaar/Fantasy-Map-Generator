import { getDefaultLabelGroupName, isProtectedLabelGroup, validateLabelGroupName } from "@/controllers/label-policy";
import type { AddedLabel, LabelGroup, LabelStyles, LabelType } from "@/generators/labels";
import type { Province } from "@/generators/provinces-generator";
import type { BurgGroup } from "@/types/burg-groups";
import type { LabelsOptions } from "@/types/labels";

type LabelOverride = { group?: string };
type LabelEntity = { i?: number; removed?: boolean; label?: LabelOverride };
type BurgEntity = LabelEntity & { group?: string };

export interface LabelWorld {
  states: LabelEntity[];
  provinces: Province[];
  burgs: BurgEntity[];
  rivers?: LabelEntity[];
  routes?: LabelEntity[];
  labels: AddedLabel[];
}

export interface LabelAssignmentCounts {
  states: number;
  provinces: number;
  burgs: number;
  rivers: number;
  routes: number;
  added: number;
}

export function createLabelGroup({
  labels,
  styles,
  burgGroups,
  name,
  type
}: {
  labels: LabelsOptions;
  styles: LabelStyles;
  burgGroups: BurgGroup[];
  name: string;
  type: LabelType;
}): LabelGroup {
  const error = validateLabelGroupName(name, [
    ...labels.groups.map(group => group.name),
    ...burgGroups.filter(group => !group.removed).map(group => group.name)
  ]);
  if (error) throw new Error(error);

  const defaultName = getDefaultLabelGroupName(type, burgGroups);
  const baseline = labels.groups.find(group => group.name === defaultName);
  if (!baseline) throw new Error(`Missing default Label Group "${defaultName}"`);

  const group: LabelGroup = { ...structuredClone(baseline), name, type, mode: "auto" };
  const lastTypeIndex = labels.groups.findLastIndex(current => current.type === type);
  labels.groups.splice(lastTypeIndex + 1, 0, group);
  styles.groups[name] = { ...(styles.groups[defaultName] || {}) };
  return group;
}

export function renameLabelGroup({
  labels,
  styles,
  world,
  burgGroups,
  oldName,
  newName,
  allowProtected = false
}: {
  labels: LabelsOptions;
  styles: LabelStyles;
  world: LabelWorld;
  burgGroups: BurgGroup[];
  oldName: string;
  newName: string;
  allowProtected?: boolean;
}): void {
  const group = labels.groups.find(group => group.name === oldName);
  if (!group) throw new Error(`Unknown Label Group "${oldName}"`);
  if (!allowProtected && isProtectedLabelGroup(oldName, burgGroups)) {
    throw new Error(`Label Group "${oldName}" is protected`);
  }
  const error = validateLabelGroupName(newName, [
    ...labels.groups.filter(group => group.name !== oldName).map(group => group.name),
    ...burgGroups.filter(group => !group.removed && group.name !== oldName).map(group => group.name)
  ]);
  if (error) throw new Error(error);

  group.name = newName;
  styles.groups[newName] = styles.groups[oldName] || {};
  delete styles.groups[oldName];
  renameLabelReferences(world, oldName, newName);
  if (allowProtected) {
    world.burgs
      .filter(burg => burg.group === oldName)
      .forEach(burg => {
        burg.group = newName;
      });
  }
}

export function deleteLabelGroup({
  labels,
  styles,
  world,
  burgGroups,
  name,
  allowProtected = false
}: {
  labels: LabelsOptions;
  styles: LabelStyles;
  world: LabelWorld;
  burgGroups: BurgGroup[];
  name: string;
  allowProtected?: boolean;
}): LabelAssignmentCounts {
  if (!labels.groups.some(group => group.name === name)) throw new Error(`Unknown Label Group "${name}"`);
  if (!allowProtected && isProtectedLabelGroup(name, burgGroups)) throw new Error(`Label Group "${name}" is protected`);

  const counts = countLabelAssignments(world, name);
  clearReferences(world.states, name);
  clearReferences(world.provinces, name);
  clearReferences(world.burgs, name);
  clearReferences(world.rivers || [], name);
  clearReferences(world.routes || [], name);
  world.labels
    .filter(label => label.group === name)
    .forEach(label => {
      label.group = "added";
    });
  labels.groups = labels.groups.filter(group => group.name !== name);
  delete styles.groups[name];
  return counts;
}

export function countLabelAssignments(world: LabelWorld, name: string): LabelAssignmentCounts {
  return {
    states: world.states.filter(entity => entity.i && !entity.removed && entity.label?.group === name).length,
    provinces: world.provinces.filter(entity => entity.i && !entity.removed && entity.label?.group === name).length,
    burgs: world.burgs.filter(entity => entity.i && !entity.removed && entity.label?.group === name).length,
    rivers: (world.rivers || []).filter(entity => entity.i !== undefined && entity.label?.group === name).length,
    routes: (world.routes || []).filter(entity => entity.i !== undefined && entity.label?.group === name).length,
    added: world.labels.filter(label => label.group === name).length
  };
}

export function assignLabelGroup(world: LabelWorld, type: LabelType, ids: Iterable<number>, target: string): void {
  const selected = new Set(ids);
  if (type === "state") assignOverrides(world.states);
  else if (type === "province") assignOverrides(world.provinces);
  else if (type === "burg") assignOverrides(world.burgs);
  else if (type === "river") assignOverrides(world.rivers || []);
  else if (type === "route") assignOverrides(world.routes || []);
  else {
    world.labels
      .filter(entity => selected.has(entity.i))
      .forEach(entity => {
        entity.group = target;
      });
  }

  function assignOverrides(entities: LabelEntity[]): void {
    entities
      .filter(entity => entity.i !== undefined && selected.has(entity.i))
      .forEach(entity => {
        entity.label ??= {};
        entity.label.group = target;
      });
  }
}

export function reconcileBurgLabelGroups({
  labels,
  styles,
  world,
  previousGroups,
  nextGroups,
  renames = {}
}: {
  labels: LabelsOptions;
  styles: LabelStyles;
  world: LabelWorld;
  previousGroups: BurgGroup[];
  nextGroups: BurgGroup[];
  renames?: Record<string, string>;
}): void {
  validateBurgLabelNamespace(labels, previousGroups, nextGroups, renames);

  const defaultBurgName = getDefaultLabelGroupName("burg", nextGroups);
  const previousDefaultBurgName = getDefaultLabelGroupName("burg", previousGroups);
  const defaultTemplateSource =
    labels.groups.find(group => group.name === defaultBurgName) ||
    labels.groups.find(group => group.name === previousDefaultBurgName) ||
    labels.groups.find(group => group.type === "burg");
  const defaultTemplate = defaultTemplateSource ? structuredClone(defaultTemplateSource) : undefined;
  const defaultStyle = defaultTemplate ? { ...(styles.groups[defaultTemplate.name] || {}) } : undefined;
  const currentNames = new Set(labels.groups.map(group => group.name));
  const renameTargets = new Set(
    Object.entries(renames)
      .filter(([oldName]) => currentNames.has(oldName))
      .map(([, newName]) => newName)
  );
  const needsTemplate = nextGroups
    .filter(group => !group.removed)
    .some(group => !currentNames.has(group.name) && !renameTargets.has(group.name));
  if (needsTemplate && !defaultTemplate) {
    throw new Error("Cannot create a Burg Label Group without a Burg default");
  }

  for (const [oldName, newName] of Object.entries(renames)) {
    if (oldName === newName || !labels.groups.some(group => group.name === oldName)) continue;
    renameLabelGroup({
      labels,
      styles,
      world,
      burgGroups: previousGroups,
      oldName,
      newName,
      allowProtected: true
    });
  }

  const nextNames = new Set(nextGroups.filter(group => !group.removed).map(group => group.name));
  const renamedOldNames = new Set(Object.keys(renames));
  for (const previous of previousGroups) {
    if (previous.removed || renamedOldNames.has(previous.name) || nextNames.has(previous.name)) continue;
    if (!labels.groups.some(group => group.name === previous.name)) continue;
    deleteLabelGroup({
      labels,
      styles,
      world,
      burgGroups: previousGroups,
      name: previous.name,
      allowProtected: true
    });
  }

  const existingNames = new Set(labels.groups.map(group => group.name));
  const previouslyManagedNames = new Set(
    previousGroups.filter(group => !group.removed).map(group => renames[group.name] || group.name)
  );

  for (const burgGroup of nextGroups.filter(group => !group.removed).toSorted((a, b) => a.order - b.order)) {
    if (existingNames.has(burgGroup.name)) {
      if (previouslyManagedNames.has(burgGroup.name)) continue;
      throw new Error(`Burg Group "${burgGroup.name}" collides with an existing Label Group`);
    }
    if (!defaultTemplate) throw new Error("Cannot create a Burg Label Group without a Burg default");
    const group: LabelGroupOptions = {
      ...structuredClone(defaultTemplate),
      name: burgGroup.name,
      type: "burg",
      mode: "auto"
    };
    const nextBurgNames = nextGroups
      .filter(candidate => !candidate.removed)
      .toSorted((a, b) => a.order - b.order)
      .map(candidate => candidate.name);
    const nextExistingName = nextBurgNames
      .slice(nextBurgNames.indexOf(burgGroup.name) + 1)
      .find(name => existingNames.has(name));
    const nextExistingIndex = nextExistingName
      ? labels.groups.findIndex(candidate => candidate.name === nextExistingName)
      : -1;
    const lastBurgIndex = labels.groups.findLastIndex(candidate => candidate.type === "burg");
    const insertAt = nextExistingIndex === -1 ? lastBurgIndex + 1 : nextExistingIndex;
    labels.groups.splice(insertAt, 0, group);
    styles.groups[burgGroup.name] = { ...(defaultStyle || {}) };
    existingNames.add(burgGroup.name);
  }
}

function validateBurgLabelNamespace(
  labels: LabelsOptions,
  previousGroups: BurgGroup[],
  nextGroups: BurgGroup[],
  renames: Record<string, string>
): void {
  const activeNext = nextGroups.filter(group => !group.removed);
  const nextNames = new Set<string>();
  for (const group of activeNext) {
    const error = validateLabelGroupName(group.name, nextNames);
    if (error) throw new Error(error);
    nextNames.add(group.name);
  }

  const previousManagedNames = new Set(
    previousGroups
      .filter(group => !group.removed)
      .filter(group => labels.groups.some(labelGroup => labelGroup.name === group.name && labelGroup.type === "burg"))
      .map(group => group.name)
  );
  const customNames = new Set(
    labels.groups.filter(group => !previousManagedNames.has(group.name)).map(group => group.name)
  );
  for (const name of nextNames) {
    if (customNames.has(name)) throw new Error(`Burg Group "${name}" collides with an existing Label Group`);
  }

  for (const [oldName, newName] of Object.entries(renames)) {
    if (oldName === newName) continue;
    const occupied = labels.groups.some(group => group.name === newName && group.name !== oldName);
    if (occupied) throw new Error(`Label Group names must be unique`);
  }
}

export function renameLabelReferences(world: LabelWorld, oldName: string, newName: string): void {
  for (const entities of [world.states, world.provinces, world.burgs, world.rivers || [], world.routes || []]) {
    entities
      .filter(entity => entity.label?.group === oldName)
      .forEach(entity => {
        entity.label!.group = newName;
      });
  }
  world.labels
    .filter(label => label.group === oldName)
    .forEach(label => {
      label.group = newName;
    });
}

function clearReferences(entities: LabelEntity[], name: string): void {
  entities
    .filter(entity => entity.label?.group === name)
    .forEach(entity => {
      delete entity.label!.group;
    });
}
