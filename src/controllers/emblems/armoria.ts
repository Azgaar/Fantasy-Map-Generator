import { z } from "zod";
import type { HeraldicEmblem } from "@/types/emblems";

export const ARMORIA_GUI = "https://azgaar.github.io/Armoria/";
export const ARMORIA_API = "https://armoria.herokuapp.com/";

const NOT_ARMORIA = "Paste an Armoria edit link, API link or COA string. Use the picture button for other images";

/** the COA of an Armoria edit link, API link or COA string; throws a message meant for the author */
export function parseArmoria(input: string): HeraldicEmblem {
  const text = input.trim();
  if (!/^https?:\/\//i.test(text)) return parseCoa(text);
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error("The link is not a valid URL");
  }
  const isArmoria =
    (url.origin === new URL(ARMORIA_GUI).origin && url.pathname.startsWith("/Armoria")) ||
    url.origin === new URL(ARMORIA_API).origin;
  // a seed or claim link names no COA, and seeds are not stable across Armoria versions
  if (!isArmoria || !url.searchParams.has("coa")) throw new Error(NOT_ARMORIA);
  return parseCoa(url.searchParams.get("coa") ?? "");
}

function parseCoa(text: string): HeraldicEmblem {
  if (!text) throw new Error(NOT_ARMORIA);
  try {
    const value: unknown = JSON.parse(/^%7b/i.test(text) ? decodeURIComponent(text) : text);
    if (coaSchema.safeParse(value).success) return value as HeraldicEmblem;
  } catch {
    // not JSON: reported as an invalid COA
  }
  throw new Error("The Armoria COA is not valid JSON with a field tincture");
}

/** The fields FMG reads from an Armoria COA; anything else it carries is kept as it is */
export const coaSchema = z.looseObject({
  t1: z.string(),
  shield: z.string().optional(),
  diaper: z.string().optional(),
  division: z.looseObject({ division: z.string(), t: z.string() }).optional(),
  charges: z.array(z.looseObject({ charge: z.string(), t: z.string(), p: z.string() })).optional(),
  ordinaries: z.array(z.looseObject({ ordinary: z.string(), t: z.string() })).optional(),
  inscriptions: z.array(z.looseObject({ text: z.string(), path: z.string() })).optional()
});

export function armoriaRenderUrl(coa: HeraldicEmblem): string {
  const url = new URL(ARMORIA_API);
  url.searchParams.set("size", "1024");
  url.searchParams.set("format", "svg");
  url.searchParams.set("coa", JSON.stringify(coa));
  return url.href;
}
