#!/usr/bin/env node

/**
 * Give the service worker a precache list of everything the build produced.
 *
 * Without it the worker only caches what the browser has already requested, so a PWA opened
 * offline is missing every editor the user never opened online (each is a lazy-loaded chunk).
 * Runs after `vite build` and rewrites dist/sw.js in place, filling `self.__WB_MANIFEST`.
 *
 * Usage:
 *   node scripts/pwa-precache.mjs [dist]   # default dist: ./dist
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PLACEHOLDER = "self.__WB_MANIFEST";
const WORKER = "sw.js";

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").slice(0, 8);
}

/** One `{url, revision}` per file in `dist`, minus the worker; urls are relative to the worker */
export function collectPrecacheEntries(dist) {
  return fs
    .readdirSync(dist, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => path.relative(dist, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"))
    .filter(url => url !== WORKER)
    .sort()
    .map(url => ({ url, revision: hashFile(path.join(dist, url)) }));
}

export function injectManifest(source, entries) {
  if (!source.includes(PLACEHOLDER)) throw new Error(`${WORKER} has no ${PLACEHOLDER} placeholder to fill`);
  return source.replace(PLACEHOLDER, JSON.stringify(entries));
}

function main() {
  const dist = path.resolve(process.argv[2] ?? "dist");
  const workerPath = path.join(dist, WORKER);
  const entries = collectPrecacheEntries(dist);
  fs.writeFileSync(workerPath, injectManifest(fs.readFileSync(workerPath, "utf8"), entries));
  console.log(`[pwa-precache] ${entries.length} files listed in ${path.relative(process.cwd(), workerPath)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
