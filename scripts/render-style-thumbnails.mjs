#!/usr/bin/env node
/**
 * Render the Style presets dialog screenshots: one AVIF per system preset, all from the same seed
 * zoomed in on the same capital, so the cards compare like for like and show the detail a preset is about.
 *
 * Needs a running dev server (`npm run dev`) and ffmpeg with libsvtav1 on PATH. Re-run when a preset
 * changes; the files are shipped from public/images/style-presets and cache-busted by the app version.
 *
 * Usage:
 *   node scripts/render-style-thumbnails.mjs [--url http://localhost:5173/Fantasy-Map-Generator/]
 *     [--seed style-presets] [--out public/images/style-presets] [--presets ink,gloom]
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const WIDTH = 480; // the card width on a 3x screen
const HEIGHT = 300;
const MAP_WIDTH = 1440;
const MAP_HEIGHT = 900;
const ZOOM = 16;
const CRF = 20;

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

// the capital of the largest state: a coast, roads and towns to show off
async function zoomToCapital(page) {
  await page.evaluate(zoom => {
    const [state] = pack.states.filter(s => s.i && !s.removed).sort((a, b) => b.area - a.area);
    const { x, y } = pack.burgs[state.capital];
    window.zoomTo(x, y, zoom, 0);
  }, ZOOM);
}

// rasterise the view at full size, in the page: the export URL is same-origin there
function capture(page) {
  return page.evaluate(async () => {
    const src = await window.Services.ExportMap.getMapURL("png", { noScaleBar: true });
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext("2d").drawImage(image, 0, 0);
    if (src.startsWith("blob:")) URL.revokeObjectURL(src);
    return canvas.toDataURL("image/png").split(",")[1];
  });
}

// lossless full-size capture in, AVIF out: ffmpeg's lanczos downscale keeps lines and text crisp, the
// color tags keep browsers from shifting the palette
function writeAvif(base64, file) {
  const { status, stderr } = spawnSync(
    "ffmpeg",
    [
      ...["-loglevel", "error", "-y", "-f", "png_pipe", "-i", "-", "-frames:v", "1"],
      "-vf",
      [
        `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase:flags=lanczos`,
        `crop=${WIDTH}:${HEIGHT}`,
        "scale=out_color_matrix=bt709:out_range=pc",
        "format=yuv420p"
      ].join(","),
      ...["-c:v", "libsvtav1", "-crf", String(CRF), "-preset", "4"],
      ...["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "iec61966-2-1", "-color_range", "pc"],
      file
    ],
    { input: Buffer.from(base64, "base64") }
  );
  if (status !== 0) throw new Error(`ffmpeg failed for ${file}: ${stderr}`);
  console.log(`→ ${path.relative(repoRoot, file)} (${Math.round(fs.statSync(file).size / 1024)} KB)`);
}

async function render(page, name) {
  await page.evaluate(async preset => {
    await window.Controllers.StylePresetsEditor.change(preset);
    await document.fonts.ready;
  }, name);
  await page.waitForTimeout(800); // the viewport layers redraw, web fonts render
  writeAvif(await capture(page), path.join(out, `${name}.avif`));
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
    await zoomToCapital(page);

    for (const name of presets) {
      console.log(name);
      await render(page, name);
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
