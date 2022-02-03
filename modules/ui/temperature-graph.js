"use strict";

function showBurgTemperatureGraph(id) {
  const b = pack.burgs[id];
  const lat = mapCoordinates.latN - (b.y / graphHeight) * mapCoordinates.latT;
  const temperature = grid.cells.temp[pack.cells.g[b.cell]];
  const prec = grid.cells.prec[pack.cells.g[b.cell]];

  // prettier-ignore
  const weights = [
    [// Layer0
      [10.782752257744338, 2.7100404240962126],
      [-2.8226802110591462, 51.62920138583541],
      [-6.6250956268643835, 4.427939197315455],
      [-59.64690518541339, 41.89084162654791],
      [-1.3302059550553835, -3.6964487738450913],
      [-2.5844898544535497, 0.09879268612455298],
      [-5.58528252533573, -0.23426224364501905],
      [26.94531337690372, 20.898158905988907],
      [3.816397481634785, -0.19045424064580757],
      [-4.835697931609101, -10.748232783636434]
    ],
    [// Layer1
      [-2.478952081870123, 0.6405800134306895, -7.136785640930911, -0.2186529024764509, 3.6568435212735424, 31.446026153530838, -19.91005187482281, 0.2543395274783306, -7.036924569659988, -0.7721371621651565],
      [-197.10583739743538, 6.889921141533474, 0.5058941504631129, 7.7667203434606416, -53.74180550086929, -15.717331715167001, -61.32068414155791, -2.259728220978728, 35.84049189540032, 94.6157364730977],
      [-5.312011591880851, -0.09923148954215096, -1.7132477487917586, -22.55559652066422, 0.4806107280554336, -26.5583974109492, 2.0558257347014863, 25.815645234787432, -18.569029876991156, -2.6792003366730035],
      [20.706518520569514, 18.344297403881875, 99.52244671131733, -58.53124969563653, -60.74384321042212, -80.57540534651835, 7.884792406540866, -144.33871131678563, 80.134199744324, 20.50745285622448],
      [-52.88299538575159, -15.782505343805528, 16.63316001054924, 88.09475330556671, -17.619552086641818, -19.943999528182427, -120.46286026828177, 19.354752020806302, 43.49422099308949, 28.733924806541363],
      [-2.4621368711159897, -1.2074759925679757, -1.5133898639835084, 2.173715352424188, -5.988707597991683, 3.0234147182203843, 3.3284199340000797, -1.8805161326360575, 5.151910934121654, -1.2540553911612116]
    ],
    [// Layer2
      [-0.3357437479474717, 0.01430651794222215, -0.7927524256670906, 0.2121636229648523, 1.0587803023358318, -3.759288325505095],
      [-1.1988028704442968, 1.3768997508052783, -3.8480086358278816, 0.5289387340947143, 0.5769459339961177, -1.2528318145750772],
      [1.0074966649240946, 1.155301164699459, -2.974254371052421, 0.47408176553219467, 0.5939042688615264, -0.7631976947131744]
    ]
  ];
  // From (-∞,∞) to ~[-1,1]
  const In1 = [(Math.abs(lat) - 26.950680212887473) / 48.378128506956, (prec - 12.229929140832644) / 29.94402033696607];

  let lastIn = In1;
  let lstOut = [];

  for (let levelN = 0; levelN < weights.length; levelN++) {
    const layerN = weights[levelN];
    for (let i = 0; i < layerN.length; i++) {
      lstOut[i] = 0;
      for (let j = 0; j < layerN[i].length; j++) {
        lstOut[i] = lstOut[i] + lastIn[j] * layerN[i][j];
      }
      // sigmoid
      lstOut[i] = 1 / (1 + Math.exp(-lstOut[i]));
    }
    lastIn = lstOut.slice(0);
  }

  // Standard deviation for average temperature for the year from [0,1] to [min,max]
  const yearSig = lstOut[0] * 62.9466411977018 + 0.28613807855649165;
  // Standard deviation for the difference between the minimum and maximum temperatures for the year
  const yearDelTmpSig = lstOut[1] * 13.541688670361175 + 0.1414213562373084 > yearSig ? yearSig : lstOut[1] * 13.541688670361175 + 0.1414213562373084;
  // Expected value for the difference between the minimum and maximum temperatures for the year
  const yearDelTmpMu = lstOut[2] * 15.266666666666667 + 0.6416666666666663;

  // Temperature change shape
  const delT = yearDelTmpMu / 2 + (0.5 * yearDelTmpSig) / 2;
  const minT = temperature - (yearSig + delT > 15 ? yearSig + delT : 15);
  const maxT = temperature + (temperature - minT);

  // height of land/sea profile, excluding the biomes data below
  const chartWidth = window.innerWidth / 2;
  const chartHeight = 300;

  // drawing starting point from top-left (y = 0) of SVG
  const xOffset = 80;
  const yOffset = 10;

  const xscale = d3.scaleLinear().domain([0, 360]).range([0, chartWidth]);
  const xscale_inv = d3.scaleLinear().domain([0, chartWidth]).range([0, 360]);
  const yscale = d3.scaleLinear().domain([minT, maxT]).range([chartHeight, 0]);
  const yscale_inv = d3.scaleLinear().domain([chartHeight, 0]).range([minT, maxT]);

  const dataAverTmp = [];
  const dataMinTmp = [];
  const dataMaxTmp = [];

  for (let i = 0; i < 360; i++) {
    let formTmp = Math.cos((i / 360) * 2 * Math.PI) / 2;
    if (lat > 0) formTmp = -formTmp;
    const averT = formTmp * yearSig + temperature;
    const delT = yearDelTmpMu / 2 + (formTmp * yearDelTmpSig) / 2;
    dataAverTmp.push({x: xscale(i) + xOffset, y: yscale(averT) + yOffset});
    dataMinTmp.push({x: xscale(i) + xOffset, y: yscale(averT - delT) + yOffset});
    dataMaxTmp.push({x: xscale(i) + xOffset, y: yscale(averT + delT) + yOffset});
  }

  drawGraph();
  $("#alert").dialog({title: "Anual temperature in " + b.name, position: {my: "center", at: "center", of: "svg"}});

  function drawGraph() {
    alertMessage.innerHTML = "";

    const legendSize = 60;
    const chart = d3
      .select("#alertMessage")
      .append("svg")
      .attr("width", chartWidth + 120)
      .attr("height", chartHeight + yOffset + legendSize)
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
      .attr("refY", "2");

    let Gen = d3
      .line()
      .curve(d3.curveBasis)
      .x(p => p.x)
      .y(p => p.y);

    //print graphs
    chart
      .append("g")
      .append("path")
      .attr("d", Gen(dataAverTmp))
      .attr("fill", "none")
      .attr("stroke", "orange")
      .on("mousemove", printVal)
      .style("stroke-width", "2");
    chart
      .append("g")
      .append("path")
      .attr("d", Gen(dataMinTmp))
      .attr("fill", "none")
      .attr("stroke", "blue")
      .on("mousemove", printVal)
      .style("stroke-width", "2");
    chart.append("g").append("path").attr("d", Gen(dataMaxTmp)).attr("fill", "none").attr("stroke", "red").on("mousemove", printVal).style("stroke-width", "2");

    //print legend
    chart
      .append("circle")
      .attr("cx", (chartWidth * 1) / 4)
      .attr("cy", chartHeight + yOffset + legendSize * 0.8)
      .attr("r", 4)
      .style("fill", "red");
    chart
      .append("text")
      .attr("x", (chartWidth * 1) / 4 + 20)
      .attr("y", chartHeight + yOffset + legendSize * 0.8)
      .text("Day temperature")
      .style("font-size", "10px")
      .attr("alignment-baseline", "middle");
    chart
      .append("circle")
      .attr("cx", (chartWidth * 2) / 4)
      .attr("cy", chartHeight + yOffset + legendSize * 0.8)
      .attr("r", 4)
      .style("fill", "orange");
    chart
      .append("text")
      .attr("x", (chartWidth * 2) / 4 + 20)
      .attr("y", chartHeight + yOffset + legendSize * 0.8)
      .text("Average daily temperature")
      .style("font-size", "10px")
      .attr("alignment-baseline", "middle");
    chart
      .append("circle")
      .attr("cx", (chartWidth * 3) / 4)
      .attr("cy", chartHeight + yOffset + legendSize * 0.8)
      .attr("r", 4)
      .style("fill", "blue");
    chart
      .append("text")
      .attr("x", (chartWidth * 3) / 4 + 20)
      .attr("y", chartHeight + yOffset + legendSize * 0.8)
      .text("Night temperature")
      .style("font-size", "10px")
      .attr("alignment-baseline", "middle");

    //print title
    let timerId = setTimeout(() => chart.attr("data-tip", "Seasonal temperature schedule"), 1000);

    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    //Val under line
    function printVal() {
      let m = d3.mouse(this);
      let tmp = convertTemperature(yscale_inv(m[1] - yOffset).toFixed(1));
      let month = months[parseInt((xscale_inv(m[0] - xOffset) / 360) * 12)];
      chart.attr("data-tip", tmp + " in " + month);
      clearTimeout(timerId);
      timerId = setTimeout(() => chart.attr("data-tip", "Seasonal temperature schedule"), 1000);
    }

    const xAxis = d3
      .axisBottom(xscale)
      .ticks(10)
      .tickFormat(function (d) {
        return months[parseInt((d / 360) * 12)];
      });
    const yAxis = d3
      .axisLeft(yscale)
      .ticks(5)
      .tickFormat(function (d) {
        return convertTemperature(d);
      });

    const xGrid = d3.axisBottom(xscale).ticks(10).tickSize(-chartHeight).tickFormat("");
    const yGrid = d3.axisLeft(yscale).ticks(5).tickSize(-chartWidth).tickFormat("");

    chart
      .append("g")
      .attr("id", "epxaxis")
      .attr("transform", "translate(" + xOffset + "," + parseInt(chartHeight + +yOffset + 20) + ")")
      .call(xAxis)
      .selectAll("text")
      .style("text-anchor", "center")
      .attr("transform", function (d) {
        return "rotate(0)"; // used to rotate labels, - anti-clockwise, + clockwise
      });

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

    if (minT < 0 && maxT > 0) {
      //add zero lv
      chart
        .append("g")
        .append("line")
        .attr("x1", xscale(0) + xOffset)
        .attr("y1", yscale(0) + yOffset)
        .attr("x2", xscale(360) + xOffset)
        .attr("y2", yscale(0) + yOffset)
        .attr("stroke", "black");
    }

    // add the Y gridlines
    chart
      .append("g")
      .attr("id", "epygrid")
      .attr("class", "epgrid")
      .attr("stroke-dasharray", "4 1")
      .attr("transform", "translate(" + xOffset + "," + yOffset + ")")
      .call(yGrid);
  }
}
