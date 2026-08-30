// Converts legacy selector-keyed preset JSONs in public/styles to the store format, in place.
// Run with: npx vite-node scripts/convert-style-presets.mjs
import fs from "node:fs";
import path from "node:path";

// the legacy module chain pulls in renderer/component modules with unconditional window/document
// side effects; import them lazily after stubbing a minimal DOM so the script runs under plain node
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (typeof globalThis.document === "undefined") {
  globalThis.document = {
    readyState: "complete",
    addEventListener() {},
    getElementById() {
      return null;
    }
  };
}

const { isLegacyPreset, presetFromLegacy } = await import("../src/generators/styles-legacy.ts");

const dir = "public/styles";
for (const file of fs.readdirSync(dir).filter(f => f.endsWith(".json"))) {
  const target = path.join(dir, file);
  const json = JSON.parse(fs.readFileSync(target, "utf8"));
  if (!isLegacyPreset(json)) {
    console.log(`${file}: skip (already converted)`);
    continue;
  }
  fs.writeFileSync(target, JSON.stringify(presetFromLegacy(json), null, 2) + "\n");
  console.log(`${file}: converted`);
}
