import { type Layer, Layers } from "./layers/layers";

export function drawCompass(layer: Layer): void {
  const compass = layer.getEl();
  if (compass.querySelector("use")) return;

  compass.innerHTML = /* html */ `<use xlink:href="#defs-compass-rose"></use>`;
}

window.drawCompass = () => drawCompass(Layers.get("compass"));
