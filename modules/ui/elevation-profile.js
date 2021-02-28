"use strict";

function showEPForRoute(node) {
  const points = [];
  debug.select("#controlPoints").selectAll("circle").each(function() {
    const i = findCell(this.getAttribute("cx"), this.getAttribute("cy"));
    points.push(i);
  });

  const routeLen = node.getTotalLength() * distanceScaleInput.value;
  showElevationProfile(points, routeLen, false);
}

function showEPForRiver(node) {
  const points = [];
  debug.select("#controlPoints").selectAll("circle").each(function() {
    const i = findCell(this.getAttribute("cx"), this.getAttribute("cy"));
    points.push(i);
  });

  const riverLen = (node.getTotalLength() / 2) * distanceScaleInput.value;
  showElevationProfile(points, riverLen, true);
}

function showElevationProfile(data, routeLen, isRiver) {
  // data is an array of cell indexes, routeLen is the distance (in actual metres/feet), isRiver should be true for rivers, false otherwise
  document.getElementById("epScaleRange").addEventListener("change", draw);
  document.getElementById("epCurve").addEventListener("change", draw);
  document.getElementById("epSave").addEventListener("click", downloadCSV);

  $("#elevationProfile").dialog({
    title: "Elevation profile", resizable: false, width: window.width,
    close: closeElevationProfile,
    position: {my: "left top", at: "left+20 bottom-500", of: window, collision: "fit"}
  });

  // prevent river graphs from showing rivers as flowing uphill - remember the general slope
  let slope = 0;
  if (isRiver) {
    if (pack.cells.h[data[0]] < pack.cells.h[data[data.length-1]]) {
      slope = 1; // up-hill
    } else if (pack.cells.h[data[0]] > pack.cells.h[data[data.length-1]]) {
      slope = -1; // down-hill
    }
  }

  const chartWidth = window.innerWidth-180, chartHeight = 300; // height of our land/sea profile, excluding the biomes data below
  const xOffset = 80, yOffset = 80; // this is our drawing starting point from top-left (y = 0) of SVG
  const biomesHeight = 40;

  let lastBurgIndex = 0;
  let lastBurgCell = 0;
  let burgCount = 0;
  let chartData = {biome:[], burg:[], cell:[], height:[], mi:1000000, ma:0, mih: 100, mah: 0, points:[]};
  for (let i = 0, prevB = 0, prevH = -1; i < data.length; i++) {
    let cell = data[i];
    let h = pack.cells.h[cell];
    if (h < 20) {
      const f = pack.features[pack.cells.f[cell]];
      if (f.type === "lake") h = f.height; else h = 20;
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
    if (b) { burgCount++; lastBurgIndex = i; lastBurgCell = cell; }

    chartData.biome[i] = pack.cells.biome[cell];
    chartData.burg[i] = b;
    chartData.cell[i] = cell;
    let sh = getHeight(h);
    chartData.height[i] = parseInt(sh.substr(0, sh.indexOf(' ')));
    chartData.mih = Math.min(chartData.mih, h);
    chartData.mah = Math.max(chartData.mah, h);
    chartData.mi = Math.min(chartData.mi, chartData.height[i]);
    chartData.ma = Math.max(chartData.ma, chartData.height[i]);
  }

  if (lastBurgIndex != 0 && lastBurgCell == chartData.cell[data.length-1] && lastBurgIndex < data.length-1) {
    chartData.burg[data.length-1] = chartData.burg[lastBurgIndex];
    chartData.burg[lastBurgIndex] = 0;
  }

  draw();

  function downloadCSV() {
    let data = "Point,X,Y,Cell,Height,Height value,Population,Burg,Burg population,Biome,Biome color,Culture,Culture color,Religion,Religion color,Province,Province color,State,State color\n"; // headers

    for (let k=0; k < chartData.points.length; k++) {
      let cell = chartData.cell[k];
      let burg = pack.cells.burg[cell];
      let biome = pack.cells.biome[cell];
      let culture = pack.cells.culture[cell];
      let religion = pack.cells.religion[cell];
      let province = pack.cells.province[cell];
      let state = pack.cells.state[cell];
      let pop = pack.cells.pop[cell];
      let h = pack.cells.h[cell];

      data += k+1 + ",";
      data += chartData.points[k][0] + ",";
      data += chartData.points[k][1] + ",";
      data += cell + ",";
      data += getHeight(h) + ",";
      data += h + ",";
      data += rn(pop * populationRate.value) + ",";
      if (burg) {
        data += pack.burgs[burg].name + ",";
        data += (pack.burgs[burg].population * populationRate.value * urbanization.value) + ",";
      } else {
        data += ",0,";
      }
      data += biomesData.name[biome] + ",";
      data += biomesData.color[biome] + ",";
      data += pack.cultures[culture].name + ",";
      data += pack.cultures[culture].color + ",";
      data += pack.religions[religion].name + ",";
      data += pack.religions[religion].color + ",";
      data += pack.provinces[province].name + ",";
      data += pack.provinces[province].color + ",";
      data += pack.states[state].name + ",";
      data += pack.states[state].color + ",";

      data = data + "\n";
    }

    const name = getFileName("elevation profile") + ".csv";
    downloadFile(data, name);
  }

  function draw() {
    chartData.points = [];
    let heightScale = 100 / parseInt(epScaleRange.value);

    heightScale *= .9; // curves cause the heights to go slightly higher, adjust here

    const xscale = d3.scaleLinear().domain([0, data.length]).range([0, chartWidth]);
    const yscale = d3.scaleLinear().domain([0, chartData.ma * heightScale]).range([chartHeight, 0]);

    for (let i=0; i<data.length; i++) {
      chartData.points.push([xscale(i) + xOffset, yscale(chartData.height[i]) + yOffset]);
    }

    document.getElementById("elevationGraph").innerHTML = "";

    const chart = d3.select("#elevationGraph").append("svg").attr("width", chartWidth+120).attr("height", chartHeight+yOffset+biomesHeight).attr("id", "elevationSVG").attr("class", "epbackground");
    // arrow-head definition
    chart.append("defs").append("marker").attr("id", "arrowhead").attr("orient", "auto").attr("markerWidth", "2").attr("markerHeight", "4").attr("refX", "0.1").attr("refY", "2").append("path").attr("d", "M0,0 V4 L2,2 Z").attr("fill", "darkgray");

    let colors = getColorScheme();
    const landdef = chart.select("defs").append("linearGradient").attr("id", "landdef").attr("x1", "0%").attr("y1", "0%").attr("x2", "0%").attr("y2", "100%");

    if (chartData.mah == chartData.mih) {
      landdef.append("stop").attr("offset", "0%").attr("style", "stop-color:" + getColor(chartData.mih, colors) + ";stop-opacity:1");
      landdef.append("stop").attr("offset", "100%").attr("style", "stop-color:" + getColor(chartData.mah, colors) + ";stop-opacity:1");
    } else {
      for (let k=chartData.mah; k >= chartData.mih; k--) {
        let perc = 1 - (k - chartData.mih)  / (chartData.mah - chartData.mih);
        landdef.append("stop").attr("offset", perc*100 + "%").attr("style", "stop-color:" + getColor(k, colors) + ";stop-opacity:1");
      }
    }

    // land
    let curve = d3.line().curve(d3.curveBasis); // see https://github.com/d3/d3-shape#curves
    let epCurveIndex = parseInt(epCurve.selectedIndex);
    switch(epCurveIndex) {
      case 0 : curve = d3.line().curve(d3.curveLinear); break;
      case 1 : curve = d3.line().curve(d3.curveBasis); break;
      case 2 : curve = d3.line().curve(d3.curveBundle.beta(1)); break;
      case 3 : curve = d3.line().curve(d3.curveCatmullRom.alpha(0.5)); break;
      case 4 : curve = d3.line().curve(d3.curveMonotoneX); break;
      case 5 : curve = d3.line().curve(d3.curveNatural); break;
    }

    // copy the points so that we can add extra straight pieces, else we get curves at the ends of the chart
    let extra = chartData.points.slice();
    let path = curve(extra);
    // this completes the right-hand side and bottom of our land "polygon"
    path += " L" + parseInt(xscale(extra.length) + +xOffset) +  "," + parseInt(extra[extra.length-1][1]);
    path += " L" + parseInt(xscale(extra.length) + +xOffset) +  "," + parseInt(yscale(0) + +yOffset);
    path += " L" + parseInt(xscale(0) + +xOffset) +"," + parseInt(yscale(0) + +yOffset);
    path += "Z";
    chart.append("g").attr("id", "epland").append("path").attr("d", path).attr("stroke", "purple").attr("stroke-width", "0").attr("fill", "url(#landdef)");

    // biome / heights
    let g = chart.append("g").attr("id", "epbiomes");
    const hu = heightUnit.value;
    for(let k=0; k < chartData.points.length; k++) {
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
        pop += pack.burgs[chartData.burg[k]].population * urbanization.value;
      }

      const populationDesc = rn(pop * populationRate.value);

      const provinceDesc = province ? ", " + pack.provinces[province].name : "";
      const dataTip = biomesData.name[chartData.biome[k]] + 
                      provinceDesc +
                      ", " + pack.states[state].name +
                      ", " + pack.religions[religion].name +
                      ", " + pack.cultures[culture].name +
                      " (height: " + chartData.height[k] + " " + hu + ", population " + populationDesc + ", cell " + chartData.cell[k] + ")";

      g.append("rect").attr("stroke", c).attr("fill", c).attr("x", x).attr("y", y).attr("width", xscale(1)).attr("height", 15).attr("data-tip", dataTip);
    }

    const xAxis = d3.axisBottom(xscale).ticks(10).tickFormat(function(d){ return (rn(d / chartData.points.length * routeLen) + " " + distanceUnitInput.value);});
    const yAxis = d3.axisLeft(yscale).ticks(5).tickFormat(function(d) { return d + " " + hu; });

    const xGrid = d3.axisBottom(xscale).ticks(10).tickSize(-chartHeight).tickFormat("");
    const yGrid = d3.axisLeft(yscale).ticks(5).tickSize(-chartWidth).tickFormat("");

    chart.append("g")
      .attr("id", "epxaxis")
      .attr("transform", "translate(" + xOffset + "," + parseInt(chartHeight + +yOffset + 20) + ")")
      .call(xAxis)
      .selectAll("text")
      .style("text-anchor", "center")
      .attr("transform", function(d) {
          return "rotate(0)" // used to rotate labels, - anti-clockwise, + clockwise
      });

    chart.append("g")
      .attr("id", "epyaxis")
      .attr("transform", "translate(" + parseInt(+xOffset-10) + "," + parseInt(+yOffset) + ")")
      .call(yAxis);

    // add the X gridlines
    chart.append("g")
      .attr("id", "epxgrid")
      .attr("class", "epgrid")
      .attr("stroke-dasharray", "4 1")
      .attr("transform", "translate(" + xOffset + "," + parseInt(chartHeight + +yOffset) + ")")
      .call(xGrid);

    // add the Y gridlines
    chart.append("g")
      .attr("id", "epygrid")
      .attr("class", "epgrid")
      .attr("stroke-dasharray", "4 1")
      .attr("transform", "translate(" + xOffset + "," + yOffset + ")")
      .call(yGrid);

    // draw city labels - try to avoid putting labels over one another
    g = chart.append("g").attr("id", "epburglabels");
    let y1 = 0;
    const add = 15;

    let xwidth = chartData.points[1][0] - chartData.points[0][0];
    for (let k=0; k<chartData.points.length; k++) {
      if (chartData.burg[k] > 0) {
        let b = chartData.burg[k];

        let x1 = chartData.points[k][0]; // left side of graph by default
        if (k > 0) x1 += xwidth/2; // center it if not first
        if (k == chartData.points.length-1) x1 = chartWidth + xOffset; // right part of graph
        y1+=add;
        if (y1 >= yOffset) y1 = add;

        // burg name
        g.append("text").attr("id", "ep" + b).attr("class", "epburglabel").attr("x", x1).attr("y", y1).attr("text-anchor", "middle");
        document.getElementById("ep" + b).innerHTML = pack.burgs[b].name;

        // arrow from burg name to graph line
        g.append("path").attr("id", "eparrow" + b).attr("d", "M" + x1.toString() + "," + (y1+3).toString() + "L" + x1.toString() + "," + parseInt(chartData.points[k][1]-3).toString()).attr("stroke", "darkgray").attr("fill", "lightgray").attr("stroke-width", "1").attr("marker-end", "url(#arrowhead)");
      }
    }
  }

  function closeElevationProfile() {
    document.getElementById("epScaleRange").removeEventListener("change", draw);
    document.getElementById("epCurve").removeEventListener("change", draw);
    document.getElementById("epSave").removeEventListener("click", downloadCSV);
    document.getElementById("elevationGraph").innerHTML = "";
    modules.elevation = false;
  }
}
