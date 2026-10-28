// Exports maps from the running dev server for the headless runner: node export-maps.mjs [seed...] [--url=...]
// Defaults to the six KPI seeds of docs/domain/economy.md
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DEFAULT_URL, exportSnapshot, openGame } from "./game.mjs";

export const KPI_SEEDS = ["431087220", "98765", "55555", "123456789", "4242", "31337"];
export const MAPS_DIR = fileURLToPath(new URL("./.cache/maps/", import.meta.url));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const url = args.find(a => a.startsWith("--url="))?.slice(6) ?? DEFAULT_URL;
  const seeds = args.filter(a => !a.startsWith("--"));
  mkdirSync(MAPS_DIR, { recursive: true });
  for (const seed of seeds.length ? seeds : KPI_SEEDS) {
    const { browser, page } = await openGame(seed, url);
    const json = await exportSnapshot(page);
    writeFileSync(`${MAPS_DIR}${seed}.json`, json);
    console.log(`${seed}: ${(json.length / 1e6).toFixed(1)} MB`);
    await browser.close();
  }
}
