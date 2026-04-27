"use strict";

// data is an array of cell indexes, routeLen is the distance in map units, isRiver flags river profiles
function showElevationProfile(data, routeLen, isRiver) {
  closeDialogs("#elevationProfile, .stable");
  byId("epCurve").on("change", draw);
  byId("epSave").on("click", downloadCSV);
  byId("epSaveSVG").on("click", downloadSVG);
  byId("epSavePNG").on("click", downloadPNG);

  // For rivers, remember the general slope direction to prevent rendering uphill flow
  let slope = 0;
  if (isRiver) {
    const firstH = pack.cells.h[data.at(0)];
    const lastH = pack.cells.h[data.at(-1)];
    if (firstH < lastH) slope = 1;
    else if (firstH > lastH) slope = -1;
  }

  const chartWidth = window.innerWidth - 400;
  const chartHeight = 300;
  const xOffset = 80;
  const yOffset = 2;
  const biomesHeight = 10;

  // Pre-process all cell data into chartData arrays
  const chartData = {biome: [], burg: [], cell: [], height: [], mi: 1e6, ma: 0, mih: 100, mah: 0, points: []};
  let totalAscent = 0;
  let totalDescent = 0;
  let lastBurgIndex = 0;
  let lastBurgCell = 0;

  for (let i = 0, prevB = 0, prevH = -1; i < data.length; i++) {
    const cell = data[i];
    let h = pack.cells.h[cell];

    if (h < 20) {
      const f = pack.features[pack.cells.f[cell]];
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
    chartData.height[i] = parseInt(sh);
    chartData.mih = Math.min(chartData.mih, h);
    chartData.mah = Math.max(chartData.mah, h);
    chartData.mi = Math.min(chartData.mi, chartData.height[i]);
    chartData.ma = Math.max(chartData.ma, chartData.height[i]);
  }

  for (let i = 1; i < data.length; i++) {
    const diff = chartData.height[i] - chartData.height[i - 1];
    if (diff > 0) totalAscent += diff;
    else totalDescent -= diff;
  }

  // Move last burg label to the final point if it falls right at the end
  if (lastBurgIndex !== 0 && lastBurgCell === chartData.cell[data.length - 1] && lastBurgIndex < data.length - 1) {
    chartData.burg[data.length - 1] = chartData.burg[lastBurgIndex];
    chartData.burg[lastBurgIndex] = 0;
  }

  draw();

  $("#elevationProfile").dialog({
    title: "Elevation profile",
    resizable: false,
    close: closeElevationProfile,
    position: {my: "center bottom", at: "center bottom-40px", of: "svg", collision: "fit"}
  });

  function draw() {
    chartData.points = [];

    const xscale = d3
      .scaleLinear()
      .domain([0, data.length - 1])
      .range([0, chartWidth]);
    const yscale = d3
      .scaleLinear()
      .domain([0, chartData.ma * 1.1])
      .range([chartHeight, 0]);

    for (let i = 0; i < data.length; i++) {
      chartData.points.push([xscale(i) + xOffset, yscale(chartData.height[i]) + yOffset]);
    }

    byId("elevationGraph").innerHTML = "";

    const chart = d3
      .select("#elevationGraph")
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
      landGrad.append("stop").attr("offset", "0%").attr("style", `stop-color:${c};stop-opacity:1`);
      landGrad.append("stop").attr("offset", "100%").attr("style", `stop-color:${c};stop-opacity:1`);
    } else {
      const steps = Math.min(20, chartData.mah - chartData.mih);
      for (let s = 0; s <= steps; s++) {
        const h = Math.round(chartData.mah - (s / steps) * (chartData.mah - chartData.mih));
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
    const curveTypes = [
      d3.curveLinear,
      d3.curveBundle.beta(1),
      d3.curveCatmullRom.alpha(0.5),
      d3.curveMonotoneX,
      d3.curveNatural
    ];
    const curveIndex = Math.min(parseInt(epCurve.selectedIndex), curveTypes.length - 1);
    const line = d3.line().curve(curveTypes[curveIndex]);

    // Land fill: curve + straight close along the bottom edge
    const pts = chartData.points;
    const lastX = pts[pts.length - 1][0];
    const baseY = yscale(0) + yOffset;
    const landPath =
      line(pts) + ` L${lastX},${pts[pts.length - 1][1]}` + ` L${lastX},${baseY}` + ` L${xscale(0) + xOffset},${baseY}Z`;

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
      .attr("d", line(pts.slice()))
      .attr("stroke", "#5a3e28")
      .attr("stroke-width", 1.5)
      .attr("fill", "none");

    // Biome colour bar
    const hu = heightUnit.value;
    const biomesG = chart.append("g").attr("id", "epbiomes").attr("clip-path", "url(#epBiomesClip)");
    const tileWidth = xscale(1);

    for (let k = 0; k < pts.length; k++) {
      const cell = chartData.cell[k];
      const biome = chartData.biome[k];
      const province = pack.cells.province[cell];
      const pop =
        pack.cells.pop[cell] + (chartData.burg[k] ? pack.burgs[chartData.burg[k]].population * urbanization : 0);
      const dataTip = [
        biomesData.name[biome],
        province ? pack.provinces[province].name : null,
        pack.states[pack.cells.state[cell]].name,
        pack.religions[pack.cells.religion[cell]].name,
        pack.cultures[pack.cells.culture[cell]].name,
        `height: ${chartData.height[k]} ${hu}`,
        `population ${rn(pop * populationRate)}`,
        `cell ${cell}`
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
    const xAxis = d3
      .axisBottom(xscale)
      .ticks(10)
      .tickFormat(d => `${rn((d / (pts.length - 1)) * routeLen)} ${distanceUnitInput.value}`);
    const yAxis = d3
      .axisLeft(yscale)
      .ticks(5)
      .tickFormat(d => `${d} ${hu}`);

    chart
      .append("g")
      .attr("id", "epxaxis")
      .attr("transform", `translate(${xOffset},${chartHeight + yOffset + 20})`)
      .call(xAxis)
      .selectAll("text")
      .style("text-anchor", "center");

    chart
      .append("g")
      .attr("id", "epyaxis")
      .attr("transform", `translate(${xOffset - 10},${yOffset})`)
      .call(yAxis);

    // Grid lines
    const gridStyle = g =>
      g
        .attr("stroke", "lightgrey")
        .attr("stroke-opacity", "0.2")
        .attr("stroke-width", "0.5")
        .selectAll("path")
        .attr("stroke-width", "0");

    chart
      .append("g")
      .attr("id", "epxgrid")
      .attr("class", "epgrid")
      .attr("stroke-dasharray", "4 1")
      .attr("transform", `translate(${xOffset},${chartHeight + yOffset})`)
      .call(d3.axisBottom(xscale).ticks(10).tickSize(-chartHeight).tickFormat(""))
      .call(gridStyle);

    chart
      .append("g")
      .attr("id", "epygrid")
      .attr("class", "epgrid")
      .attr("stroke-dasharray", "4 1")
      .attr("transform", `translate(${xOffset},${yOffset})`)
      .call(d3.axisLeft(yscale).ticks(5).tickSize(-chartWidth).tickFormat(""))
      .call(gridStyle);

    // Burg labels anchored above their curve point with all-pairs overlap avoidance
    const labelsG = chart.append("g").attr("id", "epburglabels");
    const LABEL_GAP = 18; // px above the dot for the label baseline
    const MIN_LABEL_Y = 12; // topmost allowed y
    const LINE_HEIGHT = 14; // stacking increment
    const X_PROXIMITY = 70; // horizontal proximity threshold for stacking
    const placed = [];

    for (let k = 0; k < pts.length; k++) {
      if (!chartData.burg[k]) continue;
      const b = chartData.burg[k];
      const lx = pts[k][0];
      const ptY = pts[k][1];
      let ly = ptY - LABEL_GAP;

      // Push up until no vertical overlap with any nearby placed label
      let changed = true;
      while (changed) {
        changed = false;
        for (const p of placed) {
          if (Math.abs(lx - p.lx) < X_PROXIMITY && Math.abs(ly - p.ly) < LINE_HEIGHT) {
            const candidate = p.ly - LINE_HEIGHT;
            if (candidate < MIN_LABEL_Y) break;
            ly = candidate;
            changed = true;
            break;
          }
        }
      }
      ly = Math.max(MIN_LABEL_Y, ly);
      placed.push({lx, ly});

      labelsG
        .append("text")
        .attr("id", `ep${b}`)
        .attr("class", "epburglabel")
        .attr("x", lx)
        .attr("y", ly)
        .attr("text-anchor", "middle")
        .text(pack.burgs[b].name);

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
    byId("epstats").textContent =
      `Elev: ${chartData.mi}\u2013${chartData.ma} ${heightUnit.value}\u2002\u2191\u202f${totalAscent}\u2002\u2193\u202f${totalDescent} ${heightUnit.value}`;

    // Crosshair + FMG tooltip on hover
    const crosshairG = chart.append("g").attr("id", "epcrosshair").style("pointer-events", "none");
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
      .on("mousemove", function () {
        const [mx] = d3.mouse(this);
        const idx = Math.max(
          0,
          Math.min(data.length - 1, Math.round(((mx - xOffset) / chartWidth) * (data.length - 1)))
        );
        const pt = pts[idx];
        if (!pt) return;
        vLine.attr("x1", pt[0]).attr("x2", pt[0]);
        hDot.attr("cx", pt[0]).attr("cy", pt[1]);
        const dist = rn((idx / Math.max(1, data.length - 1)) * routeLen);
        const burgId = chartData.burg[idx];
        tip(
          [
            `${dist} ${distanceUnitInput.value} from start`,
            `Elevation: ${chartData.height[idx]} ${heightUnit.value}`,
            biomesData.name[chartData.biome[idx]],
            burgId ? pack.burgs[burgId].name : null
          ]
            .filter(Boolean)
            .join(". ")
        );
      })
      .on("mouseleave", function () {
        vLine.attr("x1", -200).attr("x2", -200);
        hDot.attr("cx", -200).attr("cy", -200);
        tip("");
      });
  }

  function downloadCSV() {
    const headers =
      "Id,x,y,lat,lon,Cell,Height,Height value,Population,Burg,Burg population,Biome,Biome color,Culture,Culture color,Religion,Religion color,Province,Province color,State,State color\n";
    const rows = chartData.points.map((_, k) => {
      const cell = chartData.cell[k];
      const [x, y] = pack.cells.p[data[k]];
      const h = pack.cells.h[cell];
      const burg = pack.cells.burg[cell];
      const pop = pack.cells.pop[cell];
      const burgPop = burg ? pack.burgs[burg].population * populationRate * urbanization : 0;
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
        burg ? pack.burgs[burg].name : "",
        burgPop,
        biomesData.name[pack.cells.biome[cell]],
        biomesData.color[pack.cells.biome[cell]],
        pack.cultures[pack.cells.culture[cell]].name,
        pack.cultures[pack.cells.culture[cell]].color,
        pack.religions[pack.cells.religion[cell]].name,
        pack.religions[pack.cells.religion[cell]].color,
        pack.provinces[pack.cells.province[cell]].name,
        pack.provinces[pack.cells.province[cell]].color,
        pack.states[pack.cells.state[cell]].name,
        pack.states[pack.cells.state[cell]].color
      ].join(",");
    });
    downloadFile(headers + rows.join("\n"), getFileName("elevation profile") + ".csv");
  }

  function downloadSVG() {
    const svgEl = byId("elevationSVG");
    const svgStr = `<?xml version="1.0" encoding="utf-8"?>\n${new XMLSerializer().serializeToString(svgEl)}`;
    downloadFile(svgStr, getFileName("elevation profile") + ".svg");
  }

  function downloadPNG() {
    const svgEl = byId("elevationSVG");
    const w = +svgEl.getAttribute("width");
    const h = +svgEl.getAttribute("height");
    const svgUrl = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(svgEl)], {type: "image/svg+xml;charset=utf-8"})
    );
    const canvas = Object.assign(document.createElement("canvas"), {width: w, height: h});
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(svgUrl);
      canvas.toBlob(pngBlob => {
        const a = Object.assign(document.createElement("a"), {
          href: URL.createObjectURL(pngBlob),
          download: getFileName("elevation profile") + ".png"
        });
        a.click();
        URL.revokeObjectURL(a.href);
      });
    };
    img.src = svgUrl;
  }

  function closeElevationProfile() {
    byId("epCurve").off("change", draw);
    byId("epSave").off("click", downloadCSV);
    byId("epSaveSVG").off("click", downloadSVG);
    byId("epSavePNG").off("click", downloadPNG);
    byId("elevationGraph").innerHTML = "";
    modules.elevation = false;
  }
}
