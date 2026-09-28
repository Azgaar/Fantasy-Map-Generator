// What happens after a style value changes: the schema names the effect, this runs it
import { Layers } from "@/components/layers";
import { SchemaForm } from "@/components/shared/schema-form";
import { invokeActiveZooming } from "@/components/zoom";
import { Styles } from "@/generators/styles";
import { styleMeta, stylesSchema } from "@/generators/styles-schema";
import type { StyleEffect, StyleSelection } from "@/types/styles";

const writeAttr = (path: string[]): void => {
  if (path.includes("attrs")) Styles.writeAttr(path);
};

/** The effect declared nearest to a store path, else the store convention: attrs write, options draw */
export function effectAt(path: string[]): StyleEffect {
  const declared = SchemaForm.metaAlong(stylesSchema, path, styleMeta).find(meta => meta.effect);
  return declared?.effect ?? (path.includes("attrs") ? "write" : "draw");
}

/** Run what the value at `path` declares, or what the store convention gives it */
export function runEffect(sel: StyleSelection, path: string[]): void {
  const effect = effectAt(path);
  writeAttr(path);
  if (effect === "zoom") invokeActiveZooming();
  if (effect === "regenerateRelief") Relief.generate();
  if ((effect === "draw" || effect === "regenerateRelief") && sel.layer) Layers.draw(sel.layer);
}
