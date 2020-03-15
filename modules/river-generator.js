(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global.Rivers = factory());
}(this, (function () {'use strict';

  const generate = function(changeHeights = true) {
    console.time('generateRivers');
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
    features.forEach(f => {delete f.river; delete f.flux;});

    const riversData = []; // rivers data
    cells.fl = new Uint16Array(cells.i.length); // water flux array
    cells.r = new Uint16Array(cells.i.length); // rivers array
    cells.conf = new Uint8Array(cells.i.length); // confluences array
    let riverNext = 1; // first river id is 1, not 0

    void function drainWater() {
      const land = cells.i.filter(i => h[i] >= 20).sort((a,b) => h[b] - h[a]);
      land.forEach(function(i) {
        cells.fl[i] += grid.cells.prec[cells.g[i]]; // flux from precipitation
        const x = p[i][0], y = p[i][1];

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

        //const min = cells.c[i][d3.scan(cells.c[i], (a, b) => h[a] - h[b])]; // downhill cell
        let min = cells.c[i][d3.scan(cells.c[i], (a, b) => h[a] - h[b])]; // downhill cell

        // allow only one river can flow thought a lake
        const cf = features[cells.f[i]]; // current cell feature
        if (cf.river && cf.river !== cells.r[i]) {
          cells.fl[i] = 0;
        }

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

        if (cells.r[min]) { // downhill cell already has river assigned
          if (cells.fl[min] < cells.fl[i]) {
            cells.conf[min] = cells.fl[min]; // mark confluence
            if (h[min] >= 20) riversData.find(r => r.river === cells.r[min]).parent = cells.r[i]; // min river is a tributary of current river
            cells.r[min] = cells.r[i]; // re-assign river if downhill part has less flux
          } else {
            cells.conf[min] += cells.fl[i]; // mark confluence
            if (h[min] >= 20) riversData.find(r => r.river === cells.r[i]).parent = cells.r[min]; // current river is a tributary of min river
          }
        } else cells.r[min] = cells.r[i]; // assign the river to the downhill cell

        const nx = p[min][0], ny = p[min][1];
        if (h[min] < 20) {
          // pour water to the sea haven
          riversData.push({river: cells.r[i], cell: cells.haven[i], x: nx, y: ny});
        } else {
          const mf = features[cells.f[min]]; // feature of min cell
          if (mf.type === "lake") {
            if (!mf.river || cells.fl[i] > mf.flux) {
              mf.river = cells.r[i]; // pour water to temporaly elevated lake
              mf.flux = cells.fl[i]; // entering flux
            }
          }
          cells.fl[min] += cells.fl[i]; // propagate flux
          riversData.push({river: cells.r[i], cell: min, x: nx, y: ny}); // add next River segment
        }

      });
    }()

    void function defineRivers() {
      pack.rivers = []; // rivers data
      const riverPaths = []; // temporary data for all rivers

      for (let r = 1; r <= riverNext; r++) {
        const riverSegments = riversData.filter(d => d.river === r);

        if (riverSegments.length > 2) {
          const riverEnhanced = addMeandring(riverSegments);
          const width = rn(.8 + Math.random() * .4, 1); // river width modifier
          const increment = rn(.8 + Math.random() * .6, 1); // river bed widening modifier
          const [path, length] = getPath(riverEnhanced, width, increment);
          riverPaths.push([r, path, width, increment]);
          const source = riverSegments[0], mouth = riverSegments[riverSegments.length-2];
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

    console.timeEnd('generateRivers');
  }

  // depression filling algorithm (for a correct water flux modeling)
  const resolveDepressions = function(h) {
    const cells = pack.cells;
    const land = cells.i.filter(i => h[i] >= 20 && h[i] < 100 && !cells.b[i]); // exclude near-border cells
    land.sort((a,b) => h[b] - h[a]); // highest cells go first
    let depressed = false;

    for (let l = 0, depression = Infinity; depression && l < 100; l++) {
      depression = 0;
      for (const i of land) {
        const minHeight = d3.min(cells.c[i].map(c => h[c]));
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
    const riversToRemove = pack.rivers.filter(r => r.i === id || getBasin(r.i, r.parent, id) === id).map(r => r.i);
    riversToRemove.forEach(r => rivers.select("#river"+r).remove());
    pack.cells.r.forEach((r, i) => {
      if (r && riversToRemove.includes(r)) pack.cells.r[i] = 0;
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
