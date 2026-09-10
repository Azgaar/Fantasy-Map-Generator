// The splash overlay shown while a map is being generated
import { select } from "d3";

const fade = (id: string, opacity: number, duration: number) =>
  select(`#${id}`).transition().duration(duration).style("opacity", String(opacity));

export function showLoading(): void {
  select("#loading").style("display", null);
  fade("loading", 1, 200);
  fade("optionsContainer", 0, 100);
  fade("tooltip", 0, 200);
}

export function hideLoading(): void {
  // display:none after the fade so the splash animations stop; opacity 0 alone keeps them
  // ticking and re-rasterizing the SVG underneath, which is catastrophic at 100K+ burgs
  fade("loading", 0, 3000).on("end", () => select("#loading").style("display", "none"));
  fade("optionsContainer", 1, 2000);
  fade("tooltip", 1, 3000);
}
