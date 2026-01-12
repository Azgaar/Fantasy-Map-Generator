"use strict";

// Ice layer renderer - renders ice from data model to SVG
function drawIce() {
  TIME && console.time("drawIce");

  // Clear existing ice SVG
  ice.selectAll("*").remove();

  // Draw glaciers
  pack.ice.glaciers.forEach((glacier, index) => {
    ice
      .append("polygon")
      .attr("points", glacier.points)
      .attr("type", "iceShield")
      .attr("data-index", index)
      .attr("transform", glacier.offset ? `translate(${glacier.offset[0]},${glacier.offset[1]})` : null)
      .attr("class", "glacier");
  });

  // Draw icebergs
  pack.ice.icebergs.forEach((iceberg, index) => {
    ice
      .append("polygon")
      .attr("points", iceberg.points)
      .attr("cell", iceberg.cellId)
      .attr("size", iceberg.size)
      .attr("data-index", index)
      .attr("transform", iceberg.offset ? `translate(${iceberg.offset[0]},${iceberg.offset[1]})` : null)
      .attr("class", "iceberg");
  });

  TIME && console.timeEnd("drawIce");
}

// Re-render ice layer from data model
function redrawIce() {
  drawIce();
}
