import { Icons } from "@/components/icons";
import { Emblems } from "@/generators/emblems-generator";
import type {
  Emblem,
  EmblemCharge,
  EmblemInscription,
  EmblemOrdinary,
  HeraldicEmblem,
  PictureEmblem
} from "@/types/emblems";
import { colors } from "./colors";
import { componyDashes } from "./compony";
import { diapers } from "./diapers";
import { lines } from "./lines";
import { patterns } from "./patterns";
import { DEFAULT_SHIELD_BOX, INESCUTCHEON, inescutcheonShape, shieldShapes } from "./shields";
import { divisionTemplates, ordinaryTemplates, type Template } from "./templates";

declare global {
  interface Window {
    EmblemRenderer: EmblemRendererModule;
  }
}

const SIZE_MODIFIERS: Record<string, number> = { small: 0.8, smaller: 0.5, smallest: 0.25, big: 1.6, bigger: 2 };

// document-wide and matched in <use> copies, so it names SVG-only elements rather than scoping by emblem id
const CHARGE_ELEMENTS = ":is(g, path, circle, ellipse, rect)";
const CHARGE_STYLE = `
  ${CHARGE_ELEMENTS}.secondary {fill: var(--secondary);}
  ${CHARGE_ELEMENTS}.tertiary {fill: var(--tertiary);}
  ${CHARGE_ELEMENTS}.pseudostroke {fill: var(--stroke);}
  ${CHARGE_ELEMENTS}.background {display: var(--background);}`;

