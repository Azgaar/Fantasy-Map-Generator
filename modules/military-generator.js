(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global.Military = factory());
}(this, (function () {'use strict';

  let cells, p, states;

  const generate = function() {
    console.time("generateMilitaryForces");
    cells = pack.cells, p = cells.p, states = pack.states;
    const valid = states.filter(s => s.i && !s.removed); // valid states
    if (!options.military) options.military = getDefaultOptions();

    const expn = d3.sum(valid.map(s => s.expansionism)); // total expansion
    const area = d3.sum(valid.map(s => s.area)); // total area
    const rate = {x:0, Ally:-.2, Friendly:-.1, Neutral:0, Suspicion:.1, Enemy:1, Unknown:0, Rival:.5, Vassal:.5, Suzerain:-.5};

    const stateModifier = {
      "melee":    {"Nomadic":.5,  "Highland":1.2, "Lake":1,   "Naval":.7,   "Hunting":1.2,  "River":1.1},
      "ranged":   {"Nomadic":.9,  "Highland":1.3, "Lake":1,   "Naval":.8,   "Hunting":2,    "River":.8},
      "mounted":  {"Nomadic":2.3, "Highland":.6,  "Lake":.7,  "Naval":.3,   "Hunting":.7,   "River":.8},
      "machinery":{"Nomadic":.8,  "Highland":1.4, "Lake":1.1, "Naval":1.4,  "Hunting":.4,   "River":1.1},
      "naval":    {"Nomadic":.5,  "Highland":.5,  "Lake":1.2, "Naval":1.8,  "Hunting":.7,   "River":1.2},
      // non-default generic:
      "armored":  {"Nomadic":1,   "Highland":.5,  "Lake":1,   "Naval":1,    "Hunting":.7,   "River":1.1},
      "aviation": {"Nomadic":.5,  "Highland":.5,  "Lake":1.2, "Naval":1.2,  "Hunting":.6,   "River":1.2},
      "magical":  {"Nomadic":1,   "Highland":2,   "Lake":1,   "Naval":1,    "Hunting":1,    "River":1}
    };

    valid.forEach(s => {
      const temp = s.temp = {}, d = s.diplomacy;
      const expansionRate = Math.min(Math.max((s.expansionism / expn) / (s.area / area), .25), 4); // how much state expansionism is realized
      const diplomacyRate = d.some(d => d === "Enemy") ? 1 : d.some(d => d === "Rival") ? .8 : d.some(d => d === "Suspicion") ? .5 : .1; // peacefulness
      const neighborsRate = Math.min(Math.max(s.neighbors.map(n => n ? pack.states[n].diplomacy[s.i] : "Suspicion").reduce((s, r) => s += rate[r], .5), .3), 3); // neighbors rate
      s.alert = Math.min(Math.max(rn(expansionRate * diplomacyRate * neighborsRate, 2), .1), 5); // war alert rate (army modifier)
      temp.platoons = [];

      // apply overall state modifiers for unit types based on state features
      for (const unit of options.military) {
        if (!stateModifier[unit.type]) continue;
        let modifier = stateModifier[unit.type][s.type] || 1;
        if (unit.type === "mounted" && s.form === "Horde") modifier *= 2; else
        if (unit.type === "naval" && s.form === "Republic") modifier *= 1.2;
        temp[unit.name] = modifier * s.alert;
      }

    });

    for (const i of cells.i) {
      if (!cells.pop[i]) continue;
      const s = states[cells.state[i]]; // cell state
      if (!s.i || s.removed) continue;

      let m = cells.pop[i] / 100; // basic rural army in percentages
      if (cells.culture[i] !== s.culture) m = s.form === "Union" ? m / 1.2 : m / 2; // non-dominant culture
      if (cells.religion[i] !== cells.religion[s.center]) m = s.form === "Theocracy" ? m / 2.2 : m / 1.4; // non-dominant religion
      if (cells.f[i] !== cells.f[s.center]) m = s.type === "Naval" ? m / 1.2 : m / 1.8; // different landmass

      const nomadic = [1, 2, 3, 4].includes(cells.biome[i]);
      const wetland = [7, 8, 9, 12].includes(cells.biome[i]);
      const highland = cells.h[i] >= 70;

      for (const u of options.military) {
        const perc = +u.rural;
        if (isNaN(perc) || perc <= 0 || !s.temp[u.name]) continue;

        let army = m * perc; // basic army for rural cell
        if (nomadic) { // "nomadic" biomes special rules
          if (u.type === "melee") army /= 5; else
          if (u.type === "ranged") army /= 2; else
          if (u.type === "mounted") army *= 3;
        }

        if (wetland) { // "wet" biomes special rules
          if (u.type === "melee") army *= 1.2; else
          if (u.type === "ranged") army *= 1.4; else
          if (u.type === "mounted") army /= 3;
        }

        if (highland) { // highlands special rules
          if (u.type === "melee") army *= 1.2; else
          if (u.type === "ranged") army *= 1.6; else
          if (u.type === "mounted") army /= 3;
        }

        const t = rn(army * s.temp[u.name] * populationRate.value);
        if (!t) continue;
        let x = p[i][0], y = p[i][1], n = 0;
        if (u.type === "naval") {let haven = cells.haven[i]; x = p[haven][0], y = p[haven][1]; n = 1}; // place naval to sea
        s.temp.platoons.push({cell: i, a:t, t, x, y, u:u.name, n, s:u.separate, type:u.type});
      }
    }

    for (const b of pack.burgs) {
      if (!b.i || b.removed || !b.state || !b.population) continue;
      const s = states[b.state]; // burg state

      let m = b.population * urbanization.value / 100; // basic urban army in percentages
      if (b.capital) m *= 1.2; // capital has household troops
      if (b.culture !== s.culture) m = s.form === "Union" ? m / 1.2 : m / 2; // non-dominant culture
      if (cells.religion[b.cell] !== cells.religion[s.center]) m = s.form === "Theocracy" ? m / 2.2 : m / 1.4; // non-dominant religion
      if (cells.f[b.cell] !== cells.f[s.center]) m = s.type === "Naval" ? m / 1.2 : m / 1.8; // different landmass

      const biome = cells.biome[b.cell]; // burg biome
      const nomadic = [1, 2, 3, 4].includes(biome);
      const wetland = [7, 8, 9, 12].includes(biome);
      const highland = cells.h[b.cell] >= 70;

      for (const u of options.military) {
        const perc = +u.urban;
        if (isNaN(perc) || perc <= 0 || !s.temp[u.name]) continue;
        let army = m * perc; // basic army for rural cell

        if (u.type === "naval" && !b.port) continue; // only ports produce naval units

        if (nomadic) { // "nomadic" biomes special rules
          if (u.type === "melee") army /= 3; else
          if (u.type === "machinery") army /= 2; else
          if (u.type === "mounted") army *= 3; else
          if (u.type === "armored") army *= 2;
        }

        if (wetland) { // "wet" biomes special rules
          if (u.type === "melee") army *= 1.2; else
          if (u.type === "ranged") army *= 1.4; else
          if (u.type === "machinery") army *= 1.2; else
          if (u.type === "mounted") army /= 4; else
          if (u.type === "armored") army /= 3;
        }

        if (highland) { // highlands special rules
          if (u.type === "ranged") army *= 2; else
          if (u.type === "naval") army /= 3; else
          if (u.type === "mounted") army /= 3; else
          if (u.type === "armored") army /= 2; else
          if (u.type === "magical") army *= 2;
        }

        const t = rn(army * s.temp[u.name] * populationRate.value);
        if (!t) continue;
        let x = p[b.cell][0], y = p[b.cell][1], n = 0;
        if (u.type === "naval") {let haven = cells.haven[b.cell]; x = p[haven][0], y = p[haven][1]; n = 1}; // place naval in sea cell
        s.temp.platoons.push({cell: b.cell, a:t, t, x, y, u:u.name, n, s:u.separate, type:u.type});
      }
    }

    void function removeExistingRegiments() {
      armies.selectAll("g > g").each(function() {
        const index = notes.findIndex(n => n.id === this.id);
        if (index != -1) notes.splice(index, 1);
      });
      armies.selectAll("g").remove();
    }()

    const expected = 3 * populationRate.value; // expected regiment size
    const mergeable = (n0, n1) => (!n0.s && !n1.s) || n0.type === n1.type; // check if regiments can be merged

    // get regiments for each state
    valid.forEach(s => {
      s.military = createRegiments(s.temp.platoons, s);
      delete s.temp; // do not store temp data
      drawRegiments(s.military, s.i);
    });

    function createRegiments(nodes, s) {
      if (!nodes.length) return [];
      nodes.sort((a,b) => a.a - b.a); // form regiments in cells with most troops
      const tree = d3.quadtree(nodes, d => d.x, d => d.y);
      nodes.forEach(n => {
        tree.remove(n);
        const overlap = tree.find(n.x, n.y, 20);
        if (overlap && overlap.t && mergeable(n, overlap)) {merge(n, overlap); return;}
        if (n.t > expected) return;
        const r = (expected - n.t) / (n.s?40:20); // search radius
        const candidates = tree.findAll(n.x, n.y, r);
        for (const c of candidates) {
          if (c.t < expected && mergeable(n, c)) {merge(n, c); break;}
        }
      });

      // add n0 to n1's ultimate parent
      function merge(n0, n1) {
        if (!n1.childen) n1.childen = [n0]; else n1.childen.push(n0);
        if (n0.childen) n0.childen.forEach(n => n1.childen.push(n));
        n1.t += n0.t;
        n0.t = 0;
      }

      // parse regiments data
      const regiments = nodes.filter(n => n.t).sort((a,b) => b.t - a.t).map((r, i) => {
        const u = {}; u[r.u] = r.a;
        (r.childen||[]).forEach(n => u[n.u] = u[n.u] ? u[n.u] += n.a : n.a);
        return {i, a:r.t, cell:r.cell, x:r.x, y:r.y, bx:r.x, by:r.y, u, n:r.n, name, state: s.i};
      });

      // generate name for regiments
      regiments.forEach(r => {
        r.name = getName(r, regiments);
        r.icon = getEmblem(r);
        generateNote(r, s);
      });

      return regiments;
    }

    console.timeEnd("generateMilitaryForces");
  }

  const getDefaultOptions = function() {
    return [
      {icon: "⚔️", name:"infantry",  rural:.25,  urban:.2,   crew:1,   power:1,  type:"melee",      separate:0},
      {icon: "🏹", name:"archers",   rural:.12,  urban:.2,   crew:1,   power:1,  type:"ranged",     separate:0},
      {icon: "🐴", name:"cavalry",   rural:.12,  urban:.03,  crew:2,   power:2,  type:"mounted",    separate:0},
      {icon: "💣", name:"artillery", rural:0,    urban:.03,  crew:8,   power:12,  type:"machinery", separate:0},
      {icon: "🌊", name:"fleet",     rural:0,    urban:.015, crew:100, power:50,  type:"naval",     separate:1}
    ];
  }

  const drawRegiments = function(regiments, s) {
    const size = +armies.attr("box-size");
    const w = d => d.n ? size * 4 : size * 6;
    const h = size * 2;
    const x = d => rn(d.x - w(d) / 2, 2);
    const y = d => rn(d.y - size, 2);

    const baseColor = pack.states[s].color[0] === "#" ? pack.states[s].color : "#999";
    const darkerColor = d3.color(baseColor).darker().hex();
    const army = armies.append("g").attr("id", "army"+s).attr("fill", baseColor);

    const g = army.selectAll("g").data(regiments).enter().append("g")
      .attr("id", d => "regiment"+s+"-"+d.i).attr("data-name", d => d.name).attr("data-state", s).attr("data-id", d => d.i);
    g.append("rect").attr("x", d => x(d)).attr("y", d => y(d)).attr("width", d => w(d)).attr("height", h);
    g.append("text").attr("x", d => d.x).attr("y", d => d.y).text(d => getTotal(d));
    g.append("rect").attr("fill", darkerColor).attr("x", d => x(d)-h).attr("y", d => y(d)).attr("width", h).attr("height", h);
    g.append("text").attr("class", "regimentIcon").attr("x", d => x(d)-size).attr("y", d => d.y).text(d => d.icon);
  }

  const drawRegiment = function(reg, s) {
    const size = +armies.attr("box-size");
    const w = reg.n ? size * 4 : size * 6;
    const h = size * 2;
    const x1 = rn(reg.x - w / 2, 2);
    const y1 = rn(reg.y - size, 2);

    let army = armies.select("g#army"+s);
    if (!army.size()) {
      const baseColor = pack.states[s].color[0] === "#" ? pack.states[s].color : "#999";
      army = armies.append("g").attr("id", "army"+s).attr("fill", baseColor);
    }
    const darkerColor = d3.color(army.attr("fill")).darker().hex();

    const g = army.append("g").attr("id", "regiment"+s+"-"+reg.i).attr("data-name", reg.name).attr("data-state", s).attr("data-id", reg.i);
    g.append("rect").attr("x", x1).attr("y", y1).attr("width", w).attr("height", h);
    g.append("text").attr("x", reg.x).attr("y", reg.y).text(getTotal(reg));
    g.append("rect").attr("fill", darkerColor).attr("x", x1-h).attr("y", y1).attr("width", h).attr("height", h);
    g.append("text").attr("class", "regimentIcon").attr("x", x1-size).attr("y", reg.y).text(reg.icon);
  }

  // move one regiment to another
  const moveRegiment = function(reg, x, y) {
    const el = armies.select("g#army"+reg.state).select("g#regiment"+reg.state+"-"+reg.i);
    if (!el.size()) return;

    const duration = Math.hypot(reg.x - x, reg.y - y) * 8;
    reg.x = x; reg.y = y;
    const size = +armies.attr("box-size");
    const w = reg.n ? size * 4 : size * 6;
    const h = size * 2;
    const x1 = x => rn(x - w / 2, 2);
    const y1 = y => rn(y - size, 2);

    const move = d3.transition().duration(duration).ease(d3.easeSinInOut);
    el.select("rect").transition(move).attr("x", x1(x)).attr("y", y1(y));
    el.select("text").transition(move).attr("x", x).attr("y", y);
    el.selectAll("rect:nth-of-type(2)").transition(move).attr("x", x1(x)-h).attr("y", y1(y));
    el.select(".regimentIcon").transition(move).attr("x", x1(x)-size).attr("y", y);
  }

  // utilize si function to make regiment total text fit regiment box
  const getTotal = reg => reg.a > (reg.n ? 999 : 99999) ? si(reg.a) : reg.a;

  const getName = function(r, regiments) {
    const proper = r.n ? null :
      cells.province[r.cell] && pack.provinces[cells.province[r.cell]] ? pack.provinces[cells.province[r.cell]].name :
      cells.burg[r.cell] && pack.burgs[cells.burg[r.cell]] ? pack.burgs[cells.burg[r.cell]].name : null
    const number = nth(regiments.filter(reg => reg.n === r.n && reg.i < r.i).length+1);
    const form = r.n ? "Fleet" : "Regiment";
    return `${number}${proper?` (${proper}) `:` `}${form}`;
  }

  // get default regiment emblem
  const getEmblem = function(r) {
    if (!r.n && !Object.values(r.u).length) return "🔰"; // "Newbie" regiment without troops
    if (!r.n && pack.states[r.state].form === "Monarchy" && cells.burg[r.cell] && pack.burgs[cells.burg[r.cell]].capital) return "👑"; // "Royal" regiment based in capital
    const mainUnit = Object.entries(r.u).sort((a,b) => b[1]-a[1])[0][0]; // unit with more troops in regiment
    const unit = options.military.find(u => u.name === mainUnit);
    return unit.icon;
  }

  const generateNote = function(r, s) {
    const base = cells.burg[r.cell] && pack.burgs[cells.burg[r.cell]] ? pack.burgs[cells.burg[r.cell]].name :
      cells.province[r.cell] && pack.provinces[cells.province[r.cell]] ? pack.provinces[cells.province[r.cell]].fullName : null;
    const station = base ? `${r.name} is ${r.n ? "based" : "stationed"} in ${base}. ` : "";

    const composition = r.a ? Object.keys(r.u).map(t => `— ${t}: ${r.u[t]}`).join("\r\n") : null;
    const troops = composition ? `\r\n\r\nRegiment composition:\r\n${composition}.` : "";

    const campaign = s.campaigns ? ra(s.campaigns) : null;
    const year = campaign ? rand(campaign.start, campaign.end) : gauss(options.year-100, 150, 1, options.year-6);
    const conflict = campaign ? ` during the ${campaign.name}` : "";
    const legend = `Regiment was formed in ${year} ${options.era}${conflict}. ${station}${troops}`;
    notes.push({id:`regiment${s.i}-${r.i}`, name:`${r.icon} ${r.name}`, legend});
  }

  // const updateNote = function(r, s) {
  //   const id = `regiment${s}-${r.i}`;
  //   const note = notes.find(n => n.id === id);
  //   if (!note) return;

  //   const oldComposition = note.legend.split("composition:\r\n")[1]||"".split(".")[0];
  //   if (!oldComposition) return;
  //   const newComposition = Object.keys(r.u).map(t => `— ${t}: ${r.u[t]}`).join("\r\n") + ".";
  //   note.legend = note.legend.replace(oldComposition, newComposition);
  // }

  return {generate, getDefaultOptions, getName, generateNote, drawRegiments, drawRegiment, moveRegiment, getTotal, getEmblem};

})));