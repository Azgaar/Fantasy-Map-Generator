import type { Layer } from "@/components/layers";

export function drawVignette(layer: Layer): void {
  layer.getEl().innerHTML = /* html */ `<rect x="0" y="0" width="100%" height="100%"></rect>`;
}
