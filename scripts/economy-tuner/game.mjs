// The game in a headless browser, its economy modules rewritten tunable on the way in: a map can be exported for the
// headless runner, or its economy rerun with overrides and scored as the runner scores it
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { makeTunable, tunableFile } from "./tunables.mjs";

export const DEFAULT_URL = "http://localhost:5173/Fantasy-Map-Generator/";
const SCORE = readFileSync(new URL("./score.js", import.meta.url), "utf8").replace(
  "export function score",
  "function score"
);

/** Opens a map by seed with default options; resolves once its economy has run */
export async function openGame(seed, url = DEFAULT_URL) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  await context.route(
    request => Boolean(tunableFile(new URL(request).pathname)),
    async route => {
      const response = await route.fetch();
      const file = tunableFile(new URL(route.request().url()).pathname);
      await route.fulfill({
        response,
        body: makeTunable(await response.text(), file)
      });
    }
  );
  const page = await context.newPage();
  await page.goto(`${url}?seed=${seed}&options=default&width=1280&height=800`);
  await page.waitForFunction(() => window.pack?.deals?.length > 0, null, {
    timeout: 120000
  });
  return { browser, page };
}

/** pack, grid and options as JSON, typed arrays tagged, for runner.ts */
export function exportSnapshot(page) {
  return page.evaluate(() => {
    const seen = new WeakSet();
    const encode = (_key, v) => {
      if (ArrayBuffer.isView(v)) return { __ta: v.constructor.name, v: Array.from(v) };
      if (v && typeof v === "object") {
        if (seen.has(v)) return undefined;
        seen.add(v);
      }
      return typeof v === "function" ? undefined : v;
    };
    return JSON.stringify({ seed: options.map.seed, snapshot: { pack, grid, options } }, encode);
  });
}

/** Reruns the open map's economy with the overrides and scores it with score.js */
export function checkOverrides(page, over) {
  return page.evaluate(
    async ({ over, scoreSource }) => {
      const find = s =>
        performance
          .getEntriesByType("resource")
          .map(e => e.name)
          .filter(n => n.includes(s))
          .pop() || `/Fantasy-Map-Generator/${s}`;
      const { Goods } = await import(find("model/economy/goods-generator.ts"));
      const { Markets } = await import(find("model/economy/markets-generator.ts"));
      const { Production } = await import(find("model/economy/production-generator.ts"));
      const { Prosperity } = await import(find("model/economy/prosperity.ts"));
      for (const g of pack.goods) {
        if (over.value?.[g.name] !== undefined) g.value = over.value[g.name];
        if (over.coverage?.[g.name]) g.demandCoverage = { ...over.coverage[g.name] };
      }
      for (const [name, tunable] of Object.entries(globalThis.__economyTunables ?? {}))
        tunable.set(over.params?.[name] ?? tunable.initial);
      Goods.sync();
      Production.regenerate();
      return new Function(`${scoreSource}\nreturn score;`)()(pack, {
        Goods,
        Markets,
        Production,
        Prosperity
      });
    },
    { over, scoreSource: SCORE }
  );
}

/** Names of the tunables the open page registered: proof the rewrite reached its modules */
export const registeredTunables = page => page.evaluate(() => Object.keys(globalThis.__economyTunables ?? {}));
