#!/usr/bin/env node
"use strict";

/**
 * Stamp the public/ assets that src/index.html references with a hash of their contents.
 *
 * Those files are served from a fixed path and the service worker holds scripts and styles for
 * 30 days, so the ?v= query is the only thing that tells a returning visitor to refetch one.
 *
 * The stamp is a content hash rather than the release version: it moves exactly when the file
 * does, which a version cannot manage, since two edits inside one release share it and the
 * second silently keeps serving the first. It also makes this script idempotent — it needs no
 * git history to work out what changed, it just compares each file to the stamp beside it.
 *
 * Usage:
 *   node scripts/stamp-assets.js           # rewrite the stale stamps
 *   node scripts/stamp-assets.js --check   # exit 1 if any stamp is stale, write nothing
 *   node scripts/stamp-assets.js --stage   # rewrite, then git add src/index.html
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const indexHtmlPath = path.join(repoRoot, "src", "index.html");
const publicRoot = path.join(repoRoot, "public");

/** Only ever matches a path that already carries a stamp, so index.html's SVG data is untouched */
const STAMPED_ASSET = /([\w./-]+\.(?:js|css))\?v=([\w.]+)/g;

const HASH_LENGTH = 8;

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").slice(0, HASH_LENGTH);
}

/** One entry per ?v= reference in index.html, whether or not it is stale */
function collectStamps(html) {
  const stamps = [];

  for (const [, assetPath, stamp] of html.matchAll(STAMPED_ASSET)) {
    const filePath = path.join(publicRoot, assetPath);
    if (!fs.existsSync(filePath)) {
      stamps.push({ assetPath, stamp, missing: true });
      continue;
    }
    stamps.push({ assetPath, stamp, hash: hashFile(filePath), missing: false });
  }

  return stamps;
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const stage = args.includes("--stage");

  const html = fs.readFileSync(indexHtmlPath, "utf8");
  const stamps = collectStamps(html);

  const missing = stamps.filter(({ missing }) => missing);
  for (const { assetPath } of missing) {
    console.error(`[stamp-assets] src/index.html references public/${assetPath}, which does not exist`);
  }

  const stale = stamps.filter(({ missing, stamp, hash }) => !missing && stamp !== hash);

  if (!stale.length) {
    if (missing.length) process.exit(1);
    if (!check) console.log(`[stamp-assets] all ${stamps.length} stamps are current`);
    return;
  }

  if (check) {
    console.error("\n[stamp-assets] src/index.html is serving stale stamps for:\n");
    for (const { assetPath, stamp, hash } of stale) console.error(`  ${assetPath}  ${stamp}  →  ${hash}`);
    console.error("\nRun `npm run stamp-assets` to refresh them.\n");
    process.exit(1);
  }

  let updated = html;
  for (const { assetPath, stamp, hash } of stale) {
    updated = updated.split(`${assetPath}?v=${stamp}`).join(`${assetPath}?v=${hash}`);
    console.log(`[stamp-assets] ${assetPath}  ${stamp}  →  ${hash}`);
  }
  fs.writeFileSync(indexHtmlPath, updated, "utf8");

  if (missing.length) process.exit(1);
  if (stage) execFileSync("git", ["add", "--", indexHtmlPath], { stdio: "inherit" });
}

try {
  main();
} catch (error) {
  console.error("\n[stamp-assets] Error:", error.message || error);
  process.exit(1);
}
