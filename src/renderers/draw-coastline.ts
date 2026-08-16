import type { Layer } from "@/components/layers";

export function drawCoastline(layer: Layer): void {
  const uses: Record<string, string[]> = {};

  for (const feature of pack.features) {
    if (!feature || feature.type === "ocean" || feature.type === "lake") continue;

    const group = feature.group === "lake_island" ? "lake_island" : "sea_island";
    if (!uses[group]) uses[group] = [];
    uses[group].push(`<use href="#feature_${feature.i}" data-f="${feature.i}"></use>`);
  }

  for (const group of Array.from(layer.getEl().children)) group.innerHTML = uses[group.id]?.join("") || "";
}
