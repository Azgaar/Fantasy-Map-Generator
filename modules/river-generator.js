(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global.Rivers = factory());
}(this, (function () {'use strict';

  const generate = function(changeHeights = true) {
    TIME && console.time('generateRivers');
    Math.seedrandom(seed);
    const cells = pack.cells, p = cells.p, features = pack.features;

    // build distance field in cells from water (cells.t)
    void function markupLand() {
      const q = t => cells.i.filter(i => cells.t[i] === t);
      for (let t = 2, queue = q(t); queue.length; t++, queue = q(t)) {
        queue.forEach(i => cells.c[i].forEach(c => {
          if (!cells.t[c]) cells.t[c] = t+1;
        }));
      }
    }()

    // height with added t value to make map less depressed
    const h = Array.from(cells.h)
      .map((h, i) => h < 20 || cells.t[i] < 1 ? h : h + cells.t[i] / 100)
      .map((h, i) => h < 20 || cells.t[i] < 1 ? h : h + d3.mean(cells.c[i].map(c => cells.t[c])) / 10000);

    resolveDepressions(h);
    features.forEach(f => {delete f.river; delete f.flux; delete f.inlets});

    const riversData = []; // rivers data
    cells.fl = new Uint16Array(cells.i.length); // water flux array
    cells.r = new Uint16Array(cells.i.length); // rivers array
    cells.conf = new Uint8Array(cells.i.length); // confluences array
    let riverNext = 1; // first river id is 1, not 0

    void function drainWater() {
      const land = cells.i.filter(i => h[i] >= 20).sort((a,b) => h[b] - h[a]);
      const outlets = new Uint32Array(features.length);
      // enumerate lake outlet positions
      features.filter(f => f.type === "lake" && (f.group === "freshwater" || f.group === "frozen")).forEach(l => {
        let outlet = 0;
        if (l.shoreline) {
          outlet = l.shoreline[d3.scan(l.shoreline, (a,b) => h[a] - h[b])];
        } else { // in case it got missed or deleted
          WARN && console.warn('Re-scanning shoreline of a lake');
          const shallows = cells.i.filter(j => cells.t[j] === -1 && cells.f[j] === l.i);
          let shoreline = [];
          shallows.map(w => cells.c[w]).forEach(cList => cList.forEach(s => shoreline.push(s)));
          outlet = shoreline[d3.scan(shoreline, (a,b) => h[a] - h[b])];
        }
        outlets[l.i] = outlet;
        delete l.shoreline // cleanup temp data once used
      });

      const flowDown = function(min, mFlux, iFlux, ri, i = 0){
        if (cells.r[min]) { // downhill cell already has river assigned
          if (mFlux < iFlux) {
            cells.conf[min] = cells.fl[min]; // mark confluence
            if (h[min] >= 20) riversData.find(r => r.river === cells.r[min]).parent = ri; // min river is a tributary of current river
            cells.r[min] = ri; // re-assign river if downhill part has less flux
          } else {
            cells.conf[min] += iFlux; // mark confluence
            if (h[min] >= 20) riversData.find(r => r.river === ri).parent = cells.r[min]; // current river is a tributary of min river
          }
        } else cells.r[min] = ri; // assign the river to the downhill cell
        
        if (h[min] < 20) {
          // pour water to the sea haven
          const oh = i ? cells.haven[i] : min;
          riversData.push({river: ri, cell: oh, x: p[min][0], y: p[min][1]});
          const mf = features[cells.f[min]]; // feature of min cell
          if (mf.type === "lake") {
            if (!mf.river || iFlux > mf.flux) {
              mf.river = ri; // pour water to temporaly elevated lake
              mf.flux = iFlux; // entering flux
            }
            mf.totalFlux += iFlux;
            if (mf.inlets) {
              mf.inlets.push(ri);
            } else {
              mf.inlets = [ri];
            }
          }
        } else {
          cells.fl[min] += iFlux; // propagate flux
          riversData.push({river: ri, cell: min, x: p[min][0], y: p[min][1]}); // add next River segment
        }
      }

      land.forEach(function(i) {
        cells.fl[i] += grid.cells.prec[cells.g[i]]; // flux from precipitation
        const x = p[i][0], y = p[i][1];

        // lake outlets draw from lake
        let n = -1, out2 = 0;
        while (outlets.includes(i, n+1)) {
          n = outlets.indexOf(i, n+1);  
          const l = features[n];
          if ( ! l ) {continue;}
          const j = cells.haven[i];
          // allow chain lakes to retain identity
          if(cells.r[j] !== l.river) {
            let touch = false;
            for (const c of cells.c[j]){
              if (cells.r[c] === l.river) {
                touch = true;
                break;
              }
            }
            if (touch) {
              cells.r[j] = l.river;
              riversData.push({river: l.river, cell: j, x: p[j][0], y: p[j][1]});
            } else {
              cells.r[j] = riverNext;
              riversData.push({river: riverNext, cell: j, x: p[j][0], y: p[j][1]});
              riverNext++;
            }
          }
          cells.fl[j] = l.totalFlux; // signpost river size
          flowDown(i, cells.fl[i], l.totalFlux, cells.r[j]);
          // prevent dropping imediately back into the lake
          out2 = cells.c[i].filter(c => (h[c] >= 20 || cells.f[c] !== cells.f[j])).sort((a,b) => h[a] - h[b])[0]; // downhill cell not in the source lake
          // out2 = cells.c[i].filter(c => h[c] >= 20).sort((a,b) => h[a] - h[b])[0]; // downhill land cell
          // assign all to outlet basin
          if (l.inlets) l.inlets.forEach(fork => riversData.find(r => r.river === fork).parent = cells.r[j]);
        }

        // near-border cell: pour out of the screen
        if (cells.b[i]) {
          if (cells.r[i]) {
            const to = [];
            const min = Math.min(y, graphHeight - y, x, graphWidth - x);
            if (min === y) {to[0] = x; to[1] = 0;} else
            if (min === graphHeight - y) {to[0] = x; to[1] = graphHeight;} else
            if (min === x) {to[0] = 0; to[1] = y;} else
            if (min === graphWidth - x) {to[0] = graphWidth; to[1] = y;}
            riversData.push({river: cells.r[i], cell: i, x: to[0], y: to[1]});
          }
          return;
        }

        const min = out2 ? out2 : cells.c[i][d3.scan(cells.c[i], (a, b) => h[a] - h[b])]; // downhill cell
        // let min = cells.c[i][d3.scan(cells.c[i], (a, b) => h[a] - h[b])]; // downhill cell

        if (cells.fl[i] < 30) {
          if (h[min] >= 20) cells.fl[min] += cells.fl[i];
          return; // flux is too small to operate as river
        }

        // Proclaim a new river
        if (!cells.r[i]) {
          cells.r[i] = riverNext;
          riversData.push({river: riverNext, cell: i, x, y});
          riverNext++;
        }

        flowDown(min, cells.fl[min], cells.fl[i], cells.r[i], i);

      });
    }()

    void function defineRivers() {
      pack.rivers = []; // rivers data
      const riverPaths = []; // temporary data for all rivers

      for (let r = 1; r <= riverNext; r++) {
        const riverSegments = riversData.filter(d => d.river === r);

        if (riverSegments.length > 2) {
          const source = riverSegments[0], mouth = riverSegments[riverSegments.length-2];
          const riverEnhanced = addMeandring(riverSegments);
          let width = rn(.8 + Math.random() * .4, 1); // river width modifier [.2, 10]
          let increment = rn(.8 + Math.random() * .6, 1); // river bed widening modifier [.01, 3]
          if (cells.h[source.cell] < 20) { // is lake outflow
            const c = riverEnhanced[2][2] || 0; // widen the river by a pretend confluence
            const lakeSize = Math.min(pack.features[cells.f[source.cell]].totalFlux - 40, 0);
            // riverEnhanced[1][2] = c + Math.min(cells.fl[source.cell] - 40, 0);
            if(c) riverEnhanced[2][2] = c + lakeSize;
            else riverEnhanced[2].push(lakeSize);
          }
          const [path, length] = getPath(riverEnhanced, width, increment);
          riverPaths.push([r, path, width, increment]);
          const parent = source.parent || 0;
          pack.rivers.push({i:r, parent, length, source:source.cell, mouth:mouth.cell});
        } else {
          // remove too short rivers
          riverSegments.filter(s => cells.r[s.cell] === r).forEach(s => cells.r[s.cell] = 0);
        }
      }

      // drawRivers
      rivers.selectAll("path").remove();
      rivers.selectAll("path").data(riverPaths).enter()
        .append("path").attr("d", d => d[1]).attr("id", d => "river"+d[0])
        .attr("data-width", d => d[2]).attr("data-increment", d => d[3]);
    }()

    // apply change heights as basic one
    if (changeHeights) cells.h = Uint8Array.from(h);

    TIME && console.timeEnd('generateRivers');
  }

  // depression filling algorithm (for a correct water flux modeling)
  const resolveDepressions = function(h) {
    const cells = pack.cells;
    const land = cells.i.filter(i => h[i] >= 20 && h[i] < 100 && !cells.b[i]); // exclude near-border cells
    const lakes = pack.features.filter(f => f.type === "lake" && (f.group === "freshwater" || f.group === "frozen")); // to keep lakes flat
    lakes.forEach(l => {
      l.shoreline = [];
      l.height = 21;
      l.totalFlux = grid.cells.prec[cells.g[l.firstCell]];
    });
    for (let i of land.filter(i => cells.t[i] === 1)) { // select shoreline cells
      cells.c[i].map(c => pack.features[cells.f[c]]).forEach(cf => {
        if (lakes.includes(cf) && !cf.shoreline.includes(i)) {
          cf.shoreline.push(i);
        }
      })
    }
    land.sort((a,b) => h[b] - h[a]); // highest cells go first
    let depressed = false;

    for (let l = 0, depression = Infinity; depression && l < 100; l++) {
      depression = 0;
      for (const l of lakes) {
        const minHeight = d3.min(l.shoreline.map(s => h[s]));
        if (minHeight === 100) continue; // already max height
        if (l.height <= minHeight) {
          l.height = Math.min(minHeight + 1, 100);
          depression++;
          depressed = true;
        }
      }
      for (const i of land) {
        const minHeight = d3.min(cells.c[i].map(c => cells.t[c] > 0 ? h[c] : 
          pack.features[cells.f[c]].height || h[c] // NB undefined is falsy (a || b is short for a ? a : b)
          ));
        if (minHeight === 100) continue; // already max height
        if (h[i] <= minHeight) {
          h[i] = Math.min(minHeight + 1, 100);
          depression++;
          depressed = true;
        }
      }
    }

    return depressed;
  }

  // add more river points on 1/3 and 2/3 of length
  const addMeandring = function(segments, rndFactor = 0.3) {
    const riverEnhanced = []; // to store enhanced segments
    let side = 1; // to control meandring direction

    for (let s = 0; s < segments.length; s++) {
      const sX = segments[s].x, sY = segments[s].y; // segment start coordinates
      const c = pack.cells.conf[segments[s].cell] || 0; // if segment is river confluence
      riverEnhanced.push([sX, sY, c]);

      if (s+1 === segments.length) break; // do not enhance last segment

      const eX = segments[s+1].x, eY = segments[s+1].y; // segment end coordinates
      const angle = Math.atan2(eY - sY, eX - sX);
      const sin = Math.sin(angle), cos = Math.cos(angle);
      const serpentine = 1 / (s + 1) + 0.3;
      const meandr = serpentine + Math.random() * rndFactor;
      if (P(.5)) side *= -1; // change meandring direction in 50%
      const dist2 = (eX - sX) ** 2 + (eY - sY) ** 2;
      // if dist2 is big or river is small add extra points at 1/3 and 2/3 of segment
      if (dist2 > 64 || (dist2 > 16 && segments.length < 6)) {
        const p1x = (sX * 2 + eX) / 3 + side * -sin * meandr;
        const p1y = (sY * 2 + eY) / 3 + side * cos * meandr;
        if (P(.2)) side *= -1; // change 2nd extra point meandring direction in 20%
        const p2x = (sX + eX * 2) / 3 + side * sin * meandr;
        const p2y = (sY + eY * 2) / 3 + side * cos * meandr;
        riverEnhanced.push([p1x, p1y], [p2x, p2y]);
      // if dist is medium or river is small add 1 extra middlepoint
      } else if (dist2 > 16 || segments.length < 6) {
        const p1x = (sX + eX) / 2 + side * -sin * meandr;
        const p1y = (sY + eY) / 2 + side * cos * meandr;
        riverEnhanced.push([p1x, p1y]);
      }

    }
    return riverEnhanced;
  }

  const getPath = function(points, width = 1, increment = 1) {
    let offset, extraOffset = .1; // starting river width (to make river source visible)
    const riverLength = points.reduce((s, v, i, p) => s + (i ? Math.hypot(v[0] - p[i-1][0], v[1] - p[i-1][1]) : 0), 0); // summ of segments length
    const widening = rn((1000 + (riverLength * 30)) * increment);
    const riverPointsLeft = [], riverPointsRight = []; // store points on both sides to build a valid polygon
    const last = points.length - 1;
    const factor = riverLength / points.length;

    // first point
    let x = points[0][0], y = points[0][1], c;
    let angle = Math.atan2(y - points[1][1], x - points[1][0]);
    let sin = Math.sin(angle), cos = Math.cos(angle);
    let xLeft = x + -sin * extraOffset, yLeft = y + cos * extraOffset;
    riverPointsLeft.push([xLeft, yLeft]);
    let xRight = x + sin * extraOffset, yRight = y + -cos * extraOffset;
    riverPointsRight.unshift([xRight, yRight]);

    // middle points
    for (let p = 1; p < last; p++) {
      x = points[p][0], y = points[p][1], c = points[p][2] || 0;
      const xPrev = points[p-1][0], yPrev = points[p - 1][1];
      const xNext = points[p+1][0], yNext = points[p + 1][1];
      angle = Math.atan2(yPrev - yNext, xPrev - xNext);
      sin = Math.sin(angle), cos = Math.cos(angle);
      offset = (Math.atan(Math.pow(p * factor, 2) / widening) / 2 * width) + extraOffset;
      const confOffset = Math.atan(c * 5 / widening);
      extraOffset += confOffset;
      xLeft = x + -sin * offset, yLeft = y + cos * (offset + confOffset);
      riverPointsLeft.push([xLeft, yLeft]);
      xRight = x + sin * offset, yRight = y + -cos * offset;
      riverPointsRight.unshift([xRight, yRight]);
    }

    // end point
    x = points[last][0], y = points[last][1], c = points[last][2];
    if (c) extraOffset += Math.atan(c * 10 / widening); // add extra width on river confluence
    angle = Math.atan2(points[last-1][1] - y, points[last-1][0] - x);
    sin = Math.sin(angle), cos = Math.cos(angle);
    xLeft = x + -sin * offset, yLeft = y + cos * offset;
    riverPointsLeft.push([xLeft, yLeft]);
    xRight = x + sin * offset, yRight = y + -cos * offset;
    riverPointsRight.unshift([xRight, yRight]);

    // generate polygon path and return
    lineGen.curve(d3.curveCatmullRom.alpha(0.1));
    const right = lineGen(riverPointsRight);
    let left = lineGen(riverPointsLeft);
    left = left.substring(left.indexOf("C"));
    return [round(right + left, 2), rn(riverLength, 2)];
  }

  const specify = function() {
    if (!pack.rivers.length) return;
    Math.seedrandom(seed);
    const smallLength = pack.rivers.map(r => r.length||0).sort((a,b) => a-b)[Math.ceil(pack.rivers.length * .15)];
    const smallType = {"Creek":9, "River":3, "Brook":3, "Stream":1}; // weighted small river types

    for (const r of pack.rivers) {
      r.basin = getBasin(r.i, r.parent);
      r.name = getName(r.mouth);
      //debug.append("circle").attr("cx", pack.cells.p[r.mouth][0]).attr("cy", pack.cells.p[r.mouth][1]).attr("r", 2);
      const small = r.length < smallLength;
      r.type = r.parent && !(r.i%6) ? small ? "Branch" : "Fork" : small ? rw(smallType) : "River";
    }
  }

  const getName = function(cell) {
    return Names.getCulture(pack.cells.culture[cell]);
  }

  // remove river and all its tributaries
  const remove = function(id) {
    const cells = pack.cells;
    const riversToRemove = pack.rivers.filter(r => r.i === id || getBasin(r.i, r.parent, id) === id).map(r => r.i);
    riversToRemove.forEach(r => rivers.select("#river"+r).remove());
    cells.r.forEach((r, i) => {
      if (!r || !riversToRemove.includes(r)) return;
      cells.r[i] = 0;
      cells.fl[i] = grid.cells.prec[cells.g[i]];
      cells.conf[i] = 0;
    });
    pack.rivers = pack.rivers.filter(r => !riversToRemove.includes(r.i));
  }

  const getBasin = function(r, p, e) {
    while (p && r !== p && r !== e) {
      const parent = pack.rivers.find(r => r.i === p);
      if (!parent) return r;
      r = parent.i;
      p = parent.parent;
    }
    return r;
  }

  return {generate, resolveDepressions, addMeandring, getPath, specify, getName, getBasin, remove};

})));
