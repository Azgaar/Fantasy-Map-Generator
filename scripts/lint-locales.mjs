#!/usr/bin/env node

/**
 * Check every locale catalog against the English one, so a translation can't break the page.
 * See docs/prd/translation.md
 *
 * Usage:
 *   node scripts/lint-locales.mjs             # exit 1 on a broken string, warn about missing translations (CI)
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
const MARKUP = /<\/?[a-zA-Z][^>]*>/;
const SUFFIXES = /_(zero|one|two|few|many|other)$|_[a-z]+$/g; // plural form, context
const TEXT_START = /^(?:[\p{L}\p{N}“]|\{\{)/u;
const TEXT_END = /(?:[\p{L}\p{N}.!?…)”%">]|\}\})$/u;
const NOTATION = /(?:^|[,;] )-?\d[^\s:,]*: |\d = | • /u; // a value legend or a joined list

/** What a locale's strings get wrong against the English catalog; lint English against itself */
export function lintCatalog(strings, english) {
  const problems = [];

  for (const [key, value] of Object.entries(strings)) {
    if (OUTER_SPACE.test(key) || LINE_BREAK.test(key)) problems.push(`"${key}": a key is one line with no outer spaces`);
    const text = key.replace(SUFFIXES, "");
    if (strings === english && (!TEXT_START.test(text) || !TEXT_END.test(text) || NOTATION.test(text)))
      problems.push(`"${key}": a key is language only, symbols and values around it belong in code`);
    const source = strings === english ? value : englishFor(key, english); // English may say "a burg" for one
    if (source === undefined) problems.push(`"${key}": not in the English catalog`);
    else if (typeof value !== "string" || !value.trim()) problems.push(`"${key}": empty, leave it out instead`);
    else {
      if (OUTER_SPACE.test(value) || LINE_BREAK.test(value))
        problems.push(`"${key}": a value is one line with no outer spaces`);
      if (MARKUP.test(value)) problems.push(`"${key}": markup belongs in code, pass it in a {{- placeholder}}`);
      if (value.includes('"')) problems.push(`"${key}": a raw double quote breaks attribute markup, use “ ”`);
      if (placeholders(value) !== placeholders(source)) problems.push(`"${key}": placeholders differ from the English`);
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

/** A GitHub Actions annotation in CI, a plain line elsewhere */
const warn = (file, message) =>
  process.env.GITHUB_ACTIONS ? console.log(`::warning file=${file}::${message}`) : console.warn(`${file}: ${message}`);

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

  for (const file of files.filter(file => file !== ENGLISH)) {
    const missing = missingKeys(read(file), english, path.basename(file, ".json")).length;
    if (missing) warn(file, `untranslated strings: ${missing}, shown in English; list them with --missing`);
  }

  if (failed) process.exit(1);
  console.log("Locale catalogs keep the rules");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
