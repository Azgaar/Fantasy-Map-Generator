#!/usr/bin/env node
"use strict";

/**
 * Generate pre-rasterised PNG sprite atlases for the three relief icon sets
 * (simple, gray, colored) from the SVG <symbol> definitions in src/index.html.
 *
 * Output: public/images/relief/{simple,gray,colored}.png
 *
 * Each atlas is a grid of SPRITE_SIZE × SPRITE_SIZE tiles arranged
 * left-to-right, top-to-bottom.  Tile order matches the SET_SYMBOLS arrays
 * in src/renderers/draw-relief-icons.ts — keep the two in sync.
 *
 * Rendering strategy: each symbol is placed as a standalone <svg> element
 * positioned in a CSS grid inside a regular HTML page, then Playwright's
 * native page.screenshot() captures the result.  This avoids the headless-
 * Chromium restriction that prevents SVG blob/data URLs from rendering when
 * drawn to a <canvas> element.
 *
 * Usage:
 *   node scripts/generate-relief-atlases.js
 */

const {chromium} = require("playwright");
const path = require("path");
const fs = require("fs");

// ---------------------------------------------------------------------------
// Configuration — keep in sync with SET_SYMBOLS in draw-relief-icons.ts
// ---------------------------------------------------------------------------

const SPRITE_SIZE = 512; // px per symbol tile

const SET_SYMBOLS = {
  simple: [
    "relief-mount-1",
    "relief-hill-1",
    "relief-conifer-1",
    "relief-deciduous-1",
    "relief-acacia-1",
    "relief-palm-1",
    "relief-grass-1",
    "relief-swamp-1",
    "relief-dune-1"
  ],
  gray: [
    "relief-mount-2-bw",
    "relief-mount-3-bw",
    "relief-mount-4-bw",
    "relief-mount-5-bw",
    "relief-mount-6-bw",
    "relief-mount-7-bw",
    "relief-mountSnow-1-bw",
    "relief-mountSnow-2-bw",
    "relief-mountSnow-3-bw",
    "relief-mountSnow-4-bw",
    "relief-mountSnow-5-bw",
    "relief-mountSnow-6-bw",
    "relief-hill-2-bw",
    "relief-hill-3-bw",
    "relief-hill-4-bw",
    "relief-hill-5-bw",
    "relief-conifer-2-bw",
    "relief-coniferSnow-1-bw",
    "relief-swamp-2-bw",
    "relief-swamp-3-bw",
    "relief-cactus-1-bw",
    "relief-cactus-2-bw",
    "relief-cactus-3-bw",
    "relief-deadTree-1-bw",
    "relief-deadTree-2-bw",
    "relief-vulcan-1-bw",
    "relief-vulcan-2-bw",
    "relief-vulcan-3-bw",
    "relief-dune-2-bw",
    "relief-grass-2-bw",
    "relief-acacia-2-bw",
    "relief-palm-2-bw",
    "relief-deciduous-2-bw",
    "relief-deciduous-3-bw"
  ],
  colored: [
    "relief-mount-2",
    "relief-mount-3",
    "relief-mount-4",
    "relief-mount-5",
    "relief-mount-6",
    "relief-mount-7",
    "relief-mountSnow-1",
    "relief-mountSnow-2",
    "relief-mountSnow-3",
    "relief-mountSnow-4",
    "relief-mountSnow-5",
    "relief-mountSnow-6",
    "relief-hill-2",
    "relief-hill-3",
    "relief-hill-4",
    "relief-hill-5",
    "relief-conifer-2",
    "relief-coniferSnow-1",
    "relief-swamp-2",
    "relief-swamp-3",
    "relief-cactus-1",
    "relief-cactus-2",
    "relief-cactus-3",
    "relief-deadTree-1",
    "relief-deadTree-2",
    "relief-vulcan-1",
    "relief-vulcan-2",
    "relief-vulcan-3",
    "relief-dune-2",
    "relief-grass-2",
    "relief-acacia-2",
    "relief-palm-2",
    "relief-deciduous-2",
    "relief-deciduous-3"
  ]
};

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..");
const INDEX_HTML = path.join(ROOT, "src", "index.html");
const OUTPUT_DIR = path.join(ROOT, "public", "images", "relief");

// ---------------------------------------------------------------------------
// Extract every <symbol id="relief-*"> element from index.html
// Returns a map of  symbolId → {viewBox, innerSvg}
// ---------------------------------------------------------------------------

function extractSymbols(html) {
  const symbols = {};
  // Match each <symbol ...>...</symbol> block.
  // <symbol> elements never nest, so a lazy [\s\S]*? is safe here.
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

// ---------------------------------------------------------------------------
// Main — render each atlas via Playwright's native screenshot
// ---------------------------------------------------------------------------

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const [set, ids] of Object.entries(SET_SYMBOLS)) {
    const n = ids.length;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const W = cols * SPRITE_SIZE;
    const H = rows * SPRITE_SIZE;

    // Build one SVG per symbol, absolutely positioned in a grid.
    // Using standalone <svg> elements (not <use>) means the symbols are
    // self-contained and render correctly regardless of CSP restrictions.
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
