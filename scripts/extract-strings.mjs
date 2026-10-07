#!/usr/bin/env node

/**
 * Collect every `t()` key in the TypeScript sources into the English catalog, src/locales/en.json.
 *
 * A `context` option suffixes the key (`Close_button`); a `count` option makes it plural
 * (`<key>_one`, `<key>_other`). Existing English values are kept, so hand-written plurals and the
 * English of explicit-key prose survive; keys no longer used are dropped. See docs/prd/translation.md
 *
 * Usage:
 *   node scripts/extract-strings.mjs           # write src/locales/en.json
 *   node scripts/extract-strings.mjs --check   # exit 1 if it is stale (CI)
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const SOURCES = "src";
const CATALOG = "src/locales/en.json";

const literal = node =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined;

/** The catalog entries one file's `t()` calls need, each with its default English, plus what can't be extracted */
export function extractStrings(file, text) {
  const strings = new Map();
  const problems = [];
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);

  const visit = node => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "t") {
      const where = `${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
      const [keyArgument, optionsArgument] = node.arguments;
      const key = literal(keyArgument);
      let context;
      let plural = false;

      for (const property of optionsArgument && ts.isObjectLiteralExpression(optionsArgument)
        ? optionsArgument.properties
        : []) {
        const name = property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) && property.name.text;
        if (name === "count") plural = true;
        if (name === "context") {
          context = ts.isPropertyAssignment(property) ? literal(property.initializer) : undefined;
          if (context === undefined) problems.push(`${where}: t() needs a literal context`);
        }
      }

      if (key === undefined) problems.push(`${where}: t() needs a literal key`);
      else {
        const base = context ? `${key}_${context}` : key;
        for (const entry of plural ? [`${base}_one`, `${base}_other`] : [base]) strings.set(entry, key);
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return { strings, problems };
}

/** The English catalog for the found strings: existing values kept, new ones defaulting to their English key */
export function buildCatalog(found, existing) {
  const keys = [...found.keys()].sort();
  return Object.fromEntries(keys.map(key => [key, existing[key] ?? found.get(key)]));
}

function sourceFiles(dir) {
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith(".ts") && !/\.(test|d)\.ts$/.test(entry.name))
    .map(entry => path.join(entry.parentPath, entry.name))
    .sort();
}

function main() {
  const check = process.argv.includes("--check");
  const found = new Map();
  const problems = [];

  for (const file of sourceFiles(SOURCES)) {
    const text = fs.readFileSync(file, "utf8");
    if (!text.includes("t(")) continue;
    const result = extractStrings(file, text);
    for (const [key, english] of result.strings) found.set(key, english);
    problems.push(...result.problems);
  }

  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }

  const current = fs.existsSync(CATALOG) ? fs.readFileSync(CATALOG, "utf8") : "{}";
  const output = `${JSON.stringify(buildCatalog(found, JSON.parse(current)), null, 2)}\n`;

  if (check) {
    if (output === current) return console.log(`${CATALOG} is up to date`);
    console.error(`${CATALOG} is stale. Run: npm run extract-strings`);
    process.exit(1);
  }

  fs.writeFileSync(CATALOG, output);
  console.log(`Wrote ${CATALOG} (${found.size} strings)`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
