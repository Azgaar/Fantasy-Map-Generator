// Armoria's COA format as FMG reads it: from pasted links and strings, Armoria pictures and downloaded files
import { z } from "zod";
import type { CustomIcon } from "@/model/icons";
import type { HeraldicEmblem } from "@/types/emblems";
import { t } from "@/utils/i18n";

const GUI = "https://azgaar.github.io/Armoria/";
const API = "https://armoria.vercel.app/api";
const LEGACY_API = /^https?:\/\/armoria\.herokuapp\.com\/?(\?)?/; // retired host of older links
const FILE_KEYWORD = "armoria-coa";

const NOT_ARMORIA = t("Paste an Armoria edit link, API link or COA string. Use the picture button for other images");

/** The fields FMG reads from an Armoria COA; anything else it carries is kept as it is */
const schema = z.looseObject({
  t1: z.string(),
  shield: z.string().optional(),
  diaper: z.string().optional(),
  division: z.looseObject({ division: z.string(), t: z.string() }).optional(),
  charges: z.array(z.looseObject({ charge: z.string(), t: z.string(), p: z.string() })).optional(),
  ordinaries: z.array(z.looseObject({ ordinary: z.string(), t: z.string() })).optional(),
  inscriptions: z.array(z.looseObject({ text: z.string(), path: z.string() })).optional()
});

/** the COA of an Armoria edit link, API link or COA string; throws a message meant for the author */
function parse(input: string): HeraldicEmblem {
  const text = migrateLink(input.trim());
  if (!/^https?:\/\//i.test(text)) return parseCoa(text);
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error(t("The link is not a valid URL"));
  }
  const isArmoria =
    (url.origin === new URL(GUI).origin && url.pathname.startsWith("/Armoria")) || url.origin === new URL(API).origin;
  // a seed or claim link names no COA, and seeds are not stable across Armoria versions
  if (!isArmoria || !url.searchParams.has("coa")) throw new Error(NOT_ARMORIA);
  return parseCoa(url.searchParams.get("coa") ?? "");
}

function parseCoa(text: string): HeraldicEmblem {
  if (!text) throw new Error(NOT_ARMORIA);
  try {
    const value: unknown = JSON.parse(/^%7b/i.test(text) ? decodeURIComponent(text) : text);
    if (schema.safeParse(value).success) return value as HeraldicEmblem;
  } catch {
    // not JSON: reported as an invalid COA
  }
  throw new Error(t("The Armoria COA is not valid JSON with a field {{field}}", { field: "tincture" }));
}

/** an image link to the retired Armoria API host, moved to the current one */
function migrateLink(link: string): string {
  return link.replace(LEGACY_API, (_, query) => (query ? `${API}?` : `${API}/`));
}

/** the COA an Armoria picture renders: kept with it, or named by its API link; null for any other picture */
function pictureCoa(icon: CustomIcon | undefined): HeraldicEmblem | null {
  if (!icon) return null;
  if (icon.coa) return icon.coa;
  const link = icon.kind === "image" ? migrateLink(icon.content) : "";
  if (!link.startsWith(API)) return null;
  try {
    return parse(link);
  } catch {
    return null;
  }
}

/** the COA a file downloaded from Armoria keeps inside: SVG metadata, a PNG text chunk or a JPEG comment */
async function fileCoa(file: Blob): Promise<HeraldicEmblem | null> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const text = isPng(bytes) ? pngText(bytes) : isJpeg(bytes) ? jpegComment(bytes) : svgMetadata(bytes);
  if (!text) return null;
  try {
    const coa: unknown = JSON.parse(text);
    return schema.safeParse(coa).success ? (coa as HeraldicEmblem) : null;
  } catch {
    return null;
  }
}

const isPng = (bytes: Uint8Array) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
const isJpeg = (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8;
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

function svgMetadata(bytes: Uint8Array): string | null {
  const markup = decode(bytes);
  if (!markup.includes(FILE_KEYWORD)) return null;
  const svg = new DOMParser().parseFromString(markup, "image/svg+xml");
  return svg.querySelector(`metadata.${FILE_KEYWORD}`)?.textContent ?? null;
}

// an uncompressed iTXt chunk: keyword, compression flag and method, language and translated keyword, text
function pngText(bytes: Uint8Array): string | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let at = 8; at + 12 <= bytes.length; ) {
    const length = view.getUint32(at);
    const type = decode(bytes.subarray(at + 4, at + 8));
    if (type === "IEND") break;
    if (type === "iTXt") {
      const data = bytes.subarray(at + 8, at + 8 + length);
      const keywordEnd = data.indexOf(0);
      if (decode(data.subarray(0, keywordEnd)) === FILE_KEYWORD && data[keywordEnd + 1] === 0) {
        const languageEnd = data.indexOf(0, keywordEnd + 3);
        const translatedEnd = data.indexOf(0, languageEnd + 1);
        return decode(data.subarray(translatedEnd + 1));
      }
    }
    at += 12 + length;
  }
  return null;
}

// a COM segment before the image data, its text prefixed with the keyword
function jpegComment(bytes: Uint8Array): string | null {
  const prefix = `${FILE_KEYWORD}:`;
  for (let at = 2; at + 4 <= bytes.length && bytes[at] === 0xff; ) {
    const marker = bytes[at + 1];
    if (marker === 0xda) break; // the image data starts
    const length = (bytes[at + 2] << 8) | bytes[at + 3];
    if (marker === 0xfe) {
      const text = decode(bytes.subarray(at + 4, at + 2 + length));
      if (text.startsWith(prefix)) return text.slice(prefix.length);
    }
    at += 2 + length;
  }
  return null;
}

export const Armoria = { GUI, API, schema, parse, migrateLink, pictureCoa, fileCoa };
