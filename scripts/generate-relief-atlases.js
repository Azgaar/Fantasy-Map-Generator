"use strict";

/**
 * Generate pre-rasterised PNG sprite atlases for the relief icon sets.
 * Output: public/images/relief/{simple,gray,colored}.png
 *
 * Each atlas is a grid of SPRITE_SIZE × SPRITE_SIZE tiles arranged
 * left-to-right, top-to-bottom. Tile order matches the RELIEF_SYMBOLS.
 *
 * Run: `node scripts/generate-relief-atlases.js`
 */

const {chromium} = require("playwright");
const path = require("path");
const fs = require("fs");
const {RELIEF_SYMBOLS} = require("../src/config/relief-config.ts");

const SPRITE_SIZE = 512; // px per symbol tile

const ROOT = path.resolve(__dirname, "..");
const INDEX_HTML = path.join(ROOT, "src", "index.html");
const OUTPUT_DIR = path.join(ROOT, "public", "images", "relief");

function extractSymbols(html) {
  const symbols = {};
  const re = /<symbol\s([^>]+)>([\s\S]*?)<\/symbol>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1];
    const body = m[2];

    const idM = attrs.match(/id="(relief-[^"]+)"/);
    if (!idM) continue;

    const vbM = attrs.match(/viewBox="([^"]+)"/);
    symbols[idM[1]] = {
      viewBox: vbM ? vbM[1] : "0 0 100 100",
      body
    };
  }
  return symbols;
}

const html = fs.readFileSync(INDEX_HTML, "utf8");
const allSymbols = extractSymbols(html);

const found = Object.keys(allSymbols).length;
if (found === 0) {
  console.error("ERROR: no relief symbols found in src/index.html");
  process.exit(1);
}
console.log(`Extracted ${found} relief symbols from index.html`);

fs.mkdirSync(OUTPUT_DIR, {recursive: true});

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const [set, {ids, cols, rows}] of Object.entries(RELIEF_SYMBOLS)) {
    const n = ids.length;
    const W = cols * SPRITE_SIZE;
    const H = rows * SPRITE_SIZE;

    // Build one SVG per symbol, absolutely positioned in a grid
    const svgTiles = ids
      .map((symbolId, idx) => {
        const sym = allSymbols[symbolId];
        if (!sym) {
          console.warn(`  WARNING: symbol "${symbolId}" not found — tile will be blank`);
          return "";
        }
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = col * SPRITE_SIZE;
        const y = row * SPRITE_SIZE;
        return (
          `<svg xmlns="http://www.w3.org/2000/svg"` +
          ` style="position:absolute;left:${x}px;top:${y}px"` +
          ` width="${SPRITE_SIZE}" height="${SPRITE_SIZE}"` +
          ` viewBox="${sym.viewBox}">${sym.body}</svg>`
        );
      })
      .join("\n");

    const pageHtml =
      `<!DOCTYPE html><html><body style="margin:0;padding:0;` +
      `width:${W}px;height:${H}px;position:relative;overflow:hidden;` +
      `background:transparent">` +
      svgTiles +
      `</body></html>`;

    await page.setViewportSize({width: W, height: H});
    await page.setContent(pageHtml, {waitUntil: "load"});

    const buffer = await page.screenshot({
      type: "png",
      fullPage: false,
      clip: {x: 0, y: 0, width: W, height: H},
      omitBackground: true
    });

    const outFile = path.join(OUTPUT_DIR, `${set}.png`);
    fs.writeFileSync(outFile, buffer);
    console.log(`✓  ${set}.png  — ${cols}×${rows} tiles  (${W}×${H} px, ${(buffer.length / 1024).toFixed(0)} KB)`);
  }

  await browser.close();
  console.log("\nDone. Files saved to public/images/relief/");
})().catch(err => {
  console.error(err);
  process.exit(1);
});
