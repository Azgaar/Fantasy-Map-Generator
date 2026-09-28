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
    if (isCoa(value)) return value;
  } catch {
    // not JSON: reported as an invalid COA
  }
  throw new Error("The Armoria COA is not valid JSON with a field tincture");
}

export function isCoa(value: unknown): value is HeraldicEmblem {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const coa = value as Record<string, unknown>;
  if (typeof coa.t1 !== "string") return false;
  for (const name of ["shield", "diaper"]) if (coa[name] !== undefined && typeof coa[name] !== "string") return false;
  if (coa.division !== undefined) {
    if (!coa.division || typeof coa.division !== "object" || Array.isArray(coa.division)) return false;
    const division = coa.division as Record<string, unknown>;
    if (typeof division.division !== "string" || typeof division.t !== "string") return false;
  }
  for (const [key, names] of [
    ["charges", ["charge", "t", "p"]],
    ["ordinaries", ["ordinary", "t"]]
  ] as const) {
    if (coa[key] === undefined) continue;
    if (!Array.isArray(coa[key])) return false;
    for (const item of coa[key]) {
      if (!item || typeof item !== "object" || names.some(name => typeof item[name] !== "string")) return false;
    }
  }
  if (
    coa.inscriptions !== undefined &&
    (!Array.isArray(coa.inscriptions) ||
      coa.inscriptions.some(item => !item || typeof item.text !== "string" || typeof item.path !== "string"))
  )
    return false;
  return true;
}

export function armoriaRenderUrl(coa: HeraldicEmblem): string {
  const url = new URL(ARMORIA_API);
  url.searchParams.set("size", "1024");
  url.searchParams.set("format", "svg");
  url.searchParams.set("coa", JSON.stringify(coa));
  return url.href;
}
