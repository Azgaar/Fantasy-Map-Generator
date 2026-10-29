// The goods catalogue as the tuner sees it: read from the source, turned into a parameter vector and back into overrides
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { RANGES } from "./tunables.mjs";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const GOODS_FILE = `${ROOT}src/data/goods.ts`;
export const CATEGORIES = ["food", "utilities", "construction", "military", "luxury"];

/** GOODS_DATA from data/goods.ts: name, value, recipes by input name, demand coverage */
export function readCatalogue(source = readFileSync(GOODS_FILE, "utf8")) {
  const data = source.slice(
    source.indexOf("const GOODS_DATA"),
    source.indexOf("\n];", source.indexOf("const GOODS_DATA"))
  );
  return [...data.matchAll(/ {2}\{\n {4}name: "([^"]+)",([\s\S]*?)\n {2}\}/g)].map(([, name, body]) => {
    const recipes = body.match(/recipes: \[([\s\S]*?)\]/)?.[1] ?? "";
    const coverage = body.match(/demandCoverage: \{([^}]*)\}/)?.[1] ?? "";
    return {
      name,
      value: +body.match(/value: ([\d.]+)/)[1],
      made: recipes.includes(":"),
      recipes: [...recipes.matchAll(/\{([^}]*)\}/g)].map(([, r]) =>
        [...r.matchAll(/("[^"]+"|[\w ]+?): ([\d.]+)/g)].map(([, n, a]) => [n.replaceAll('"', "").trim(), +a])
      ),
      coverage: Object.fromEntries([...coverage.matchAll(/(\w+): ([\d.]+)/g)].map(([, c, x]) => [c, +x]))
    };
  });
}

/** The goods reference table of the economy doc: kind, commonness weight, price range and coverage ranges by good */
export function readReference(doc = readFileSync(`${ROOT}docs/domain/economy.md`, "utf8")) {
  const section = doc.slice(doc.indexOf("### Goods reference"), doc.indexOf("### Tuning"));
  // each table by its first header cell, as rows of trimmed cells
  const tables = {};
  for (const block of section.split("\n\n").filter(b => b.startsWith("|"))) {
    const [header, , ...rows] = block.split("\n").map(line =>
      line
        .slice(1, -1)
        .split("|")
        .map(cell => cell.trim())
    );
    tables[header[0]] = { header, rows };
  }
  const ranges = table =>
    Object.fromEntries(
      tables[table].rows.map(([name, text]) => {
        const [, lo, hi = Infinity] = text.match(/([\d.]+)(?:–([\d.]+))?/);
        return [name, [+lo, +hi]];
      })
    );
  const prices = ranges("Price"),
    levels = ranges("Coverage");
  const { header, rows } = tables.Good;
  const needs = header.slice(4).map(n => n.toLowerCase());
  const reference = { kind: {}, made: {}, raw: {}, price: {}, coverage: {} };
  for (const [name, kind, weight, price, ...cover] of rows) {
    reference.kind[name] = kind.toLowerCase();
    reference[kind === "Made" ? "made" : "raw"][name] = +weight;
    reference.price[name] = prices[price];
    reference.coverage[name] = Object.fromEntries(
      needs.flatMap((need, i) => (cover[i] ? [[need, levels[cover[i]]]] : []))
    );
  }
  return reference;
}

/** Mismatches of the reference with the catalogue: goods missing from either, the wrong kind, an unknown category */
export function checkReference(catalogue, reference) {
  const issues = [];
  const names = new Set(catalogue.map(g => g.name));
  for (const g of catalogue) {
    const kind = reference.kind[g.name];
    if (!kind) issues.push(`${g.name} is not in the reference`);
    else if (kind !== (g.made ? "made" : "raw")) issues.push(`${g.name} is ${g.made ? "made" : "raw"}, not ${kind}`);
    else if (!reference.price[g.name]) issues.push(`${g.name} has an unknown price category`);
  }
  for (const name of Object.keys(reference.kind)) if (!names.has(name)) issues.push(`${name} is not in the catalogue`);
  return issues;
}

/** The catalogue as the search starts it: values brought within their price range, coverage entries as the reference
 * has them, each the source's brought within its level, or the level's middle if the source has none */
export function snapToReference(catalogue, reference) {
  const clamp = (x, [lo, hi]) => Math.min(hi, Math.max(lo, x));
  return catalogue.map(g => {
    const price = reference.price[g.name];
    const levels = reference.coverage[g.name];
    if (!price || !levels) return g;
    return {
      ...g,
      value: clamp(g.value, price),
      coverage: Object.fromEntries(
        Object.entries(levels).map(([c, [lo, hi]]) => [c, clamp(g.coverage[c] ?? (lo + Math.min(hi, 1)) / 2, [lo, hi])])
      )
    };
  });
}

/** Parameters: raw goods' values, made goods' margins over their recipes' average inputs, coverage entries, tunables */
export function thetaOf(catalogue, params = {}) {
  const byName = new Map(catalogue.map(g => [g.name, g]));
  const theta = { raw: {}, margin: {}, cov: [], params: {} };
  for (const g of catalogue) {
    if (!g.made) theta.raw[g.name] = g.value;
    else {
      let inputs = 0;
      for (const r of g.recipes) for (const [n, a] of r) inputs += (a * byName.get(n).value) / g.recipes.length;
      theta.margin[g.name] = Math.min(15, Math.max(1, g.value - inputs));
    }
    for (const c of CATEGORIES) if (g.coverage[c] > 0) theta.cov.push([g.name, c, g.coverage[c]]);
  }
  for (const name of Object.keys(RANGES)) if (params[name] !== undefined) theta.params[name] = params[name];
  return theta;
}

/** Values, coverage (within the caps: made ≤ 1, or 2 from value 20; raw ≥ 0.1) and tunables a parameter vector gives */
export function overridesOf(catalogue, theta) {
  const byName = new Map(catalogue.map(g => [g.name, g]));
  const value = {};
  const v = (name, path = new Set()) => {
    if (value[name] !== undefined) return value[name];
    const g = byName.get(name);
    if (!g.made || path.has(name)) return (value[name] = theta.raw[name] ?? g.value);
    path.add(name);
    let inputs = 0;
    for (const r of g.recipes) for (const [n, a] of r) inputs += (a * v(n, path)) / g.recipes.length;
    return (value[name] = Math.max(0.5, inputs + theta.margin[name]));
  };
  for (const g of catalogue) v(g.name);
  const coverage = Object.fromEntries(catalogue.map(g => [g.name, {}]));
  for (const [name, c, x] of theta.cov) {
    const cap = value[name] >= 20 ? 2 : 1;
    coverage[name][c] = Math.min(cap, Math.max(byName.get(name).made ? 0.02 : 0.1, x));
  }
  return { value, coverage, params: { ...theta.params } };
}
