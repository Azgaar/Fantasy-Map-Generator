// Dust density: elevation bands over the sector — the chart's read of where the dust is thick
import type { Layer } from "@/components/layers";
import { getIsolines } from "@/utils/pathUtils";
import { buildDustBands } from "./dust-bands";

const BANDS = 6; // fixed band groups declared in the layer registry

export function drawDustDensity(layer: Layer): void {
  TIME && console.time("drawDustDensity");
  const element = layer.getEl();
  const groups = Array.from(element.querySelectorAll("[data-group]"));
  const clear = () => {
    for (const group of groups) group.replaceChildren();
    TIME && console.timeEnd("drawDustDensity");
  };
  if (!pack.cells?.i?.length) return void clear();

  const { levels } = styles.dustDensity.options;
  const bands = buildDustBands(pack.cells.h, levels);
  if (!bands.some(band => band)) return void clear();

  const isolines = getIsolines(pack, cellId => bands[cellId] || null, { fill: true });
  for (let band = 1; band <= BANDS; band++) {
    const group = element.querySelector(`[data-group="band${band}"]`);
    if (!group) continue;
    const fill = band <= levels ? isolines[band]?.fill : undefined;
    group.innerHTML = fill ? /* html */ `<path d="${fill}"/>` : "";
  }

  TIME && console.timeEnd("drawDustDensity");
}
