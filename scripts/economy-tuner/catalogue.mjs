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

/** The goods reference table of the economy doc: kind, commonness weight, value and coverage by good */
export function readReference(doc = readFileSync(`${ROOT}docs/domain/economy.md`, "utf8")) {
  const section = doc.slice(doc.indexOf("### Goods reference"), doc.indexOf("### Tuning"));
  const [header, , ...rows] = section
    .slice(section.indexOf("| Good "))
    .split("\n\n")[0]
    .split("\n")
    .map(line =>
      line
        .slice(1, -1)
        .split("|")
        .map(cell => cell.trim())
    );
  const needs = header.slice(4).map(n => n.toLowerCase());
  const reference = { kind: {}, made: {}, raw: {}, value: {}, coverage: {} };
  for (const [name, kind, weight, value, ...cover] of rows) {
    reference.kind[name] = kind.toLowerCase();
    reference[kind === "Made" ? "made" : "raw"][name] = +weight;
    reference.value[name] = +value;
    reference.coverage[name] = Object.fromEntries(needs.flatMap((need, i) => (cover[i] ? [[need, +cover[i]]] : [])));
  }
  return reference;
}

/** Mismatches of the reference with the catalogue: goods missing from either or of the wrong kind */
export function checkReference(catalogue, reference) {
  const issues = [];
  const names = new Set(catalogue.map(g => g.name));
  for (const g of catalogue) {
    const kind = reference.kind[g.name];
    if (!kind) issues.push(`${g.name} is not in the reference`);
    else if (kind !== (g.made ? "made" : "raw")) issues.push(`${g.name} is ${g.made ? "made" : "raw"}, not ${kind}`);
  }
  for (const name of Object.keys(reference.kind)) if (!names.has(name)) issues.push(`${name} is not in the catalogue`);
  return issues;
}

/** The catalogue with the coverage entries the reference has: the source's, or the reference's where the source has none */
export function withReferenceCoverage(catalogue, reference) {
  return catalogue.map(g => {
    const entries = reference.coverage[g.name];
    if (!entries) return g;
    return { ...g, coverage: Object.fromEntries(Object.entries(entries).map(([c, x]) => [c, g.coverage[c] ?? x])) };
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
