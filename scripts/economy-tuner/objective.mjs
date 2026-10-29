// What the tuner minimizes: misses against the KPI targets of docs/domain/economy.md, goods out of proportion to their
// commonness (KPIs 1 and 2), values and coverage off the goods reference (KPIs 3 and 4), outsized goods, and made goods'
// margins far from the default 5

const outside = (x, lo, hi) => Math.max(0, lo - x, x - hi);
/** Doublings a value lies outside a range */
const off = (x, [lo, hi]) => Math.max(0, Math.log2(lo / Math.max(x, 1e-9)), Math.log2(x / hi));

/** Per map, goods whose share of the units is within ½–2× of their commonness target, and how far they are off */
function proportion(results, key, weights) {
  const names = Object.keys(results[0][key]);
  const total = names.reduce((s, n) => s + (weights[n] ?? 2), 0);
  const target = Object.fromEntries(names.map(n => [n, (weights[n] ?? 2) / total]));
  const unitShare = Object.fromEntries(names.map(n => [n, 0]));
  let share = 0,
    offBy = 0;
  for (const r of results) {
    const units = names.reduce((s, n) => s + r[key][n], 0) || 1;
    for (const n of names) {
      const ratio = r[key][n] / units / target[n];
      unitShare[n] += r[key][n] / units / results.length;
      if (ratio >= 0.5 && ratio <= 2) share += 1 / names.length / results.length;
      offBy += Math.abs(Math.log(Math.min(8, Math.max(1 / 8, ratio)))) / names.length / results.length;
    }
  }
  return { share, offBy, unitShare, target };
}

/** Share of values and coverage entries within the reference, and the doublings they are off in all */
function sense(over, reference) {
  let prices = 0,
    priced = 0,
    priceOff = 0,
    covers = 0,
    covered = 0,
    coverageOff = 0;
  for (const [name, value] of Object.entries(over.value)) {
    const range = reference.price[name];
    if (!range) continue;
    const d = off(value, range);
    priced++;
    if (!d) prices++;
    priceOff += d;
  }
  for (const [name, entries] of Object.entries(over.coverage))
    for (const [need, x] of Object.entries(entries)) {
      const range = reference.coverage[name]?.[need];
      if (!range) continue;
      const d = off(x, range);
      covered++;
      if (!d) covers++;
      coverageOff += d;
    }
  return {
    prices: prices / (priced || 1),
    priceOff,
    coverage: covers / (covered || 1),
    coverageOff
  };
}

/** results: score.js output per map; reference: the goods reference (catalogue.mjs); over: the candidate's overrides */
export function objective(results, theta, reference, over) {
  const avg = k => results.reduce((s, r) => s + r[k], 0) / results.length;
  const geo = k => Math.exp(results.reduce((s, r) => s + Math.log(Math.max(1e-9, r[k])), 0) / results.length);
  const made = proportion(results, "madeUnits", reference.made);
  const raw = proportion(results, "rawUnits", reference.raw);
  const fit = sense(over, reference);
  const kpi = {
    produced: avg("produced"),
    positive: avg("positive"),
    regions: geo("regions"),
    apart: avg("apart"),
    specialization: avg("specialization"),
    taxShare: avg("taxShare"),
    wealthGini: avg("wealthGini"),
    treasuryTop: avg("treasuryTop"),
    sold: avg("sold"),
    prosperity: avg("prosperity"),
    stateLink: avg("stateLink"),
    proportion: made.share,
    rawProportion: raw.share,
    prices: fit.prices,
    coverage: fit.coverage
  };
  const share = {};
  for (const r of results)
    for (const [n, s] of Object.entries(r.madeShare)) share[n] = (share[n] || 0) + s / results.length;
  const [top, topShare] = Object.entries(share).sort((a, b) => b[1] - a[1])[0];
  const margins = Object.values(theta.margin);
  // fees per unit of miss, set in docs/domain/economy.md#kpis; KPI 1 is the most important
  const parts = {
    proportion: Math.max(0, 0.85 - kpi.proportion) * 10 + made.offBy * 0.5,
    rawProportion: Math.max(0, 0.6 - kpi.rawProportion) * 2 + raw.offBy * 0.1,
    prices: fit.priceOff * 0.2,
    coverage: fit.coverageOff * 0.1,
    produced: Math.max(0, 0.95 - kpi.produced) * 10,
    positive: Math.max(0, 0.75 - kpi.positive) * 2,
    regions: Math.max(0, Math.log(5 / Math.max(kpi.regions, 1e-6))) * 0.5,
    apart: Math.max(0, 0.3 - kpi.apart),
    specialization: Math.max(0, 0.6 - kpi.specialization) * 2,
    taxShare: outside(kpi.taxShare, 0.15, 0.35),
    stateLink: Math.max(0, 0.2 - kpi.stateLink),
    wealthGini: outside(kpi.wealthGini, 0.4, 0.6) * 3,
    treasuryTop: Math.max(0, kpi.treasuryTop - 0.7),
    sold: Math.max(0, 0.5 - kpi.sold) * 2,
    prosperity: outside(kpi.prosperity, 0.4, 0.6) * 10,
    outsized: Object.values(share).reduce((s, x) => s + Math.max(0, x - 0.05) * 20, 0),
    margins: (margins.reduce((s, m) => s + Math.abs(Math.log(m / 5)), 0) / margins.length) * 0.2
  };
  return {
    loss: Object.values(parts).reduce((s, x) => s + x, 0),
    parts,
    kpi: { ...kpi, top, topShare },
    unitShare: { ...made.unitShare, ...raw.unitShare },
    target: { ...made.target, ...raw.target }
  };
}

export const summary = k =>
  `prosperity ${pct(k.prosperity)} proportion ${pct(k.proportion)} raw ${pct(k.rawProportion)} prices ${pct(k.prices)} coverage ${pct(k.coverage)} produced ${pct(k.produced)} ` +
  `sold ${pct(k.sold)} spec ${pct(k.specialization)} profit ${pct(k.positive)} link ${k.stateLink.toFixed(2)} top ${k.top} ${(k.topShare * 100).toFixed(1)}%`;
const pct = x => `${(x * 100).toFixed(0)}%`;
