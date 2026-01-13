"use strict";

// Ice layer renderer - renders ice from data model to SVG
function drawIce() {
  TIME && console.time("drawIce");

  // Clear existing ice SVG
  ice.selectAll("*").remove();

  let html = "";

  // Draw glaciers
  pack.ice.glaciers.forEach((glacier, index) => {
    html += `<polygon points="${glacier.points}" type="iceShield" data-index="${index}" ${glacier.offset ? `transform="translate(${glacier.offset[0]},${glacier.offset[1]})"` : ""} class="glacier"/>`;
  });

  // Draw icebergs
  pack.ice.icebergs.forEach((iceberg, index) => {
    html += `<polygon points="${iceberg.points}" cell="${iceberg.cellId}" size="${iceberg.size}" data-index="${index}" ${iceberg.offset ? `transform="translate(${iceberg.offset[0]},${iceberg.offset[1]})"` : ""} class="iceberg"/>`;
  });

  ice.html(html);

  TIME && console.timeEnd("drawIce");
}

// Re-render ice layer from data model
function redrawIce() {
  drawIce();
}
