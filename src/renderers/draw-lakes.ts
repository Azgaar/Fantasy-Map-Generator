import type { Layer } from "@/components/layers";

export function drawLakes(layer: Layer): void {
  const groups = Array.from(layer.getEl().children);
  const groupIds = new Set(groups.map(group => group.id));
  const uses: Record<string, string[]> = {};

  for (const feature of pack.features) {
    if (!feature || feature.type !== "lake") continue;
    const group = groupIds.has(feature.group) ? feature.group : "freshwater"; // the group may have been removed

    if (!uses[group]) uses[group] = [];
    uses[group].push(`<use href="#feature_${feature.i}" data-f="${feature.i}"></use>`);
  }

  for (const group of groups) group.innerHTML = uses[group.id]?.join("") || "";
}
