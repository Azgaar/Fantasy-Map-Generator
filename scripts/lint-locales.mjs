#!/usr/bin/env node

/**
 * Check every locale catalog against the English one, so a translation can't break the page.
 * See docs/prd/translation.md
 *
 * Usage:
 *   node scripts/lint-locales.mjs             # exit 1 on any problem (CI)
 *   node scripts/lint-locales.mjs --missing   # list the English keys each language lacks, to translate
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const LOCALES = "src/locales";
const ENGLISH = `${LOCALES}/en.json`;

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

const placeholders = text =>
  [...text.matchAll(/{{\s*(-?)\s*(\w+)\s*}}/g)]
    .map(match => match[1] + match[2])
    .sort()
    .join(", ");

const LINE_BREAK = /[\n\r⏎]/;
const OUTER_SPACE = /^\s|\s$/;

/** The tags of a text with their spacing normalised: `</a >` and `</a>` are the same tag */
const tagsOf = text => [...text.matchAll(/<\/?[a-zA-Z][^>]*>/g)].map(match => match[0].replace(/\s+(\/?>)$/, "$1"));

/** What a locale's strings get wrong against the English catalog; lint English against itself */
export function lintCatalog(strings, english) {
  const problems = [];

  for (const [key, value] of Object.entries(strings)) {
    if (OUTER_SPACE.test(key) || LINE_BREAK.test(key)) problems.push(`"${key}": a key is one line with no outer spaces`);
    const source = strings === english ? value : englishFor(key, english); // English may say "a burg" for one
    if (source === undefined) problems.push(`"${key}": not in the English catalog`);
    else if (typeof value !== "string" || !value.trim()) problems.push(`"${key}": empty, leave it out instead`);
    else {
      if (OUTER_SPACE.test(value) || LINE_BREAK.test(value))
        problems.push(`"${key}": a value is one line with no outer spaces`);
      if (value.replace(/<[^>]*>/g, "").includes('"'))
        problems.push(`"${key}": a raw double quote outside a tag breaks attribute markup, use “ ”`);
      if (placeholders(value) !== placeholders(source)) problems.push(`"${key}": placeholders differ from the English`);
      if (tagsOf(value).join() !== tagsOf(source).join()) problems.push(`"${key}": markup differs from the English`);
      if (/[:：]\s*$/.test(value)) problems.push(`"${key}": ends with a colon, put it in code`);
    }
  }

  return problems;
}

/** The English keys a language lacks; an English plural needs the language's own plural forms */
export function missingKeys(strings, english, code) {
  const forms = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
  const needed = new Set();
  for (const key of Object.keys(english)) {
    const base = key.replace(PLURAL_SUFFIX, "");
    if (base !== key && `${base}_other` in english) for (const form of forms) needed.add(`${base}_${form}`);
    else needed.add(key);
  }
  return [...needed].filter(key => !(key in strings));
}

/** The English a key translates; a plural form English lacks (Russian `_few`) follows the English `_other` */
function englishFor(key, english) {
  const base = key.replace(PLURAL_SUFFIX, "");
  if (base !== key && key !== `${base}_other` && `${base}_other` in english) return english[`${base}_other`];
  return english[key];
}

function main() {
  const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
  const english = read(ENGLISH);
  const files = fs
    .readdirSync(LOCALES)
    .filter(name => name.endsWith(".json"))
    .map(name => path.join(LOCALES, name));

  if (process.argv.includes("--missing")) {
    for (const file of files.filter(file => file !== ENGLISH)) {
      const keys = missingKeys(read(file), english, path.basename(file, ".json"));
      console.log(`${file}: ${keys.length} missing${keys.map(key => `\n  ${JSON.stringify(key)}`).join("")}`);
    }
    return;
  }

  let failed = false;
  for (const file of files) {
    const strings = file === ENGLISH ? english : read(file);
    const problems = lintCatalog(strings, english);
    if (!problems.length) continue;
    failed = true;
    console.error(`${file}:\n${problems.map(problem => `  ${problem}`).join("\n")}`);
  }

  if (failed) process.exit(1);
  console.log("Locale catalogs keep the rules");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
