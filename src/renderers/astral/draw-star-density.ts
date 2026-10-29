// Star density: the banded heatmap of where systems cluster, masked to the land by the style
import type { Layer } from "@/renderers/layers";
import { getIsolines } from "@/utils/path-utils";
import { buildDensityField } from "./star-density-field";

const BANDS = 6; // fixed band groups declared in the layer registry

export function drawStarDensity(layer: Layer): void {
  TIME && console.time("drawStarDensity");
  const element = layer.getEl();
  const groups = Array.from(element.querySelectorAll("[data-group]"));
  const clear = () => {
    for (const group of groups) group.replaceChildren();
    TIME && console.timeEnd("drawStarDensity");
  };
  if (!pack.cells?.i?.length) return void clear();

  const { levels, reach, populationWeight } = styles.starDensity.options;
  const bands = buildDensityField(pack.cells, pack.burgs, options.map.graph, { levels, reach, populationWeight });
  if (!bands.some(band => band)) return void clear();

  const isolines = getIsolines(pack, cellId => bands[cellId] || null, { fill: true });
  for (let band = 1; band <= BANDS; band++) {
    const group = element.querySelector(`[data-group="band${band}"]`);
    if (!group) continue;
    const fill = band <= levels ? isolines[band]?.fill : undefined;
    group.innerHTML = fill ? /* html */ `<path d="${fill}"/>` : "";
  }

  TIME && console.timeEnd("drawStarDensity");
}
