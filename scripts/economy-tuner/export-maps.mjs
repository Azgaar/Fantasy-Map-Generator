// Exports the KPI maps from the running dev server for the headless runner: node export-maps.mjs [--url=...]
// Ten maps whose heightmap templates follow the app's template weights (data/heightmap-templates.ts), by largest remainder
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DEFAULT_URL, exportSnapshot, openGame } from "./game.mjs";

export const KPI_MAPS = [
  { seed: "431087220", template: "highIsland" },
  { seed: "98765", template: "highIsland" },
  { seed: "55555", template: "archipelago" },
  { seed: "123456789", template: "archipelago" },
  { seed: "4242", template: "continents" },
  { seed: "31337", template: "continents" },
  { seed: "2024", template: "lowIsland" },
  { seed: "7777", template: "oldWorld" },
  { seed: "1234", template: "shattered" },
  { seed: "31415", template: "mediterranean" }
];
export const MAPS_DIR = fileURLToPath(new URL("./.cache/maps/", import.meta.url));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.argv.find(a => a.startsWith("--url="))?.slice(6) ?? DEFAULT_URL;
  mkdirSync(MAPS_DIR, { recursive: true });
  for (const file of readdirSync(MAPS_DIR)) if (file.endsWith(".json")) unlinkSync(`${MAPS_DIR}${file}`); // the set is whole or stale
  for (const { seed, template } of KPI_MAPS) {
    const { browser, page } = await openGame(seed, url, template);
    const json = await exportSnapshot(page);
    const used = JSON.parse(json).template;
    if (used !== template) throw new Error(`${seed}: generated with template ${used}, not ${template}`);
    writeFileSync(`${MAPS_DIR}${seed}-${template}.json`, json);
    console.log(`${seed} ${template}: ${(json.length / 1e6).toFixed(1)} MB`);
    await browser.close();
  }
}
