import { STYLE_PRESET_LABELS } from "@/data/id-labels";
import { Styles } from "@/generators/styles";
import { isLegacyPreset, isStoreStyles, normalizeStyles, presetFromLegacy } from "@/generators/styles-legacy";
import { VERSION } from "@/services/versioning";
import type { StylesData } from "@/types/styles";
import { t } from "@/utils/i18n";
import { isValidJSON } from "@/utils/stringUtils";

export const SYSTEM_PRESETS = [
  "default",
  "ink",
  "ancient",
  "cinderwood",
  "clean",
  "atlas",
  "light",
  "pale",
  "watercolor",
  "frostbite",
  "gloom",
  "darkSeas",
  "cyberpunk",
  "night",
  "monochrome"
] as readonly string[];

export const CUSTOM_PREFIX = "fmg-style-";
export const LEGACY_PREFIX = "fmgStyle_";

const isSystem = (name: string): boolean => SYSTEM_PRESETS.includes(name);

const listCustom = (): string[] =>
  Object.keys(localStorage).filter(key => key.startsWith(CUSTOM_PREFIX) || key.startsWith(LEGACY_PREFIX));

/** The map's preset; one this browser doesn't have counts as default */
function current(): string {
  const name = options.map.style.preset || "default";
  return isSystem(name) || listCustom().includes(name) ? name : "default";
}

function displayName(name: string): string {
  if (name.startsWith(CUSTOM_PREFIX)) return t("{{- name}} [custom]", { name: name.slice(CUSTOM_PREFIX.length) });
  if (name.startsWith(LEGACY_PREFIX)) return t("{{- name}} [custom]", { name: name.slice(LEGACY_PREFIX.length) });
  return STYLE_PRESET_LABELS[name] ?? name;
}

const isPreset = (json: unknown): boolean =>
  typeof json === "object" && json !== null && (isLegacyPreset(json) || isStoreStyles(json));

/** A preset record in store shape, whichever format it was saved in; undefined for what is not a preset */
function parse(json: unknown): StylesData | undefined {
  if (!isPreset(json)) return undefined;
  if (isLegacyPreset(json as object))
    return presetFromLegacy(json as Record<string, Record<string, unknown>>, { onUnknown: "skip" });
  // a preset file saved before v1.154.0 is store-shaped but in an older layout; normalize a copy, the
  // default preset is the shared record
  return Styles.parse(normalizeStyles(structuredClone(json)));
}

async function fetchSystem(name: string): Promise<unknown> {
  // the default preset ships in the bundle (src/generators/default-styles.json)
  if (name === "default") return Styles.defaults;
  const response = await fetch(`./styles/${name}.json?v=${VERSION}`);
  if (!response.ok) throw new Error(`Style preset ${name} is not available (${response.status})`);
  return await response.json();
}

/** The preset by name, or the default when it is missing or broken: `error` then says why */
async function load(name: string): Promise<{ name: string; styles: unknown; error?: string }> {
  if (isSystem(name)) {
    try {
      return { name, styles: await fetchSystem(name) };
    } catch (error) {
      const message = t("Cannot fetch style preset {{- name}}", { name });
      ERROR && console.error(`${message}. Applying default style`, error);
      return { name: "default", styles: Styles.defaults, error: message };
    }
  }

  const stored = localStorage.getItem(name);
  if (stored && isValidJSON(stored)) return { name, styles: normalizeStyles(JSON.parse(stored)) };

  const error = stored
    ? t("Custom style {{- name}} stored in localStorage is not valid", { name })
    : t("Custom style {{- name}} is not found in localStorage", { name });
  ERROR && console.error(error);
  return { name: "default", styles: await fetchSystem("default"), error };
}

export const StylePresetsService = {
  isSystem,
  listCustom,
  current,
  displayName,
  isPreset,
  parse,
  load,
  saveCustom: (name: string, json: string): void => localStorage.setItem(name, json),
  removeCustom: (name: string): void => localStorage.removeItem(name)
};
