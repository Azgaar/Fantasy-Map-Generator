// The game's own economy, headless: a map exported by export-maps.mjs, the goods catalogue and tunables overridden,
// Production.regenerate run as the game runs it, the KPIs scored. Bundled by build.mjs
import "./stubs";
import { readFileSync } from "node:fs";
import { GOODS_DATA } from "@/data/goods";
import { Accounts } from "@/model/economy/accounts";
import { Goods } from "@/model/economy/goods-generator";
import { Markets } from "@/model/economy/markets-generator";
import { Output } from "@/model/economy/output";
import { Production } from "@/model/economy/production-generator";
import { Prosperity } from "@/model/economy/prosperity";
import { Biomes } from "@/model/physical/biomes-generator";
import { Cultures } from "@/model/society/cultures-generator";
import { Development } from "@/model/society/development-generator";
import { log } from "@/utils/logger";
import { score } from "./score.js";
import { setTunables } from "./tunables.mjs";

Object.assign(log.enabled, {
  time: false,
  info: false,
  warn: false,
  error: false
});

type Snapshot = { pack: any; grid: any; options: any };
export type Overrides = {
  value?: Record<string, number>;
  coverage?: Record<string, Record<string, number>>;
  params?: Record<string, number>;
};

const revive = (_key: string, v: any) =>
  v && typeof v === "object" && v.__ta ? new (globalThis as any)[v.__ta](v.v) : v;

export function loadMap(file: string): { seed: string; snapshot: Snapshot } {
  return JSON.parse(readFileSync(file, "utf8"), revive);
}

const MUTABLE = ["burgs", "markets", "states", "deals", "routes"];
const TIERS = new Map(GOODS_DATA.map(good => [good.name, good.development])); // maps exported before goods had tiers

/** One day on a fresh copy of the map's mutable state */
export function runEconomy(snap: Snapshot, over: Overrides = {}) {
  const pack: any = { ...snap.pack, cells: { ...snap.pack.cells } }; // a new cells object resets caches keyed by it
  for (const key of MUTABLE) pack[key] = structuredClone(snap.pack[key]);
  for (const burg of pack.burgs)
    if (burg) {
      delete burg.production;
      delete burg.product;
    }
  const goods = structuredClone(snap.options.map.goods ?? snap.pack.goods); // snapshots before goods moved to options
  for (const good of goods) {
    good.development ??= TIERS.get(good.name);
    if (over.value?.[good.name] !== undefined) good.value = over.value[good.name];
    if (over.coverage?.[good.name]) good.demandCoverage = { ...over.coverage[good.name] };
  }
  setTunables(over.params);
  const options = { ...snap.options, map: { ...snap.options.map, goods } };
  Object.assign(globalThis, { pack, grid: snap.grid, options });
  Goods.sync(); // the indexes the loader rebuilds, as services/io/load.ts does
  Markets.sync();
  if (!pack.cells.development) {
    const biomes = Biomes.getDefault();
    for (const biome of pack.biomes) biome.development ??= biomes[biome.i]?.development ?? 0;
    for (const culture of pack.cultures) if (culture.i) culture.development ??= Cultures.getDefaultDevelopment(culture.name);
    Development.generate(); // maps exported before cells had development
  }
  const start = performance.now();
  Production.regenerate();
  return {
    ms: performance.now() - start,
    ...score(pack, { Goods, Output, Prosperity, Accounts })
  };
}
