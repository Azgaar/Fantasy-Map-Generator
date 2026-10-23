// Star systems: one class-coloured marker per burg, drawn as a viewport layer like the burg icons
import { Layers } from "@/components/layers";
import { zoomFontSize } from "@/components/viewport";
import { type StarSystem, systemsOf } from "@/generators/astral-naming";
import { ViewportLayers, type ViewportRenderContext } from "@/renderers/viewport/viewport-renderer";
import type { StylesData } from "@/types/styles";
import { rn } from "@/utils/numberUtils";
import { escapeHtml } from "@/utils/stringUtils";
import {
  CAPITAL_GAP_EM,
  CAPITAL_RING_EM,
  GLOW_OPACITY,
  GLOW_RADIUS,
  groupByClass,
  PORT_ORBIT_EM,
  PORT_TICK_EM,
  STAR_CLASSES,
  type StarClassId,
  starRadiusEm
} from "./system-markers";

const layer = ViewportLayers.register({ id: "systems", render: reconcileSystems });

export function drawSystems(): void {
  TIME && console.time("drawSystems");
  layer.render();
  TIME && console.timeEnd("drawSystems");
}

type StarGroupStyle = StylesData["systems"]["groups"][StarClassId];
type Bounds = ViewportRenderContext["bounds"];

function reconcileSystems({ root, bounds }: ViewportRenderContext): void {
  if (!Layers.isOn("systems")) return;

  const container = root.querySelector<SVGGElement>("#systems");
  if (!container) return;

  const byClass = groupByClass(systemsOf());
  const markup: string[] = [];

  for (const cls of STAR_CLASSES) {
    const style = styles.systems.groups[cls];
    if (style) markup.push(writeGroup(cls, style, byClass[cls], bounds));
  }

  container.innerHTML = markup.join("");
}

/** One spectral class as its own data-group element, styled by its record */
function writeGroup(cls: StarClassId, style: StarGroupStyle, systems: StarSystem[], bounds: Bounds): string {
  const size = style.options.size ?? 1;
  // A marker is sized in % of the layer font, so it follows the zoom on the systems curve
  const em = (size * zoomFontSize("systems", bounds.scale)) / 100;
  const padding = 3 * em; // the star, its capital ring and its halo all sit inside this
  const glow = styles.systems.options.glow && style.options.glow;

  const markup = [`<g id="${cls}" data-group="${cls}"${writeAttrs(style.attrs)} font-size="${size}%">`];
  for (const { id, x, y, population, capital, port } of systems) {
    if (x + padding < bounds.x0 || x - padding > bounds.x1 || y + padding < bounds.y0 || y - padding > bounds.y1)
      continue;
    const radius = starRadiusEm(population);
    const star = [
      glow ? halo(radius) : "",
      `<circle class="star" r="${rn(radius, 3)}em"/>`,
      capital ? capitalRing(radius) : "",
      port ? portTick(radius) : ""
    ];
    markup.push(
      `<g id="system${id}" data-id="${id}" transform="translate(${rn(x, 2)} ${rn(y, 2)})">${star.join("")}</g>`
    );
  }

  markup.push("</g>");
  return markup.join("");
}

function halo(radius: number): string {
  return `<circle class="glow" r="${rn(radius * GLOW_RADIUS, 3)}em" fill-opacity="${GLOW_OPACITY}" stroke="none"/>`;
}

function capitalRing(radius: number): string {
  return `<circle class="capital" r="${rn(radius + CAPITAL_GAP_EM, 3)}em" fill="none" stroke-width="${CAPITAL_RING_EM}em"/>`;
}

function portTick(radius: number): string {
  const orbit = rn((radius + PORT_ORBIT_EM) * Math.SQRT1_2, 3); // the tick hangs on a 45° orbit
  return `<circle class="port" cx="${orbit}em" cy="-${orbit}em" r="${PORT_TICK_EM}em"/>`;
}

function writeAttrs(attrs: StarGroupStyle["attrs"]): string {
  const written: string[] = [];
  for (const [name, value] of Object.entries(attrs)) {
    if (value !== null && value !== undefined) written.push(` ${name}="${escapeHtml(String(value))}"`);
  }
  return written.join("");
}
