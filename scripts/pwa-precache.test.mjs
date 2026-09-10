import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { collectPrecacheEntries, injectManifest } from "./pwa-precache.mjs";

function makeDist(files) {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), "pwa-precache-"));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dist, file)), { recursive: true });
    fs.writeFileSync(path.join(dist, file), content);
  }
  return dist;
}

test("lists every file under dist with a posix url and a content revision", () => {
  const dist = makeDist({ "index.html": "<html>", "index-Ab12Cd34.js": "js", "charges/lion.svg": "<svg>" });
  const entries = collectPrecacheEntries(dist);
  assert.deepEqual(
    entries.map(({ url }) => url),
    ["charges/lion.svg", "index-Ab12Cd34.js", "index.html"]
  );
  for (const { revision } of entries) assert.match(revision, /^[0-9a-f]{8}$/);
});

test("leaves the service worker itself out of its own manifest", () => {
  const dist = makeDist({ "index.html": "<html>", "sw.js": "worker" });
  assert.deepEqual(
    collectPrecacheEntries(dist).map(({ url }) => url),
    ["index.html"]
  );
});

test("revision follows the file content", () => {
  const before = collectPrecacheEntries(makeDist({ "main.js": "one" }))[0].revision;
  const after = collectPrecacheEntries(makeDist({ "main.js": "two" }))[0].revision;
  const same = collectPrecacheEntries(makeDist({ "main.js": "one" }))[0].revision;
  assert.notEqual(before, after);
  assert.equal(before, same);
});

test("injects the manifest where the worker source expects it", () => {
  const source = 'precacheAndRoute(self.__WB_MANIFEST || []);\nregisterRoute();';
  const entries = [{ url: "index.html", revision: "0123abcd" }];
  assert.equal(
    injectManifest(source, entries),
    'precacheAndRoute([{"url":"index.html","revision":"0123abcd"}] || []);\nregisterRoute();'
  );
});

test("refuses a worker source without the placeholder", () => {
  assert.throws(() => injectManifest("registerRoute();", []), /__WB_MANIFEST/);
});
