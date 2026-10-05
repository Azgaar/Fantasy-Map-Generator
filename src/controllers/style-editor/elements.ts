// The style elements and their user-named groups, as the editor and its dialogs list them
import { Layers } from "@/components/layers";
import { layerLabel } from "@/data/layer-labels";
import { stylesSchema } from "@/generators/styles-schema";
import { getLabelsData } from "@/renderers/labels/label-data";
import type { StyleElement } from "@/types/styles";

export function listElements(): { id: StyleElement; label: string }[] {
  return (Object.keys(stylesSchema.shape) as StyleElement[])
    .map(id => ({ id, label: layerLabel(id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// The editors name elements by their svg group id
const ELEMENT_BY_DOM_ID: ReadonlyMap<string, StyleElement> = new Map(
  Layers.all.flatMap(layer => {
    if (!(layer.id in stylesSchema.shape)) return [];
    const ids = [layer.id, layer.elementId, ...layer.children.map(child => child.id)];
    return ids.map(id => [id, layer.id as StyleElement] as const);
  })
);

/** The style element an editor's id addresses: a legacy svg group id, a layer id, or the id itself */
export const elementFor = (id: string): StyleElement => ELEMENT_BY_DOM_ID.get(id) ?? (id as StyleElement);

/** Whether the element keeps a record of user-named groups, even while the record is empty */
export const hasGroups = (element: StyleElement): boolean => element in GROUP_SOURCES;

export type GroupEntry = { id: string; label: string; count?: string };
export const groupEntriesFor = (element: StyleElement): GroupEntry[] => GROUP_SOURCES[element]?.() ?? [];

const countBy = <T>(items: readonly T[], key: (item: T) => string | undefined): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k !== undefined) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
};

// labels and burgs list top-down: the group drawn on top (states, capitals) is the one most often styled
const GROUP_SOURCES: Partial<Record<StyleElement, () => GroupEntry[]>> = {
  labels: () => {
    // count from the label data: the culled DOM only holds labels rendered at this zoom
    const counts = countBy(getLabelsData(), label => label.group);
    return options.map.labels.groups
      .map(({ name }) => ({ id: name, label: name, count: String(counts.get(name) ?? 0) }))
      .reverse();
  },
  burgIcons: () => {
    const burgs = pack.burgs.filter(burg => burg.i && !burg.removed);
    const all = countBy(burgs, burg => burg.group);
    const ports = countBy(
      burgs.filter(burg => burg.port),
      burg => burg.group
    );
    return [...options.map.burgs.groups]
      .sort((a, b) => b.order - a.order)
      .map(({ name }) => ({
        id: name,
        label: name,
        count: `${all.get(name) ?? 0} burgs, ${ports.get(name) ?? 0} ports`
      }));
  },
  routes: () => {
    const counts = countBy(pack.routes ?? [], route => route.group);
    return Object.keys(styles.routes.groups).map(id => ({ id, label: id, count: String(counts.get(id) ?? 0) }));
  },
  lakes: () => {
    const counts = countBy(
      (pack.features ?? []).filter(feature => feature?.type === "lake"),
      feature => (feature as { group?: string }).group
    );
    return Object.keys(styles.lakes.groups).map(id => ({ id, label: id, count: String(counts.get(id) ?? 0) }));
  }
};
