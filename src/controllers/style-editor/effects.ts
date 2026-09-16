// What happens after a style value changes: the default is the store convention (an attr goes to its
// element, an option redraws the layer), the table holds the exceptions
import { type LayerId, Layers } from "@/components/layers";
import { invokeActiveZooming } from "@/components/zoom";
import { Styles } from "@/generators/styles";
import type { StyleElement } from "@/generators/styles-schema";
import { applyOceanPattern } from "@/renderers/draw-ocean";
import { applyVignetteOptions } from "@/renderers/draw-vignette";
import { findEl, rn } from "@/utils";

export type Selection = { element: StyleElement; group?: string; layer?: LayerId };
export type Effect = (sel: Selection, value: unknown, previous: unknown, path: string[]) => void;

const write: Effect = (_sel, _v, _p, path) => Styles.writeAttr(path); // the one attr → its element, no redraw
const draw: Effect = sel => sel.layer && Layers.draw(sel.layer); // options → renderer
const redraw =
  (id: LayerId): Effect =>
  () =>
    Layers.draw(id);
const seq =
  (...effects: Effect[]): Effect =>
  (...args) => {
    for (const effect of effects) effect(...args);
  };
const num = (value: unknown): number => (typeof value === "number" ? value : Number(value) || 0);

// state labels are fitted to their outline width, which every typography attr moves
export const refitStateLabels: Effect = sel => {
  const type = options.map.labels.groups.find(group => group.name === sel.group)?.type;
  if (type === "state") Layers.draw("labels");
};

/** Label groups differ ~10x in font size, so a group's stroke-width and letter-spacing sliders get a
 * range fitted to its font size; a stored value beyond that range keeps the range wide enough */
export function fitLabelRanges(
  fontSize: number,
  attrs: { "stroke-width"?: number | null; "letter-spacing"?: number | null }
): void {
  const form = findEl("styleForm");
  if (!form) return;
  const spacing = attrs["letter-spacing"] ?? 0;
  const stroke = form.querySelector('[data-field="attrs.stroke-width"] slider-input');
  stroke?.setAttribute("max", String(Math.max(rn(fontSize / 2, 2), attrs["stroke-width"] ?? 0)));
  const letter = form.querySelector('[data-field="attrs.letter-spacing"] slider-input');
  letter?.setAttribute("min", String(Math.min(-rn(fontSize / 10, 2), spacing)));
  letter?.setAttribute("max", String(Math.max(rn(fontSize / 2, 2), spacing)));
}

const fitLabelRangesEffect: Effect = (sel, value) => {
  const attrs = sel.group ? styles.labels.groups[sel.group]?.attrs : undefined;
  if (attrs) fitLabelRanges(Number.parseFloat(String(value)) || 18, attrs);
};

const EFFECTS: [RegExp, Effect][] = [
  [
    /^rulers\.attrs\.stroke-dasharray$/,
    seq(
      (_, v) => {
        if (v === null) styles.rulers.attrs["stroke-dasharray"] = "none";
      },
      write,
      draw
    )
  ], // unset means the default pattern, a cleared field means solid
  [/^(grid|rulers)\.attrs\./, seq(write, draw)], // the renderer bakes the stroke
  [/^ocean\.oceanWaves\.attrs\./, seq(write, draw)],
  [/^burgIcons\./, redraw("burgIcons")], // the icon groups are rebuilt from the store
  [
    /^relief\.options\.set$/,
    seq((_, v) => Relief.changeSet(v as Parameters<typeof Relief.changeSet>[0]), redraw("relief"))
  ],
  [
    /^relief\.options\.size$/,
    seq((_, v, prev) => num(prev) && Relief.changeSize(num(v) / num(prev)), redraw("relief"))
  ],
  [/^relief\.options\.density$/, seq(() => Relief.generate(), redraw("relief"))],
  [/^markers\.options\.rescale$/, () => invokeActiveZooming()],
  [
    /^map\.options\.dataFilter$/,
    (_, v) => {
      styles.map.attrs.filter = v ? `url(#filter-${v})` : null;
      Styles.writeAttr(["map", "attrs", "filter"]);
    }
  ],
  [/^ocean\.options\.pattern/, () => applyOceanPattern()],
  [/^vignette\.options\./, () => applyVignetteOptions()],
  [/^labels\.groups\.[^.]+\.attrs\.font-size$/, seq(write, fitLabelRangesEffect, refitStateLabels)],
  [/^labels\.groups\.[^.]+\.attrs\.(style|font-.*|letter-spacing)$/, seq(write, refitStateLabels)], // width-fitted groups
  [/^legend\.attrs\.font-family$/, seq(write, redraw("legend"))],
  [
    /^states\.statesHalo\.options\.width$/,
    (_, v) => {
      styles.states.statesHalo.attrs["stroke-width"] = num(v);
      Styles.writeAttr(["states", "statesHalo", "attrs", "stroke-width"]);
    }
  ],
  [/^military\.options\.boxSize$/, seq((_, v) => (styles.military.options.fontSize = num(v) * 2), draw)],
  [/^scaleBar\.(.*\.)?attrs\./, seq(write, redraw("scaleBar"))], // both attrs and options lay the bar out
  [/^scaleBar\./, redraw("scaleBar")],
  [/^emblems\..*\.options\.size$/, redraw("emblems")]
];

export const effectFor = (path: string[]): Effect =>
  EFFECTS.find(([re]) => re.test(path.join(".")))?.[1] ?? (path.includes("attrs") ? write : draw);
