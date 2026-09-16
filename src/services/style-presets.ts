import { Styles } from "@/generators/styles";
import { normalizeStyles } from "@/generators/styles-legacy";
import { VERSION } from "@/services/versioning";
import { isValidJSON } from "@/utils/stringUtils";

export const SYSTEM_PRESETS = [
  "default",
  "ancient",
  "gloom",
  "pale",
  "light",
  "watercolor",
  "clean",
  "atlas",
  "darkSeas",
  "cyberpunk",
  "night",
  "monochrome",
  "ink",
  "cinderwood",
  "frostbite"
] as const;

export const CUSTOM_PREFIX = "fmgStyle_";
const LEGACY_PREFIX = "style"; // custom presets saved before the fmgStyle_ prefix

type LoadedPreset = { name: string; styles: unknown };

const isSystem = (name: string): boolean => (SYSTEM_PRESETS as readonly string[]).includes(name);

function listCustom(): string[] {
  return Object.keys(localStorage).filter(key => key.startsWith(CUSTOM_PREFIX) || key.startsWith(LEGACY_PREFIX));
}

/** The name shown for a preset key: system names as they are, customs without their prefix */
function displayName(name: string): string {
  if (isSystem(name)) return name;
  if (name.startsWith(CUSTOM_PREFIX)) return `${name.slice(CUSTOM_PREFIX.length)} [custom]`;
  return name.slice(LEGACY_PREFIX.length);
}

function saveCustom(name: string, json: string): void {
  localStorage.setItem(name, json);
}

function removeCustom(name: string): void {
  localStorage.removeItem(name);
}

/** The preset by name, or the default when it is missing or broken (one console.error). A failed
 * fetch keeps the name: the preset exists, the network does not */
async function load(name: string): Promise<LoadedPreset> {
  if (isSystem(name)) return { name, styles: await fetchSystem(name) };

  const stored = localStorage.getItem(name);
  if (stored && isValidJSON(stored)) return { name, styles: normalizeStyles(JSON.parse(stored)) };

  ERROR &&
    console.error(
      stored
        ? `Custom style ${name} stored in localStorage is not valid. Applying default style`
        : `Custom style ${name} is not found in localStorage. Applying default style`
    );
  return { name: "default", styles: await fetchSystem("default") };
}

async function fetchSystem(name: string): Promise<unknown> {
  // the default preset ships in the bundle (src/generators/default-styles.json), not as a fetchable asset
  if (name === "default") return Styles.defaults;
  try {
    const response = await fetch(`./styles/${name}.json?v=${VERSION}`);
    return await response.json();
  } catch (error) {
    ERROR && console.error(`Cannot fetch style preset ${name}. Applying default style`, error);
    return Styles.defaults;
  }
}

export const StylePresets = { load, saveCustom, removeCustom, listCustom, displayName, isSystem };
