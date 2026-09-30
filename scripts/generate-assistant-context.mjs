// Builds src/services/assistant/context.generated.ts — the Assistant context derived from the codebase
// rather than written by hand: the compact parts go into the system prompt, the rest is served by read_docs. Run `npm run generate:assistant-context` after
// changing global declarations, the registries, or the data model doc. Pass --check to verify the
// committed file is current without writing (used by context.test.ts).

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = "src/services/assistant/context.generated.ts";

const read = path => readFileSync(join(root, path), "utf8");

// Every non-test source file under src, read once
const sources = readdirSync(join(root, "src"), { recursive: true })
  .filter(path => path.endsWith(".ts") && !path.endsWith(".test.ts") && !path.endsWith(".generated.ts"))
  .sort()
  .map(path => read(`src/${path}`));

// `declare global` bodies are already valid TS declarations, so they go to the model verbatim
function extractGlobalBlocks(source) {
  return [...source.matchAll(/declare global \{\n([\s\S]*?)\n\}/g)].map(([, body]) => body);
}

// Global declarations live beside the modules that own them
function globalDeclarations() {
  return sources.flatMap(extractGlobalBlocks).join("\n").trim();
}

function generatorNames() {
  const dir = "src/generators";
  const files = readdirSync(join(root, dir))
    .filter(name => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .sort();

  const names = files.flatMap(file =>
    extractGlobalBlocks(read(`${dir}/${file}`)).flatMap(body =>
      [...body.matchAll(/^\s*var ([A-Z]\w*):/gm)].map(([, name]) => name)
    )
  );

  return [...new Set(names)].sort().join(", ");
}

// Field names per data-model section, labelled so each line names a read_docs topic
function dataFields() {
  const lines = new Map();
  let section = "";
  for (const part of read("docs/architecture/data-model.md").split(/(?=^#{1,3} )/m)) {
    const [, level, heading] = part.match(/^(#{1,3}) (.+)$/m) ?? [];
    if (level === "##") section = heading;
    if (!level || level === "#") continue;
    const sub = level === "###" ? heading.replace(/ object$/, "").toLowerCase() : "";
    const label = sub ? `${section} (${sub})` : section;
    for (const [, name] of part.matchAll(/^(?:- )+`([\w.]+)`:/gm)) {
      const dot = name.lastIndexOf(".");
      const [prefix, field] = dot < 0 ? ["", name] : [name.slice(0, dot), name.slice(dot + 1)];
      if (!lines.has(label)) lines.set(label, new Map());
      const groups = lines.get(label);
      if (!groups.has(prefix)) groups.set(prefix, new Set());
      groups.get(prefix).add(field);
    }
  }
  return [...lines]
    .map(([label, groups]) => {
      const fields = [...groups].map(([prefix, set]) => (prefix ? `${prefix}.{${[...set].join(", ")}}` : [...set].join(", ")));
      return `${label}: ${fields.join("; ")}`;
    })
    .join("\n");
}

function registryKeys(path, name) {
  const body = read(path).match(/createRegistry\(\{\n([\s\S]*?)\n\}\)/)?.[1] ?? "";
  return [...body.matchAll(/^ {2}(\w+):/gm)].map(([, key]) => `${name}.${key}`).join("\n");
}

// Every registered Assistant operation with its model-class method signature and doc line, served by read_docs
function operations() {
  const registry = read("src/controllers/assistant-operations.ts");
  return [...registry.matchAll(/^ {2}"(\w+)\.(\w+)":/gm)]
    .map(([, model, method]) => {
      const className = sources
        .map(source => source.match(new RegExp(`\\b(?:var|const) ${model}(?:: | = new )(\\w+)`))?.[1])
        .find(Boolean);
      const source = sources.find(source => source.includes(`class ${className} `));
      const match = source?.match(new RegExp(`(?:/\\*\\* (.+) \\*/\\n)? {2}${method}\\(([^)]*)\\)`));
      if (!match) throw new Error(`Operation ${model}.${method} has no public method`);
      return `${model}.${method}(${match[2]})${match[1] ? ` // ${match[1]}` : ""}`;
    })
    .join("\n");
}

// The declarations of the types operation signatures name, and the types and constants those use in turn.
// A type read by index (`Good["multipliers"]`) is not followed: the doc line describes that part
function operationTypes(list) {
  const statement = (source, start) => {
    let depth = 0;
    for (let index = start; index < source.length; index++) {
      const char = source[index];
      if ("{(<[".includes(char)) depth++;
      else if ("})>]".includes(char)) {
        depth--;
        if (!depth && char === "}" && /^\s*interface /.test(source.slice(start).replace(/^export /, "")))
          return source.slice(start, index + 1);
      } else if (char === ";" && !depth) return source.slice(start, index + 1);
    }
    return source.slice(start);
  };
  const declare = name => {
    const pattern = new RegExp(`^(?:export )?(?:interface|type|const) ${name}\\b`, "m");
    for (const source of sources) {
      const match = pattern.exec(source);
      if (match) return statement(source, match.index).replace(/^export /, "");
    }
    return null;
  };
  const names = text =>
    [...text.matchAll(/\b(?:typeof )?([A-Z][A-Za-z0-9_]*)\b(?!\[")/g)].map(([, name]) => name);

  const declarations = new Map();
  const queue = list.split("\n").flatMap(line => names(line.replace(/\/\/.*$/, "").replace(/^\w+\.\w+/, "")));
  while (queue.length) {
    const name = queue.shift();
    if (declarations.has(name)) continue;
    const text = declare(name);
    declarations.set(name, text);
    if (text) queue.push(...names(text.replace(/^(?:interface|type|const) \w+/, "")));
  }
  return [...declarations.values()].filter(Boolean).join("\n");
}

// The same operations grouped by model, method names only, for the system prompt; read_docs serves the signatures
function operationIndex(list) {
  const groups = new Map();
  for (const line of list.split("\n")) {
    const [, model, method] = line.match(/^(\w+)\.(\w+)\(/);
    if (!groups.has(model)) groups.set(model, []);
    groups.get(model).push(method);
  }
  return [...groups].map(([model, methods]) => `${model}: ${methods.join(", ")}`).join("\n");
}

// Commands an answer may link, by the same rule as isLinkable in map-commands.ts
function commands() {
  return [...read("src/components/map-commands.ts").matchAll(/id: "(\w+)",\s*name: "([^"]+)"/g)]
    .filter(([, id, name]) => id !== "assistant" && /^(Open|Show|Edit) /.test(name))
    .map(([, id, name]) => `${id}: ${name}`)
    .join("\n");
}

// Every type a link key may name, entities first, from map-entities.ts
function keyTypes() {
  const source = read("src/components/map-entities.ts");
  const list = name =>
    [...(source.match(new RegExp(`${name} = \\[([^\\]]*)\\]`))?.[1] ?? "").matchAll(/"(\w+)"/g)].map(([, type]) => type);
  return [...list("ENTITY_TYPES"), ...list("RECORD_TYPES")].join(", ");
}

function buildGeneratedContext() {
  const operationList = operations();
  const sections = {
    GLOBAL_DECLARATIONS: globalDeclarations(),
    GENERATOR_NAMES: generatorNames(),
    REGISTRY_KEYS: [registryKeys("src/controllers/index.ts", "Controllers"), registryKeys("src/services/index.ts", "Services")].join("\n"),
    DATA_FIELDS: dataFields(),
    OPERATIONS: operationList,
    OPERATION_TYPES: operationTypes(operationList),
    OPERATION_INDEX: operationIndex(operationList),
    COMMANDS: commands(),
    KEY_TYPES: keyTypes()
  };

  const header = `// GENERATED FILE — do not edit by hand.\n// Run \`npm run generate:assistant-context\` to rebuild it from the sources it mirrors.\n`;
  const body = Object.entries(sections)
    .map(([name, value]) => `export const ${name} = ${JSON.stringify(value)};`)
    .join("\n\n");

  return `${header}\n${body}\n`;
}

const generated = buildGeneratedContext();

if (process.argv.includes("--check")) {
  const committed = read(target);
  if (committed !== generated) {
    console.error(`${target} is stale. Run: npm run generate:assistant-context`);
    process.exit(1);
  }
  console.log(`${target} is up to date`);
} else {
  writeFileSync(join(root, target), generated);
  console.log(`Wrote ${target} (${generated.length} chars)`);
}
