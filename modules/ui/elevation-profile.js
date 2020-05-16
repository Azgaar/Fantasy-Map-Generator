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

function closeElevationProfile() {
  modules.elevation = false;
}

function showElevationProfile(data, routeLen, isRiver) {
  // data is an array of cell indexes, routeLen is the distance (in actual metres/feet), isRiver should be true for rivers, false otherwise

  document.getElementById("epScaleRange").addEventListener("change", draw);
  document.getElementById("epCurve").addEventListener("change", draw);

  $("#elevationProfile").dialog({
    title: "Elevation profile", resizable: false, width: window.width,
    close: closeElevationProfile,
    position: {my: "left top", at: "left+20 bottom-500", of: window, collision: "fit"}
  });

  // prevent river graphs from showing rivers as flowing uphill - remember the general slope
  var slope = 0;
  if (isRiver) {
    if (pack.cells.h[data[0]] < pack.cells.h[data[data.length-1]]) {
      slope = 1; // up-hill
    } else if (pack.cells.h[data[0]] > pack.cells.h[data[data.length-1]]) {
      slope = -1; // down-hill 
    }
  }

  const chartWidth = window.innerWidth-280;
  const chartHeight = 200; // height of our land/sea profile, excluding the biomes data below

  const xOffset = 160;
  const yOffset = 140;  // this is our drawing starting point from top-left (y = 0) of SVG

  const biomesHeight = 40;

  let chartData = {biome:[], burg:[], cell:[], height:[], mi:1000000, ma:0, points:[] }
  for (let i=0, prevB=0, prevH=-1; i<data.length; i++) {
    let cell = data[i];

    let h = pack.cells.h[cell];
    if (h < 20) h = 20;

    // check for river up-hill
    if (prevH != -1) {
      if (isRiver) {
        if (slope == 1 && h < prevH) h = prevH;
        else if (slope == 0 && h != prevH) h = prevH;
        else if (slope == -1 && h > prevH) h = prevH;
      }
    }
    prevH = h;
    // river up-hill checks stop here

    let b = pack.cells.burg[cell];
    if (b == prevB) b = 0;
    else prevB = b;

    chartData.biome[i] = pack.cells.biome[cell];
    chartData.burg[i] = b;
    chartData.cell[i] = cell;
    let sh = getHeight(h);
    chartData.height[i] = parseInt(sh.substr(0, sh.indexOf(' ')));
    chartData.mi = Math.min(chartData.mi, chartData.height[i]);
    chartData.ma = Math.max(chartData.ma, chartData.height[i]);
  }
  draw();

  function draw() {
    chartData.points = []; 
    let heightScale = 100 / parseInt(epScaleRange.value);

    heightScale *= 0.90; // curves cause the heights to go slightly higher, adjust here

    const xscale = d3.scaleLinear().domain([0, data.length]).range([0, chartWidth]);
    const yscale = d3.scaleLinear().domain([0, (chartData.ma-chartData.mi) * heightScale]).range([chartHeight, 0]);
  
    for (let i=0; i<data.length; i++) {
      chartData.points.push([xscale(i) + xOffset, yscale(chartData.height[i]) + yOffset]);
    }
  
    document.getElementById("elevationGraph").innerHTML = "";

    const chart = d3.select("#elevationGraph").append("svg").attr("width", chartWidth+200).attr("height", chartHeight+yOffset+biomesHeight).attr("id", "elevationSVG").attr("class", "epbackground");
    // arrow-head definition
    chart.append("defs").append("marker").attr("id", "arrowhead").attr("orient", "auto").attr("markerWidth", "2").attr("markerHeight", "4").attr("refX", "0.1").attr("refY", "2").append("path").attr("d", "M0,0 V4 L2,2 Z").attr("fill", "darkgray");
  
    var landdef = chart.select("defs").append("linearGradient").attr("id", "landdef").attr("x1", "0%").attr("y1", "0%").attr("x2", "0%").attr("y2", "100%");
    landdef.append("stop").attr("offset", "0%").attr("style", "stop-color:rgb(64,255,128);stop-opacity:1");
    landdef.append("stop").attr("offset", "100%").attr("style", "stop-color:rgb(0,192,64);stop-opacity:1");
  
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
    var path = curve(extra);
    // this completes the right-hand side and bottom of our land "polygon"
    path += " L" + parseInt(xscale(extra.length) + +xOffset) +  "," + parseInt(extra[extra.length-1][1]);
    path += " L" + parseInt(xscale(extra.length) + +xOffset) +  "," + parseInt(yscale(0) + +yOffset);
    path += " L" + parseInt(xscale(0) + +xOffset) +"," + parseInt(yscale(0) + +yOffset);
    path +=  "Z";
    chart.append("g").attr("id", "epland").append("path").attr("d", path).attr("stroke", "purple").attr("stroke-width", "0").attr("fill", "url(#landdef)");  
  
    // biome / heights
    let g = chart.append("g").attr("id", "epbiomes");
    const hu = heightUnit.value;
    for(var k=0; k<chartData.points.length; k++) {
      const x = chartData.points[k][0];
      const y = yOffset + chartHeight;
      const c = biomesData.color[chartData.biome[k]];
      const dataTip = biomesData.name[chartData.biome[k]]+" (" + chartData.height[k] + " " + hu + ")";
  
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
    var y1 = 0;
    var add = 15;
    for (let k=0; k<chartData.points.length; k++)
    {
      if (chartData.burg[k] > 0) {
        let b = chartData.burg[k];
  
        var x1 = chartData.points[k][0];
        y1+=add;
        if (y1 >= yOffset) { y1 = add; }
        var d1 = 0;
  
        // burg name
        g.append("text").attr("id", "ep" + b).attr("class", "epburglabel").attr("x", x1).attr("y", y1).attr("text-anchor", "middle");
        document.getElementById("ep" + b).innerHTML = pack.burgs[b].name;
  
        // arrow from burg name to graph line
        g.append("path").attr("id", "eparrow" + b).attr("d", "M" + x1.toString() + "," + (y1+3).toString() + "L" + x1.toString() + "," + parseInt(chartData.points[k][1]-3).toString()).attr("stroke", "darkgray").attr("fill", "lightgray").attr("stroke-width", "1").attr("marker-end", "url(#arrowhead)");
      }
    }
  }
}

