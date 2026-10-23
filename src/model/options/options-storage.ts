// Where `Options` keeps this browser's choices. Light: main.ts reads the interface language from it before the app modules load
import { safeParseJSON } from "@/utils/stringUtils";

export const OPTIONS_STORAGE_KEY = "fmg-options";

/** The options this browser stored, empty when there are none or they can't be read */
export function readStoredOptions(): Record<string, unknown> {
  try {
    const parsed = safeParseJSON(localStorage.getItem(OPTIONS_STORAGE_KEY) ?? "");
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {}; // storage blocked
  }
}
