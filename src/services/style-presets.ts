import { Styles } from "@/generators/styles";
import { normalizeStyles } from "@/generators/styles-legacy";
import { VERSION } from "@/services/versioning";
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
const LEGACY_PREFIX = "fmgStyle_";

class StylePresetsStore {
  isSystem(name: string): boolean {
    return SYSTEM_PRESETS.includes(name);
  }

  listCustom(): string[] {
    return Object.keys(localStorage).filter(key => key.startsWith(CUSTOM_PREFIX) || key.startsWith(LEGACY_PREFIX));
  }

  displayName(name: string): string {
    if (name.startsWith(CUSTOM_PREFIX)) return `${name.slice(CUSTOM_PREFIX.length)} [custom]`;
    if (name.startsWith(LEGACY_PREFIX)) return `${name.slice(LEGACY_PREFIX.length)} [custom]`;
    return name;
  }

  saveCustom(name: string, json: string): void {
    localStorage.setItem(name, json);
  }

  removeCustom(name: string): void {
    localStorage.removeItem(name);
  }

  /** The preset by name, or the default when it is missing or broken: `error` then says why */
  async load(name: string): Promise<{ name: string; styles: unknown; error?: string }> {
    if (this.isSystem(name)) {
      try {
        return { name, styles: await this.fetchSystem(name) };
      } catch (error) {
        const message = `Cannot fetch style preset ${name}`;
        ERROR && console.error(`${message}. Applying default style`, error);
        return { name: "default", styles: Styles.defaults, error: message };
      }
    }

    const stored = localStorage.getItem(name);
    if (stored && isValidJSON(stored)) return { name, styles: normalizeStyles(JSON.parse(stored)) };

    const error = stored
      ? `Custom style ${name} stored in localStorage is not valid`
      : `Custom style ${name} is not found in localStorage`;
    ERROR && console.error(error);
    return { name: "default", styles: await this.fetchSystem("default"), error };
  }

  private async fetchSystem(name: string): Promise<unknown> {
    // the default preset ships in the bundle (src/generators/default-styles.json)
    if (name === "default") return Styles.defaults;
    const response = await fetch(`./styles/${name}.json?v=${VERSION}`);
    if (!response.ok) throw new Error(`Style preset ${name} is not available (${response.status})`);
    return await response.json();
  }
}

export const StylePresetsService = new StylePresetsStore();
