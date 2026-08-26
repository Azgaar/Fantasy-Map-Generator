import type { Layer } from "@/components/layers";

export function drawVignette(layer: Layer): void {
  layer.getEl().innerHTML = /* html */ `<rect x="0" y="0" width="100%" height="100%"></rect>`;
  applyVignetteOptions();
}

/** the mask rect in defs is shaped by the store's geometry options */
export function applyVignetteOptions(): void {
  const rect = document.getElementById("vignette-rect");
  if (!rect) return;
  for (const [key, value] of Object.entries(styles.vignette.options)) {
    if (value === null || value === undefined) rect.removeAttribute(key);
    else rect.setAttribute(key, String(value));
  }
}

window.applyVignetteOptions = applyVignetteOptions;
