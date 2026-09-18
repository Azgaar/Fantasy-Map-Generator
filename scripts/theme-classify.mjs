export const DROPDOWN = {
  "States / Provinces / Diplomacy": "theme: states-diplomacy",
  "Import / Export / Save": "theme: import-export",
  "UI / Editors": "theme: ui-editors",
  "Cultures / Religions / Society": "theme: cultures-society",
  "Burgs & Population": "theme: burgs-population",
  "Labels & Styling": "theme: labels-styling",
  "Climate / Biomes / Terrain": "theme: climate-terrain",
  "Markers / Notes / Zones": "theme: markers-zones",
  Military: "theme: military",
  "Rivers / Lakes / Coast": "theme: rivers-water",
  "Integrations & External": "theme: integrations",
  "Architecture / Performance": "theme: architecture",
  "Routes & Roads": "theme: routes"
};

export const KEYWORDS = {
  "theme: states-diplomacy": ["state", "states", "province", "provinces", "diplomacy", "war", "alliance", "country", "nation", "border", "annex", "vassal", "empire", "kingdom", "realm", "territory"],
  "theme: import-export": ["export", "import", "save", "load", "backup", "geojson", "json", "download", "upload", "dropbox", "file"],
  "theme: ui-editors": ["editor", "ui", "dialog", "menu", "button", "window", "panel", "hotkey", "shortcut", "interface", "tooltip", "overview", "filter", "brush", "paint", "undo", "drag"],
  "theme: cultures-society": ["culture", "cultures", "religion", "religions", "race", "species", "language", "namebase", "namesbase", "society", "folk", "deity", "government"],
  "theme: burgs-population": ["burg", "burgs", "city", "cities", "town", "towns", "population", "settlement", "village", "urban", "port"],
  "theme: labels-styling": ["label", "labels", "font", "style", "color", "colour", "texture", "legend", "emblem", "coa", "heraldry", "opacity", "stroke", "preset"],
  "theme: climate-terrain": ["climate", "biome", "biomes", "temperature", "precipitation", "heightmap", "terrain", "elevation", "height", "relief", "mountain", "wind", "erosion", "latitude"],
  "theme: markers-zones": ["marker", "markers", "note", "notes", "zone", "zones", "icon", "pin", "annotation"],
  "theme: military": ["military", "regiment", "regiments", "army", "unit", "units", "troop", "battle", "garrison"],
  "theme: rivers-water": ["river", "rivers", "lake", "lakes", "coast", "ocean", "sea", "island", "shore", "delta"],
  "theme: integrations": ["api", "integration", "foundry", "roll20", "plugin", "discord", "watabou", "armoria", "android", "vtt", "translation", "localization"],
  "theme: architecture": ["performance", "refactor", "codebase", "typescript", "memory", "optimize", "bundle", "browser", "wasm", "pwa", "offline", "architecture", "vite"],
  "theme: routes": ["route", "routes", "road", "roads", "path", "trail", "bridge"]
};

const words = s => (s || "").toLowerCase().match(/[a-z]{2,}/g) || [];

export function themeFromBody(body) {
  const m = (body || "").match(/###\s*Theme\s*\n+\s*(.+)/i);
  return m ? DROPDOWN[m[1].trim()] || null : null;
}

export function themeFromKeywords(title, body) {
  const inTitle = new Set(words(title));
  const inBody = new Set(words(body).slice(0, 250));
  let best = 0;
  let label = null;
  for (const [candidate, kws] of Object.entries(KEYWORDS)) {
    let score = 0;
    for (const k of kws) score += (inTitle.has(k) ? 3 : 0) + (inBody.has(k) ? 1 : 0);
    if (score > best) {
      best = score;
      label = candidate;
    }
  }
  return best < 3 ? null : label;
}

export function classifyTheme(title, body) {
  return themeFromBody(body) || themeFromKeywords(title, body) || "needs-theme";
}
