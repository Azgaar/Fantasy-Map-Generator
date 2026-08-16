import type { Layer } from "./layers/layers";

export function drawTexture(layer: Layer): void {
  const element = layer.getEl();
  const x = Number(element.getAttribute("data-x") || 0);
  const y = Number(element.getAttribute("data-y") || 0);
  const href = element.getAttribute("data-href");

  element.innerHTML = /* html */ `<image preserveAspectRatio="xMidYMid slice"
    x="${x}" y="${y}" width="${graphWidth - x}" height="${graphHeight - y}" href="${href}"></image>`;
}
