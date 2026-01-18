"use strict";

function showBurgTemperatureGraph(id) {
  const b = pack.burgs[id];
  const lat = mapCoordinates.latN - (b.y / graphHeight) * mapCoordinates.latT;
  const burgTemp = grid.cells.temp[pack.cells.g[b.cell]];
  const prec = grid.cells.prec[pack.cells.g[b.cell]];

  // prettier-ignore
  const weights = [
    [
      [10.782752257744338, 2.7100404240962126], [-2.8226802110591462, 51.62920138583541], [-6.6250956268643835, 4.427939197315455], [-59.64690518541339, 41.89084162654791], [-1.3302059550553835, -3.6964487738450913],
      [-2.5844898544535497, 0.09879268612455298], [-5.58528252533573, -0.23426224364501905], [26.94531337690372, 20.898158905988907], [3.816397481634785, -0.19045424064580757], [-4.835697931609101, -10.748232783636434]
    ],
    [
      [-2.478952081870123, 0.6405800134306895, -7.136785640930911, -0.2186529024764509, 3.6568435212735424, 31.446026153530838, -19.91005187482281, 0.2543395274783306, -7.036924569659988, -0.7721371621651565],
      [-197.10583739743538, 6.889921141533474, 0.5058941504631129, 7.7667203434606416, -53.74180550086929, -15.717331715167001, -61.32068414155791, -2.259728220978728, 35.84049189540032, 94.6157364730977],
      [-5.312011591880851, -0.09923148954215096, -1.7132477487917586, -22.55559652066422, 0.4806107280554336, -26.5583974109492, 2.0558257347014863, 25.815645234787432, -18.569029876991156, -2.6792003366730035],
      [20.706518520569514, 18.344297403881875, 99.52244671131733, -58.53124969563653, -60.74384321042212, -80.57540534651835, 7.884792406540866, -144.33871131678563, 80.134199744324, 20.50745285622448],
      [-52.88299538575159, -15.782505343805528, 16.63316001054924, 88.09475330556671, -17.619552086641818, -19.943999528182427, -120.46286026828177, 19.354752020806302, 43.49422099308949, 28.733924806541363],
      [-2.4621368711159897, -1.2074759925679757, -1.5133898639835084, 2.173715352424188, -5.988707597991683, 3.0234147182203843, 3.3284199340000797, -1.8805161326360575, 5.151910934121654, -1.2540553911612116]
    ],
    [
      [-0.3357437479474717, 0.01430651794222215, -0.7927524256670906, 0.2121636229648523, 1.0587803023358318, -3.759288325505095],
      [-1.1988028704442968, 1.3768997508052783, -3.8480086358278816, 0.5289387340947143, 0.5769459339961177, -1.2528318145750772],
      [1.0074966649240946, 1.155301164699459, -2.974254371052421, 0.47408176553219467, 0.5939042688615264, -0.7631976947131744]
    ]
  ];
  // From (-∞, ∞) to ~[-1, 1]
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

  // Standard deviation for average temperature for the year from [0, 1] to [min, max]
  const yearSig = lstOut[0] * 62.9466411977018 + 0.28613807855649165;

  // Standard deviation for the difference between the minimum and maximum temperatures for the year
  const yearDelTmpSig =
    lstOut[1] * 13.541688670361175 + 0.1414213562373084 > yearSig
      ? yearSig
      : lstOut[1] * 13.541688670361175 + 0.1414213562373084;

  // Expected value for the difference between the minimum and maximum temperatures for the year
  const yearDelTmpMu = lstOut[2] * 15.266666666666667 + 0.6416666666666663;

  // Temperature change shape
  const delT = yearDelTmpMu / 2 + (0.5 * yearDelTmpSig) / 2;
  const minT = burgTemp - Math.max(yearSig + delT, 15);
  const maxT = burgTemp + (burgTemp - minT);

  const chartWidth = Math.max(window.innerWidth / 2, 520);
  const chartHeight = 300;

  // drawing starting point from top-left (y = 0) of SVG
  const xOffset = 60;
  const yOffset = 10;

  const year = new Date().getFullYear(); // use current year
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];

  const xscale = d3.scaleTime().domain([startDate, endDate]).range([0, chartWidth]);
  const yscale = d3.scaleLinear().domain([minT, maxT]).range([chartHeight, 0]);

  const tempMean = [];
  const tempMin = [];
  const tempMax = [];

  months.forEach((month, index) => {
    const rate = index / 11;
    let formTmp = Math.cos(rate * 2 * Math.PI) / 2;
    if (lat > 0) formTmp = -formTmp;

    const x = rate * chartWidth + xOffset;
    const tempAverage = formTmp * yearSig + burgTemp;
    const tempDelta = yearDelTmpMu / 2 + (formTmp * yearDelTmpSig) / 2;

    tempMean.push([x, yscale(tempAverage) + yOffset]);
    tempMin.push([x, yscale(tempAverage - tempDelta) + yOffset]);
    tempMax.push([x, yscale(tempAverage + tempDelta) + yOffset]);
  });

  drawGraph();

  $("#alert").dialog({
    title: "Average temperature in " + b.name,
    position: {my: "center", at: "center", of: "svg"}
  });

  function drawGraph() {
    alertMessage.innerHTML = "";
    const getCurve = data => round(d3.line().curve(d3.curveBasis)(data), 2);

    const legendSize = 60;
    const chart = d3
      .select("#alertMessage")
      .append("svg")
      .attr("width", chartWidth + 120)
      .attr("height", chartHeight + yOffset + legendSize);

    const legend = chart.append("g");
    const legendY = chartHeight + yOffset + legendSize * 0.8;
    const legendX = n => (chartWidth * n) / 4;
    const legendTextX = n => legendX(n) + 10;
    legend.append("circle").attr("cx", legendX(1)).attr("cy", legendY).attr("r", 4).style("fill", "red");
    legend
      .append("text")
      .attr("x", legendTextX(1))
      .attr("y", legendY)
      .attr("alignment-baseline", "central")
      .text("Day temperature");
    legend.append("circle").attr("cx", legendX(2)).attr("cy", legendY).attr("r", 4).style("fill", "orange");
    legend
      .append("text")
      .attr("x", legendTextX(2))
      .attr("y", legendY)
      .attr("alignment-baseline", "central")
      .text("Mean temperature");
    legend.append("circle").attr("cx", legendX(3)).attr("cy", legendY).attr("r", 4).style("fill", "blue");
    legend
      .append("text")
      .attr("x", legendTextX(3))
      .attr("y", legendY)
      .attr("alignment-baseline", "central")
      .text("Night temperature");

    const xGrid = d3.axisBottom(xscale).ticks().tickSize(-chartHeight);
    const yGrid = d3.axisLeft(yscale).ticks(5).tickSize(-chartWidth);

    const grid = chart.append("g").attr("class", "epgrid").attr("stroke-dasharray", "4 1");
    grid.append("g").attr("transform", `translate(${xOffset}, ${chartHeight + yOffset})`).call(xGrid); // prettier-ignore
    grid.append("g").attr("transform", `translate(${xOffset}, ${yOffset})`).call(yGrid);
    grid.selectAll("text").remove();

    // add zero degree line
    if (minT < 0 && maxT > 0) {
      grid
        .append("line")
        .attr("x1", xOffset)
        .attr("y1", yscale(0) + yOffset)
        .attr("x2", chartWidth + xOffset)
        .attr("y2", yscale(0) + yOffset)
        .attr("stroke", "gray");
    }

    const xAxis = d3.axisBottom(xscale).ticks().tickFormat(d3.timeFormat("%B"));
    const yAxis = d3
      .axisLeft(yscale)
      .ticks(5)
      .tickFormat(v => convertTemperature(v));

    const axis = chart.append("g");
    axis
      .append("g")
      .attr("transform", `translate(${xOffset}, ${chartHeight + yOffset})`)
      .call(xAxis);
    axis.append("g").attr("transform", `translate(${xOffset}, ${yOffset})`).call(yAxis);
    axis.select("path.domain").attr("d", `M0.5,0.5 H${chartWidth + 0.5}`);

    const curves = chart.append("g").attr("fill", "none").style("stroke-width", 2.5);
    curves
      .append("path")
      .attr("d", getCurve(tempMean))
      .attr("data-type", "daily")
      .attr("stroke", "orange")
      .on("mousemove", printVal);
    curves
      .append("path")
      .attr("d", getCurve(tempMin))
      .attr("data-type", "night")
      .attr("stroke", "blue")
      .on("mousemove", printVal);
    curves
      .append("path")
      .attr("d", getCurve(tempMax))
      .attr("data-type", "day")
      .attr("stroke", "red")
      .on("mousemove", printVal);

    function printVal() {
      const [x, y] = d3.mouse(this);
      const type = this.getAttribute("data-type");
      const temp = convertTemperature(yscale.invert(y - yOffset));
      const month = months[rn(((x - xOffset) / chartWidth) * 12)] || months[0];
      tip(`Average ${type} temperature in ${month}: ${temp}`);
    }
  }
}
