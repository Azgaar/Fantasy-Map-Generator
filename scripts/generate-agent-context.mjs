// Builds src/services/agent/context.generated.ts — the part of the AI Chat system prompt that is
// derived from the codebase rather than written by hand. Run `npm run generate:agent-context` after
// changing global declarations, the registries, or the data model doc. Pass --check to verify the
// committed file is current without writing (used by context.test.ts).

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = "src/services/agent/context.generated.ts";

const read = path => readFileSync(join(root, path), "utf8");

// `declare global` bodies are already valid TS declarations, so they go to the model verbatim
function extractGlobalBlocks(source) {
  return [...source.matchAll(/declare global \{\n([\s\S]*?)\n\}/g)].map(([, body]) => body);
}

function globalDeclarations() {
  const source = read("src/types/global.ts").replace(/^import .*\n/gm, "");
  return extractGlobalBlocks(source).join("\n").trim();
}

function generatorGlobals() {
  const dir = "src/generators";
  const files = readdirSync(join(root, dir))
    .filter(name => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .sort();

  const declarations = files.flatMap(file =>
    extractGlobalBlocks(read(`${dir}/${file}`)).flatMap(body =>
      [...body.matchAll(/^\s*(var .+;)$/gm)].map(([, declaration]) => declaration)
    )
  );

  return [...new Set(declarations)].sort().join("\n");
}

function registryKeys(path, name) {
  const body = read(path).match(/createRegistry\(\{\n([\s\S]*?)\n\}\)/)?.[1] ?? "";
  return [...body.matchAll(/^ {2}(\w+):/gm)].map(([, key]) => `${name}.${key}`).join("\n");
}

function buildGeneratedContext() {
  const sections = {
    GLOBAL_DECLARATIONS: globalDeclarations(),
    GENERATOR_GLOBALS: generatorGlobals(),
    REGISTRY_KEYS: [registryKeys("src/controllers/index.ts", "Controllers"), registryKeys("src/services/index.ts", "Services")].join("\n"),
    PACKED_GRAPH_TYPES: read("src/types/PackedGraph.ts").replace(/^import .*\n/gm, "").trim(),
    DATA_MODEL: read("docs/architecture/data_model.md").trim()
  };

  const header = `// GENERATED FILE — do not edit by hand.\n// Run \`npm run generate:agent-context\` to rebuild it from the sources it mirrors.\n`;
  const body = Object.entries(sections)
    .map(([name, value]) => `export const ${name} = ${JSON.stringify(value)};`)
    .join("\n\n");

  return `${header}\n${body}\n`;
}

const generated = buildGeneratedContext();

if (process.argv.includes("--check")) {
  const committed = read(target);
  if (committed !== generated) {
    console.error(`${target} is stale. Run: npm run generate:agent-context`);
    process.exit(1);
  }
  console.log(`${target} is up to date`);
} else {
  writeFileSync(join(root, target), generated);
  console.log(`Wrote ${target} (${generated.length} chars)`);
}
