#!/usr/bin/env node

/**
 * Check every locale catalog against the English one, so a translation can't break the page.
 * See docs/prd/translation.md
 *
 * Usage:
 *   node scripts/lint-locales.mjs   # exit 1 on any problem (CI)
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

/** What a locale's strings get wrong against the English catalog; lint English against itself */
export function lintCatalog(strings, english) {
  const problems = [];

  for (const [key, value] of Object.entries(strings)) {
    const source = strings === english ? value : englishFor(key, english); // English may say "a burg" for one
    if (source === undefined) problems.push(`"${key}": not in the English catalog`);
    else if (typeof value !== "string" || !value.trim()) problems.push(`"${key}": empty, leave it out instead`);
    else {
      if (value.replace(/<[^>]*>/g, "").includes('"'))
        problems.push(`"${key}": a raw double quote outside a tag breaks attribute markup, use “ ”`);
      if (placeholders(value) !== placeholders(source)) problems.push(`"${key}": placeholders differ from the English`);
      if (/[:：]\s*$/.test(value)) problems.push(`"${key}": ends with a colon, put it in code`);
    }
  }

  return problems;
}

/** The English a key translates; a plural form English lacks (Russian `_few`) follows the English `_other` */
function englishFor(key, english) {
  const base = key.replace(PLURAL_SUFFIX, "");
  if (base !== key && key !== `${base}_other` && `${base}_other` in english) return english[`${base}_other`];
  return english[key];
}

const catalogs = dir =>
  fs
    .readdirSync(dir)
    .filter(name => name.endsWith(".json"))
    .map(name => path.join(dir, name));

function main() {
  const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
  const english = read(ENGLISH);
  let failed = false;

  // seeds: languages not offered yet, partial catalogs kept for translators
  for (const file of [...catalogs(LOCALES), ...catalogs(`${LOCALES}/seeds`)]) {
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
