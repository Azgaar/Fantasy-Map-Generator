"use strict";

window.ReliefIcons = (function () {
  const ReliefIcons = function () {
    TIME && console.time("drawRelief");
    terrain.selectAll("*").remove();

    const cells = pack.cells;
    const density = terrain.attr("density") || 0.4;
    const size = 2 * (terrain.attr("size") || 1);
    const mod = 0.2 * size; // size modifier
    const relief = [];

    for (const i of cells.i) {
      const height = cells.h[i];
      if (height < 20) continue; // no icons on water
      if (cells.r[i]) continue; // no icons on rivers
      const biome = cells.biome[i];
      if (height < 50 && biomesData.iconsDensity[biome] === 0) continue; // no icons for this biome

      const polygon = getPackPolygon(i);
      const [minX, maxX] = d3.extent(polygon, p => p[0]);
      const [minY, maxY] = d3.extent(polygon, p => p[1]);

      if (height < 50) placeBiomeIcons(i, biome);
      else placeReliefIcons(i);

      function placeBiomeIcons() {
        const iconsDensity = biomesData.iconsDensity[biome] / 100;
        const radius = 2 / iconsDensity / density;
        if (Math.random() > iconsDensity * 10) return;

        for (const [cx, cy] of poissonDiscSampler(minX, minY, maxX, maxY, radius)) {
          if (!d3.polygonContains(polygon, [cx, cy])) continue;
          let h = (4 + Math.random()) * size;
          const icon = getBiomeIcon(i, biomesData.icons[biome]);
          if (icon === "#relief-grass-1") h *= 1.2;
          relief.push({i: icon, x: rn(cx - h, 2), y: rn(cy - h, 2), s: rn(h * 2, 2)});
        }
      }

      function placeReliefIcons(i) {
        const radius = 2 / density;
        const [icon, h] = getReliefIcon(i, height);

        for (const [cx, cy] of poissonDiscSampler(minX, minY, maxX, maxY, radius)) {
          if (!d3.polygonContains(polygon, [cx, cy])) continue;
          relief.push({i: icon, x: rn(cx - h, 2), y: rn(cy - h, 2), s: rn(h * 2, 2)});
        }
      }

      function getReliefIcon(i, h) {
        const temp = grid.cells.temp[pack.cells.g[i]];
        const type = h > 70 && temp < 0 ? "mountSnow" : h > 70 ? "mount" : "hill";
        const size = h > 70 ? (h - 45) * mod : minmax((h - 40) * mod, 3, 6);
        return [getIcon(type), size];
      }
    }

    // sort relief icons by y+size
    relief.sort((a, b) => a.y + a.s - (b.y + b.s));

    let reliefHTML = "";
    for (const r of relief) {
      reliefHTML += `<use href="${r.i}" x="${r.x}" y="${r.y}" width="${r.s}" height="${r.s}"/>`;
    }
    terrain.html(reliefHTML);

    TIME && console.timeEnd("drawRelief");
  };

  function getBiomeIcon(i, b) {
    let type = b[Math.floor(Math.random() * b.length)];
    const temp = grid.cells.temp[pack.cells.g[i]];
    if (type === "conifer" && temp < 0) type = "coniferSnow";
    return getIcon(type);
  }

  function getVariant(type) {
    switch (type) {
      case "mount":
        return rand(2, 7);
      case "mountSnow":
        return rand(1, 6);
      case "hill":
        return rand(2, 5);
      case "conifer":
        return 2;
      case "coniferSnow":
        return 1;
      case "swamp":
        return rand(2, 3);
      case "cactus":
        return rand(1, 3);
      case "deadTree":
        return rand(1, 2);
      default:
        return 2;
    }
  }

  function getOldIcon(type) {
    switch (type) {
      case "mountSnow":
        return "mount";
      case "vulcan":
        return "mount";
      case "coniferSnow":
        return "conifer";
      case "cactus":
        return "dune";
      case "deadTree":
        return "dune";
      default:
        return type;
    }
  }

  function getIcon(type) {
    const set = terrain.attr("set") || "simple";
    if (set === "simple") return "#relief-" + getOldIcon(type) + "-1";
    if (set === "colored") return "#relief-" + type + "-" + getVariant(type);
    if (set === "gray") return "#relief-" + type + "-" + getVariant(type) + "-bw";
    return "#relief-" + getOldIcon(type) + "-1"; // simple
  }

  return ReliefIcons;
})();
