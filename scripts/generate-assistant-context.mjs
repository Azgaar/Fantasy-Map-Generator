// Builds src/services/assistant/provider/context.generated.ts — the Assistant context only source text can give:
// global declarations, registries, data-model fields and operation signatures. Run `npm run generate:assistant-context`
// after changing any of them. Pass --check to verify the committed file is current without writing
// (used by context.test.ts).

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = "src/services/assistant/provider/context.generated.ts";

// sources are compared and matched with LF-only regexes, so a CRLF checkout (git autocrlf) reads the same
const read = path => readFileSync(join(root, path), "utf8").replaceAll("\r\n", "\n");

// Every non-test source file under src, read once
const paths = readdirSync(join(root, "src"), { recursive: true })
  .map(path => path.replace(/\\/g, "/"))
  .filter(path => path.endsWith(".ts") && !path.endsWith(".test.ts") && !path.endsWith(".generated.ts"))
  .sort();
const sources = paths.map(path => read(`src/${path}`));

// The scripting surface is `window.FMG` (src/app/fmg.ts); read_map scripts see each member by name
const FMG = "src/app/fmg.ts";
const fmgSource = read(FMG);

const modulePath = spec => {
  const base = `src/${spec.slice(2)}`;
  return paths.includes(`${spec.slice(2)}.ts`) ? `${base}.ts` : `${base}/index.ts`;
};

// imported name → the source file that exports it
const fmgImports = new Map(
  [...fmgSource.matchAll(/import \{([^}]+)\} from "(@\/[^"]+)";/g)].flatMap(([, names, spec]) =>
    names.split(",").map(name => [name.trim(), modulePath(spec)])
  )
);

const fmgBody = fmgSource.match(/const FMG = \{\n([\s\S]*?)\n\};/)?.[1] ?? "";
if (!fmgBody) throw new Error(`${FMG} has no FMG object`);

// the declared type of a `var` global: the map state a getter reads
const globalType = name =>
  sources.map(source => source.match(new RegExp(`^\\s*var ${name}: ([^;]+);`, "m"))?.[1]).find(Boolean);

// a one-line declaration of an exported member, read from the module that owns it
function memberDeclaration(name) {
  const path = fmgImports.get(name);
  const source = path ? read(path) : "";
  const instance = source.match(new RegExp(`export const ${name} = new (\\w+)`))?.[1];
  if (instance) return `${name}: ${instance};`;
  if (new RegExp(`export const ${name} = "`).test(source)) return `${name}: string;`;
  const typed = source.match(new RegExp(`export const ${name}: ([^=]+?) =`))?.[1];
  if (typed) return `${name}: ${typed};`;
  const fn = source.match(new RegExp(`export (?:async )?function ${name}(\\([^)]*\\)(?:: [^{]+?)?) \\{`))?.[1];
  if (fn) return `${name}${fn};`;
  const arrow = source.match(new RegExp(`export const ${name} = (?:async )?(\\([^)]*\\))(?:: ([^=]+?))? =>`));
  if (arrow) return `${name}${arrow[1]}${arrow[2] ? `: ${arrow[2]}` : ""};`;
  return `${name}: typeof ${name};`;
}

// the exported names of a module spread into FMG whole (`...units`)
function spreadNames(namespace) {
  const spec = fmgSource.match(new RegExp(`import \\* as ${namespace} from "(@\\/[^"]+)";`))?.[1];
  if (!spec) throw new Error(`${FMG} spreads ${namespace} without importing it`);
  return [...read(modulePath(spec)).matchAll(/^export (?:async )?(?:function|const|class) (\w+)/gm)].map(([, name]) => name);
}

function fmgMembers() {
  return fmgBody.split("\n").flatMap(line => {
    const getter = line.match(/^ {2}get (\w+)\(\)/)?.[1];
    if (getter) return [`${getter}: ${globalType(getter) ?? "unknown"};`];
    const spread = line.match(/^ {2}\.\.\.(\w+),$/)?.[1];
    if (spread) return [`// from ${spread}: ${spreadNames(spread).join(", ")}`];
    const wrapper = line.match(/^ {2}(\w+): (\([^)]*\)) =>/);
    if (wrapper) return [`${wrapper[1]}${wrapper[2]};`];
    const member = line.match(/^ {2}(\w+),?$/)?.[1];
    if (member) return [memberDeclaration(member)];
    const comment = line.match(/^ {2}(\/\/.*)$/)?.[1];
    return comment ? [comment] : [];
  });
}

function globalDeclarations() {
  return ["declare const FMG: {", ...fmgMembers().map(line => `  ${line}`), "};"].join("\n");
}

// the generator singletons; the Globals doc lists the rest
function generatorNames() {
  const names = [...fmgImports]
    .filter(([name, path]) => /^[A-Z]/.test(name) && path.startsWith("src/model/") && path.endsWith("-generator.ts"))
    .map(([name]) => name);
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
  const registry = read("src/controllers/assistant/operations.ts").match(/const METHODS[^{]*\{\n([\s\S]*?)\n\}(?: satisfies [^;]+)?;/)?.[1];
  if (!registry) throw new Error("controllers/assistant/operations.ts has no METHODS registry");
  return [...registry.matchAll(/^ {2}(\w+): \[([^\]]*)\]/gm)]
    .flatMap(([, model, methods]) => [...methods.matchAll(/"(\w+)"/g)].map(([, method]) => [model, method]))
    .map(([model, method]) => {
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

function buildGeneratedContext() {
  const operationList = operations();
  const sections = {
    GLOBAL_DECLARATIONS: globalDeclarations(),
    GENERATOR_NAMES: generatorNames(),
    REGISTRY_KEYS: [registryKeys("src/controllers/index.ts", "Controllers"), registryKeys("src/services/index.ts", "Services")].join("\n"),
    DATA_FIELDS: dataFields(),
    OPERATIONS: operationList,
    OPERATION_TYPES: operationTypes(operationList)
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
