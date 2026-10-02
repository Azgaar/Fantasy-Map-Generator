import { IconSets } from "@/components/icon-sets";
import { Icons } from "@/components/icons";
import { EmblemRenderer } from "@/renderers/emblems/renderer";
import { inlineLinkedImages } from "@/services/io/export";
import type { Emblem } from "@/types/emblems";

// An emblem as a standalone picture: for downloads, and for the Assistant to look at

/** Ids of the definitions an element's `<use>` elements point to */
const references = (element: Element): string[] =>
  [...element.querySelectorAll("use")].flatMap(use => {
    const href = use.getAttribute("href") ?? use.getAttribute("xlink:href");
    return href?.startsWith("#") ? [href.slice(1)] : [];
  });

/** A self-contained copy of a rendered emblem, carrying every definition it references */
export function cloneEmblem(svg: Element, size: number): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(size));
  clone.setAttribute("height", String(size));
  const defs =
    clone.querySelector("defs") ??
    clone.insertBefore(document.createElementNS("http://www.w3.org/2000/svg", "defs"), clone.firstChild);
  const visited = new Set<string>();
  const follow = (id: string): void => {
    if (visited.has(id)) return;
    visited.add(id);
    let definition = clone.querySelector(`[id="${CSS.escape(id)}"]`);
    if (!definition) {
      const original = document.getElementById(id);
      if (!original) return; // removed art draws nothing on the map either
      definition = defs.appendChild(original.cloneNode(true) as Element);
    }
    for (const id of references(definition)) follow(id);
  };
  for (const id of references(clone)) follow(id);
  return clone;
}

export function loadEmblemIcons(emblems: Element[]): Promise<void> {
  const sets = emblems.flatMap(emblem => references(emblem).flatMap(id => IconSets.setForId(id) ?? []));
  return Icons.require(sets);
}

/** An object URL of the emblem as SVG; raster use needs its linked images inlined */
export async function emblemURL(svg: Element, size: number, raster: boolean): Promise<string> {
  const clone = cloneEmblem(svg, size);
  if (raster) await inlineLinkedImages(clone);
  const serialized = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  window.setTimeout(() => window.URL.revokeObjectURL(url), 6000);
  return url;
}

/** The emblem rendered under this id, as a PNG data URL */
export async function emblemPng(id: string, coa: Emblem, size: number): Promise<string> {
  await EmblemRenderer.trigger(id, coa);
  const svg = document.getElementById(id);
  if (!svg) throw new Error("The emblem could not be drawn");
  await loadEmblemIcons([svg]);
  const url = await emblemURL(svg, size, true);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      canvas.getContext("2d")!.drawImage(img, 0, 0, size, size);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("The emblem could not be drawn"));
    img.src = url;
  });
}
