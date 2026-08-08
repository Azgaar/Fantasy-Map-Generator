import { AppState } from "../state/store";
import { BIOME_COLORS } from "../simulation/biomes/biomes-generator";
import { GOODS } from "../simulation/civilization/goods-generator";
import { meander } from "./meander";

const STATE_COLORS = [
  "#2563eb", "#16a34a", "#ca8a04", "#d97706", "#dc2626",
  "#7c3aed", "#0891b2", "#db2777", "#4f46e5", "#0d9488"
];

const CULTURE_COLORS = [
  "#e11d48", "#2563eb", "#16a34a", "#ca8a04", "#9333ea",
  "#0891b2", "#ea580c", "#db2777", "#4f46e5", "#65a30d"
];

const PROVINCE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#6366f1", "#14b8a6", "#f43f5e"
];

const RELIGION_COLORS = [
  "#f43f5e", "#06b6d4", "#eab308", "#a855f7", "#10b981",
  "#f97316", "#3b82f6", "#64748b", "#ec4899", "#14b8a6"
];

function getHeightColor(h: number): string {
  if (h < 20) {
    const ratio = h / 20;
    const blue = Math.round(50 + ratio * 150);
    return `rgb(20, 40, ${blue})`;
  } else {
    const ratio = (h - 20) / 80;
    if (ratio < 0.4) {
      const green = Math.round(120 + ratio * 100);
      const red = Math.round(60 + ratio * 80);
      return `rgb(${red}, ${green}, 40)`;
    } else if (ratio < 0.8) {
      const red = Math.round(140 + (ratio - 0.4) * 80);
      const green = Math.round(120 + (ratio - 0.4) * 80);
      return `rgb(${red}, ${green}, 80)`;
    } else {
      const val = Math.round(200 + (ratio - 0.8) * 275);
      const clamped = Math.min(val, 255);
      return `rgb(${clamped}, ${clamped}, ${clamped})`;
    }
  }
}

function getTempColor(t: number): string {
  const norm = (t + 15) / 45;
  const r = Math.round(minmax(norm * 255, 0, 255));
  const b = Math.round(minmax((1 - norm) * 255, 0, 255));
  return `rgb(${r}, 80, ${b})`;
}

// Convert Celsius temperature to Fahrenheit for original scale displays
export function celsiusToFahrenheit(c: number): number {
  return Number((c * 1.8 + 32).toFixed(1));
}

function getPrecColor(p: number): string {
  if (p === 0) return "#fbe79f";
  const norm = Math.min(p / 120, 1.0);
  const val = Math.round(250 - norm * 200);
  return `rgb(${val}, ${val}, 255)`;
}

