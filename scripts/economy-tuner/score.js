// KPIs of the economy doc on a finished run; plain JS so the headless runner and the game page share it

const mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const tenths = a => {
  const v = [...a].sort((x, y) => x - y),
    t = Math.max(1, Math.floor(v.length / 10));
  return mean(v.slice(-t)) / Math.max(1e-9, mean(v.slice(0, t)));
};
const ranks = a => {
  const r = [];
  a.map((v, i) => [v, i])
    .sort((x, y) => x[0] - y[0])
    .forEach(([, i], k) => {
      r[i] = k;
    });
  return r;
};
const spearman = (a, b) => {
  const ra = ranks(a),
    rb = ranks(b),
    ma = mean(ra),
    mb = mean(rb);
  let n = 0,
    da = 0,
    db = 0;
  ra.forEach((x, i) => {
    n += (x - ma) * (rb[i] - mb);
    da += (x - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  });
  return n / Math.sqrt(da * db || 1);
};
const gini = xs => {
  const v = xs.map(x => Math.max(0, x)).sort((a, b) => a - b);
  const total = v.reduce((s, x) => s + x, 0);
  if (!total) return 0;
  let cum = 0,
    area = 0;
  for (const x of v) {
    const next = cum + x;
    area += (cum + next) / total;
    cum = next;
  }
  return 1 - area / v.length;
};

/** The doc's KPIs, per-good made output and townspeople's prosperity; modules passed in so the game page can run it too */
export function score(pack, { Goods, Markets, Production, Prosperity }) {
  const value = id => Goods.get(id)?.value || 0;
  const markets = pack.markets.filter(m => m.i);
  const burgs = pack.burgs.filter(b => b.i && !b.removed && b.market && b.population > 0);
  const units = [],
    made = [];
  const mix = new Map(markets.map(m => [m.i, {}]));
  const ruralPeople = new Map();
  const bp = Goods.getBiomesProduction();
  for (const c of pack.cells.i) {
    const v = mix.get(pack.cells.market[c]);
    if (!v) continue;
    ruralPeople.set(pack.cells.market[c], (ruralPeople.get(pack.cells.market[c]) || 0) + (pack.cells.pop[c] || 0));
    for (const [gid, u] of Object.entries(Production.getCellProduction(c, bp))) {
      units[+gid] = (units[+gid] || 0) + u;
      v[+gid] = (v[+gid] || 0) + u * value(+gid);
    }
  }
  for (const b of burgs)
    for (const [gid, u] of b.production || []) {
      units[gid] = (units[gid] || 0) + u;
      if (Goods.get(gid)?.recipes?.length) made[gid] = (made[gid] || 0) + u;
      const v = mix.get(b.market);
      if (v) v[gid] = (v[gid] || 0) + u * value(gid);
    }
  const goods = pack.goods;
  const produced = goods.filter(g => (units[g.i] || 0) >= 0.5).length / goods.length;
  const madeGoods = goods.filter(g => g.recipes?.length);
  const people = m =>
    (ruralPeople.get(m.i) || 0) + burgs.filter(b => b.market === m.i).reduce((s, b) => s + b.population, 0);
  const out = new Map(markets.map(m => [m.i, Object.values(mix.get(m.i)).reduce((a, b) => a + b, 0)]));
  const totalPeople = markets.reduce((s, m) => s + people(m), 0);
  const totalOut = [...out.values()].reduce((a, b) => a + b, 0);
  const apart =
    markets.filter(m => {
      const ps = people(m) / totalPeople;
      return ps > 0 && Math.abs(out.get(m.i) / totalOut / ps - 1) > 0.5;
    }).length / markets.length;
  const world = {};
  for (const v of mix.values()) for (const [gid, x] of Object.entries(v)) world[gid] = (world[gid] || 0) + x;
  const wt = Object.values(world).reduce((a, b) => a + b, 0);
  const spec = [...mix.values()]
    .map(v => {
      const t = Object.values(v).reduce((a, b) => a + b, 0);
      if (!t) return 0;
      let d = 0;
      for (const gid of Object.keys(world)) d += Math.abs((v[gid] || 0) / t - world[gid] / wt);
      return d / 2;
    })
    .sort((a, b) => a - b);
  const treasuries = burgs.map(b => b.treasury || 0);
  const wealth = burgs.map(b => (b.product || 0) / b.population);
  const wealthByMarket = markets
    .map(m => {
      const w = burgs.filter(b => b.market === m.i).map(b => (b.product || 0) / b.population);
      return w.length ? mean(w) : null;
    })
    .filter(v => v !== null && v > 0);
  const top = Math.max(1, Math.floor(burgs.length / 10));
  const byTreasury = [...burgs].sort((a, b) => (b.treasury || 0) - (a.treasury || 0)).slice(0, top);
  const pos = treasuries.filter(t => t > 0).reduce((a, b) => a + b, 0) || 1;
  const living = pack.states.filter(s => s.i && !s.removed);
  // the taxes a state keeps from its officials, for its treasury and its orders; other revenue is no tax
  const kept = ({ economy }) => (economy.collected || 0) - (economy.otherRevenue || 0) - (economy.pocketed || 0);
  const taxes = living.reduce((s, x) => s + kept(x), 0);
  const rural = markets.reduce((s, m) => s + (Markets.getRuralBalance(m.i)?.income || 0), 0);
  const margins = pack.deals.reduce((s, d) => s + Markets.getMargin(d), 0);
  const economy = burgs.reduce((s, b) => s + (b.product || 0), 0) + margins + rural;
  const left = [];
  for (const m of markets)
    for (const [gid, x] of Object.entries(m.goods)) left[gid] = (left[gid] || 0) + (x?.stock || 0);
  let mv = 0,
    lv = 0;
  for (const g of madeGoods) {
    const u = made[g.i] || 0;
    mv += u * g.value;
    lv += Math.min(left[g.i] || 0, u) * g.value;
  }
  // townspeople's prosperity, weighted by their numbers
  let pp = 0,
    pw = 0;
  for (const b of burgs) {
    const p = Prosperity.getBurg(b.i)?.prosperity;
    if (p != null) {
      pp += p * b.population;
      pw += b.population;
    }
  }
  // KPI 9: across states, the rank correlation of their townspeople's wealth and the taxes they collect per head
  const stateRows = living.flatMap(state => {
    const own = burgs.filter(b => b.state === state.i);
    const people = own.reduce((s, b) => s + b.population, 0);
    return people > 0 ? [[own.reduce((s, b) => s + (b.product || 0), 0) / people, kept(state) / people]] : [];
  });
  const madeShare = {},
    madeUnits = {};
  for (const g of madeGoods) {
    madeShare[g.name] = ((made[g.i] || 0) * g.value) / (wt || 1);
    madeUnits[g.name] = made[g.i] || 0;
  }
  return {
    produced,
    positive: treasuries.filter(t => t > 0).length / treasuries.length,
    regions: tenths(wealthByMarket),
    apart,
    specialization: spec[Math.floor(spec.length / 2)] || 0,
    taxShare: taxes / (economy || 1),
    wealthGini: gini(wealth),
    treasuryTop: byTreasury.reduce((s, b) => s + Math.max(0, b.treasury || 0), 0) / pos,
    sold: 1 - lv / (mv || 1),
    prosperity: pw ? pp / pw : 0,
    stateLink:
      stateRows.length > 2
        ? spearman(
            stateRows.map(r => r[0]),
            stateRows.map(r => r[1])
          )
        : 0,
    madeShare,
    madeUnits
  };
}
