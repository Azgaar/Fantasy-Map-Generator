// Writes a tuning result into the source: goods' values and coverage into data/goods.ts, tunables into their modules.
//   node scripts/economy-tuner/apply.mjs [result.json = .cache/best.json]
// Values round to 0.5 below 5 and to whole numbers above; coverage to 0.05; tunables to two decimals
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { GOODS_FILE, ROOT } from "./catalogue.mjs";
import { TUNABLES, writeTunables } from "./tunables.mjs";

const file = process.argv[2] ?? fileURLToPath(new URL("./.cache/best.json", import.meta.url));
const { overrides } = JSON.parse(readFileSync(file, "utf8"));
const roundValue = v => (v < 5 ? Math.max(0.5, Math.round(v * 2) / 2) : Math.round(v));
const roundCoverage = x => Math.max(0.05, Math.round(x * 20) / 20);

const source = readFileSync(GOODS_FILE, "utf8");
const start = source.indexOf("const GOODS_DATA"),
  end = source.indexOf("\n];", start);
let changed = 0;
const data = source.slice(start, end).replace(/ {2}\{\n {4}name: "([^"]+)",[\s\S]*?\n {2}\}/g, (block, name) => {
  let next = block;
  const value = overrides.value?.[name];
  if (value !== undefined) next = next.replace(/value: [\d.]+/, `value: ${roundValue(value)}`);
  // coverage as the result has it: an entry line replaced, added after the unit, or removed with its comma
  const coverage = overrides.coverage?.[name];
  if (coverage) {
    const entries = Object.entries(coverage).map(([c, x]) => `${c}: ${roundCoverage(x)}`);
    const line = `demandCoverage: { ${entries.join(", ")} }`;
    if (!entries.length)
      next = next.replace(/(,?)\n {4}demandCoverage: \{[^}]*\}(,?)/, (_, before, after) => (after ? before : ""));
    else if (/demandCoverage: \{[^}]*\}/.test(next)) next = next.replace(/demandCoverage: \{[^}]*\}/, line);
    else next = next.replace(/(\n {4}unit: "[^"]*")(,?)/, `$1,\n    ${line}$2`);
  }
  if (next !== block) changed++;
  return next;
});
writeFileSync(GOODS_FILE, source.slice(0, start) + data + source.slice(end));
console.log(`${changed} goods updated in ${GOODS_FILE.replace(ROOT, "")}`);

const params = Object.fromEntries(Object.entries(overrides.params ?? {}).map(([n, v]) => [n, +v.toFixed(2)]));
for (const path of Object.keys(TUNABLES)) {
  const code = readFileSync(`${ROOT}${path}`, "utf8");
  const next = writeTunables(code, path, params);
  if (next !== code) writeFileSync(`${ROOT}${path}`, next);
}
console.log(`tunables: ${Object.keys(params).length ? JSON.stringify(params) : "unchanged"}`);
