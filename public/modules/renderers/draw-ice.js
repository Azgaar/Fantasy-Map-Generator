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

  function getGlacierHtml(glacier, index) {
    return `<polygon points="${glacier.points}" type="iceShield" data-index="${index}" ${glacier.offset ? `transform="translate(${glacier.offset[0]},${glacier.offset[1]})"` : ""} class="glacier"/>`;
  }

  function getIcebergHtml(iceberg, index) {
    return `<polygon points="${iceberg.points}" cell="${iceberg.cellId}" size="${iceberg.size}" data-index="${index}" ${iceberg.offset ? `transform="translate(${iceberg.offset[0]},${iceberg.offset[1]})"` : ""} class="iceberg"/>`;
  }
}

function redrawIceberg(index) {
  TIME && console.time("redrawIceberg");
  const iceberg = pack.ice.icebergs[index];
  let el = ice.selectAll(`.iceberg[data-index="${index}"]`);
  if (!iceberg && !el.empty()) {
    el.remove();
  } else {
    if (el.empty()) {
      // Create new element if it doesn't exist
      const polygon = getIcebergHtml(iceberg, index);
      ice.node().insertAdjacentHTML("beforeend", polygon);
      el = ice.selectAll(`.iceberg[data-index="${index}"]`);
    }
    el.attr("points", iceberg.points);
    el.attr("size", iceberg.size);
    el.attr("cell", iceberg.cellId);
    el.attr("transform", iceberg.offset ? `translate(${iceberg.offset[0]},${iceberg.offset[1]})` : null);
  }
  TIME && console.timeEnd("redrawIceberg");

  function getIcebergHtml(iceberg, index) {
    return `<polygon points="${iceberg.points}" cell="${iceberg.cellId}" size="${iceberg.size}" data-index="${index}" ${iceberg.offset ? `transform="translate(${iceberg.offset[0]},${iceberg.offset[1]})"` : ""} class="iceberg"/>`;
  }
}

function redrawGlacier(index) {
  TIME && console.time("redrawGlacier");
  const glacier = pack.ice.glaciers[index];
  let el = ice.selectAll(`.glacier[data-index="${index}"]`);
  if (!glacier && !el.empty()) {
    el.remove();
  } else {
    if (el.empty()) {
      // Create new element if it doesn't exist
      const polygon = getGlacierHtml(glacier, index);
      ice.node().insertAdjacentHTML("beforeend", polygon);
      el = ice.selectAll(`.glacier[data-index="${index}"]`);
    }
    el.attr("points", glacier.points);
    el.attr("transform", glacier.offset ? `translate(${glacier.offset[0]},${glacier.offset[1]})` : null);
  }
  TIME && console.timeEnd("redrawGlacier");

  function getGlacierHtml(glacier, index) {
    return `<polygon points="${glacier.points}" type="iceShield" data-index="${index}" ${glacier.offset ? `transform="translate(${glacier.offset[0]},${glacier.offset[1]})"` : ""} class="glacier"/>`;
  }
}

// Re-render ice layer from data model
function redrawIce() {
  drawIce();
}
