import type { Layer } from "@/components/layers";

export function drawTexture(layer: Layer): void {
  const element = layer.getEl();
  const { href, x, y } = styles.texture.options;
  if (!href) return void element.replaceChildren();

  element.innerHTML = /* html */ `<image preserveAspectRatio="xMidYMid slice"
    x="${x}" y="${y}" width="${graphWidth - x}" height="${graphHeight - y}" href="${href}"></image>`;
}
