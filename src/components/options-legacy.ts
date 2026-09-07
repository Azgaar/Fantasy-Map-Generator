// The one-time migration out of the pre-`fmg-options` world
import { Coastline } from "@/generators/coastline-generator";

const ADOPTED_KEYS = [
  // preferences, one key per control
  "uiSize",
  "tooltipSize",
  "transparency",
  "themeColor",
  "speakerVoice",
  "azgaarAssistant",
  "viewportRedraw",
  "shapeRendering",
  "onloadBehavior",
  "emblemShape",
  "autosaveInterval",
  "pngResolution",
  "tileCols",
  "tileRows",
  "tileScale",
  "noReminder",
  "trade-animation",
  // the user's own definition sets, which seed every new map
  "military",
  "burg-groups",
  "options-labels",
  "options-transports",
  "coastline-settings"
] as const;

const DISCARDED_KEYS = [
  "mapWidth",
  "mapHeight",
  "points",
  "template",
  "resolveDepressionsSteps",
  "lakeElevationLimit",
  "cultures",
  "culturesSet",
  "statesNumber",
  "provincesRatio",
  "religionsNumber",
  "manors",
  "sizeVariety",
  "growthRate",
  "mapName",
  "year",
  "era",
  "seed",
  "mapSize",
  "latitude",
  "longitude",
  "temperatureEquator",
  "temperatureNorthPole",
  "temperatureSouthPole",
  "prec",
  "distanceScale",
  "distanceUnit",
  "heightUnit",
  "heightExponent",
  "areaUnit",
  "temperatureScale",
  "populationRate",
  "urbanization",
  "urbanDensity",
  "winds",
  "presetStyle"
] as const;

const LEGACY_KEYS: readonly string[] = [...ADOPTED_KEYS, ...DISCARDED_KEYS];

export function adoptLegacyOptions(): Record<string, unknown> | null {
  if (!LEGACY_KEYS.some(key => localStorage.getItem(key) !== null)) return null;
  WARN && console.warn("Migrating settings from the pre-fmg-options storage");

  const migrated: Record<string, unknown> = {};

  /** the legacy key on the left, where it lands on the right - the whole of the mapping */
  const put = (path: string, value: unknown) => {
    const keys = path.split(".");
    let node = migrated;
    for (const key of keys.slice(0, -1)) {
      node[key] ??= {};
      node = node[key] as Record<string, unknown>;
    }
    node[keys.at(-1) as string] = value;
  };

  // an empty value carries no more information than a missing one: that world stored "" for any
  // control the user had left blank, and Number("") is 0, not "nothing"
  const read = (key: string) => localStorage.getItem(key) || null;
  const num = (key: string, path: string) => {
    const stored = read(key);
    if (stored === null) return;
    const value = Number(stored);
    if (Number.isFinite(value)) put(path, value);
  };
  const str = (key: string, path: string) => {
    const stored = read(key);
    if (stored !== null) put(path, stored);
  };
  const json = (key: string, take: (parsed: unknown) => void) => {
    const stored = read(key);
    if (stored === null) return;
    try {
      take(JSON.parse(stored));
    } catch {
      WARN && console.warn(`Legacy "${key}" is not valid JSON, dropped`);
    }
  };

  num("uiSize", "app.ui.size");
  num("tooltipSize", "app.ui.tooltipSize");
  num("transparency", "app.ui.transparency");
  str("themeColor", "app.ui.themeColor");
  str("speakerVoice", "app.ui.speakerVoice");
  str("azgaarAssistant", "app.ui.assistant");
  str("shapeRendering", "app.rendering");
  str("viewportRedraw", "app.viewportRedraw");
  str("onloadBehavior", "app.onLoad");
  str("emblemShape", "app.emblems.shape");
  num("autosaveInterval", "app.autosave.interval");
  num("pngResolution", "app.export.pngResolution");
  num("tileCols", "app.export.tiles.cols");
  num("tileRows", "app.export.tiles.rows");
  num("tileScale", "app.export.tiles.scale");
  if (read("noReminder")) put("app.autosave.remind", false);
  json("trade-animation", parsed => put("app.trade.animation", parsed));
  json("military", parsed => put("map.military.units", parsed));
  json("burg-groups", parsed => put("map.burgs.groups", parsed));
  json("options-labels", parsed => put("map.labels.groups", (parsed as { groups?: unknown })?.groups));
  json("options-transports", parsed => put("map.transports", parsed));
  json("coastline-settings", parsed =>
    put("map.coastline", { ...Coastline.getDefaultSettings(), ...(parsed as object) })
  );

  for (const key of LEGACY_KEYS) localStorage.removeItem(key);
  return migrated;
}
