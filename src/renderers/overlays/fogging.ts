// Fogging: dim everything outside the focused area by punching its shape out of the fog overlay
import { easeSinInOut, select, transition } from "d3";
import { type Layer, Layers } from "@/components/layers";

const FADE_DURATION = 2000;
const fadeIn = () => transition().duration(FADE_DURATION).ease(easeSinInOut);

export function drawFogging(layer: Layer): void {
  const element = layer.getEl();
  const isRevealed = Boolean(document.querySelector("#fog path"));

  if (!isRevealed) return void element.replaceChildren();
  if (element.hasChildNodes()) return; // already showing: the mask alone changed

  element.innerHTML = /* html */ `<rect x="0" y="0" width="100%" height="100%"></rect>
    <rect x="0" y="0" width="100%" height="100%" fill="#e8f0f6" filter="url(#splotch)"></rect>`;

  const fogging = select(element);
  const opacity = fogging.attr("opacity");
  fogging.attr("opacity", 0).transition(fadeIn()).attr("opacity", opacity);
}

export function fog(id: string, path: string): void {
  const fogMask = select("#fog");
  if (fogMask.select(`#${id}`).size()) return;

  const isFirst = !fogMask.select("path").size();
  const revealed = fogMask.append("path").attr("d", path).attr("id", id);
  if (!isFirst) revealed.attr("opacity", 0).transition(fadeIn()).attr("opacity", 1);

  Layers.draw("fogging");
}

export function unfog(id?: string): void {
  const fogMask = select("#fog");
  const selector = id && fogMask.select(`#${id}`).size() ? `#${id}` : "path";
  fogMask.selectAll(selector).remove();

  Layers.draw("fogging");
}

// legacy seam:
window.unfog = unfog;
