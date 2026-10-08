// The interface language at startup. Kept light: it runs before the app modules are loaded
import { isLanguage, LANGUAGE_CODES, type Language } from "@/data/languages";

/** `Options`' storage key, read here before `Options` itself is loaded */
export const OPTIONS_STORAGE_KEY = "fmg-options";

/** The stored choice, else the browser's first language the app ships, else English */
export function resolveLanguage(): Language {
  const stored = storedLanguage();
  if (stored) return stored;

  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  return preferred.map(tag => matchLanguage(tag ?? "")).find(Boolean) ?? "en";
}

/** A shipped language for a browser tag: its exact tag (pt-BR), else its base language (pt-PT → pt) */
function matchLanguage(tag: string): Language | undefined {
  const lower = tag.toLowerCase();
  const sameTag = LANGUAGE_CODES.find(code => code.toLowerCase() === lower);
  return sameTag ?? LANGUAGE_CODES.find(code => code.toLowerCase() === lower.split("-")[0]);
}

function storedLanguage(): Language | undefined {
  try {
    const language = JSON.parse(localStorage.getItem(OPTIONS_STORAGE_KEY) ?? "null")?.app?.language;
    return isLanguage(language) ? language : undefined;
  } catch {
    return undefined; // storage blocked or corrupt: Options.restore reports it
  }
}
