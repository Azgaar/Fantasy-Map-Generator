"use strict";

// Ice layer renderer - renders ice from data model to SVG
function drawIce() {
  TIME && console.time("drawIce");

  // Clear existing ice SVG
  ice.selectAll("*").remove();

  let html = "";

  // Draw glaciers
  pack.ice.glaciers.forEach((glacier, index) => {
    html += getGlacierHtml(glacier, index);
  });

  // Draw icebergs
  pack.ice.icebergs.forEach((iceberg, index) => {
    html += getIcebergHtml(iceberg, index);
  });

  ice.html(html);

  TIME && console.timeEnd("drawIce");
}

function redrawIceberg(index) {
  TIME && console.time("redrawIceberg");
  const iceberg = pack.ice.icebergs[index];
  let el = ice.selectAll(`polygon[data-index="${index}"]:not([type="glacier"])`);
  if (!iceberg && !el.empty()) {
    el.remove();
  } else {
    if (el.empty()) {
      // Create new element if it doesn't exist
      const polygon = getIcebergHtml(iceberg, index);
      ice.node().insertAdjacentHTML("beforeend", polygon);
      el = ice.selectAll(`polygon[data-index="${index}"]:not([type="glacier"])`);
    }
    el.attr("points", iceberg.points);
    el.attr("transform", iceberg.offset ? `translate(${iceberg.offset[0]},${iceberg.offset[1]})` : null);
  }
  TIME && console.timeEnd("redrawIceberg");
}

function redrawGlacier(index) {
  TIME && console.time("redrawGlacier");
  const glacier = pack.ice.glaciers[index];
  let el = ice.selectAll(`polygon[data-index="${index}"][type="glacier"]`);
  if (!glacier && !el.empty()) {
    el.remove();
  } else {
    if (el.empty()) {
      // Create new element if it doesn't exist
      const polygon = getGlacierHtml(glacier, index);
      ice.node().insertAdjacentHTML("beforeend", polygon);
      el = ice.selectAll(`polygon[data-index="${index}"][type="glacier"]`);
    }
    el.attr("points", glacier.points);
    el.attr("transform", glacier.offset ? `translate(${glacier.offset[0]},${glacier.offset[1]})` : null);
  }
  TIME && console.timeEnd("redrawGlacier");
}

function getGlacierHtml(glacier, index) {
  return `<polygon points="${glacier.points}" type="glacier" data-index="${index}" ${glacier.offset ? `transform="translate(${glacier.offset[0]},${glacier.offset[1]})"` : ""}/>`;
}

function getIcebergHtml(iceberg, index) {
  return `<polygon points="${iceberg.points}" data-index="${index}" ${iceberg.offset ? `transform="translate(${iceberg.offset[0]},${iceberg.offset[1]})"` : ""}/>`;
}