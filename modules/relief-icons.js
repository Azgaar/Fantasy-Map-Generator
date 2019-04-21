(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global.ReliefIcons = factory());
}(this, (function () {'use strict';

  var ReliefIcons = function ReliefIcons() {
    console.time('drawRelief');
    terrain.selectAll("*").remove();
    const density = +styleReliefDensityInput.value;
    if (!density) return;

    const size = 1.6, mod = .2 * size; // size modifier;s
    const relief = []; // t: type, c: cell, x: centerX, y: centerY, s: size;
    const cells = pack.cells;

    for (const i of cells.i) {
      const height = cells.h[i];
      if (height < 20) continue; // no icons on water
      if (cells.r[i]) continue; // no icons on rivers 
      const b = cells.biome[i];
      if (height < 50 && biomesData.iconsDensity[b] === 0) continue; // no icons for this biome
      const polygon = getPackPolygon(i);
      const x = d3.extent(polygon, p => p[0]), y = d3.extent(polygon, p => p[1]);
      const e = [Math.ceil(x[0]), Math.ceil(y[0]), Math.floor(x[1]), Math.floor(y[1])]; // polygon box

      if (height < 50) placeBiomeIcons(i, b); else placeReliefIcons(i);

      function placeBiomeIcons() {
        const iconsDensity = biomesData.iconsDensity[b] / 100;
        const radius = 2 / iconsDensity / density;
        if (Math.random() > iconsDensity * 10) return;

        for (const [cx, cy] of poissonDiscSampler(e[0], e[1], e[2], e[3], radius)) {
          if (!d3.polygonContains(polygon, [cx, cy])) continue;
          let h = rn((4 + Math.random()) * size, 2);
          const icon = getBiomeIcon(biomesData.icons[b]);
          if (icon === "#relief-grass-1") h *= 1.3;
          relief.push({t: icon, c: i, x: rn(cx-h, 2), y: rn(cy-h, 2), s: h*2});
        }
      }

      function placeReliefIcons() {
        const radius = 2 / density;
        const [icon, h] = getReliefIcon(height);
    
        for (const [cx, cy] of poissonDiscSampler(e[0], e[1], e[2], e[3], radius)) {
          if (!d3.polygonContains(polygon, [cx, cy])) continue;
          relief.push({t: icon, c: i, x: rn(cx-h, 2), y: rn(cy-h, 2), s: h*2});
        }
      }

      function getReliefIcon(h) {
        const type = h > 70 ? "mount" : "hill";
        const size = h > 70 ? (h - 45) * mod : Math.min(Math.max((h - 40) * mod, 3), 6);
        return ["#relief-" + type + "-1", size];
      }

    }

    // sort relief icons by y+size
    relief.sort((a, b) => (a.y + a.s) - (b.y + b.s));

    // append relief icons at once using pure js
    void function renderRelief() {
      let reliefHTML = "";
      for (const r of relief) {reliefHTML += `<use xlink:href="${r.t}" data-type="${r.t}" x=${r.x} y=${r.y} data-size=${r.s} width=${r.s} height=${r.s}></use>`;}
      terrain.html(reliefHTML);
    }()

    console.timeEnd('drawRelief');
  }
  
  function getBiomeIcon(i) {
    return "#relief-" + i[Math.floor(Math.random() * i.length)] + "-1";
  }
   
  return ReliefIcons;

})));