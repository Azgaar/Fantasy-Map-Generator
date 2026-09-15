import type { Styles } from "@/generators/styles-schema";
import { createEl, ensureEl } from "@/utils/nodeUtils";

type CoastalBands = Styles["ocean"]["options"]["bands"];

export function getCoastalBandReach(bands: CoastalBands): number {
  return bands.render && bands.opacity > 0 ? bandRadius(bands, bands.count) : 0;
}

function bandRadius(bands: CoastalBands, index: number): number {
  return bands.spacing * (index + 0.15 * index * (index - 1));
}

export function removeCoastalBands(): void {
  ensureEl("oceanBands").replaceChildren();
  for (const id of ["coastal-bands-mask", "coastal-bands-lines", "coastal-bands-shade"]) {
    document.getElementById(id)?.remove();
  }
}

export function drawCoastalBands(): void {
  removeCoastalBands();
  const bands = styles.ocean.options.bands;
  if (!bands.render) return;
  const group = ensureEl<SVGGElement>("oceanBands");

  const { width, height } = options.map.graph;
  const land = pack.features.filter(feature => feature?.land);
  const coasts = land.filter(feature => feature.subtype !== "lake_island");
  const maskAttrs = {
    maskUnits: "userSpaceOnUse",
    x: "0",
    y: "0",
    width: String(width),
    height: String(height)
  };
  const mask = createEl("mask", "coastal-bands-mask", maskAttrs);
  mask.innerHTML = `<rect width="${width}" height="${height}" fill="white" />${land
    .map(feature => `<use href="#feature_${feature.i}" fill="black" />`)
    .join("")}`;
  ensureEl("deftemp").append(mask);
  group.setAttribute("mask", "url(#coastal-bands-mask)");
  group.setAttribute("opacity", String(bands.opacity));
  group.setAttribute("fill", "none");
  group.setAttribute("stroke-linejoin", "round");
  group.setAttribute("stroke-linecap", "round");
  group.setAttribute("pointer-events", "none");

  const uses = coasts.map(feature => `<use href="#feature_${feature.i}" />`).join("");
  const strokes: string[] = [];
  const shades: string[] = [];
  // Draw each width across all islands before the next, so bands merge in narrow straits.
  for (let i = bands.count; i >= 1; i--) {
    const radius = bandRadius(bands, i);
    const edge = Math.min(bands.width, bands.spacing * 0.45);
    strokes.push(
      `<g stroke="white" stroke-width="${2 * radius}">${uses}</g>`,
      `<g stroke="black" stroke-width="${2 * (radius - edge)}">${uses}</g>`
    );
    const lightness = Math.round(255 * (1 - (i - 1) / bands.count));
    shades.push(`<g stroke="rgb(${lightness},${lightness},${lightness})" stroke-width="${2 * radius}">${uses}</g>`);
  }
  for (const [id, paths] of [
    ["lines", strokes],
    ["shade", shades]
  ] as const) {
    const bandMask = createEl("mask", `coastal-bands-${id}`, maskAttrs);
    bandMask.innerHTML = `<g fill="none" stroke-linejoin="round" stroke-linecap="round">${paths.join("")}</g>`;
    ensureEl("deftemp").append(bandMask);
  }
  group.innerHTML = `<rect width="${width}" height="${height}" data-band="shade" fill="${bands.shore}"
    fill-opacity="${bands.shade}" mask="url(#coastal-bands-shade)" />
    <rect width="${width}" height="${height}" fill="${bands.color}" mask="url(#coastal-bands-lines)" />`;
}
