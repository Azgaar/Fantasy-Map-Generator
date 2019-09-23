"use strict";
function editLake() {
  if (customization) return;
  closeDialogs(".stable");

  $("#routeEditor").dialog({
    title: "Edit Route", resizable: false,
    position: {my: "center top+20", at: "top", of: d3.event, collision: "fit"},
    close: closeLakesEditor
  });

  const node = d3.event.target;
  debug.append("g").attr("id", "controlPoints");
  elSelected = d3.select(node).on("click", addInterimControlPoint);
  drawControlPoints(node);
  //selectRouteGroup(elSelected.node());

  if (modules.editLake) return;
  modules.editLake = true;

  // add listeners


  function drawControlPoints(node) {
    const l = node.getTotalLength();
    const increment = l / Math.ceil(l / 10);
    for (let i=0; i <= l; i += increment) {addControlPoint(node.getPointAtLength(i));}
  }
  
  function addControlPoint(point) {
    debug.select("#controlPoints").append("circle")
      .attr("cx", point.x).attr("cy", point.y).attr("r", .8)
      .call(d3.drag().on("drag", dragControlPoint))
      //.on("click", clickControlPoint);
  }

  function addInterimControlPoint() {
    const point = d3.mouse(this);

    const dists = [];
    debug.select("#controlPoints").selectAll("circle").each(function() {
      const x = +this.getAttribute("cx");
      const y = +this.getAttribute("cy");
      dists.push((point[0] - x) ** 2 + (point[1] - y) ** 2);
    });

    let index = dists.length;
    if (dists.length > 1) {
      const sorted = dists.slice(0).sort((a, b) => a-b);
      const closest = dists.indexOf(sorted[0]);
      const next = dists.indexOf(sorted[1]);
      if (closest <= next) index = closest+1; else index = next+1;
    }

    const before = ":nth-child(" + (index + 1) + ")";
    debug.select("#controlPoints").insert("circle", before)
      .attr("cx", point[0]).attr("cy", point[1]).attr("r", .8)
      .call(d3.drag().on("drag", dragControlPoint))
      .on("click", clickControlPoint);

    redrawLake();
  }
  
  function dragControlPoint() {
    this.setAttribute("cx", d3.event.x);
    this.setAttribute("cy", d3.event.y);
    redrawLake();
  }

  function redrawLake() {
    lineGen.curve(d3.curveCatmullRom.alpha(.1));
    const points = [];
    debug.select("#controlPoints").selectAll("circle").each(function() {
      points.push([this.getAttribute("cx"), this.getAttribute("cy")]);
    });

    elSelected.attr("d", round(lineGen(points)));
  }

  function closeLakesEditor() {
    elSelected.on("click", null);
    clearMainTip();
    debug.select("#controlPoints").remove();
    unselect();
  }
}