const round = (value: number) => Math.round(value * 100) / 100;
const escapeXml = (text: string) => text.replace(/[&<>"]/g, char => `&#${char.charCodeAt(0)};`);
const attr = (name: string, value: string | number | undefined) => (value ? ` ${name}="${value}"` : "");

function getTemplate({ template, templateLined }: Template, line?: string): string {
  if (!line || line === "straight" || !templateLined || !lines[line]) return template;
  return templateLined(lines[line]);
}

/** the charge a semy tincture strews, like `mullet` in `semy_of_mullet-or-azure` */
function semy(tincture: string | undefined): string | null {
  return tincture?.match(/^semy_of_(.*?)-/)?.[1] ?? null;
}

/** placement of a charge or ordinary group; a positioned charge is sized per position instead */
function groupTransform(element: EmblemCharge | EmblemOrdinary): string {
  const positioned = "p" in element && element.p;
  const { x = 0, y = 0, angle = 0 } = element;
  const size = positioned ? 1 : (element.size ?? 1);
  const stretch = positioned ? 0 : (element.stretch ?? 0);

  let sx = size;
  let sy = size;
  if (stretch < 0) sx = round(sx * (1 - stretch));
  else if (stretch > 0) sy = round(sy * (1 + stretch));
  const dx = round(x - 100 * (sx - 1));
  const dy = round(y - 100 * (sy - 1));

  let transform = "";
  if (dx || dy) transform += `translate(${dx} ${dy})`;
  if (angle) transform += ` rotate(${angle} ${sx * 100} ${sy * 100})`;
  if (sx !== 1 || sy !== 1) transform += sx === sy ? ` scale(${sx})` : ` scale(${sx} ${sy})`;
  return transform.trim();
}

function useTransform(charge: EmblemCharge, [px, py]: [number, number], sizeModifier: number): string {
  const size = round((charge.size || 1) * sizeModifier);
  const stretch = charge.stretch ?? 0;
  let sx = charge.sinister ? -size : size;
  let sy = charge.reversed ? -size : size;
  if (stretch < 0) sx = round(sx * (1 - stretch));
  else if (stretch > 0) sy = round(sy * (1 + stretch));
  const x = round(px - 100 * (sx - 1));
  const y = round(py - 100 * (sy - 1));

  let transform = "";
  if (x || y) transform += `translate(${x} ${y})`;
  if (sx !== 1 || sy !== 1) transform += sx === sy ? ` scale(${sx})` : ` scale(${sx} ${sy})`;
  return transform.trim();
}

function viewBoxOf(box: string, zoom: number): string {
  const [x0, y0, w0, h0] = box.split(" ").map(Number);
  const w = Math.round(w0 / zoom);
  const h = Math.round(h0 / zoom);
  return `${x0 - w / 2 + 100} ${y0 - h / 2 + 100} ${w} ${h}`;
}

function drawInscription(inscription: EmblemInscription, pathId: string): string {
  const { text, font, size, color, path, bold, italic, spacing, shadow } = inscription;
  const rows = text.split("|");
  const tspans = rows
    .map((row, i) => `<tspan x="0" dy="${i > 0 ? 1 : -0.5 * (rows.length - 1)}em">${escapeXml(row)}</tspan>`)
    .join("");
  const style = shadow
    ? ` style="text-shadow: ${shadow.x}px ${shadow.y}px ${shadow.blur}px ${escapeXml(shadow.color)}"`
    : "";

  const typeface = ` font-family="${escapeXml(font)}" font-size="${size}px" font-weight="${bold ? "bold" : "normal"}" font-style="${italic ? "italic" : "normal"}"`;
  const label = `<text${attr("letter-spacing", spacing)} fill="${escapeXml(color)}"${typeface} dominant-baseline="middle"${style}><textPath href="#${pathId}" text-anchor="middle" startOffset="50%">${tspans}</textPath></text>`;
  return `<g transform="translate(100, 100)"><path id="${pathId}" fill="none" d="${escapeXml(path)}"/>${label}</g>`;
}

class EmblemRendererModule {
  private versions = new Map<string, number>();
  private pending = new Map<string, { coa: string; promise: Promise<unknown> }>();
  private paths?: Record<string, string>;

  get shieldPaths(): Record<string, string> {
    this.paths ??= Object.fromEntries(Object.entries(shieldShapes).map(([name, { path }]) => [name, path]));
    return this.paths;
  }

  private drawPicture(id: string, coa: PictureEmblem): void {
    const shape = coa.shield ? shieldShapes[coa.shield] : undefined;
    const clip = shape ? `<clipPath id="shield_${id}"><path d="${shape.path}"/></clipPath>` : "";
    const backlight = shape
      ? `<radialGradient id="backlight_${id}" cx="100%" cy="100%" r="150%"><stop stop-color="#fff" stop-opacity=".3" offset="0"/><stop stop-color="#fff" stop-opacity=".15" offset=".25"/><stop stop-color="#000" stop-opacity="0" offset="1"/></radialGradient>`
      : "";
    const picture = `<use href="${Icons.href(coa.icon)}" x="0" y="0" width="200" height="200"${Icons.paintAttributes(coa.icon)}/>`;
    const content = shape ? `<g clip-path="url(#shield_${id})">${picture}</g>` : picture;
    const overlay = shape ? `<path d="${shape.path}" fill="url(#backlight_${id})" stroke="#333"/>` : "";
    const svg = `<svg id="${id}" width="200" height="200" viewBox="${shape?.box ?? DEFAULT_SHIELD_BOX}"><defs>${clip}${backlight}</defs>${content}${overlay}</svg>`;
    const coas = document.getElementById("coas")!;
    document.getElementById(id)?.remove();
    coas.insertAdjacentHTML("beforeend", svg);
    (coas.lastElementChild as SVGElement).dataset.coa = JSON.stringify(coa);
  }

  /** a charge definition: the charge set's symbol placed in shield space, or a small shield for inescutcheons */
  private getCharge(charge: string, id: string, shield: string): string {
    const shape = inescutcheonShape(charge, shield);
    if (!shape) {
      const icon = Emblems.chargeArt(charge);
      if (!icon) return "";
      // a library icon takes the tincture as fill; line art (a set that paints its strokes) draws its lines in it,
      // since its bodies are fixed; custom art gets no outline
      const { stroke, strokeWidth } = Emblems.chargeIcon(charge) ? {} : Icons.paint(icon);
      const lines = stroke ? ` style="stroke: var(--tincture)"${attr("stroke-width", strokeWidth)}` : "";
      const outline = Icons.kind(icon) === "custom" ? ' stroke="none"' : lines;
      return `<g id="${charge}_${id}"><use href="${Icons.href(icon)}" x="60" y="60" width="80" height="80"${outline}/></g>`;
    }
    const path = (shieldShapes[shape] ?? shieldShapes[shield]).path;
    return `<g id="${charge}_${id}"><path transform="translate(67 67) scale(.33)" d="${path}"/></g>`;
  }

  private async draw(id: string, coa: HeraldicEmblem, version: number) {
    const { ordinaries = [], charges = [], inscriptions = [] } = coa;
    const shield = coa.shield && shieldShapes[coa.shield] ? coa.shield : "heater";
    const { path: shieldPath, box = DEFAULT_SHIELD_BOX, size: sizeModifier = 1, segments } = shieldShapes[shield];
    const positions = shieldShapes[shield].positions ?? shieldShapes.spanish.positions!;
    const division =
      coa.division && divisionTemplates[coa.division.division] && coa.division.division !== "no" ? coa.division : null;
    const ordinariesRegular = ordinaries.filter(o => !o.above);
    const ordinariesAbove = ordinaries.filter(o => o.above);

    const patternDefs = new Map<string, string>();
    const chargeNames = new Set<string>();
    let masks = 0;

    // a color, or a link to a pattern defined for this emblem
    const clr = (tincture: string | undefined): string | undefined => {
      if (!tincture) return undefined;
      if (colors[tincture]) return colors[tincture];
      if (/^#[\da-f]{3,8}$/i.test(tincture)) return tincture;
      const [pattern, t1, t2, size] = tincture.split("-");
      const charge = semy(tincture);
      if (!charge && !patterns[pattern]) return "#000000"; // unknown tincture

      const patternId = `${tincture.replaceAll("#", "")}_${id}`; // hex colours are tinctures too: `vair-#228833-or`
      if (!patternDefs.has(patternId)) {
        const [c1, c2] = [clr(t1)!, clr(t2)!];
        const sizeModifier = SIZE_MODIFIERS[size] ?? 1;
        if (charge) chargeNames.add(charge);
        const markup = charge
          ? patterns.semy(patternId, c1, c2, sizeModifier, `${charge}_${id}`)
          : patterns[pattern](patternId, c1, c2, sizeModifier);
        patternDefs.set(patternId, markup);
      }
      return `url(#${patternId})`;
    };

    const drawCharge = (charge: EmblemCharge, t = clr(charge.t), t2?: string, t3?: string, hideBackground = false) => {
      const name =
        charge.charge === INESCUTCHEON ? INESCUTCHEON + shield[0].toUpperCase() + shield.slice(1) : charge.charge;
      chargeNames.add(name);
      const stroke = charge.stroke || "#000";
      const style = `--tincture: ${t}; --secondary: ${t2 || t}; --tertiary: ${t3 || t}; --stroke: ${stroke}; --background: ${hideBackground ? "none" : "block"}`;
      const uses = [...new Set(charge.p)]
        .filter(p => positions[p])
        .map(p => `<use href="#${name}_${id}"${attr("transform", useTransform(charge, positions[p], sizeModifier))}/>`)
        .join("");
      return `<g fill="${t}"${attr("transform", groupTransform(charge))} stroke="${escapeXml(stroke)}" style="${escapeXml(style)}">${uses}</g>`;
    };

    const drawOrdinary = (ordinary: EmblemOrdinary, t = clr(ordinary.t), t2 = t) => {
      const { ordinary: type, gyronny, compony } = ordinary;
      const width = type === "bordure" ? 33.3 : type === "orle" ? 10 : ordinary.strokeWidth || 1;

      let content: string;
      if (type === "bordure" || type === "orle") {
        const transform = type === "orle" ? ` transform="translate(15 15) scale(.85)"` : "";
        const outline = `<path d="${shieldPath}" fill="none" stroke="${t}"${transform}/>`;
        if (gyronny) {
          const count = Math.round(gyronny / 2) * 2;
          const angle = (2 * Math.PI) / count;
          const point = (k: number) =>
            `${round(100 + Math.cos(k * angle) * 200)},${round(100 + Math.sin(k * angle) * 200)}`;
          const sectors = Array.from(
            { length: count / 2 },
            (_, i) => `<polygon points="100,100 ${point(2 * i)} ${point(2 * i + 1)}"/>`
          ).join("");
          const maskId = `mask${masks++}_${id}`;
          content = `<mask id="${maskId}"><path d="${shieldPath}" fill="none" stroke="white"/></mask>${outline}<g fill="${t2}" mask="url(#${maskId})"${transform}>${sectors}</g>`;
        } else if (compony) {
          const dashes = componyDashes(shieldPath, segments, compony).map(dash => Math.round(dash * 1000) / 1000);
          const tiles = `<path d="${shieldPath}" fill="none" stroke="${t2}" stroke-dasharray="${dashes.join(" ")}"${transform}/>`;
          content = outline + (dashes.length ? tiles : "");
        } else {
          content = outline;
        }
      } else {
        const template = ordinaryTemplates[type];
        if (!template) return "";
        content = getTemplate(template, ordinary.line);
      }

      const stroke = escapeXml(ordinary.stroke || "none");
      return `<g fill="${t}" stroke="${stroke}" stroke-width="${width}"${attr("transform", groupTransform(ordinary))}>${content}</g>`;
    };

    const own = (charge: EmblemCharge, hide = false) =>
      drawCharge(charge, clr(charge.t), clr(charge.t2), clr(charge.t3), hide);
    const drawCharges = (test: (charge: EmblemCharge) => boolean, hide = false) =>
      charges
        .filter(test)
        .map(charge => own(charge, hide))
        .join("");

    // a divided part draws its own elements and the counterchanged ones in the other part's tincture
    const partOrdinaries = (list: EmblemOrdinary[], part: "field" | "division", counter: string) =>
      list
        .filter(o => o.divided === part || o.divided === "counter")
        .map(o => (o.divided === part ? drawOrdinary(o, clr(o.t), clr(o.t2)) : drawOrdinary(o, clr(counter))))
        .join("");
    const partCharges = (part: "field" | "division", counter: string, hide: boolean) =>
      charges
        .filter(c => (c.divided === part || c.divided === "counter") && (!hide || c.layered))
        .map(c => (c.divided === part ? own(c, hide) : drawCharge(c, clr(counter), undefined, undefined, hide)))
        .join("");

    const diaper = coa.diaper && diapers[coa.diaper] ? coa.diaper : null;
    const plainField = !coa.t1.includes("-");
    const plainDivision = !division?.t.includes("-");
    const diaperType = !diaper
      ? null
      : plainField && plainDivision
        ? "overall"
        : plainField
          ? "field"
          : plainDivision
            ? "division"
            : null;
    const diaperRect = (type: string) =>
      diaperType === type
        ? `<rect class="diaper" x="0" y="0" width="200" height="200" fill="url(#diaper_${id})" style="pointer-events: none"/>`
        : "";

    const below =
      drawCharges(c => c.outside === "below" || c.outside === "around") +
      drawCharges(c => c.outside === "below" && !!c.layered, true);

    const field = `<rect x="0" y="0" width="200" height="200" fill="${clr(coa.t1)}"/>`;

    let divided = "";
    if (division) {
      divided += partOrdinaries(ordinariesRegular, "field", division.t);
      divided += diaperRect("field");
      divided += partCharges("field", division.t, false) + partCharges("field", division.t, true);
      divided += partOrdinaries(ordinariesAbove, "field", division.t);

      divided += `<g clip-path="url(#division_${id})"><rect x="0" y="0" width="200" height="200" fill="${clr(division.t)}"/>`;
      divided += partOrdinaries(ordinariesRegular, "division", coa.t1);
      divided += diaperRect("division");
      divided += partCharges("division", coa.t1, false) + partCharges("division", coa.t1, true);
      divided += partOrdinaries(ordinariesAbove, "division", coa.t1);
      divided += "</g>";
    }

    const onField = (c: EmblemCharge) => !c.outside && (!c.divided || !division);
    const overall =
      ordinariesRegular
        .filter(o => !o.divided)
        .map(o => drawOrdinary(o, clr(o.t), clr(o.t2)))
        .join("") +
      diaperRect("overall") +
      drawCharges(onField) +
      drawCharges(c => onField(c) && !!c.layered, true) +
      ordinariesAbove
        .filter(o => !o.divided)
        .map(o => drawOrdinary(o, clr(o.t), clr(o.t2)))
        .join("");

    const above =
      drawCharges(c => c.outside === "above") +
      drawCharges(c => (c.outside === "above" && !!c.layered) || c.outside === "around", true);

    const written = inscriptions
      .map((inscription, i) => drawInscription(inscription, `inscription${i}_${id}`))
      .join("");

    const shieldClip = `<clipPath id="shield_${id}"><path d="${shieldPath}"/></clipPath>`;
    const divisionClip = division
      ? `<clipPath id="division_${id}">${getTemplate(divisionTemplates[division.division], division.line)}</clipPath>`
      : "";
    const diaperDef = diaperType ? diapers[diaper!](`diaper_${id}`) : "";
    const backlight = `<radialGradient id="backlight_${id}" cx="100%" cy="100%" r="150%"><stop stop-color="#fff" stop-opacity=".3" offset="0"/><stop stop-color="#fff" stop-opacity=".15" offset=".25"/><stop stop-color="#000" stop-opacity="0" offset="1"/></radialGradient>`;
    const style = `<style>${CHARGE_STYLE}</style>`;
    const overlay = `<path d="${shieldPath}" fill="url(#backlight_${id})" stroke="#333"/>`;

    const loadedCharges = [...chargeNames].map(charge => this.getCharge(charge, id, shield));
    const defs = shieldClip + divisionClip + loadedCharges.join("") + [...patternDefs.values()].join("");

    const svg = `<svg id="${id}" width="200" height="200" viewBox="${viewBoxOf(box, coa.zoom || 1)}">
        <defs>${defs}${diaperDef}${backlight}${style}</defs>
        ${below}<g clip-path="url(#shield_${id})">${field}${divided}${overall}</g>${overlay}${above}${written}</svg>`;

    if (this.versions.get(id) !== version) return false;

    // insert coa svg to defs
    const coas = document.getElementById("coas")!;
    document.getElementById(id)?.remove();
    coas.insertAdjacentHTML("beforeend", svg);
    // the cache key travels with the rendered shield, so clearing #coas clears the cache with it
    (coas.lastElementChild as SVGElement).dataset.coa = JSON.stringify(coa);
    return true;
  }

  /** render the coa unless the rendered one is already up to date: a reassigned coa replaces its shield */
  async trigger(id: string, coa: Emblem | undefined) {
    if (!coa) return console.warn(`Emblem ${id} is undefined`);

    const serialized = JSON.stringify(coa);
    const rendered = document.getElementById(id);
    const pending = this.pending.get(id);
    if (rendered?.dataset.coa === serialized) {
      if (pending) this.invalidate(id);
      return;
    }

    if (pending?.coa === serialized) return pending.promise;

    const version = (this.versions.get(id) || 0) + 1;
    this.versions.set(id, version);
    const promise = ("icon" in coa ? Promise.resolve(this.drawPicture(id, coa)) : this.draw(id, coa, version)).finally(
      () => {
        if (this.pending.get(id)?.promise === promise) this.pending.delete(id);
      }
    );
    this.pending.set(id, { coa: serialized, promise });
    return promise;
  }

  remove(id: string): void {
    this.invalidate(id);
    document.getElementById(id)?.remove();
  }

  /** the version only ever grows: a render still in flight can never match a later one for the same id */
  private invalidate(id: string): void {
    this.versions.set(id, (this.versions.get(id) || 0) + 1);
    this.pending.delete(id);
  }
}

export const EmblemRenderer = new EmblemRendererModule();
window.EmblemRenderer = EmblemRenderer;
