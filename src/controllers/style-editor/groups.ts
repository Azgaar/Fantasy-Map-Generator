// What the Element and Group selects list: every style element by label, and for a grouped element its
// groups with how many things use each
import { layerLabel } from "@/data/layer-labels";
import { type StyleElement, stylesSchema } from "@/generators/styles-schema";
import { getLabelsData } from "@/renderers/labels/label-data";

export type GroupEntry = { id: string; label: string };
type GroupSource = () => GroupEntry[];

export function listElements(): { id: StyleElement; label: string }[] {
  return (Object.keys(stylesSchema.shape) as StyleElement[])
    .map(id => ({ id, label: layerLabel(id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

const countBy = <T>(items: readonly T[], key: (item: T) => string | undefined): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k !== undefined) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
};

export const GROUP_SOURCES: Record<string, GroupSource> = {
  labels: () => {
    // count from the label data: the culled DOM only holds labels rendered at this zoom
    const counts = countBy(getLabelsData(), label => label.group);
    return options.map.labels.groups.map(({ name }) => ({ id: name, label: `${name} (${counts.get(name) ?? 0})` }));
  },
  burgIcons: () => {
    const burgs = pack.burgs.filter(burg => burg.i && !burg.removed);
    const all = countBy(burgs, burg => burg.group);
    const ports = countBy(
      burgs.filter(burg => burg.port),
      burg => burg.group
    );
    return [...options.map.burgs.groups]
      .sort((a, b) => a.order - b.order)
      .map(({ name }) => ({ id: name, label: `${name} (${all.get(name) ?? 0} burgs, ${ports.get(name) ?? 0} ports)` }));
  },
  routes: () => {
    const counts = countBy(pack.routes ?? [], route => route.group);
    return Object.keys(styles.routes.groups).map(id => ({ id, label: `${id} (${counts.get(id) ?? 0})` }));
  },
  lakes: () => {
    const counts = countBy(
      (pack.features ?? []).filter(feature => feature?.type === "lake"),
      feature => (feature as { group?: string }).group
    );
    return Object.keys(styles.lakes.groups).map(id => ({ id, label: `${id} (${counts.get(id) ?? 0})` }));
  }
};
