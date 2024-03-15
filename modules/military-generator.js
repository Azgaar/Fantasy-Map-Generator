"use strict";

window.Military = (function () {
  const generate = function () {
    TIME && console.time("generateMilitaryForces");
    const {cells, states} = pack;
    const {p} = cells;
    const valid = states.filter(s => s.i && !s.removed); // valid states
    if (!options.military) options.military = getDefaultOptions();

    const expn = d3.sum(valid.map(s => s.expansionism)); // total expansion
    const area = d3.sum(valid.map(s => s.area)); // total area
    const rate = {
      x: 0,
      Ally: -0.2,
      Friendly: -0.1,
      Neutral: 0,
      Suspicion: 0.1,
      Enemy: 1,
      Unknown: 0,
      Rival: 0.5,
      Vassal: 0.5,
      Suzerain: -0.5
    };

    const stateModifier = {
      melee: {Nomadic: 0.5, Highland: 1.2, Lake: 1, Naval: 0.7, Hunting: 1.2, River: 1.1},
      ranged: {Nomadic: 0.9, Highland: 1.3, Lake: 1, Naval: 0.8, Hunting: 2, River: 0.8},
      mounted: {Nomadic: 2.3, Highland: 0.6, Lake: 0.7, Naval: 0.3, Hunting: 0.7, River: 0.8},
      machinery: {Nomadic: 0.8, Highland: 1.4, Lake: 1.1, Naval: 1.4, Hunting: 0.4, River: 1.1},
      naval: {Nomadic: 0.5, Highland: 0.5, Lake: 1.2, Naval: 1.8, Hunting: 0.7, River: 1.2},
      armored: {Nomadic: 1, Highland: 0.5, Lake: 1, Naval: 1, Hunting: 0.7, River: 1.1},
      aviation: {Nomadic: 0.5, Highland: 0.5, Lake: 1.2, Naval: 1.2, Hunting: 0.6, River: 1.2},
      magical: {Nomadic: 1, Highland: 2, Lake: 1, Naval: 1, Hunting: 1, River: 1}
    };

    const cellTypeModifier = {
      nomadic: {
        melee: 0.2,
        ranged: 0.5,
        mounted: 3,
        machinery: 0.4,
        naval: 0.3,
        armored: 1.6,
        aviation: 1,
        magical: 0.5
      },
      wetland: {
        melee: 0.8,
        ranged: 2,
        mounted: 0.3,
        machinery: 1.2,
        naval: 1.0,
        armored: 0.2,
        aviation: 0.5,
        magical: 0.5
      },
      highland: {
        melee: 1.2,
        ranged: 1.6,
        mounted: 0.3,
        machinery: 3,
        naval: 1.0,
        armored: 0.8,
        aviation: 0.3,
        magical: 2
      }
    };

    const burgTypeModifier = {
      nomadic: {
        melee: 0.3,
        ranged: 0.8,
        mounted: 3,
        machinery: 0.4,
        naval: 1.0,
        armored: 1.6,
        aviation: 1,
        magical: 0.5
      },
      wetland: {
        melee: 1,
        ranged: 1.6,
        mounted: 0.2,
        machinery: 1.2,
        naval: 1.0,
        armored: 0.2,
        aviation: 0.5,
        magical: 0.5
      },
      highland: {melee: 1.2, ranged: 2, mounted: 0.3, machinery: 3, naval: 1.0, armored: 0.8, aviation: 0.3, magical: 2}
    };

    valid.forEach(s => {
      s.temp = {};
      const d = s.diplomacy;

      const expansionRate = minmax(s.expansionism / expn / (s.area / area), 0.25, 4); // how much state expansionism is realized
      const diplomacyRate = d.some(d => d === "Enemy")
        ? 1
        : d.some(d => d === "Rival")
        ? 0.8
        : d.some(d => d === "Suspicion")
        ? 0.5
        : 0.1; // peacefulness
      const neighborsRateRaw = s.neighbors
        .map(n => (n ? pack.states[n].diplomacy[s.i] : "Suspicion"))
        .reduce((s, r) => (s += rate[r]), 0.5);
      const neighborsRate = minmax(neighborsRateRaw, 0.3, 3); // neighbors rate
      s.alert = minmax(rn(expansionRate * diplomacyRate * neighborsRate, 2), 0.1, 5); // alert rate (area modifier)
      s.temp.platoons = [];

      // apply overall state modifiers for unit types based on state features
      for (const unit of options.military) {
        if (!stateModifier[unit.type]) continue;

        let modifier = stateModifier[unit.type][s.type] || 1;
        if (unit.type === "mounted" && s.formName.includes("Horde")) modifier *= 2;
        else if (unit.type === "naval" && s.form === "Republic") modifier *= 1.2;
        s.temp[unit.name] = modifier * s.alert;
      }
    });

    const getType = cell => {
      if ([1, 2, 3, 4].includes(cells.biome[cell])) return "nomadic";
      if ([7, 8, 9, 12].includes(cells.biome[cell])) return "wetland";
      if (cells.h[cell] >= 70) return "highland";
      return "generic";
    };

    function passUnitLimits(unit, biome, state, culture, religion) {
      if (unit.biomes && !unit.biomes.includes(biome)) return false;
      if (unit.states && !unit.states.includes(state)) return false;
      if (unit.cultures && !unit.cultures.includes(culture)) return false;
      if (unit.religions && !unit.religions.includes(religion)) return false;
      return true;
    }

    // rural cells
    for (const i of cells.i) {
      if (!cells.pop[i]) continue;

      const biome = cells.biome[i];
      const state = cells.state[i];
      const culture = cells.culture[i];
      const religion = cells.religion[i];

      const stateObj = states[state];
      if (!state || stateObj.removed) continue;

      let modifier = cells.pop[i] / 100; // basic rural army in percentages
      if (culture !== stateObj.culture) modifier = stateObj.form === "Union" ? modifier / 1.2 : modifier / 2; // non-dominant culture
      if (religion !== cells.religion[stateObj.center])
        modifier = stateObj.form === "Theocracy" ? modifier / 2.2 : modifier / 1.4; // non-dominant religion
      if (cells.f[i] !== cells.f[stateObj.center])
        modifier = stateObj.type === "Naval" ? modifier / 1.2 : modifier / 1.8; // different landmass
      const type = getType(i);

      for (const unit of options.military) {
        const perc = +unit.rural;
        if (isNaN(perc) || perc <= 0 || !stateObj.temp[unit.name]) continue;
        if (!passUnitLimits(unit, biome, state, culture, religion)) continue;
        if (unit.type === "naval" && !cells.haven[i]) continue; // only near-ocean cells create naval units

        const cellTypeMod = type === "generic" ? 1 : cellTypeModifier[type][unit.type]; // cell specific modifier
        const army = modifier * perc * cellTypeMod; // rural cell army
        const total = rn(army * stateObj.temp[unit.name] * populationRate); // total troops
        if (!total) continue;

        let [x, y] = p[i];
        let n = 0;

        // place naval units to sea
        if (unit.type === "naval") {
          const haven = cells.haven[i];
          [x, y] = p[haven];
          n = 1;
        }

        stateObj.temp.platoons.push({
          cell: i,
          a: total,
          t: total,
          x,
          y,
          u: unit.name,
          n,
          s: unit.separate,
          type: unit.type
        });
      }
    }

    // burgs
    for (const b of pack.burgs) {
      if (!b.i || b.removed || !b.state || !b.population) continue;

      const biome = cells.biome[b.cell];
      const state = b.state;
      const culture = b.culture;
      const religion = cells.religion[b.cell];

      const stateObj = states[state];
      let m = (b.population * urbanization) / 100; // basic urban army in percentages
      if (b.capital) m *= 1.2; // capital has household troops
      if (culture !== stateObj.culture) m = stateObj.form === "Union" ? m / 1.2 : m / 2; // non-dominant culture
      if (religion !== cells.religion[stateObj.center]) m = stateObj.form === "Theocracy" ? m / 2.2 : m / 1.4; // non-dominant religion
      if (cells.f[b.cell] !== cells.f[stateObj.center]) m = stateObj.type === "Naval" ? m / 1.2 : m / 1.8; // different landmass
      const type = getType(b.cell);

      for (const unit of options.military) {
        const perc = +unit.urban;
        if (isNaN(perc) || perc <= 0 || !stateObj.temp[unit.name]) continue;
        if (!passUnitLimits(unit, biome, state, culture, religion)) continue;
        if (unit.type === "naval" && (!b.port || !cells.haven[b.cell])) continue; // only ports create naval units

        const mod = type === "generic" ? 1 : burgTypeModifier[type][unit.type]; // cell specific modifier
        const army = m * perc * mod; // urban cell army
        const total = rn(army * stateObj.temp[unit.name] * populationRate); // total troops
        if (!total) continue;

        let [x, y] = p[b.cell];
        let n = 0;

        // place naval to sea
        if (unit.type === "naval") {
          const haven = cells.haven[b.cell];
          [x, y] = p[haven];
          n = 1;
        }

        stateObj.temp.platoons.push({
          cell: b.cell,
          a: total,
          t: total,
          x,
          y,
          u: unit.name,
          n,
          s: unit.separate,
          type: unit.type
        });
      }
    }

    const expected = 3 * populationRate; // expected regiment size
    const mergeable = (n0, n1) => (!n0.s && !n1.s) || n0.u === n1.u; // check if regiments can be merged

    // get regiments for each state
    valid.forEach(s => {
      s.military = createRegiments(s.temp.platoons, s);
      delete s.temp; // do not store temp data
    });

    redraw();

    function createRegiments(nodes, s) {
      if (!nodes.length) return [];

      nodes.sort((a, b) => a.a - b.a); // form regiments in cells with most troops
      const tree = d3.quadtree(
        nodes,
        d => d.x,
        d => d.y
      );

      nodes.forEach(node => {
        tree.remove(node);
        const overlap = tree.find(node.x, node.y, 20);
        if (overlap && overlap.t && mergeable(node, overlap)) {
          merge(node, overlap);
          return;
        }
        if (node.t > expected) return;
        const r = (expected - node.t) / (node.s ? 40 : 20); // search radius
        const candidates = tree.findAll(node.x, node.y, r);
        for (const c of candidates) {
          if (c.t < expected && mergeable(node, c)) {
            merge(node, c);
            break;
          }
        }
      });

      // add n0 to n1's ultimate parent
      function merge(n0, n1) {
        if (!n1.childen) n1.childen = [n0];
        else n1.childen.push(n0);
        if (n0.childen) n0.childen.forEach(n => n1.childen.push(n));
        n1.t += n0.t;
        n0.t = 0;
      }

      // parse regiments data
      const regiments = nodes
        .filter(n => n.t)
        .sort((a, b) => b.t - a.t)
        .map((r, i) => {
          const u = {};
          u[r.u] = r.a;
          (r.childen || []).forEach(n => (u[n.u] = u[n.u] ? (u[n.u] += n.a) : n.a));
          return {i, a: r.t, cell: r.cell, x: r.x, y: r.y, bx: r.x, by: r.y, u, n: r.n, name, state: s.i};
        });

      // generate name for regiments
      regiments.forEach(r => {
        r.name = getName(r, regiments);
        r.icon = getEmblem(r);
        generateNote(r, s);
      });

      return regiments;
    }

    TIME && console.timeEnd("generateMilitaryForces");
  };

  function redraw() {
    const validStates = pack.states.filter(s => s.i && !s.removed);
    armies.selectAll("g > g").each(function () {
      const index = notes.findIndex(n => n.id === this.id);
      if (index != -1) notes.splice(index, 1);
    });
    armies.selectAll("g").remove();
    validStates.forEach(s => drawRegiments(s.military, s.i));
  }

  const getDefaultOptions = function () {
    return [
      {icon: "⚔️", name: "infantry", rural: 0.25, urban: 0.2, crew: 1, power: 1, type: "melee", separate: 0},
      {icon: "🏹", name: "archers", rural: 0.12, urban: 0.2, crew: 1, power: 1, type: "ranged", separate: 0},
      {icon: "🐴", name: "cavalry", rural: 0.12, urban: 0.03, crew: 2, power: 2, type: "mounted", separate: 0},
      {icon: "💣", name: "artillery", rural: 0, urban: 0.03, crew: 8, power: 12, type: "machinery", separate: 0},
      {icon: "🌊", name: "fleet", rural: 0, urban: 0.015, crew: 100, power: 50, type: "naval", separate: 1}
    ];
  };

  const drawRegiments = function (regiments, s) {
    const size = +armies.attr("box-size");
    const w = d => (d.n ? size * 4 : size * 6);
    const h = size * 2;
    const x = d => rn(d.x - w(d) / 2, 2);
    const y = d => rn(d.y - size, 2);

    const baseColor = pack.states[s].color[0] === "#" ? pack.states[s].color : "#999";
    const darkerColor = d3.color(baseColor).darker().hex();
    const army = armies
      .append("g")
      .attr("id", "army" + s)
      .attr("fill", baseColor)
      .attr("color", darkerColor);

    const g = army
      .selectAll("g")
      .data(regiments)
      .enter()
      .append("g")
      .attr("id", d => "regiment" + s + "-" + d.i)
      .attr("data-name", d => d.name)
      .attr("data-state", s)
      .attr("data-id", d => d.i);
    g.append("rect")
      .attr("x", d => x(d))
      .attr("y", d => y(d))
      .attr("width", d => w(d))
      .attr("height", h);
    g.append("text")
      .attr("x", d => d.x)
      .attr("y", d => d.y)
      .text(d => getTotal(d));
    g.append("rect")
      .attr("fill", "currentColor")
      .attr("x", d => x(d) - h)
      .attr("y", d => y(d))
      .attr("width", h)
      .attr("height", h);
    g.append("text")
      .attr("class", "regimentIcon")
      .attr("x", d => x(d) - size)
      .attr("y", d => d.y)
      .text(d => d.icon);
  };

  const drawRegiment = function (reg, stateId) {
    const size = +armies.attr("box-size");
    const w = reg.n ? size * 4 : size * 6;
    const h = size * 2;
    const x1 = rn(reg.x - w / 2, 2);
    const y1 = rn(reg.y - size, 2);

    let army = armies.select("g#army" + stateId);
    if (!army.size()) {
      const baseColor = pack.states[stateId].color[0] === "#" ? pack.states[stateId].color : "#999";
      const darkerColor = d3.color(baseColor).darker().hex();
      army = armies
        .append("g")
        .attr("id", "army" + stateId)
        .attr("fill", baseColor)
        .attr("color", darkerColor);
    }

    const g = army
      .append("g")
      .attr("id", "regiment" + stateId + "-" + reg.i)
      .attr("data-name", reg.name)
      .attr("data-state", stateId)
      .attr("data-id", reg.i);
    g.append("rect").attr("x", x1).attr("y", y1).attr("width", w).attr("height", h);
    g.append("text").attr("x", reg.x).attr("y", reg.y).text(getTotal(reg));
    g.append("rect")
      .attr("fill", "currentColor")
      .attr("x", x1 - h)
      .attr("y", y1)
      .attr("width", h)
      .attr("height", h);
    g.append("text")
      .attr("class", "regimentIcon")
      .attr("x", x1 - size)
      .attr("y", reg.y)
      .text(reg.icon);
  };

  // move one regiment to another
  const moveRegiment = function (reg, x, y) {
    const el = armies.select("g#army" + reg.state).select("g#regiment" + reg.state + "-" + reg.i);
    if (!el.size()) return;

    const duration = Math.hypot(reg.x - x, reg.y - y) * 8;
    reg.x = x;
    reg.y = y;
    const size = +armies.attr("box-size");
    const w = reg.n ? size * 4 : size * 6;
    const h = size * 2;
    const x1 = x => rn(x - w / 2, 2);
    const y1 = y => rn(y - size, 2);

    const move = d3.transition().duration(duration).ease(d3.easeSinInOut);
    el.select("rect").transition(move).attr("x", x1(x)).attr("y", y1(y));
    el.select("text").transition(move).attr("x", x).attr("y", y);
    el.selectAll("rect:nth-of-type(2)")
      .transition(move)
      .attr("x", x1(x) - h)
      .attr("y", y1(y));
    el.select(".regimentIcon")
      .transition(move)
      .attr("x", x1(x) - size)
      .attr("y", y);
  };

  // utilize si function to make regiment total text fit regiment box
  const getTotal = reg => (reg.a > (reg.n ? 999 : 99999) ? si(reg.a) : reg.a);

  const getName = function (r, regiments) {
    const cells = pack.cells;
    const proper = r.n
      ? null
      : cells.province[r.cell] && pack.provinces[cells.province[r.cell]]
      ? pack.provinces[cells.province[r.cell]].name
      : cells.burg[r.cell] && pack.burgs[cells.burg[r.cell]]
      ? pack.burgs[cells.burg[r.cell]].name
      : null;
    const number = nth(regiments.filter(reg => reg.n === r.n && reg.i < r.i).length + 1);
    const form = r.n ? "Fleet" : "Regiment";
    return `${number}${proper ? ` (${proper}) ` : ` `}${form}`;
  };

  // get default regiment emblem
  const getEmblem = function (r) {
    if (!r.n && !Object.values(r.u).length) return "🔰"; // "Newbie" regiment without troops
    if (
      !r.n &&
      pack.states[r.state].form === "Monarchy" &&
      pack.cells.burg[r.cell] &&
      pack.burgs[pack.cells.burg[r.cell]].capital
    )
      return "👑"; // "Royal" regiment based in capital
    const mainUnit = Object.entries(r.u).sort((a, b) => b[1] - a[1])[0][0]; // unit with more troops in regiment
    const unit = options.military.find(u => u.name === mainUnit);
    return unit.icon;
  };

  const generateNote = function (r, s) {
    const cells = pack.cells;
    const base =
      cells.burg[r.cell] && pack.burgs[cells.burg[r.cell]]
        ? pack.burgs[cells.burg[r.cell]].name
        : cells.province[r.cell] && pack.provinces[cells.province[r.cell]]
        ? pack.provinces[cells.province[r.cell]].fullName
        : null;
    const station = base ? `${r.name} is ${r.n ? "based" : "stationed"} in ${base}. ` : "";

    const composition = r.a
      ? Object.keys(r.u)
          .map(t => `— ${t}: ${r.u[t]}`)
          .join("\r\n")
      : null;
    const troops = composition
      ? `\r\n\r\nRegiment composition in ${options.year} ${options.eraShort}:\r\n${composition}.`
      : "";

    const campaign = s.campaigns ? ra(s.campaigns) : null;
    const year = campaign ? rand(campaign.start, campaign.end) : gauss(options.year - 100, 150, 1, options.year - 6);
    const conflict = campaign ? ` during the ${campaign.name}` : "";
    const legend = `Regiment was formed in ${year} ${options.era}${conflict}. ${station}${troops}`;
    notes.push({id: `regiment${s.i}-${r.i}`, name: `${r.icon} ${r.name}`, legend});
  };

  return {
    generate,
    redraw,
    getDefaultOptions,
    getName,
    generateNote,
    drawRegiments,
    drawRegiment,
    moveRegiment,
    getTotal,
    getEmblem
  };
})();
