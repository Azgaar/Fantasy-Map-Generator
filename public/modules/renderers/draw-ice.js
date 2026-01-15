"use strict";

// Ice layer renderer - renders ice from data model to SVG
function drawIce() {
  TIME && console.time("drawIce");

  // Clear existing ice SVG
  ice.selectAll("*").remove();

  let html = "";

  // Draw all ice elements
  pack.ice.forEach(iceElement => {
    if (iceElement.type === "glacier") {
      html += getGlacierHtml(iceElement);
    } else if (iceElement.type === "iceberg") {
      html += getIcebergHtml(iceElement);
    }
  });

  ice.html(html);

  TIME && console.timeEnd("drawIce");
}

function redrawIceberg(id) {
  TIME && console.time("redrawIceberg");
  const iceberg = pack.ice.find(element => element.i === id);
  let el = ice.selectAll(`polygon[data-id="${id}"]:not([type="glacier"])`);
  if (!iceberg && !el.empty()) {
    el.remove();
  } else {
    if (el.empty()) {
      // Create new element if it doesn't exist
      const polygon = getIcebergHtml(iceberg);
      ice.node().insertAdjacentHTML("beforeend", polygon);
      el = ice.selectAll(`polygon[data-id="${id}"]:not([type="glacier"])`);
    }
    el.attr("points", iceberg.points);
    el.attr("transform", iceberg.offset ? `translate(${iceberg.offset[0]},${iceberg.offset[1]})` : null);
  }
  TIME && console.timeEnd("redrawIceberg");
}

function redrawGlacier(id) {
  TIME && console.time("redrawGlacier");
  const glacier = pack.ice.find(element => element.i === id);
  let el = ice.selectAll(`polygon[data-id="${id}"][type="glacier"]`);
  if (!glacier && !el.empty()) {
    el.remove();
  } else {
    if (el.empty()) {
      // Create new element if it doesn't exist
      const polygon = getGlacierHtml(glacier);
      ice.node().insertAdjacentHTML("beforeend", polygon);
      el = ice.selectAll(`polygon[data-id="${id}"][type="glacier"]`);
    }
    el.attr("points", glacier.points);
    el.attr("transform", glacier.offset ? `translate(${glacier.offset[0]},${glacier.offset[1]})` : null);
  }
  TIME && console.timeEnd("redrawGlacier");
}

function getGlacierHtml(glacier) {
  return `<polygon points="${glacier.points}" type="glacier" data-id="${glacier.i}" ${glacier.offset ? `transform="translate(${glacier.offset[0]},${glacier.offset[1]})"` : ""}/>`;
}

function getIcebergHtml(iceberg) {
  return `<polygon points="${iceberg.points}" data-id="${iceberg.i}" ${iceberg.offset ? `transform="translate(${iceberg.offset[0]},${iceberg.offset[1]})"` : ""}/>`;
}