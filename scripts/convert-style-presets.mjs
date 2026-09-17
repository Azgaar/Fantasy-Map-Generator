// Rewrites style preset JSONs in place.
//   npx vite-node scripts/convert-style-presets.mjs             legacy selector-keyed presets in public/styles → store format
//   npx vite-node scripts/convert-style-presets.mjs --normalize  "" → null for filter/mask/dasharray, "inherit" linecaps → null,
//                                                                over the presets, default-styles.json and the test fixtures
//   npx vite-node scripts/convert-style-presets.mjs --schema     presets and default-styles.json rewritten as the schema
//                                                                parses them: newer sections filled in, keys in schema order
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

const { isLegacyPreset, presetFromLegacy, normalizeStyles } = await import("../src/generators/styles-legacy.ts");
const { stylesSchema } = await import("../src/generators/styles-schema.ts");

const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, json) => fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
const presets = fs
  .readdirSync("public/styles")
  .filter(f => f.endsWith(".json"))
  .map(f => path.join("public/styles", f));

const records = [...presets, "src/generators/default-styles.json"];

if (process.argv.includes("--schema")) {
  for (const file of records) rewrite(file, json => stylesSchema.parse(normalizeStyles(json)));
} else if (process.argv.includes("--normalize")) {
  const legacyFixtures = fs
    .readdirSync("src/generators")
    .filter(f => f.endsWith(".fixture.json"))
    .map(f => path.join("src/generators", f));
  const snapshots = fs
    .readdirSync("tests/fixtures")
    .filter(f => f.startsWith("style-baseline") && f.endsWith(".json"))
    .map(f => path.join("tests/fixtures", f));

  for (const file of records) rewrite(file, normalizeStyles);
  for (const file of legacyFixtures) rewrite(file, normalizeLegacyBags);
  for (const file of snapshots) rewrite(file, normalizeSnapshot);
} else {
  for (const file of presets) {
    const json = read(file);
    if (!isLegacyPreset(json)) {
      console.log(`${file}: skip (already converted)`);
      continue;
    }
    write(file, presetFromLegacy(json));
    console.log(`${file}: converted`);
  }
}

function rewrite(file, normalize) {
  const before = fs.readFileSync(file, "utf8");
  const json = normalize(JSON.parse(before));
  // the e2e snapshot writer adds no trailing newline; keep each file the way its writer leaves it
  const after = JSON.stringify(json, null, 2) + (before.endsWith("\n") ? "\n" : "");
  if (after === before) return console.log(`${file}: unchanged`);
  fs.writeFileSync(file, after);
  console.log(`${file}: normalized`);
}

// a legacy preset is one attr bag per selector: normalize each bag as the store's attrs
function normalizeLegacyBags(preset) {
  for (const bag of Object.values(preset)) normalizeStyles({ attrs: bag });
  return preset;
}

// a DOM attribute snapshot: an attr the store now holds as null is absent from the element. #scaleBarBack
// keeps its file attrs on load (the old rect carries no data-group), so it is left as the file has it
function normalizeSnapshot(snapshot) {
  for (const [selector, bag] of Object.entries(snapshot)) {
    if (selector === "#scaleBarBack") continue;
    const normalized = normalizeStyles({ attrs: { ...bag } }).attrs;
    for (const [attr, value] of Object.entries(normalized)) {
      if (value === null) delete bag[attr];
      else bag[attr] = value;
    }
  }
  return snapshot;
}
