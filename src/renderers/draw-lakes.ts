import type { Layer } from "@/components/layers";
import { getLakeRipples } from "./lake-ripples";

export function drawLakes(layer: Layer): void {
  const groups = Array.from(layer.getEl().children);
  const groupIds = new Set(groups.map(group => group.id));
  const existing = new Map(
    Array.from(layer.getEl().querySelectorAll("use[data-f]"), use => [use.getAttribute("data-f"), use])
  );
  const uses: Record<string, Element[]> = {};

  for (const feature of pack.features) {
    if (feature?.type !== "lake") continue;
    const group = groupIds.has(feature.group) ? feature.group : "freshwater"; // the group may have been removed

    const use = existing.get(String(feature.i)) ?? document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `#feature_${feature.i}`);
    use.setAttribute("data-f", String(feature.i));
    if (!uses[group]) uses[group] = [];
    uses[group].push(use);
  }

  for (const group of groups) group.replaceChildren(...(uses[group.id] || []));
  drawLakeEmbellishments(layer);
}

/** the ripple masks in deftemp live as long as the ripple paths in the lake groups */
export function removeLakeEmbellishments(): void {
  for (const node of document.querySelectorAll("[data-lake-embellishment]")) node.remove();
}

export function drawLakeEmbellishments(layer: Layer): void {
  removeLakeEmbellishments();
  const defs = document.getElementById("deftemp");
  if (!defs) return;
  const islands = pack.features
    .filter(feature => feature?.land && feature.subtype === "lake_island")
    .map(feature => `<use href="#feature_${feature.i}" fill="black" stroke="black"></use>`)
    .join("");

  for (const use of layer.getEl().querySelectorAll(":scope > g > use[data-f]")) {
    const style = styles.lakes.groups[use.parentElement!.id]?.options;
    if (!style || style.embellishment === "none") continue;
    const feature = pack.features[Number(use.getAttribute("data-f"))];
    const points = feature.vertices.map(vertex => pack.vertices.p[vertex]);
    const { path, x, y, width, height, gap } = getLakeRipples(
      points,
      grid.spacing,
      style,
      `${options.map.seed}:lake:${feature.i}`
    );
    if (!path) continue;
    const id = `lake-ripples-${feature.i}`;
    defs.insertAdjacentHTML(
      "beforeend",
      /* html */ `<mask id="${id}" data-lake-embellishment="" maskUnits="userSpaceOnUse"
      x="${x}" y="${y}" width="${width}" height="${height}">
      <use href="#feature_${feature.i}" fill="white" stroke="black" stroke-width="${gap * 2}" stroke-linejoin="round"></use>
      <g stroke-width="${gap * 2}" stroke-linejoin="round">${islands}</g>
    </mask>`
    );
    const stroke = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const attrs = {
      "data-lake-embellishment": "",
      d: path,
      fill: "none",
      stroke: style.color,
      "stroke-width": String(style.width),
      "stroke-dasharray": "none",
      "stroke-linecap": "round",
      opacity: String(style.opacity),
      mask: `url(#${id})`,
      "pointer-events": "none"
    };
    for (const [name, value] of Object.entries(attrs)) stroke.setAttribute(name, value);
    use.after(stroke);
  }
}
