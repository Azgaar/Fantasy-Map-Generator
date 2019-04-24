(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global.BurgsAndStates = factory());
}(this, (function () { 'use strict';

  const generate = function() {
    console.time("generateBurgsAndStates");

    const cells = pack.cells, vertices = pack.vertices, features = pack.features, cultures = pack.cultures, n = cells.i.length;

    cells.burg = new Uint16Array(n); // cell burg
    cells.road = new Uint16Array(n); // cell road power

    const burgs = pack.burgs = placeCapitals();
    pack.states = createStates();
    const capitalRoutes = Routes.getRoads();

    placeTowns();
    const townRoutes = Routes.getTrails();
    specifyBurgs();
    const oceanRoutes = Routes.getSearoutes();

    expandStates();
    normalizeStates();

    Routes.draw(capitalRoutes, townRoutes, oceanRoutes);
    drawBurgsWithLabels();

    function placeCapitals() {
      console.time('placeCapitals');
      let count = +regionsInput.value;
      let burgs = [0];

      const score = new Int16Array(cells.s.map(s => s * Math.random())); // cell score for capitals placement
      const sorted = cells.i.filter(i => score[i] > 0 && cells.culture[i]).sort((a, b) => score[b] - score[a]); // filtered and sorted array of indexes

      if (sorted.length < count * 10) {
        count = Math.floor(sorted.length / 10);
        if (!count) {
          console.error(`There is no populated cells. Cannot generate states`);
          return burgs;
        } else {
          console.error(`Not enought populated cells (${sorted.length}). Will generate only ${count} states`);      
        }
      }      

      let burgsTree = d3.quadtree();
      let spacing = (graphWidth + graphHeight) / 2 / count; // min distance between capitals

      for (let i = 0; burgs.length <= count; i++) {
        const cell = sorted[i], x = cells.p[cell][0], y = cells.p[cell][1];

        if (burgsTree.find(x, y, spacing) === undefined) {
          burgs.push({cell, x, y});
          burgsTree.add([x, y]);
        }

        if (i === sorted.length - 1) {
          console.error("Cannot place capitals with current spacing. Trying again with reduced spacing");
          burgsTree = d3.quadtree();
          i = -1, burgs = [0], spacing /= 1.2;
        }
      }

      burgs[0] = burgsTree;
      console.timeEnd('placeCapitals');
      return burgs;
    }

    // For each capital create a state
    function createStates() {
      console.time('createStates');
      const states = [{i:0, name: "Neutrals"}];
      const colors = getColors(burgs.length-1);

      burgs.forEach(function(b, i) {
        if (!i) return; // skip first element

        // burgs data
        b.i = b.state = i;
        b.culture = cells.culture[b.cell];
        const base = cultures[b.culture].base; 
        const min = nameBases[base].min-1;
        const max = Math.max(nameBases[base].max-2, min);
        b.name = Names.getCulture(b.culture, min, max, "", 0);
        b.feature = cells.f[b.cell];
        b.capital = true;

        // states data
        const expansionism = rn(Math.random() * powerInput.value / 2 + 1, 1);
        const basename = b.name.length < 9 && b.cell%5 === 0 ? b.name : Names.getCulture(b.culture, min, 6, "", 0);
        const name = Names.getState(basename, b.culture);
        const type = cultures[b.culture].type;
        states.push({i, color: colors[i-1], name, expansionism, capital: i, type, center: b.cell, culture: b.culture});
        cells.burg[b.cell] = i;
      });
      
      console.timeEnd('createStates');
      return states;
    }

    // place secondary settlements based on geo and economical evaluation
    function placeTowns() {
      console.time('placeTowns');
      const score = new Int16Array(cells.s.map(s => s * Math.random())); // cell score for towns placement
      const sorted = cells.i.filter(i => score[i] > 0 && cells.culture[i]).sort((a, b) => score[b] - score[a]); // filtered and sorted array of indexes

      // burgs number depends on ratio between populated and all cells and burgsDensity input (expected mean ~300))
      const burgsCount = rn(sorted.length / grid.points.length * manorsInput.value * 1000);
      const spacing = (graphWidth + graphHeight) * 9 / burgsCount; // base min distance between towns
      const burgsTree = burgs[0];

      for (let i = 0; burgs.length <= burgsCount && i < sorted.length; i++) {
        const id = sorted[i], x = cells.p[id][0], y = cells.p[id][1];
        const s = spacing * Math.random() + 0.5; // randomize to make the placement not uniform
        if (burgsTree.find(x, y, s) !== undefined) continue; // to close to existing burg
        const burg = burgs.length;
        const culture = cells.culture[id];
        const name = Names.getCulture(culture);
        const feature = cells.f[id];
        burgs.push({cell: id, x, y, state: 0, i: burg, culture, name, capital: false, feature});
        burgsTree.add([x, y]);
        cells.burg[id] = burg;
      }

      if (burgs.length <= burgsCount) console.error(`Cannot place all burgs. Requested ${burgsCount}, placed ${burgs.length-1}`);

      //const min = d3.min(score.filter(s => s)), max = d3.max(score);
      //terrs.selectAll("polygon").data(sorted).enter().append("polygon").attr("points", d => getPackPolygon(d)).attr("fill", d => color(1 - normalize(score[d], min, max)));  
      //labels.selectAll("text").data(sorted).enter().append("text").attr("x", d => cells.p[d][0]).attr("y", d => cells.p[d][1]).text(d => score[d]).attr("font-size", 2);

      burgs[0] = {name:undefined};
      console.timeEnd('placeTowns'); 
    }
     
    // define burg coordinates and define details
    function specifyBurgs() {
      console.time("specifyBurgs");

      for (const b of burgs) {
        if (!b.i) continue;
        const i = b.cell;

        // asign port status: capital with any harbor and towns with good harbors
        const port = (b.capital && cells.harbor[i]) || cells.harbor[i] === 1;
        b.port = port ? cells.f[cells.haven[i]] : 0; // port is defined by feature id it lays on

        // define burg population (keep urbanization at about 10% rate)
        b.population = rn(Math.max((cells.s[i] + cells.road[i]) / 3 + b.i / 1000 + i % 100 / 1000, .1), 3);
        if (b.capital) b.population = rn(b.population * 1.3, 3); // increase capital population

        if (port) {
          b.population = rn(b.population * 1.3, 3); // increase port population
          const e = cells.v[i].filter(v => vertices.c[v].some(c => c === cells.haven[i])); // vertices of common edge
          b.x = rn((vertices.p[e[0]][0] + vertices.p[e[1]][0]) / 2, 2);
          b.y = rn((vertices.p[e[0]][1] + vertices.p[e[1]][1]) / 2, 2);
          continue;
        }

        // shift burgs on rivers semi-randomly and just a bit
        if (cells.r[i]) {
          const shift = Math.min(cells.fl[i]/150, 1);
          if (i%2) b.x = rn(b.x + shift, 2); else b.x = rn(b.x - shift, 2);
          if (cells.r[i]%2) b.y = rn(b.y + shift, 2); else b.y = rn(b.y - shift, 2);
        }

      }
      
      // de-assign port status if it's the only one on feature
      for (const f of features) {
        if (!f.i || f.land) continue;
        const onFeature = burgs.filter(b => b.port === f.i);
        if (onFeature.length === 1) {
          onFeature[0].port = 0;
        }
      }

      console.timeEnd("specifyBurgs");
    }

    function drawBurgsWithLabels() {
      console.time("drawBurgs");
      
      // remove old data
      burgIcons.selectAll("circle").remove();
      burgLabels.selectAll("text").remove();
      icons.selectAll("use").remove();

      // capitals
      const capitals = burgs.filter(b => b.capital);
      const capitalIcons = burgIcons.select("#cities");
      const capitalLabels = burgLabels.select("#cities");   
      const capitalSize = capitalIcons.attr("size") || 1;
      const capitalAnchors = anchors.selectAll("#cities");
      const caSize = capitalAnchors.attr("size") || 2;

      capitalIcons.selectAll("circle").data(capitals).enter()
        .append("circle").attr("id", d => "burg"+d.i).attr("data-id", d => d.i)
        .attr("cx", d => d.x).attr("cy", d => d.y).attr("r", capitalSize);

      capitalLabels.selectAll("text").data(capitals).enter()
        .append("text").attr("id", d => "burgLabel"+d.i).attr("data-id", d => d.i)
        .attr("x", d => d.x).attr("y", d => d.y).attr("dy", `${capitalSize * -1.5}px`).text(d => d.name);
        
      capitalAnchors.selectAll("use").data(capitals.filter(c => c.port)).enter()
        .append("use").attr("xlink:href", "#icon-anchor").attr("data-id", d => d.i)
        .attr("x", d => rn(d.x - caSize * .47, 2)).attr("y", d => rn(d.y - caSize * .47, 2))
        .attr("width", caSize).attr("height", caSize); 

      // towns
      const towns = burgs.filter(b => b.capital === false);
      const townIcons = burgIcons.select("#towns");
      const townLabels = burgLabels.select("#towns");
      const townSize = townIcons.attr("size") || 0.5;
      const townsAnchors = anchors.selectAll("#towns");
      const taSize = townsAnchors.attr("size") || 1;

      townIcons.selectAll("circle").data(towns).enter()
        .append("circle").attr("id", d => "burg"+d.i).attr("data-id", d => d.i)
        .attr("cx", d => d.x).attr("cy", d => d.y).attr("r", townSize);

      townLabels.selectAll("text").data(towns).enter()
        .append("text").attr("id", d => "burgLabel"+d.i).attr("data-id", d => d.i)
        .attr("x", d => d.x).attr("y", d => d.y).attr("dy", `${townSize * -1.5}px`).text(d => d.name);

       townsAnchors.selectAll("use").data(towns.filter(c => c.port)).enter()
        .append("use").attr("xlink:href", "#icon-anchor").attr("data-id", d => d.i)
        .attr("x", d => rn(d.x - taSize * .47, 2)).attr("y", d => rn(d.y - taSize * .47, 2))
        .attr("width", taSize).attr("height", taSize);

      console.timeEnd("drawBurgs");
    }

    console.timeEnd("generateBurgsAndStates");
  }

  // growth algorithm to assign cells to states like we did for cultures
  const expandStates = function() {
    console.time("expandStates");
    const cells = pack.cells, states = pack.states, cultures = pack.cultures, burgs = pack.burgs;

    cells.state = new Uint8Array(cells.i.length); // cell state
    const queue = new PriorityQueue({comparator: (a, b) => a.p - b.p});
    const cost = [];
    states.filter(s => s.i && !s.removed).forEach(function(s) {
      cells.state[burgs[s.capital].cell] = s.i;
      const b = cells.biome[cultures[s.culture].center]; // native biome
      queue.queue({e:s.center, p:0, s:s.i, b}); 
      cost[s.center] = 1;
    });
    const neutral = cells.i.length / 5000 * 2000 * neutralInput.value * statesNeutral.value; // limit cost for state growth

    while (queue.length) {
      const next = queue.dequeue(), n = next.e, p = next.p, s = next.s, b = next.b;
      const type = states[s].type;

      cells.c[n].forEach(function(e) {
        const biome = cells.biome[e];
        const cultureCost = states[s].culture === cells.culture[e] ? 10 : 100;
        const biomeCost = getBiomeCost(cells.road[e], b, biome, type);
        const heightCost = getHeightCost(cells.h[e], type);
        const riverCost = getRiverCost(cells.r[e], e, type);
        const typeCost = getTypeCost(cells.t[e], type);
        const totalCost = p + (cultureCost + biomeCost + heightCost + riverCost + typeCost) / states[s].expansionism;

        if (totalCost > neutral) return;

        if (!cost[e] || totalCost < cost[e]) {
          if (cells.h[e] >= 20) {
            cells.state[e] = s; // assign state to cell
            if (cells.burg[e]) burgs[cells.burg[e]].state = s;
          }
          cost[e] = totalCost;
          queue.queue({e, p:totalCost, s, b});

          //const points = [cells.p[n][0], cells.p[n][1], (cells.p[n][0]+cells.p[e][0])/2, (cells.p[n][1]+cells.p[e][1])/2, cells.p[e][0], cells.p[e][1]];
          //debug.append("text").attr("x", (cells.p[n][0]+cells.p[e][0])/2 - 1).attr("y", (cells.p[n][1]+cells.p[e][1])/2 - 1).text(rn(totalCost-p)).attr("font-size", .8);
          //debug.append("polyline").attr("points", points).attr("marker-mid", "url(#arrow)").attr("opacity", .6);
        }
      });
      
    }

    //debug.selectAll(".text").data(cost).enter().append("text").attr("x", (d, e) => cells.p[e][0]-1).attr("y", (d, e) => cells.p[e][1]-1).text(d => d ? rn(d) : "").attr("font-size", 2);  

    function getBiomeCost(r, b, biome, type) {
      if (r > 5) return 0; // no penalty if there is a road;
      if (b === biome) return 10; // tiny penalty for native biome
      if (type === "Hunting") return biomesData.cost[biome] * 2; // non-native biome penalty for hunters
      if (type === "Nomadic" && biome > 4 && biome < 10) return biomesData.cost[biome] * 3; // forest biome penalty for nomads
      return biomesData.cost[biome]; // general non-native biome penalty
    }

    function getHeightCost(h, type) {
      if ((type === "Naval" || type === "Lake") && h < 20) return 200; // low sea crossing penalty for Navals
      if (type === "Nomadic" && h < 20) return 10000; // giant sea crossing penalty for Navals
      if (h < 20) return 1000; // general sea crossing penalty
      if (type === "Highland" && h < 50) return 30; // penalty for highlanders on lowlands
      if (type === "Highland") return 0; // no penalty for highlanders on highlands
      if (h >= 70) return 100; // general mountains crossing penalty
      if (h >= 50) return 30; // general hills crossing penalty
      return 0;
    }

    function getRiverCost(r, i, type) {
      if (type === "River") return r ? 0 : 50; // penalty for river cultures
      if (!r) return 0; // no penalty for others if there is no river 
      return Math.min(Math.max(cells.fl[i] / 10, 20), 100) // river penalty from 20 to 100 based on flux
    }

    function getTypeCost(ctype, type) {
      if (ctype === 1) return type === "Naval" || type === "Lake" ? 0 : type === "Nomadic" ? 60 : 20; // penalty for coastline
      if (ctype === 2) return type === "Naval" || type === "Nomadic" ? 30 : 0; // low penalty for land level 2 for Navals and nomads
      if (ctype !== -1) return type === "Naval" || type === "Lake" ? 100 : 0;  // penalty for mainland for navals
      return 0;
    }

    console.timeEnd("expandStates");
  }

  const normalizeStates = function() {
    console.time("normalizeStates");
    const cells = pack.cells;
    const burgs = pack.burgs;

    for (const i of cells.i) {
      if (cells.h[i] < 20) continue;
      const adversaries = cells.c[i].filter(c => cells.h[c] >= 20 && cells.state[c] !== cells.state[i]);
      const buddies = cells.c[i].filter(c => cells.h[c] >= 20 && cells.state[c] === cells.state[i]);
      if (adversaries.length <= buddies.length) continue;
      if (cells.c[i].some(c => burgs[cells.burg[c]].capital)) continue; // do not overwrite near capital
      if (burgs[cells.burg[i]].capital) continue; // do not overwrite capital
      const newState = cells.state[adversaries[0]];
      cells.state[i] = newState;
      if (cells.burg[i]) burgs[cells.burg[i]].state = newState;
    }
    console.timeEnd("normalizeStates");
  }

  // calculate and draw curved state labels
  const drawStateLabels = function() {
    console.time("drawStateLabels");
    const cells = pack.cells, features = pack.features, states = pack.states;
    const paths = []; // text paths
    lineGen.curve(d3.curveBundle.beta(1));

    for (const s of states) {
      if (!s.i || s.removed) continue;
      const used = [];
      const hull = getHull(s.center, s.i);
      const points = [...hull].map(v => pack.vertices.p[v]);

      //const poly = polylabel([points], 1.0); // pole of inaccessibility
      //debug.append("circle").attr("r", 3).attr("cx", poly[0]).attr("cy", poly[1]);

      const delaunay = Delaunator.from(points);
      const voronoi = Voronoi(delaunay, points, points.length);
      const c = voronoi.vertices;
      const chain = connectCenters(c, s.i);
      const relaxed = chain.map(i => c.p[i]).filter((p, i) => i%8 === 0 || i+1 === chain.length);
      paths.push([s.i, relaxed]);

      // if (s.i == 13) debug.selectAll(".circle").data(points).enter().append("circle").attr("cx", d => d[0]).attr("cy", d => d[1]).attr("r", .5).attr("fill", "red");
      // if (s.i == 13) d3.select("#cells").selectAll(".polygon").data(d3.range(voronoi.cells.v.length)).enter().append("polygon").attr("points", d => voronoi.cells.v[d] ? voronoi.cells.v[d].map(v => c.p[v]) : "");
      // if (s.i == 13) debug.append("path").attr("d", round(lineGen(relaxed))).attr("fill", "none").attr("stroke", "blue").attr("stroke-width", .5);
      // if (s.i == 13) debug.selectAll(".circle").data(chain).enter().append("circle").attr("cx", d => c.p[d][0]).attr("cy", d => c.p[d][1]).attr("r", 1);

      function getHull(start, state) {
        const queue = [start], hull = new Set();
  
        while (queue.length) {
          const q = queue.pop();
          const nQ = cells.c[q].filter(c => cells.state[c] === state);
          cells.c[q].forEach(function(c, d) {
            if (features[cells.f[c]].type === "lake" && features[cells.f[c]].cells < 10) return; // ignore small lakes
            if (cells.b[c]) {hull.add(cells.v[q][d]); return;}
            if (cells.state[c] !== state) {hull.add(cells.v[q][d]); return;}
            const nC = cells.c[c].filter(n => cells.state[n] === state);
            const intersected = intersect(nQ, nC).length
            if (hull.size > 20 && !intersected) {hull.add(cells.v[q][d]); return;}
            if (used[c]) return;
            used[c] = 1;
            queue.push(c);
          });
        }
  
        return hull;
      }

      function connectCenters(c, state) {
        // check if vertex is inside the area
        const inside = c.p.map(function(p) {
          if (p[0] <= 0 || p[1] <= 0 || p[0] >= graphWidth || p[1] >= graphHeight) return false; // out of the screen
          return used[findCell(p[0], p[1])];
        });
        //if (state == 13) debug.selectAll(".circle").data(c.p).enter().append("circle").attr("cx", d => d[0]).attr("cy", d => d[1]).attr("r", .5).attr("fill", (d, i) => inside[i] ? "green" : "blue");
  
        const sorted = d3.range(c.p.length).filter(i => inside[i]).sort((a, b) => c.p[a][0] - c.p[b][0]);
        const left = sorted[0] || 0, right = sorted.pop() || 0;

        // connect leftmost and rightmost points with shortest path
        const queue = new PriorityQueue({comparator: (a, b) => a.p - b.p});
        const cost = [], from = [];
        queue.queue({e: right, p: 0});
  
        while (queue.length) {
          const next = queue.dequeue(), n = next.e, p = next.p;
          if (n === left) break;
  
          for (const v of c.v[n]) {
            if (v === -1) continue;
            const totalCost = p + (inside[v] ? 1 : 100);
            if (from[v] || totalCost >= cost[v]) continue;
            cost[v] = totalCost;
            from[v] = n;
            queue.queue({e: v, p: totalCost});
          }
        }

        // restore path
        const chain = [left];
        let cur = left;
        while (cur !== right) {
          cur = from[cur];
          if (inside[cur]) chain.push(cur);
        }
        return chain;
      }

    }
   
    void function drawLabels() {
      const g = labels.select("#states"), p = defs.select("#textPaths");
      g.selectAll("text").remove();
      p.selectAll("path[id*='stateLabel']").remove();

      const data = paths.map(p => [round(lineGen(p[1])), "stateLabel"+p[0], states[p[0]].name, p[1]]);
      p.selectAll(".path").data(data).enter().append("path").attr("d", d => d[0]).attr("id", d => "textPath_"+d[1]);

      g.selectAll("text").data(data).enter()
        .append("text").attr("id", d => d[1])
        .append("textPath").attr("xlink:href", d => "#textPath_"+d[1])
        .attr("startOffset", "50%").text(d => d[2]);

      // resize label based on its length 
      g.selectAll("text").each(function(e) {
        const textPath = document.getElementById("textPath_"+e[1])
        const pathLength = textPath.getTotalLength();

        // if area is too small to get a path and length is 0
        if (pathLength === 0) {
          const x = e[3][0][0], y = e[3][0][1];
          textPath.setAttribute("d", `M${x-50},${y}h${100}`);
          this.firstChild.setAttribute("font-size", "60%");
          return;
        }

        const copy = g.append("text").text(this.textContent);
        const textLength = copy.node().getComputedTextLength();
        copy.remove();

        const size = Math.max(Math.min(rn(pathLength / textLength * 60), 175), 60);
        this.firstChild.setAttribute("font-size", size+"%");

        // prolongate textPath to not trim labels
        if (pathLength < 100) {
          const mod = 25 / pathLength;
          const points = e[3];
          const f = points[0], l = points[points.length-1];
          const dx = l[0] - f[0], dy = l[1] - f[1];
          points[0] = [rn(f[0] - dx * mod), rn(f[1] - dy * mod)];
          points[points.length-1] = [rn(l[0] + dx * mod), rn(l[1] + dy * mod)];
          textPath.setAttribute("d", round(lineGen(points)));
          //debug.append("path").attr("d", round(lineGen(points))).attr("fill", "none").attr("stroke", "red");
        }
        
      });
    }()

    console.timeEnd("drawStateLabels");
  }

  return {generate, expandStates, normalizeStates, drawStateLabels};

})));
