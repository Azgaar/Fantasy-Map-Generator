"use strict";

// data is an array of cell indexes, routeLen is the distance (in actual metres/feet), isRiver should be true for rivers, false otherwise
function showElevationProfile(data, routeLen, isRiver) {
  byId("epCurve").on("change", draw);
  byId("epSave").on("click", downloadCSV);
  byId("epSaveSVG").on("click", downloadSVG);
  byId("epSavePNG").on("click", downloadPNG);

  $("#elevationProfile").dialog({
    title: "Elevation profile",
    resizable: false,
    close: closeElevationProfile,
    position: {my: "left top", at: "left+20 bottom-500", of: window, collision: "fit"}
  });

  // prevent river graphs from showing rivers as flowing uphill - remember the general slope
  let slope = 0;
  if (isRiver) {
    const firstCellHeight = pack.cells.h[data.at(0)];
    const lastCellHeight = pack.cells.h[data.at(-1)];
    if (firstCellHeight < lastCellHeight) {
      slope = 1; // up-hill
    } else if (firstCellHeight > lastCellHeight) {
      slope = -1; // down-hill
    }
  }

  const chartWidth = window.innerWidth - 400;
  const chartHeight = 300;
  const xOffset = 80;
  const yOffset = 2;
  const biomesHeight = 10;

  let lastBurgIndex = 0;
  let lastBurgCell = 0;
  let burgCount = 0;
  let chartData = {biome: [], burg: [], cell: [], height: [], mi: 1000000, ma: 0, mih: 100, mah: 0, points: []};
  let totalAscent = 0;
  let totalDescent = 0;
  for (let i = 0, prevB = 0, prevH = -1; i < data.length; i++) {
    let cell = data[i];
    let h = pack.cells.h[cell];
    if (h < 20) {
      const f = pack.features[pack.cells.f[cell]];
      if (f.type === "lake") h = f.height;
      else h = 20;
    }

    // check for river up-hill
    if (prevH != -1) {
      if (isRiver) {
        if (slope == 1 && h < prevH) h = prevH;
        else if (slope == 0 && h != prevH) h = prevH;
        else if (slope == -1 && h > prevH) h = prevH;
      }
    }
    prevH = h;

    let b = pack.cells.burg[cell];
    if (b == prevB) b = 0;
    else prevB = b;
    if (b) {
      burgCount++;
      lastBurgIndex = i;
      lastBurgCell = cell;
    }

    chartData.biome[i] = pack.cells.biome[cell];
    chartData.burg[i] = b;
    chartData.cell[i] = cell;
    let sh = getHeight(h);
    chartData.height[i] = parseInt(sh.substr(0, sh.indexOf(" ")));
    chartData.mih = Math.min(chartData.mih, h);
    chartData.mah = Math.max(chartData.mah, h);
    chartData.mi = Math.min(chartData.mi, chartData.height[i]);
    chartData.ma = Math.max(chartData.ma, chartData.height[i]);
  }

  for (let i = 1; i < data.length; i++) {
    const diff = chartData.height[i] - chartData.height[i - 1];
    if (diff > 0) totalAscent += diff;
    else totalDescent += -diff;
  }

  if (lastBurgIndex != 0 && lastBurgCell == chartData.cell[data.length - 1] && lastBurgIndex < data.length - 1) {
    chartData.burg[data.length - 1] = chartData.burg[lastBurgIndex];
    chartData.burg[lastBurgIndex] = 0;
  }

  draw();

  function downloadCSV() {
    let csv =
      "Id,x,y,lat,lon,Cell,Height,Height value,Population,Burg,Burg population,Biome,Biome color,Culture,Culture color,Religion,Religion color,Province,Province color,State,State color\n"; // headers

    for (let k = 0; k < chartData.points.length; k++) {
      let cell = chartData.cell[k];
      let burg = pack.cells.burg[cell];
      let biome = pack.cells.biome[cell];
      let culture = pack.cells.culture[cell];
      let religion = pack.cells.religion[cell];
      let province = pack.cells.province[cell];
      let state = pack.cells.state[cell];
      let pop = pack.cells.pop[cell];
      let h = pack.cells.h[cell];

      csv += k + 1 + ",";
      const [x, y] = pack.cells.p[data[k]];
      csv += x + ",";
      csv += y + ",";
      const lat = getLatitude(y, 2);
      const lon = getLongitude(x, 2);
      csv += lat + ",";
      csv += lon + ",";
      csv += cell + ",";
      csv += getHeight(h) + ",";
      csv += h + ",";
      csv += rn(pop * populationRate) + ",";
      if (burg) {
        csv += pack.burgs[burg].name + ",";
        csv += pack.burgs[burg].population * populationRate * urbanization + ",";
      } else {
        csv += ",0,";
      }
      csv += biomesData.name[biome] + ",";
      csv += biomesData.color[biome] + ",";
      csv += pack.cultures[culture].name + ",";
      csv += pack.cultures[culture].color + ",";
      csv += pack.religions[religion].name + ",";
      csv += pack.religions[religion].color + ",";
      csv += pack.provinces[province].name + ",";
      csv += pack.provinces[province].color + ",";
      csv += pack.states[state].name + ",";
      csv += pack.states[state].color + ",";
      csv += "\n";
    }

    const name = getFileName("elevation profile") + ".csv";
    downloadFile(csv, name);
  }

  function draw() {
    chartData.points = [];
    const heightScale = 1.1; // auto-fit: peaks fill ~90% of chart height

    const xscale = d3
      .scaleLinear()
      .domain([0, data.length - 1])
      .range([0, chartWidth]);
    const yscale = d3
      .scaleLinear()
      .domain([0, chartData.ma * heightScale])
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
    // arrow-head definition
    chart
      .append("defs")
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

    const colors = getColorScheme("natural");
    const landdef = chart
      .select("defs")
      .append("linearGradient")
      .attr("id", "landdef")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");

    if (chartData.mah == chartData.mih) {
      landdef
        .append("stop")
        .attr("offset", "0%")
        .attr("style", "stop-color:" + getColor(chartData.mih, colors) + ";stop-opacity:1");
      landdef
        .append("stop")
        .attr("offset", "100%")
        .attr("style", "stop-color:" + getColor(chartData.mah, colors) + ";stop-opacity:1");
    } else {
      const gradSteps = Math.min(20, chartData.mah - chartData.mih);
      for (let s = 0; s <= gradSteps; s++) {
        const k = Math.round(chartData.mah - (s / gradSteps) * (chartData.mah - chartData.mih));
        const perc = s / gradSteps;
        landdef
          .append("stop")
          .attr("offset", perc * 100 + "%")
          .attr("style", "stop-color:" + getColor(k, colors) + ";stop-opacity:1");
      }
    }

    // land
    let curve = d3.line().curve(d3.curveNatural); // see https://github.com/d3/d3-shape#curves
    let epCurveIndex = parseInt(epCurve.selectedIndex);
    switch (epCurveIndex) {
      case 0:
        curve = d3.line().curve(d3.curveLinear);
        break;
      case 1:
        curve = d3.line().curve(d3.curveBundle.beta(1));
        break;
      case 2:
        curve = d3.line().curve(d3.curveCatmullRom.alpha(0.5));
        break;
      case 3:
        curve = d3.line().curve(d3.curveMonotoneX);
        break;
      case 4:
      default:
        curve = d3.line().curve(d3.curveNatural);
        break;
    }

    // copy the points so that we can add extra straight pieces, else we get curves at the ends of the chart
    let extra = chartData.points.slice();
    let path = curve(extra);
    // this completes the right-hand side and bottom of our land "polygon"
    const lastX = extra[extra.length - 1][0];
    path += " L" + lastX + "," + parseInt(extra[extra.length - 1][1]);
    path += " L" + lastX + "," + parseInt(yscale(0) + +yOffset);
    path += " L" + parseInt(xscale(0) + +xOffset) + "," + parseInt(yscale(0) + +yOffset);
    path += "Z";
    chart
      .append("g")
      .attr("id", "epland")
      .append("path")
      .attr("d", path)
      .attr("stroke", "none")
      .attr("fill", "url(#landdef)");

    // profile stroke line (outline of elevation silhouette)
    chart
      .append("g")
      .attr("id", "epline")
      .append("path")
      .attr("d", curve(chartData.points.slice()))
      .attr("stroke", "#5a3e28")
      .attr("stroke-width", 1.5)
      .attr("fill", "none");

    chart
      .select("defs")
      .append("clipPath")
      .attr("id", "epBiomesClip")
      .append("rect")
      .attr("x", xOffset)
      .attr("y", yOffset + chartHeight)
      .attr("width", chartWidth)
      .attr("height", biomesHeight);

    // biome / heights
    let g = chart.append("g").attr("id", "epbiomes").attr("clip-path", "url(#epBiomesClip)");
    const hu = heightUnit.value;
    for (let k = 0; k < chartData.points.length; k++) {
      const x = chartData.points[k][0];
      const y = yOffset + chartHeight;
      const c = biomesData.color[chartData.biome[k]];

      const cell = chartData.cell[k];
      const culture = pack.cells.culture[cell];
      const religion = pack.cells.religion[cell];
      const province = pack.cells.province[cell];
      const state = pack.cells.state[cell];
      let pop = pack.cells.pop[cell];
      if (chartData.burg[k]) {
        pop += pack.burgs[chartData.burg[k]].population * urbanization;
      }

      const populationDesc = rn(pop * populationRate);

      const provinceDesc = province ? ", " + pack.provinces[province].name : "";
      const dataTip =
        biomesData.name[chartData.biome[k]] +
        provinceDesc +
        ", " +
        pack.states[state].name +
        ", " +
        pack.religions[religion].name +
        ", " +
        pack.cultures[culture].name +
        " (height: " +
        chartData.height[k] +
        " " +
        hu +
        ", population " +
        populationDesc +
        ", cell " +
        chartData.cell[k] +
        ")";

      g.append("rect")
        .attr("stroke", c)
        .attr("fill", c)
        .attr("x", x)
        .attr("y", y)
        .attr("width", xscale(1))
        .attr("height", biomesHeight)
        .attr("data-tip", dataTip);
    }

    const xAxis = d3
      .axisBottom(xscale)
      .ticks(10)
      .tickFormat(function (d) {
        return rn((d / (chartData.points.length - 1)) * routeLen) + " " + distanceUnitInput.value;
      });
    const yAxis = d3
      .axisLeft(yscale)
      .ticks(5)
      .tickFormat(function (d) {
        return d + " " + hu;
      });

    const xGrid = d3.axisBottom(xscale).ticks(10).tickSize(-chartHeight).tickFormat("");
    const yGrid = d3.axisLeft(yscale).ticks(5).tickSize(-chartWidth).tickFormat("");

    chart
      .append("g")
      .attr("id", "epxaxis")
      .attr("transform", "translate(" + xOffset + "," + parseInt(chartHeight + +yOffset + 20) + ")")
      .call(xAxis)
      .selectAll("text")
      .style("text-anchor", "center");

    chart
      .append("g")
      .attr("id", "epyaxis")
      .attr("transform", "translate(" + parseInt(+xOffset - 10) + "," + parseInt(+yOffset) + ")")
      .call(yAxis);

    // add the X gridlines
    chart
      .append("g")
      .attr("id", "epxgrid")
      .attr("class", "epgrid")
      .attr("stroke-dasharray", "4 1")
      .attr("transform", "translate(" + xOffset + "," + parseInt(chartHeight + +yOffset) + ")")
      .call(xGrid);

    // add the Y gridlines
    chart
      .append("g")
      .attr("id", "epygrid")
      .attr("class", "epgrid")
      .attr("stroke-dasharray", "4 1")
      .attr("transform", "translate(" + xOffset + "," + yOffset + ")")
      .call(yGrid);

    // draw city labels anchored near the actual curve height
    g = chart.append("g").attr("id", "epburglabels");
    const labelGap = 18; // pixels above the curve point for the label baseline
    const minLabelY = 12; // use the full top margin (yOffset=80) so labels can stack without cascading
    const lineHeight = 14; // vertical spacing between stacked labels
    const xProximity = 70; // horizontal range within which labels may stack

    const burgLabelPositions = []; // track placed labels for all-pairs overlap detection

    for (let k = 0; k < chartData.points.length; k++) {
      if (chartData.burg[k] > 0) {
        const b = chartData.burg[k];
        const ptX = chartData.points[k][0];
        const ptY = chartData.points[k][1];

        const lx = ptX;

        // Natural position: just above the curve point
        let ly = ptY - labelGap;

        // Push up to avoid overlapping with any already-placed nearby label.
        // All-pairs comparison prevents cascading: each label only moves when
        // it TRULY conflicts with an existing one, not because a previous label
        // was already pushed up.
        let adjusting = true;
        while (adjusting) {
          adjusting = false;
          for (const p of burgLabelPositions) {
            if (Math.abs(lx - p.lx) < xProximity && Math.abs(ly - p.ly) < lineHeight) {
              const newLy = p.ly - lineHeight;
              if (newLy < minLabelY) break; // can't push higher — accept overlap at top
              ly = newLy;
              adjusting = true;
              break; // restart scan with updated ly
            }
          }
        }
        ly = Math.max(minLabelY, ly);
        burgLabelPositions.push({lx, ly});

        // burg name
        g.append("text")
          .attr("id", "ep" + b)
          .attr("class", "epburglabel")
          .attr("x", lx)
          .attr("y", ly)
          .attr("text-anchor", "middle");
        byId("ep" + b).innerHTML = pack.burgs[b].name;

        // arrow from label to curve (only when there is meaningful distance)
        if (ly + 4 < ptY - 4) {
          g.append("path")
            .attr("id", "eparrow" + b)
            .attr(
              "d",
              "M" + lx.toString() + "," + (ly + 3).toString() + "L" + lx.toString() + "," + parseInt(ptY - 3).toString()
            )
            .attr("stroke", "darkgray")
            .attr("fill", "lightgray")
            .attr("stroke-width", "1")
            .attr("marker-end", "url(#arrowhead)");
        }
      }
    }

    // burg dots on the profile line
    const burgDotsG = chart.append("g").attr("id", "epburgdots");
    for (let k = 0; k < chartData.points.length; k++) {
      if (chartData.burg[k] > 0) {
        burgDotsG
          .append("circle")
          .attr("cx", chartData.points[k][0])
          .attr("cy", chartData.points[k][1])
          .attr("r", 4)
          .attr("fill", "white")
          .attr("stroke", "#333")
          .attr("stroke-width", 1.5);
      }
    }

    // stats summary in the controls bar (single line)
    byId("epstats").textContent =
      "Elev: " +
      chartData.mi +
      "\u2013" +
      chartData.ma +
      " " +
      heightUnit.value +
      "\u2002\u2191\u202f" +
      totalAscent +
      "\u2002\u2193\u202f" +
      totalDescent +
      " " +
      heightUnit.value;

    // interactive crosshair
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
        const pt = chartData.points[idx];
        if (!pt) return;
        vLine.attr("x1", pt[0]).attr("x2", pt[0]);
        hDot.attr("cx", pt[0]).attr("cy", pt[1]);
        const dist = rn((idx / Math.max(1, data.length - 1)) * routeLen);
        const biomeName = biomesData.name[chartData.biome[idx]];
        const burgId = chartData.burg[idx];
        const burgName = burgId ? pack.burgs[burgId].name : null;
        const tipText =
          dist +
          " " +
          distanceUnitInput.value +
          " from start. Elevation: " +
          chartData.height[idx] +
          " " +
          heightUnit.value +
          ". " +
          biomeName +
          (burgName ? ". " + burgName : "");
        tip(tipText);
      })
      .on("mouseleave", function () {
        vLine.attr("x1", -200).attr("x2", -200);
        hDot.attr("cx", -200).attr("cy", -200);
        tip("");
      });
  }

  function downloadSVG() {
    const svgEl = byId("elevationSVG");
    const svgStr = '<?xml version="1.0" encoding="utf-8"?>\n' + new XMLSerializer().serializeToString(svgEl);
    downloadFile(svgStr, getFileName("elevation profile") + ".svg");
  }

  function downloadPNG() {
    const svgEl = byId("elevationSVG");
    const w = +svgEl.getAttribute("width");
    const h = +svgEl.getAttribute("height");
    const svgBlob = new Blob([new XMLSerializer().serializeToString(svgEl)], {type: "image/svg+xml;charset=utf-8"});
    const svgUrl = URL.createObjectURL(svgBlob);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    const img = new Image();
    img.onload = function () {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(svgUrl);
      canvas.toBlob(function (pngBlob) {
        const pngUrl = URL.createObjectURL(pngBlob);
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = getFileName("elevation profile") + ".png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(pngUrl);
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
