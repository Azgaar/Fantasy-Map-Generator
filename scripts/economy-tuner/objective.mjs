// What the tuner minimizes: misses against the KPI targets of docs/domain/economy.md, made goods out of proportion to
// their commonness (KPI 15), outsized goods, and made goods' margins far from the default 5

const outside = (x, lo, hi) => Math.max(0, lo - x, x - hi);

/** results: score.js output per map; weights: commonness tier per made good */
export function objective(results, theta, weights) {
  const avg = k => results.reduce((s, r) => s + r[k], 0) / results.length;
  const geo = k => Math.exp(results.reduce((s, r) => s + Math.log(Math.max(1e-9, r[k])), 0) / results.length);
  const made = Object.keys(results[0].madeUnits);
  const total = made.reduce((s, n) => s + (weights[n] ?? 2), 0);
  const target = Object.fromEntries(made.map(n => [n, (weights[n] ?? 2) / total]));

  // KPI 15, per map: made goods whose share of made units is within ½–2× of their commonness target
  let proportion = 0,
    offBy = 0;
  const unitShare = Object.fromEntries(made.map(n => [n, 0]));
  for (const r of results) {
    const units = made.reduce((s, n) => s + r.madeUnits[n], 0) || 1;
    for (const n of made) {
      const ratio = r.madeUnits[n] / units / target[n];
      unitShare[n] += r.madeUnits[n] / units / results.length;
      if (ratio >= 0.5 && ratio <= 2) proportion += 1 / made.length / results.length;
      offBy += Math.abs(Math.log(Math.min(8, Math.max(1 / 8, ratio)))) / made.length / results.length;
    }
  }
  const kpi = {
    produced: avg("produced"),
    volume: geo("volume"),
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
    proportion
  };
  const share = {};
  for (const r of results)
    for (const [n, s] of Object.entries(r.madeShare)) share[n] = (share[n] || 0) + s / results.length;
  const [top, topShare] = Object.entries(share).sort((a, b) => b[1] - a[1])[0];
  const margins = Object.values(theta.margin);
  const parts = {
    produced: Math.max(0, 0.95 - kpi.produced) * 10,
    volume: Math.abs(Math.log(Math.min(20, Math.max(10, kpi.volume)) / kpi.volume)),
    positive: Math.max(0, 0.9 - kpi.positive) * 5,
    regions: Math.max(0, Math.log(5 / Math.max(kpi.regions, 1e-6))) * 0.5,
    apart: Math.max(0, 0.5 - kpi.apart),
    specialization: Math.max(0, 0.6 - kpi.specialization) * 2,
    taxShare: outside(kpi.taxShare, 0.1, 0.2) * 5,
    wealthGini: outside(kpi.wealthGini, 0.35, 0.55) * 3,
    treasuryTop: Math.max(0, kpi.treasuryTop - 0.5) * 2,
    sold: Math.max(0, 0.5 - kpi.sold) * 2,
    prosperity: outside(kpi.prosperity, 0.45, 0.55) * 10,
    stateLink: Math.max(0, 0.5 - kpi.stateLink),
    proportion: Math.max(0, 0.75 - kpi.proportion) * 4 + offBy * 0.5,
    outsized: Object.values(share).reduce((s, x) => s + Math.max(0, x - 0.05) * 20, 0),
    margins: (margins.reduce((s, m) => s + Math.abs(Math.log(m / 5)), 0) / margins.length) * 0.2
  };
  return {
    loss: Object.values(parts).reduce((s, x) => s + x, 0),
    parts,
    kpi: { ...kpi, top, topShare },
    unitShare,
    target
  };
}

export const summary = k =>
  `prosperity ${pct(k.prosperity)} produced ${pct(k.produced)} volume ${k.volume.toFixed(0)}× proportion ${pct(k.proportion)} ` +
  `sold ${pct(k.sold)} spec ${pct(k.specialization)} profit ${pct(k.positive)} link ${k.stateLink.toFixed(2)} top ${k.top} ${(k.topShare * 100).toFixed(1)}%`;
const pct = x => `${(x * 100).toFixed(0)}%`;
