import type { Layer } from "@/components/layers";

export function drawLakes(layer: Layer): void {
  const uses: Record<string, string[]> = {};

  for (const feature of pack.features) {
    if (!feature || feature.type !== "lake") continue;

    const group = feature.group || "freshwater";
    if (!uses[group]) uses[group] = [];
    uses[group].push(`<use href="#feature_${feature.i}" data-f="${feature.i}"></use>`);
  }

  for (const group of Array.from(layer.getEl().children)) group.innerHTML = uses[group.id]?.join("") || "";
}
