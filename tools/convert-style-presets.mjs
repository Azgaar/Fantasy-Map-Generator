// one-off: npx vite-node tools/convert-style-presets.mjs  (rerunnable; skips already-converted files)
import fs from "node:fs";
import path from "node:path";
import { isLegacyPreset, upgradeLegacyPreset } from "../src/services/styles/legacy.ts";

const dir = path.resolve("public/styles");
for (const file of fs.readdirSync(dir)) {
  const p = path.join(dir, file);
  const json = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!isLegacyPreset(json)) {
    console.log("skip (already converted)", file);
    continue;
  }
  fs.writeFileSync(p, JSON.stringify(upgradeLegacyPreset(json), null, 2) + "\n");
  console.log("converted", file);
}
