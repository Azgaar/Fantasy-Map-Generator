// Star systems: one class-coloured marker per burg, drawn as a viewport layer like the burg icons
import { Layers } from "@/renderers/layers";
import { zoomFontSize } from "@/renderers/viewport/viewport";
import { type StarSystem, systemsOf } from "@/model/physical/astral-naming";
import { ViewportLayers, type ViewportRenderContext } from "@/renderers/viewport/viewport-renderer";
import type { StylesData } from "@/types/styles";
import { rn } from "@/utils/number-utils";
import { groupByClass, STAR_CLASSES, type StarClassId, starShape, writeAttrs } from "./system-markers";

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
  const glow = Boolean(styles.systems.options.glow && style.options.glow);

  const markup = [`<g id="${cls}" data-group="${cls}"${writeAttrs(style.attrs)} font-size="${size}%">`];
  for (const { id, x, y, population, capital, port } of systems) {
    if (x + padding < bounds.x0 || x - padding > bounds.x1 || y + padding < bounds.y0 || y - padding > bounds.y1)
      continue;
    markup.push(
      `<g id="system${id}" data-id="${id}" transform="translate(${rn(x, 2)} ${rn(y, 2)})">${starShape(population, capital, port, glow)}</g>`
    );
  }

  markup.push("</g>");
  return markup.join("");
}
