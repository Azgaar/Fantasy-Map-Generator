import type { Layer } from "./layers/layers";

export function drawFogging(layer: Layer): void {
  layer.getEl().innerHTML = /* html */ `<rect x="0" y="0" width="100%" height="100%"></rect>
    <rect x="0" y="0" width="100%" height="100%" fill="#e8f0f6" filter="url(#splotch)"></rect>`;
}