function minmax(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function renderMap(
  canvas: HTMLCanvasElement,
  state: AppState & any,
  layerType: "heightmap" | "biomes" | "temp" | "prec" | "cultures" | "states" | "provinces" | "religions" | "goods"
) {
  const ctx = canvas.getContext("2d");
  if (!ctx || !state.grid) return;

  const { grid, heights, biomes, temp, prec, flowDirections, rivers, cellCultures, cellStates, cellProvinces, cellReligions, cellGoods, burgs, routes, military, zones, markers, labels } = state;
  const pointsN = grid.points.length;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Draw cells
  for (let i = 0; i < pointsN; i++) {
    const vertices = grid.cells.v[i];
    if (!vertices || vertices.length === 0) continue;

    ctx.beginPath();
    const firstV = grid.vertices.p[vertices[0]];
    if (!firstV) continue;
    ctx.moveTo(firstV[0], firstV[1]);

    for (let j = 1; j < vertices.length; j++) {
      const v = grid.vertices.p[vertices[j]];
      if (v) ctx.lineTo(v[0], v[1]);
    }
    ctx.closePath();

    let color = "#333";
    if (layerType === "heightmap" && heights) {
      color = getHeightColor(heights[i]);
    } else if (layerType === "biomes" && biomes) {
      color = BIOME_COLORS[biomes[i]] || "#333";
    } else if (layerType === "temp" && temp) {
      color = getTempColor(temp[i]);
    } else if (layerType === "prec" && prec) {
      color = getPrecColor(prec[i]);
    } else if (layerType === "cultures" && cellCultures && heights) {
      const cultId = cellCultures[i];
      color = heights[i] < 20 ? getHeightColor(heights[i]) :
        (cultId > 0 ? CULTURE_COLORS[(cultId - 1) % CULTURE_COLORS.length] : "#555");
    } else if (layerType === "states" && cellStates && heights) {
      const stateId = cellStates[i];
      color = heights[i] < 20 ? getHeightColor(heights[i]) :
        (stateId > 0 ? STATE_COLORS[(stateId - 1) % STATE_COLORS.length] : "#555");
    } else if (layerType === "provinces" && cellProvinces && heights) {
      const provId = cellProvinces[i];
      color = heights[i] < 20 ? getHeightColor(heights[i]) :
        (provId > 0 ? PROVINCE_COLORS[(provId - 1) % PROVINCE_COLORS.length] : "#555");
    } else if (layerType === "religions" && cellReligions && heights) {
      const relId = cellReligions[i];
      color = heights[i] < 20 ? getHeightColor(heights[i]) :
        (relId > 0 ? RELIGION_COLORS[(relId - 1) % RELIGION_COLORS.length] : "#555");
    } else if (layerType === "goods" && cellGoods && heights) {
      const goodId = cellGoods[i];
      color = heights[i] < 20 ? getHeightColor(heights[i]) :
        (goodId > 0 ? GOODS[goodId].color : "#555");
    }

    ctx.fillStyle = color;
    ctx.fill();

    ctx.strokeStyle = "rgba(0, 0, 0, 0.05)";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // 2. Draw rivers
  if (rivers && flowDirections && layerType !== "cultures" && layerType !== "states" && layerType !== "provinces" && layerType !== "religions" && layerType !== "goods") {
    ctx.strokeStyle = "#466eab";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const headwaters = new Uint8Array(pointsN).fill(1);
    for (let i = 0; i < pointsN; i++) {
      const next = flowDirections[i];
      if (next !== -1) {
        headwaters[next] = 0;
      }
    }

    for (let i = 0; i < pointsN; i++) {
      if (rivers[i] > 0 && headwaters[i] === 1) {
        const chain: [number, number][] = [];
        let curr: number = i;
        while (curr !== -1 && rivers[curr] > 0) {
          chain.push(grid.points[curr]);
          curr = flowDirections[curr];
          if (curr !== -1 && heights[curr] < 20) {
            chain.push(grid.points[curr]);
            break;
          }
        }

        if (chain.length >= 2) {
          const meandered = meander(chain, { meandering: 0.5 });
          const fluxVal = state.flux ? state.flux[i] || 10 : 10;
          ctx.lineWidth = minmax(Math.sqrt(fluxVal) * 0.15, 0.5, 6.0);
          ctx.beginPath();
          ctx.moveTo(meandered[0][0], meandered[0][1]);
          for (let j = 1; j < meandered.length; j++) {
            ctx.lineTo(meandered[j][0], meandered[j][1]);
          }
          ctx.stroke();
        }
      }
    }
  }

  // 3. Draw zones
  if (zones && layerType !== "goods") {
    for (const z of zones) {
      ctx.fillStyle = z.color;
      for (const cellId of z.cells) {
        const vertices = grid.cells.v[cellId];
        if (!vertices) continue;
        ctx.beginPath();
        const firstV = grid.vertices.p[vertices[0]];
        if (!firstV) continue;
        ctx.moveTo(firstV[0], firstV[1]);
        for (let j = 1; j < vertices.length; j++) {
          const v = grid.vertices.p[vertices[j]];
          if (v) ctx.lineTo(v[0], v[1]);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // 4. Draw routes
  if (routes) {
    for (const r of routes) {
      if (r.type === "road") {
        ctx.strokeStyle = "rgba(141, 110, 99, 0.85)";
        ctx.lineWidth = 1.8;
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = "rgba(33, 150, 243, 0.6)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
      }
      ctx.beginPath();
      const firstPt = grid.points[r.path[0]];
      ctx.moveTo(firstPt[0], firstPt[1]);
      for (let k = 1; k < r.path.length; k++) {
        const pt = grid.points[r.path[k]];
        ctx.lineTo(pt[0], pt[1]);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // 5. Draw burgs
  if (burgs) {
    for (const b of burgs) {
      const radius = b.isCapital ? 6.0 : 4.0;
      ctx.fillStyle = b.isCapital ? "#ef4444" : "#ffffff";
      ctx.strokeStyle = "#1e1e24";
      ctx.lineWidth = 2.0;

      ctx.beginPath();
      ctx.arc(b.x, b.y, radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${b.isCapital ? 12 : 10}px 'Outfit', 'Inter', sans-serif`;
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 4;
      ctx.fillText(b.name, b.x + radius + 3, b.y + 4);
      ctx.shadowBlur = 0;
    }
  }

  // 6. Draw military units
  if (military) {
    for (const m of military) {
      const pt = grid.points[m.cell];
      if (!pt) continue;
      const [mx, my] = pt;
      const shieldColor = STATE_COLORS[(m.stateId - 1) % STATE_COLORS.length] || "#888";
      ctx.fillStyle = shieldColor;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.fillRect(mx - 8, my - 24, 16, 16);
      ctx.strokeRect(mx - 8, my - 24, 16, 16);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(mx - 8, my - 24);
      ctx.lineTo(mx - 8, my - 8);
      ctx.stroke();
      const letter = m.type[0].toUpperCase();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px 'Outfit', 'Inter', sans-serif";
      ctx.fillText(letter, mx - 3, my - 12);
    }
  }

  // 7. Draw markers
  if (markers) {
    for (const mk of markers) {
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1.0;
      if (mk.type === "volcano") {
        ctx.fillStyle = "#f87171";
        ctx.beginPath();
        ctx.moveTo(mk.x, mk.y - 7);
        ctx.lineTo(mk.x + 6, mk.y + 5);
        ctx.lineTo(mk.x - 6, mk.y + 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = "#fbbf24";
        ctx.fillRect(mk.x - 5, mk.y - 5, 10, 10);
        ctx.strokeRect(mk.x - 5, mk.y - 5, 10, 10);
      }
    }
  }

  // 8. Draw custom placed text labels
  if (labels) {
    for (const l of labels) {
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate((l.rotation * Math.PI) / 180);
      
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${l.size}px 'Outfit', 'Inter', sans-serif`;
      ctx.textAlign = "center";
      
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 4;
      ctx.fillText(l.text, 0, 0);
      
      ctx.restore();
    }
  }
}
