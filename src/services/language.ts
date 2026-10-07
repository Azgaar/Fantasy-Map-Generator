// The interface language at startup. Kept light: it runs before the app modules are loaded
import { isLanguage, type Language } from "@/data/languages";

/** `Options`' storage key, read here before `Options` itself is loaded */
export const OPTIONS_STORAGE_KEY = "fmg-options";
const REOPEN_KEY = "fmg-reopen-map";

/** The stored choice, else the browser's first language the app ships, else English */
export function resolveLanguage(): Language {
  const stored = storedLanguage();
  if (stored) return stored;

  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  const code = preferred.map(tag => tag?.split("-")[0].toLowerCase()).find(isLanguage);
  return code ?? "en";
}

function storedLanguage(): Language | undefined {
  try {
    const language = JSON.parse(localStorage.getItem(OPTIONS_STORAGE_KEY) ?? "null")?.app?.language;
    return isLanguage(language) ? language : undefined;
  } catch {
    return undefined; // storage blocked or corrupt: Options.restore reports it
  }
}

/** Reload the page, asking it to reopen the map just kept in browser storage */
export function reloadKeepingMap(): void {
  sessionStorage.setItem(REOPEN_KEY, "1");
  location.reload();
}

/** Whether this page load was asked to reopen the stored map; the request is consumed */
export function takeReopenRequest(): boolean {
  const requested = sessionStorage.getItem(REOPEN_KEY) === "1";
  sessionStorage.removeItem(REOPEN_KEY);
  return requested;
}
