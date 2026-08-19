// one-off: npx vite-node tools/convert-style-presets.mjs  (rerunnable; skips already-converted files)
import fs from "node:fs";
import path from "node:path";
import { Style } from "../src/styles/index.ts";

// Style.fromJSON, not the raw upgrader: only fromJSON's legacy path also supplies the three
// attrs an old preset never carried (labels font-size, the fogging and vignette masks), so
// writing the upgrader's output directly would ship presets that render unmasked.
const canonical = value =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v
  );

const dir = path.resolve("public/styles");
for (const file of fs.readdirSync(dir)) {
  const p = path.join(dir, file);
  const json = JSON.parse(fs.readFileSync(p, "utf8"));
  const converted = Style.fromJSON(json).toJSON();
  if (canonical(converted) === canonical(json)) {
    console.log("skip (already converted)", file);
    continue;
  }
  fs.writeFileSync(p, JSON.stringify(converted, null, 2) + "\n");
  console.log("converted", file);
}
