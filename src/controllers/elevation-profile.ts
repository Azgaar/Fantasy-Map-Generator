// biome-ignore assist/source/organizeImports: sorting is wring
import {
  axisBottom,
  axisLeft,
  curveBundle,
  curveCatmullRom,
  curveLinear,
  curveMonotoneX,
  curveNatural,
  line,
  pointer,
  scaleLinear,
  select,
  type CurveFactory,
  type CurveFactoryLineOnly,
  type Selection,
} from "d3";
import type { Burg } from "../modules/burgs-generator";
import type { PackedGraphFeature } from "../modules/features";
import type { Province } from "../modules/provinces-generator";
import type { State } from "../modules/states-generator";
import { byId, rn } from "../utils";

export function open(
  cells: number[],
  routeLen: number,
  isRiver: boolean,
): void {
  closeDialogs("#elevationProfile, .stable");
  byId("epCurve")!.on("change", draw);
  byId("epSave")!.on("click", downloadCSV);
  byId("epSaveSVG")!.on("click", downloadSVG);
  byId("epSavePNG")!.on("click", downloadPNG);

  const firstCell = cells[0];
  const lastCell = cells.at(-1);
  if (firstCell === undefined || lastCell === undefined) {
    tip("Elevation profile: no data", true, "error");
    return;
  }

  // For rivers, remember the general slope direction to prevent rendering uphill flow
  let slope = 0;
  if (isRiver) {
    const firstH = pack.cells.h[firstCell];
    const lastH = pack.cells.h[lastCell];
    if (firstH < lastH) slope = 1;
    else if (firstH > lastH) slope = -1;
  }

  const chartWidth = window.innerWidth - 400;
  const chartHeight = 300;
  const xOffset = 80;
  const yOffset = 2;
  const biomesHeight = 10;

  interface ChartData {
    biome: number[];
    burg: number[];
    cell: number[];
    height: number[];
    mi: number;
    ma: number;
    mih: number;
    mah: number;
    points: [number, number][];
  }

  // Pre-process all cell data into chartData arrays
  const chartData: ChartData = {
    biome: [],
    burg: [],
    cell: [],
    height: [],
    mi: 1e6,
    ma: 0,
    mih: 100,
    mah: 0,
    points: [],
  };

  let totalAscent = 0;
  let totalDescent = 0;
  let lastBurgIndex = 0;
  let lastBurgCell = 0;

  for (let i = 0, prevB = 0, prevH = -1; i < cells.length; i++) {
    const cell = cells[i];
    let h = pack.cells.h[cell];

    if (h < 20) {
      const f = pack.features[pack.cells.f[cell]] as PackedGraphFeature;
      h = f.type === "lake" ? f.height : 20;
    }

    if (prevH !== -1 && isRiver) {
      if (slope === 1 && h < prevH) h = prevH;
      else if (slope === 0 && h !== prevH) h = prevH;
      else if (slope === -1 && h > prevH) h = prevH;
    }
    prevH = h;

    let b = pack.cells.burg[cell];
    if (b === prevB) b = 0;
    else prevB = b;
    if (b) {
      lastBurgIndex = i;
      lastBurgCell = cell;
    }

    chartData.biome[i] = pack.cells.biome[cell];
    chartData.burg[i] = b;
    chartData.cell[i] = cell;
    const sh = getHeight(h);
    chartData.height[i] = parseInt(sh, 10);
    chartData.mih = Math.min(chartData.mih, h);
    chartData.mah = Math.max(chartData.mah, h);
    chartData.mi = Math.min(chartData.mi, chartData.height[i]);
    chartData.ma = Math.max(chartData.ma, chartData.height[i]);
  }

  for (let i = 1; i < cells.length; i++) {
    const diff = chartData.height[i] - chartData.height[i - 1];
    if (diff > 0) totalAscent += diff;
    else totalDescent -= diff;
  }

  // Move last burg label to the final point if it falls right at the end
  if (
    lastBurgIndex !== 0 &&
    lastBurgCell === chartData.cell[cells.length - 1] &&
    lastBurgIndex < cells.length - 1
  ) {
    chartData.burg[cells.length - 1] = chartData.burg[lastBurgIndex];
    chartData.burg[lastBurgIndex] = 0;
  }

  draw();

  $("#elevationProfile").dialog({
    title: "Elevation profile",
    resizable: false,
    close: closeElevationProfile,
    position: {
      my: "center bottom",
      at: "center bottom-40px",
      of: "svg",
      collision: "fit",
    },
  });

  function draw(): void {
    chartData.points = [];

    const xscale = scaleLinear()
      .domain([0, cells.length - 1])
      .range([0, chartWidth]);
    const yscale = scaleLinear()
      .domain([0, chartData.ma * 1.1])
      .range([chartHeight, 0]);

    for (let i = 0; i < cells.length; i++) {
      chartData.points.push([
        xscale(i) + xOffset,
        yscale(chartData.height[i]) + yOffset,
      ]);
    }

    byId("elevationGraph")!.innerHTML = "";

    const chart = select("#elevationGraph")
      .append("svg")
      .attr("width", chartWidth + 120)
      .attr("height", chartHeight + yOffset + biomesHeight)
      .attr("id", "elevationSVG")
      .attr("class", "epbackground");

    const defs = chart.append("defs");

    // Arrowhead marker for burg label lines
    defs
      .append("marker")
      .attr("id", "arrowhead")
      .attr("orient", "auto")
      .attr("markerWidth", "2")
      .attr("markerHeight", "4")
      .attr("refX", "0.1")
      .attr("refY", "2")
      .append("path")
      .attr("d", "M0,0 V4 L2,2 Z")
      .attr("fill", "darkgray");

    // Terrain elevation gradient (top = peak colour, bottom = valley colour)
    const colors = getColorScheme("natural");
    const landGrad = defs
      .append("linearGradient")
      .attr("id", "landdef")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");

    if (chartData.mah === chartData.mih) {
      const c = getColor(chartData.mih, colors);
      landGrad
        .append("stop")
        .attr("offset", "0%")
        .attr("style", `stop-color:${c};stop-opacity:1`);
      landGrad
        .append("stop")
        .attr("offset", "100%")
        .attr("style", `stop-color:${c};stop-opacity:1`);
    } else {
      const steps = Math.min(20, chartData.mah - chartData.mih);
      for (let s = 0; s <= steps; s++) {
        const h = Math.round(
          chartData.mah - (s / steps) * (chartData.mah - chartData.mih),
        );
        landGrad
          .append("stop")
          .attr("offset", `${(s / steps) * 100}%`)
          .attr("style", `stop-color:${getColor(h, colors)};stop-opacity:1`);
      }
    }

    // Clip biome bar to chart bounds
    defs
      .append("clipPath")
      .attr("id", "epBiomesClip")
      .append("rect")
      .attr("x", xOffset)
      .attr("y", yOffset + chartHeight)
      .attr("width", chartWidth)
      .attr("height", biomesHeight);

    // Build the elevation curve using the selected interpolation
    const curveTypes: (CurveFactory | CurveFactoryLineOnly)[] = [
      curveLinear,
      curveBundle.beta(1),
      curveCatmullRom.alpha(0.5),
      curveMonotoneX,
      curveNatural,
    ];
    const epCurve = byId("epCurve") as HTMLSelectElement;
    const curveIndex = Math.min(epCurve.selectedIndex, curveTypes.length - 1);
    const lineFn = line<[number, number]>().curve(
      curveTypes[curveIndex] as CurveFactory,
    );

    // Land fill: curve + straight close along the bottom edge
    const pts = chartData.points;
    const lastX = pts[pts.length - 1][0];
    const baseY = yscale(0) + yOffset;
    const landPath =
      (lineFn(pts) ?? "") +
      ` L${lastX},${pts[pts.length - 1][1]}` +
      ` L${lastX},${baseY}` +
      ` L${xscale(0) + xOffset},${baseY}Z`;

    chart
      .append("g")
      .attr("id", "epland")
      .append("path")
      .attr("d", landPath)
      .attr("stroke", "none")
      .attr("fill", "url(#landdef)");

    // Profile outline stroke
    chart
      .append("g")
      .attr("id", "epline")
      .append("path")
      .attr("d", lineFn(pts.slice()) ?? "")
      .attr("stroke", "#5a3e28")
      .attr("stroke-width", 1.5)
      .attr("fill", "none");

    // Biome colour bar
    const hu = heightUnit.value;
    const biomesG = chart
      .append("g")
      .attr("id", "epbiomes")
      .attr("clip-path", "url(#epBiomesClip)");
    const tileWidth = xscale(1);

    for (let k = 0; k < pts.length; k++) {
      const cell = chartData.cell[k];
      const biome = chartData.biome[k];
      const province = pack.cells.province[cell];
      const burgId = chartData.burg[k];
      const pop =
        pack.cells.pop[cell] +
        (burgId
          ? ((pack.burgs[burgId] as Burg).population ?? 0) * urbanization
          : 0);
      const provinceName = province
        ? (pack.provinces[province] as Province).name
        : null;
      const stateName = (pack.states[pack.cells.state[cell]] as State).name;
      const religionName = (
        pack.religions[pack.cells.religion[cell]] as { name: string }
      ).name;
      const cultureName = (
        pack.cultures[pack.cells.culture[cell]] as { name: string }
      ).name;
      const dataTip = [
        biomesData.name[biome],
        provinceName,
        stateName,
        religionName,
        cultureName,
        `height: ${chartData.height[k]} ${hu}`,
        `population ${rn(pop * populationRate)}`,
      ]
        .filter(Boolean)
        .join(", ");

      biomesG
        .append("rect")
        .attr("x", pts[k][0])
        .attr("y", yOffset + chartHeight)
        .attr("width", tileWidth)
        .attr("height", biomesHeight)
        .attr("fill", biomesData.color[biome])
        .attr("stroke", biomesData.color[biome])
        .attr("data-tip", dataTip);
    }

    // Axes
    const xAxis = axisBottom(xscale)
      .ticks(10)
      .tickFormat(
        (d) =>
          `${rn((Number(d) / (pts.length - 1)) * routeLen)} ${distanceUnitInput.value}`,
      );
    const yAxis = axisLeft(yscale)
      .ticks(5)
      .tickFormat((d) => `${d} ${hu}`);

    chart
      .append("g")
      .attr("id", "epxaxis")
      .attr("transform", `translate(${xOffset},${chartHeight + yOffset + 20})`)
      .call(xAxis as any)
      .selectAll("text")
      .style("text-anchor", "center");

    chart
      .append("g")
      .attr("id", "epyaxis")
      .attr("transform", `translate(${xOffset - 10},${yOffset})`)
      .call(yAxis as any);

    // Grid lines
    const gridStyle = (
      g: Selection<SVGGElement, unknown, null, undefined>,
    ): void => {
      g.attr("stroke", "lightgrey")
        .attr("stroke-opacity", "0.2")
        .attr("stroke-width", "0.5");
      g.selectAll("path").attr("stroke-width", "0");
    };

    chart
      .append("g")
      .attr("id", "epxgrid")
      .attr("class", "epgrid")
      .attr("stroke-dasharray", "4 1")
      .attr("transform", `translate(${xOffset},${chartHeight + yOffset})`)
      .call(gridStyle as any);

    chart
      .append("g")
      .attr("id", "epygrid")
      .attr("class", "epgrid")
      .attr("stroke-dasharray", "4 1")
      .attr("transform", `translate(${xOffset},${yOffset})`)
      .call(gridStyle as any);

    // Burg labels anchored above their curve point with all-pairs overlap avoidance
    const labelsG = chart.append("g").attr("id", "epburglabels");
    const LABEL_GAP = 18; // px above the dot for the label baseline
    const MIN_LABEL_Y = 12; // topmost allowed y
    const LINE_HEIGHT = 14; // stacking increment
    const X_PROXIMITY = 70; // horizontal proximity threshold for stacking
    const placed: { lx: number; ly: number }[] = [];

    for (let k = 0; k < pts.length; k++) {
      if (!chartData.burg[k]) continue;
      const b = chartData.burg[k];
      const burg = pack.burgs[b] as Burg;
      const lx = pts[k][0];
      const ptY = pts[k][1];
      let ly = ptY - LABEL_GAP;

      // Push up until no vertical overlap with any nearby placed label
      let changed = true;
      while (changed) {
        changed = false;
        for (const p of placed) {
          if (
            Math.abs(lx - p.lx) < X_PROXIMITY &&
            Math.abs(ly - p.ly) < LINE_HEIGHT
          ) {
            const candidate = p.ly - LINE_HEIGHT;
            if (candidate < MIN_LABEL_Y) break;
            ly = candidate;
            changed = true;
            break;
          }
        }
      }
      ly = Math.max(MIN_LABEL_Y, ly);
      placed.push({ lx, ly });

      labelsG
        .append("text")
        .attr("id", `ep${b}`)
        .attr("class", "epburglabel")
        .attr("x", lx)
        .attr("y", ly)
        .attr("text-anchor", "middle")
        .attr("data-tip", `Focus on ${burg.name}`)
        .style("cursor", "pointer")
        .on("click", () => zoomTo(burg.x, burg.y, 8, 2000))
        .text(burg.name ?? "");

      if (ly + 4 < ptY - 4) {
        labelsG
          .append("path")
          .attr("d", `M${lx},${ly + 3}L${lx},${ptY - 3}`)
          .attr("stroke", "darkgray")
          .attr("stroke-width", "1")
          .attr("fill", "none")
          .attr("marker-end", "url(#arrowhead)");
      }
    }

    // Burg dots on the curve
    const dotsG = chart.append("g").attr("id", "epburgdots");
    for (let k = 0; k < pts.length; k++) {
      if (!chartData.burg[k]) continue;
      dotsG
        .append("circle")
        .attr("cx", pts[k][0])
        .attr("cy", pts[k][1])
        .attr("r", 4)
        .attr("fill", "white")
        .attr("stroke", "#333")
        .attr("stroke-width", 1.5);
    }

    // Stats line in the controls bar
    byId("epstats")!.textContent =
      `Elev: ${chartData.mi}\u2013${chartData.ma} ${heightUnit.value}\u2002\u2191\u202f${totalAscent}\u2002\u2193\u202f${totalDescent} ${heightUnit.value}`;

    // Crosshair + FMG tooltip on hover
    const crosshairG = chart
      .append("g")
      .attr("id", "epcrosshair")
      .style("pointer-events", "none");
    const vLine = crosshairG
      .append("line")
      .attr("x1", -200)
      .attr("x2", -200)
      .attr("y1", yOffset)
      .attr("y2", yOffset + chartHeight)
      .attr("stroke", "rgba(60,60,60,0.6)")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4 2");
    const hDot = crosshairG
      .append("circle")
      .attr("r", 4)
      .attr("cx", -200)
      .attr("cy", -200)
      .attr("fill", "white")
      .attr("stroke", "#333")
      .attr("stroke-width", 1.5);

    chart
      .append("rect")
      .attr("id", "epoverlay")
      .attr("x", xOffset)
      .attr("y", yOffset)
      .attr("width", chartWidth)
      .attr("height", chartHeight)
      .attr("fill", "transparent")
      .style("cursor", "crosshair")
      .on("mousemove", (event: MouseEvent) => {
        const [mx] = pointer(event);
        const idx = Math.max(
          0,
          Math.min(
            cells.length - 1,
            Math.round(((mx - xOffset) / chartWidth) * (cells.length - 1)),
          ),
        );
        const pt = pts[idx];
        if (!pt) return;
        vLine.attr("x1", pt[0]).attr("x2", pt[0]);
        hDot.attr("cx", pt[0]).attr("cy", pt[1]);
        const dist = rn((idx / Math.max(1, cells.length - 1)) * routeLen);
        const burgId = chartData.burg[idx];
        tip(
          [
            `${dist} ${distanceUnitInput.value} from start`,
            `Elevation: ${chartData.height[idx]} ${heightUnit.value}`,
            biomesData.name[chartData.biome[idx]],
            burgId ? ((pack.burgs[burgId] as Burg).name ?? null) : null,
          ]
            .filter(Boolean)
            .join(". "),
        );
      })
      .on("mouseleave", () => {
        vLine.attr("x1", -200).attr("x2", -200);
        hDot.attr("cx", -200).attr("cy", -200);
        tip("");
      });
  }

  function downloadCSV(): void {
    const headers =
      "Id,x,y,lat,lon,Cell,Height,Height value,Population,Burg,Burg population,Biome,Biome color,Culture,Culture color,Religion,Religion color,Province,Province color,State,State color\n";
    const rows = chartData.points.map((_, k) => {
      const cell = chartData.cell[k];
      const [x, y] = pack.cells.p[cells[k]];
      const h = pack.cells.h[cell];
      const burgId = pack.cells.burg[cell];
      const pop = pack.cells.pop[cell];
      const burg = burgId ? (pack.burgs[burgId] as Burg) : null;
      const burgPop = burg
        ? (burg.population ?? 0) * populationRate * urbanization
        : 0;
      const culture = pack.cultures[pack.cells.culture[cell]] as {
        name: string;
        color: string;
      };
      const religion = pack.religions[pack.cells.religion[cell]] as {
        name: string;
        color: string;
      };
      const province = pack.provinces[pack.cells.province[cell]] as
        | Province
        | 0;
      const state = pack.states[pack.cells.state[cell]] as State;
      return [
        k + 1,
        x,
        y,
        getLatitude(y, 2),
        getLongitude(x, 2),
        cell,
        getHeight(h),
        h,
        rn(pop * populationRate),
        burg?.name ?? "",
        burgPop,
        biomesData.name[pack.cells.biome[cell]],
        biomesData.color[pack.cells.biome[cell]],
        culture.name,
        culture.color,
        religion.name,
        religion.color,
        province ? province.name : "",
        province ? province.color : "",
        state.name,
        (state as State & { color: string }).color,
      ].join(",");
    });
    downloadFile(
      `${headers}${rows.join("\n")}`,
      `${getFileName("elevation profile")}.csv`,
    );
  }

  function downloadSVG(): void {
    const svgEl = byId("elevationSVG")!;
    const svgStr = `<?xml version="1.0" encoding="utf-8"?>\n${new XMLSerializer().serializeToString(svgEl)}`;
    downloadFile(svgStr, `${getFileName("elevation profile")}.svg`);
  }

  function downloadPNG(): void {
    const svgEl = byId("elevationSVG")!;
    const w = +svgEl.getAttribute("width")!;
    const h = +svgEl.getAttribute("height")!;
    const svgUrl = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(svgEl)], {
        type: "image/svg+xml;charset=utf-8",
      }),
    );
    const canvas = Object.assign(document.createElement("canvas"), {
      width: w,
      height: h,
    });
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(svgUrl);
      canvas.toBlob((pngBlob) => {
        const a = Object.assign(document.createElement("a"), {
          href: URL.createObjectURL(pngBlob!),
          download: `${getFileName("elevation profile")}.png`,
        });
        a.click();
        URL.revokeObjectURL(a.href);
      });
    };
    img.src = svgUrl;
  }

  function closeElevationProfile(): void {
    byId("epCurve")!.off("change", draw);
    byId("epSave")!.off("click", downloadCSV);
    byId("epSaveSVG")!.off("click", downloadSVG);
    byId("epSavePNG")!.off("click", downloadPNG);
    byId("elevationGraph")!.innerHTML = "";
    modules.elevation = false;
  }
}

declare global {
  interface Window {
    ElevationProfile: {
      open: (cells: number[], routeLen: number, isRiver: boolean) => void;
    };
  }
}

window.ElevationProfile = { open };
