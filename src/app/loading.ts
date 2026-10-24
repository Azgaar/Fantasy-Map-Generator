// The splash overlay shown while a map is being generated
import { select } from "d3";

const fade = (id: string, opacity: number, duration: number) =>
  select(`#${id}`).transition().duration(duration).style("opacity", String(opacity));

export function showLoading(): void {
  fade("loading", 1, 200);
  fade("optionsContainer", 0, 100);
  fade("tooltip", 0, 200);
}

export function hideLoading(): void {
  fade("loading", 0, 3000);
  fade("optionsContainer", 1, 2000);
  fade("tooltip", 1, 3000);
}
