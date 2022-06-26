import {getPackPolygon} from "/src/utils/graphUtils";
import {rn, minmax} from "/src/utils/numberUtils";
import {rand} from "@/utils/probabilityUtils";

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

  // mbostock's poissonDiscSampler
  function* poissonDiscSampler(x0, y0, x1, y1, r, k = 3) {
    if (!(x1 >= x0) || !(y1 >= y0) || !(r > 0)) throw new Error();

    const width = x1 - x0;
    const height = y1 - y0;
    const r2 = r * r;
    const r2_3 = 3 * r2;
    const cellSize = r * Math.SQRT1_2;
    const gridWidth = Math.ceil(width / cellSize);
    const gridHeight = Math.ceil(height / cellSize);
    const grid = new Array(gridWidth * gridHeight);
    const queue = [];

    function far(x, y) {
      const i = (x / cellSize) | 0;
      const j = (y / cellSize) | 0;
      const i0 = Math.max(i - 2, 0);
      const j0 = Math.max(j - 2, 0);
      const i1 = Math.min(i + 3, gridWidth);
      const j1 = Math.min(j + 3, gridHeight);
      for (let j = j0; j < j1; ++j) {
        const o = j * gridWidth;
        for (let i = i0; i < i1; ++i) {
          const s = grid[o + i];
          if (s) {
            const dx = s[0] - x;
            const dy = s[1] - y;
            if (dx * dx + dy * dy < r2) return false;
          }
        }
      }
      return true;
    }

    function sample(x, y) {
      queue.push((grid[gridWidth * ((y / cellSize) | 0) + ((x / cellSize) | 0)] = [x, y]));
      return [x + x0, y + y0];
    }

    yield sample(width / 2, height / 2);

    pick: while (queue.length) {
      const i = (Math.random() * queue.length) | 0;
      const parent = queue[i];

      for (let j = 0; j < k; ++j) {
        const a = 2 * Math.PI * Math.random();
        const r = Math.sqrt(Math.random() * r2_3 + r2);
        const x = parent[0] + r * Math.cos(a);
        const y = parent[1] + r * Math.sin(a);
        if (0 <= x && x < width && 0 <= y && y < height && far(x, y)) {
          yield sample(x, y);
          continue pick;
        }
      }

      const r = queue.pop();
      if (i < queue.length) queue[i] = r;
    }
  }

  return ReliefIcons;
})();
