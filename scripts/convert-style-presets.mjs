// Rewrites default-styles.json and the presets in public/styles to follow styles-schema.ts
// npx vite-node scripts/convert-style-presets.mjs
import fs from "node:fs";
import path from "node:path";

// the styles module chain pulls in renderer/component modules with unconditional window/document
// side effects; import them lazily after stubbing a minimal DOM so the script runs under node
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

const DEFAULTS = "src/generators/default-styles.json";
const presets = fs
  .readdirSync("public/styles")
  .filter(f => f.endsWith(".json"))
  .map(f => path.join("public/styles", f));

const { stylesSchema } = await import("../src/generators/styles-schema.ts");
rewrite(DEFAULTS, json => byElement(repairDefaults(json)));

// importing the store module parses the defaults, so it loads only once they are repaired
const { Styles } = await import("../src/generators/styles.ts");
const { normalizeStyles } = await import("../src/generators/styles-legacy.ts");
for (const file of presets) rewrite(file, json => byElement(Styles.parse(normalizeStyles(json))));

function rewrite(file, parse) {
  const before = fs.readFileSync(file, "utf8");
  const after = `${JSON.stringify(parse(JSON.parse(before)), null, 2)}\n`;
  if (after === before) return console.log(`${file}: unchanged`);
  fs.writeFileSync(file, after);
  console.log(`${file}: rewritten`);
}

// top-level keys alphabetical; each element keeps the schema's key order
function byElement(styles) {
  return Object.fromEntries(Object.entries(styles).sort(([a], [b]) => a.localeCompare(b)));
}

function repairDefaults(json) {
  for (;;) {
    const result = stylesSchema.safeParse(json);
    if (result.success) return result.data;

    let progressed = false;
    for (const issue of result.error.issues) {
      const at = depth => issue.path.slice(0, depth).reduce((node, key) => node?.[key], json);
      if (issue.code === "unrecognized_keys") {
        // the path is the object holding the keys
        const holder = at(issue.path.length);
        for (const key of issue.keys) if (holder && key in holder) progressed = delete holder[key];
      } else if (issue.input === undefined) {
        const parent = at(issue.path.length - 1);
        if (!parent || issue.path.at(-1) in parent) continue;
        parent[issue.path.at(-1)] = null;
        progressed = true;
      }
    }
    if (progressed) continue;

    for (const issue of result.error.issues) console.error(`${DEFAULTS}: ${issue.path.join(".")}: ${issue.message}`);
    process.exit(1);
  }
}
