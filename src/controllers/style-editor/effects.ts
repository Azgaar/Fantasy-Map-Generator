// What happens after a style value changes: the schema names the effect, this runs it
import { Layers } from "@/components/layers";
import { SchemaForm } from "@/components/shared/schema-form";
import { invokeActiveZooming } from "@/components/zoom";
import { Styles } from "@/generators/styles";
import { styleMeta, stylesSchema } from "@/generators/styles-schema";
import { applyVignetteOptions } from "@/renderers/draw-vignette";
import type { ReliefSet } from "@/types/relief";
import type { StyleChange, StyleEffect } from "@/types/styles";

type Run = (change: StyleChange) => void;

const num = (value: unknown): number => (typeof value === "number" ? value : Number(value) || 0);

const write: Run = ({ path }) => Styles.writeAttr(path);

const draw: Run = change => {
  if (change.path.includes("attrs")) write(change);
  if (change.sel.layer) Layers.draw(change.sel.layer);
};

const EFFECTS: Record<StyleEffect, Run> = {
  write,
  draw,
  zoom: change => {
    if (change.path.includes("attrs")) write(change);
    invokeActiveZooming();
  },
  applyVignette: () => applyVignetteOptions(),
  changeReliefSet: change => {
    Relief.changeSet(change.value as ReliefSet);
    draw(change);
  },
  resizeRelief: change => {
    if (num(change.previous)) Relief.changeSize(num(change.value) / num(change.previous));
    draw(change);
  },
  regenerateRelief: change => {
    Relief.generate();
    draw(change);
  },
  refitStateLabels: change => {
    write(change);
    const type = options.map.labels.groups.find(group => group.name === change.sel.group)?.type;
    if (type === "state") Layers.draw("labels");
  }
};

/** The effect declared nearest to a store path, else the store convention: attrs write, options draw */
export function effectAt(path: string[]): StyleEffect {
  const declared = SchemaForm.metaAlong(stylesSchema, path, styleMeta).find(meta => meta.effect);
  return declared?.effect ?? (path.includes("attrs") ? "write" : "draw");
}

export const runEffect = (change: StyleChange): void => EFFECTS[effectAt(change.path)](change);
