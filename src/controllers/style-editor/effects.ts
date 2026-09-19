// What happens after a style value changes: the schema names the effect, this runs it
import { Layers } from "@/components/layers";
import { SchemaForm } from "@/components/shared/schema-form";
import { invokeActiveZooming } from "@/components/zoom";
import { Styles } from "@/generators/styles";
import { styleMeta, stylesSchema } from "@/generators/styles-schema";
import type { ReliefSet } from "@/types/relief";
import type { StyleChange, StyleEffect } from "@/types/styles";

const writeAttr = (change: StyleChange): void => {
  if (change.path.includes("attrs")) Styles.writeAttr(change.path);
};

const redraw = (change: StyleChange): void => {
  writeAttr(change);
  if (change.sel.layer) Layers.draw(change.sel.layer);
};

/** The effect declared nearest to a store path, else the store convention: attrs write, options draw */
export function effectAt(path: string[]): StyleEffect {
  const declared = SchemaForm.metaAlong(stylesSchema, path, styleMeta).find(meta => meta.effect);
  return declared?.effect ?? (path.includes("attrs") ? "write" : "draw");
}

/** Run what a change declares, or what the store convention gives it */
export function runEffect(change: StyleChange): void {
  switch (effectAt(change.path)) {
    case "write":
      Styles.writeAttr(change.path);
      return;
    case "draw":
      redraw(change);
      return;
    case "zoom":
      writeAttr(change);
      invokeActiveZooming();
      return;
    case "changeReliefSet":
      Relief.changeSet(change.value as ReliefSet);
      redraw(change);
      return;
    case "resizeRelief": {
      const previous = Number(change.previous) || 0;
      if (previous) Relief.changeSize((Number(change.value) || 0) / previous);
      redraw(change);
      return;
    }
    case "regenerateRelief":
      Relief.generate();
      redraw(change);
      return;
  }
}
