// Remnants: collapse-classed objects where matter piled thickest, drawn as a viewport layer like the systems
import { Layers } from "@/components/layers";
import { zoomFontSize } from "@/components/viewport";
import { ViewportLayers, type ViewportRenderContext } from "@/renderers/viewport/viewport-renderer";
import type { StylesData } from "@/types/styles";
import { rn } from "@/utils/numberUtils";
import { escapeHtml } from "@/utils/stringUtils";
import { collectRemnants, REMNANT_CLASSES, type Remnant, type RemnantClassId } from "./remnants";

const layer = ViewportLayers.register({ id: "remnants", render: reconcileRemnants });

export function drawRemnants(): void {
  TIME && console.time("drawRemnants");
  if (!pack.relief?.length) Relief.generate(); // pure pack data: the glyphs are hand-drawn, no assets
  layer.render();
  TIME && console.timeEnd("drawRemnants");
}

/** glyph geometry in em of the layer font */
const HALO_EM = 1.15; // the glow halo radius
const HALO_OPACITY = 0.22;
const PADDING_EM = 1.4; // culling margin: every glyph and its halo sit inside this

type RemnantGroupStyle = StylesData["remnants"]["groups"][RemnantClassId];

function reconcileRemnants({ root, bounds }: ViewportRenderContext): void {
  const container = root.querySelector<SVGGElement>("#remnants");
  if (!container) return;
  if (!Layers.isOn("remnants")) return void container.replaceChildren();

  const em = zoomFontSize("remnants", bounds.scale);
  const padding = PADDING_EM * em;
  const glow = styles.remnants.options.glow;
  const remnants = collectRemnants(pack.relief, (x, y) => Pack.findCell(x, y), pack.cells.h);

  const markup: string[] = [];
  for (const cls of REMNANT_CLASSES) {
    const style = styles.remnants.groups[cls];
    if (style)
      markup.push(
        writeGroup(
          cls,
          style,
          remnants.filter(remnant => remnant.cls === cls),
          bounds,
          padding,
          glow
        )
      );
  }
  container.innerHTML = markup.join("");
}

/** One remnant class as its own data-group element, styled by its record */
function writeGroup(
  cls: RemnantClassId,
  style: RemnantGroupStyle,
  remnants: Remnant[],
  bounds: ViewportRenderContext["bounds"],
  padding: number,
  glow: boolean
): string {
  const markup = [`<g id="${cls}" data-group="${cls}"${writeAttrs(style.attrs)}>`];
  for (const { index, x, y } of remnants) {
    if (x + padding < bounds.x0 || x - padding > bounds.x1 || y + padding < bounds.y0 || y - padding > bounds.y1)
      continue;
    const body = (glow ? halo() : "") + glyph(cls);
    markup.push(
      `<g id="remnant${index}" data-id="${index}" transform="translate(${rn(x, 2)} ${rn(y, 2)})">${body}</g>`
    );
  }
  markup.push("</g>");
  return markup.join("");
}

/** the three glyphs: a ring-with-dot singularity, concentric pulse rings, a small diamond */
function glyph(cls: RemnantClassId): string {
  if (cls === "blackHole")
    return /* html */ `<circle class="ring" r="0.5em" fill="none" stroke-width="0.11em"/><circle class="dot" r="0.16em"/>`;
  if (cls === "pulsar")
    return /* html */ `<circle class="dot" r="0.14em"/><circle class="ring" r="0.4em" fill="none" stroke-width="0.09em"/><circle class="ring" r="0.66em" fill="none" stroke-width="0.05em"/>`;
  return /* html */ `<rect class="diamond" x="-0.26em" y="-0.26em" width="0.52em" height="0.52em" transform="rotate(45)"/>`;
}

function halo(): string {
  return `<circle class="glow" r="${HALO_EM}em" fill-opacity="${HALO_OPACITY}" stroke="none"/>`;
}

function writeAttrs(attrs: RemnantGroupStyle["attrs"]): string {
  const written: string[] = [];
  for (const [name, value] of Object.entries(attrs)) {
    if (value !== null && value !== undefined) written.push(` ${name}="${escapeHtml(String(value))}"`);
  }
  return written.join("");
}
