import type { Layer } from "@/components/layers";

export function drawTexture(layer: Layer): void {
  const element = layer.getEl();
  const href = element.getAttribute("data-href");
  if (!href) return void element.replaceChildren();

  const x = Number(element.getAttribute("data-x") || 0);
  const y = Number(element.getAttribute("data-y") || 0);

  element.innerHTML = /* html */ `<image preserveAspectRatio="xMidYMid slice"
    x="${x}" y="${y}" width="${graphWidth - x}" height="${graphHeight - y}" href="${href}"></image>`;
}
