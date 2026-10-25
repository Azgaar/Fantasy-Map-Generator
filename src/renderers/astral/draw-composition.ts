// Composition: biomes re-read as the resource character of a region — a tint over the dust sheet
import type { Layer } from "@/components/layers";
import { getIsolines } from "@/utils/pathUtils";
import { biomeClass, COMPOSITION_CLASSES } from "./biome-classes";

export function drawComposition(layer: Layer): void {
  TIME && console.time("drawComposition");
  const element = layer.getEl();
  const groups = Array.from(element.querySelectorAll("[data-group]"));
  const clear = () => {
    for (const group of groups) group.replaceChildren();
    TIME && console.timeEnd("drawComposition");
  };
  if (!pack.cells?.i?.length) return void clear();

  const isolines = getIsolines(pack, cellId => biomeClass(pack.cells.biome[cellId]) || null, { fill: true });
  COMPOSITION_CLASSES.forEach((name, index) => {
    const group = element.querySelector(`[data-group="${name}"]`);
    const fill = isolines[index + 1]?.fill;
    if (group) group.innerHTML = fill ? /* html */ `<path d="${fill}"/>` : "";
  });

  TIME && console.timeEnd("drawComposition");
}
