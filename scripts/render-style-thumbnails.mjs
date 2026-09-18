#!/usr/bin/env node
/**
 * Render the Style presets dialog screenshots: one 320×180 PNG per system preset, all from the same
 * seed at the same view, so the cards compare like for like.
 *
 * Needs a running dev server (`npm run dev`). Re-run when a preset changes; the files are shipped
 * from public/images/style-presets and cache-busted by the app version.
 *
 * Usage:
 *   node scripts/render-style-thumbnails.mjs [--url http://localhost:5173/Fantasy-Map-Generator/]
 *     [--seed style-presets] [--out public/images/style-presets] [--presets ink,gloom]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const WIDTH = 720;
const HEIGHT = 450;
const MAP_WIDTH = 1440;
const MAP_HEIGHT = 900;

const SYSTEM_PRESETS = [
  "default",
  "ancient",
  "gloom",
  "pale",
  "light",
  "watercolor",
  "clean",
  "atlas",
  "darkSeas",
  "cyberpunk",
  "night",
  "monochrome",
  "ink",
  "cinderwood",
  "frostbite"
];

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const url = arg("url", "http://localhost:5173/Fantasy-Map-Generator/");
const seed = arg("seed", "style-presets");
const out = path.resolve(repoRoot, arg("out", "public/images/style-presets"));
const presets = arg("presets", SYSTEM_PRESETS.join(",")).split(",").filter(Boolean);

// rasterise the full map at thumbnail size, in the page: the export URL is same-origin there
async function thumbnail(page, name) {
  await page.evaluate(async preset => {
    await window.Controllers.StylePresetsEditor.change(preset);
    await document.fonts.ready;
  }, name);
  await page.waitForTimeout(800); // the drawn layers settle, web fonts render

  return page.evaluate(
    async ([width, height]) => {
      const src = await window.Services.ExportMap.getMapURL("png", { fullMap: true, noScaleBar: true });
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      const scale = Math.max(width / image.width, height / image.height);
      const dx = (width - image.width * scale) / 2;
      const dy = (height - image.height * scale) / 2;
      ctx.drawImage(image, dx, dy, image.width * scale, image.height * scale);
      if (src.startsWith("blob:")) URL.revokeObjectURL(src);
      return canvas.toDataURL("image/png").split(",")[1];
    },
    [WIDTH, HEIGHT]
  );
}

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: MAP_WIDTH, height: MAP_HEIGHT } });
  page.on("pageerror", error => console.error("page error:", error.message));

  try {
    const query = `seed=${encodeURIComponent(seed)}&width=${MAP_WIDTH}&height=${MAP_HEIGHT}`;
    await page.goto(`${url}${url.includes("?") ? "&" : "?"}${query}`);
    await page.waitForFunction(() => (window.mapHistory?.length ?? 0) > 0, undefined, { timeout: 120000 });

    for (const name of presets) {
      const base64 = await thumbnail(page, name);
      const file = path.join(out, `${name}.png`);
      fs.writeFileSync(file, Buffer.from(base64, "base64"));
      console.log(`${name} → ${path.relative(repoRoot, file)}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
