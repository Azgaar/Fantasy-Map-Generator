// Console verbosity switches. Read bare (`TIME && console.time(…)`) by every layer, so they live on
// globalThis instead of being exported. `debug` in localStorage holds opt-in per-feature flags
import { safeParseJSON } from "@/utils/stringUtils";

globalThis.DEBUG = safeParseJSON(localStorage.getItem("debug") ?? "") || {};
globalThis.INFO = true;
globalThis.TIME = true;
globalThis.WARN = true;
globalThis.ERROR = true;

declare global {
  var TIME: boolean;
  var INFO: boolean;
  var WARN: boolean;
  var ERROR: boolean;
  var DEBUG: { stateLabels?: boolean; [key: string]: boolean | undefined };
}
