import type { Layer } from "@/components/layers";

export function drawCoastline(layer: Layer): void {
  const groups = Array.from(layer.getEl().children);
  const groupIds = new Set(groups.map(group => group.id));
  const uses: Record<string, string[]> = {};

  for (const feature of pack.features) {
    if (!feature || feature.type === "ocean" || feature.type === "lake") continue;
    const renderingGroup = feature.renderingGroup;
    const group = renderingGroup && groupIds.has(renderingGroup) ? renderingGroup : "sea_island";

    if (!uses[group]) uses[group] = [];
    uses[group].push(`<use href="#feature_${feature.i}" data-f="${feature.i}"></use>`);
  }

  for (const group of groups) group.innerHTML = uses[group.id]?.join("") || "";
}
