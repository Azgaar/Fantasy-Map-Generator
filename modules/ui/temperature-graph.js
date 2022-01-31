"use strict";

function showTGForBurg(id) {
	const b = pack.burgs[id];
    const lat = mapCoordinates.latN - (b.y / graphHeight) * mapCoordinates.latT;
    const temperature = grid.cells.temp[pack.cells.g[b.cell]];
    const prec = grid.cells.prec[pack.cells.g[b.cell]];
	
	const weights = [
		[//Layer0
			//IN0               IN1
			[1.7032805665330064, 9.76344839973784], //Neyron0
			[78.11570897168328, 14.601126748769655],    //Neyron1...
			[-17.86260543967271, -18.89959889983629],
			[-5.096416157498042, -3.239101608785143],
			[15.135359078936663, -8.21750087038963],
			[2.89070853797873, 0.748597154917318],
			[-7.071033124823327, 1.0694133212613257],
			[30.89625278090631, -29.58412597781861],
			[8.83742206727876, 2.925882228813251],
			[-23.105918821529457, 59.975819969733955]
		],
		[//Layer1
			[-24.660066638519528, -6.444388451540001, 6.096317239481185, -28.634935067425154, 8.866490165643159, 25.542783838925033, 17.570826750545905, -6.67295071629475, -8.77729799869443, -88.98038329450236],
			[6.38376320044125, -2.7182778686238724, -1.9865485601337416, 10.917347591979627, 34.144968406291774, -32.11415334678534, -38.15179026431855, -11.51948938610541, 0.5380355040386701, -0.607356926268642],
			[-2.7768468273633093, -48.37419296453233, -62.61815919593951, -19.513164468492786, 93.1761828264018, 14.132428867566691, 17.590766480352126, -14.424771379214942, -40.16821165163309, -0.4757635185201129],
			[0.7126339045981811, 1.3807870964549949, -4.52694413868832, 8.859114020044535, -25.542800936427525, -17.052646819490533, -13.45262248737299, 19.04927696239682, 4.3772665027214215, 10.673504480995467],
			[-0.9901713313063913, 1.1537165068921644, 0.7627751991455828, -8.862080579381123, 4.095960737251427, 5.010172336857094, 10.078303996053119, -1.4715229465851472, -8.840479073062008, -0.35367530438937667],
			[3.004754427223695, -3.406260869341714, -18.468433323078546, 51.77036802551895, 65.24063311909613, -7.050118290901991, -29.013152721648716, -131.7678338510577, -32.49691343209261, 2.484670717084914]
		],
		[//Layer2
			[1.7430650921661213, -0.2869375191565024, -0.8484945138945511, -0.9256615130832988, -6.319047898501307, 4.494914932369445],
			[0.9505278662318376, -1.1656186389912937, -2.578920014335076, -1.2897962843278608, -1.57363345004906, 0.937571776650802],
			[1.1869391990570621, 1.214292485154762, -3.0748452401175337, -2.6279324686504615, -0.6747453940846205, 1.1011366399902536]
		]
	];
	
	//From (-∞,∞) to ~[-1,1]
	const In1 = [(lat - 12.976592977893368)/81.9224728505465,(prec - 15.12743823146944)/38.5286376102066];
	
	let lastIn = In1;
	let lstOut = [];
	for (let levelN = 0; levelN < weights.length ; levelN++) {
		let layerN = weights[levelN];
		for (let i = 0; i < layerN.length ; i++) {
			lstOut[i] = 0;
			for (let j = 0; j < layerN[i].length ; j++)
				lstOut[i] = lstOut[i] + lastIn[j]*layerN[i][j] ;
			//Sigmoid
			lstOut[i] = 1/(1+Math.exp(-lstOut[i]));
		}
		lastIn = lstOut.slice(0);
	}
	
	//From [0,1] to [min,max]
	//Standard deviation for average temperature for the year
	const yearSig = lstOut[0]*62;
	//Standard deviation for the difference between the minimum and maximum temperatures for the year
	const yearDelTmpSig = lstOut[1]*12;
	//Expected value for the difference between the minimum and maximum temperatures for the year
	const yearDelTmpMu = lstOut[2]*15+1;
	
	//Temperature change shape
	//const formTmp = -Math.cos(data*2*Math.PI) / 2;
	const delT = yearDelTmpMu/2+0.5*yearDelTmpSig/2;

	const chartWidth = window.innerWidth/2,
	chartHeight = 300; // height of our land/sea profile, excluding the biomes data below
	const xOffset = 80,
    yOffset = 10; // this is our drawing starting point from top-left (y = 0) of SVG
	
    const xscale = d3.scaleLinear().domain([0,360]).range([0, chartWidth]);
    const yscale = d3.scaleLinear().domain([temperature-yearSig-delT, temperature+yearSig+delT]).range([chartHeight, 0]);
    const yscale_inv = d3.scaleLinear().domain([chartHeight, 0]).range([temperature-yearSig-delT, temperature+yearSig+delT]);
	
	const dataAverTmp = [];
	const dataMinTmp = [];
	const dataMaxTmp = [];
	for (let i = 0; i < 360 ; i++) {
		let formTmp = Math.cos(i/360*2*Math.PI) / 2;
		if(lat > 0) formTmp = -formTmp;
		const averT = formTmp * yearSig + temperature;
		const delT = yearDelTmpMu/2+formTmp*yearDelTmpSig/2;
		dataAverTmp.push({x:xscale(i) + xOffset,y:yscale(averT) + yOffset});
		dataMinTmp.push({x:xscale(i) + xOffset,y:yscale(averT-delT) + yOffset});
		dataMaxTmp.push({x:xscale(i) + xOffset,y:yscale(averT+delT) + yOffset});
	}
	
  document.getElementById("epControls").style.visibility = "hidden";

  $("#elevationProfile").dialog({
    title: "Seasonal temperature schedule",
    resizable: false,
    width: window.width,
    close: closeTGForBurg,
    position: {my: "left top", at: "left+20 bottom-500", of: window, collision: "fit"}
  });

  draw();

  function draw() {

    document.getElementById("elevationGraph").innerHTML = "";

    const chart = d3
      .select("#elevationGraph")
      .append("svg")
      .attr("width", chartWidth + 120)
      .attr("height", chartHeight + yOffset + 40)
      .attr("id", "elevationSVG")
      .attr("class", "epbackground");
    // arrow-head definition
    chart.append("defs").append("marker").attr("id", "arrowhead").attr("orient", "auto").attr("markerWidth", "2").attr("markerHeight", "4").attr("refX", "0.1").attr("refY", "2");

    // land
	let Gen = d3.line().curve(d3.curveBasis).x((p) => p.x).y((p) => p.y);

	chart.append("g").append("path").attr("d", Gen(dataAverTmp)).attr("fill", "none").attr("stroke", "orange").on("mousemove", printVal).style("stroke-width", "2");
	chart.append("g").append("path").attr("d", Gen(dataMinTmp)).attr("fill", "none").attr("stroke", "blue").on("mousemove", printVal).style("stroke-width", "2");
	chart.append("g").append("path").attr("d", Gen(dataMaxTmp)).attr("fill", "none").attr("stroke", "red").on("mousemove", printVal).style("stroke-width", "2");
	//print title
	let timerId = setTimeout(() => chart.attr("data-tip", "Seasonal temperature schedule"), 1000);
	//Val under line
	function printVal(){
		let m = d3.mouse(this);
		let val = convertTemperature(yscale_inv(m[1]-yOffset).toFixed(1));
		chart.attr("data-tip", val);
		clearTimeout(timerId);
		timerId = setTimeout(() => chart.attr("data-tip", "Seasonal temperature schedule"), 1000);
	}

	const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

    const xAxis = d3
      .axisBottom(xscale)
      .ticks(10)
      .tickFormat(function (d) {
        return months[parseInt(d/360*12)];
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

    // add the Y gridlines
    chart
      .append("g")
      .attr("id", "epygrid")
      .attr("class", "epgrid")
      .attr("stroke-dasharray", "4 1")
      .attr("transform", "translate(" + xOffset + "," + yOffset + ")")
      .call(yGrid);
  }
  function closeTGForBurg() {
	document.getElementById("epControls").style.visibility = "visible";
    document.getElementById("elevationGraph").innerHTML = "";
    modules.elevation = false;
  }
}