import {rn} from "../utils/numberUtils";

export function drawLegend(name: string, data: unknown[]) {
  legend.selectAll("*").remove(); // fully redraw every time
  legend.attr("data", data.join("|")); // store data

  const itemsInCol = +styleLegendColItems.value;
  const fontSize = +legend.attr("font-size");
  const backClr = styleLegendBack.value;
  const opacity = +styleLegendOpacity.value;

  const lineHeight = Math.round(fontSize * 1.7);
  const colorBoxSize = Math.round(fontSize / 1.7);
  const colOffset = fontSize;
  const vOffset = fontSize / 2;

  // append items
  const boxes = legend.append("g").attr("stroke-width", 0.5).attr("stroke", "#111111").attr("stroke-dasharray", "none");
  const labels = legend.append("g").attr("fill", "#000000").attr("stroke", "none");

  const columns = Math.ceil(data.length / itemsInCol);
  for (let column = 0, i = 0; column < columns; column++) {
    const linesInColumn = Math.ceil(data.length / columns);
    const offset = column ? colOffset * 2 + legend.node().getBBox().width : colOffset;

    for (let l = 0; l < linesInColumn && data[i]; l++, i++) {
      boxes
        .append("rect")
        .attr("fill", data[i][1])
        .attr("x", offset)
        .attr("y", lineHeight + l * lineHeight + vOffset)
        .attr("width", colorBoxSize)
        .attr("height", colorBoxSize);

      labels
        .append("text")
        .text(data[i][2])
        .attr("x", offset + colorBoxSize * 1.6)
        .attr("y", fontSize / 1.6 + lineHeight + l * lineHeight + vOffset);
    }
  }

  // append label
  const offset = colOffset + legend.node().getBBox().width / 2;
  labels
    .append("text")
    .attr("text-anchor", "middle")
    .attr("font-weight", "bold")
    .attr("font-size", "1.2em")
    .attr("id", "legendLabel")
    .text(name)
    .attr("x", offset)
    .attr("y", fontSize * 1.1 + vOffset / 2);

  // append box
  const bbox = legend.node().getBBox();
  const width = bbox.width + colOffset * 2;
  const height = bbox.height + colOffset / 2 + vOffset;

  legend
    .insert("rect", ":first-child")
    .attr("id", "legendBox")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", width)
    .attr("height", height)
    .attr("fill", backClr)
    .attr("fill-opacity", opacity);

  fitLegendBox();
}

// fit Legend box to canvas size
export function fitLegendBox() {
  if (!legend.selectAll("*").size()) return;
  const px = isNaN(+legend.attr("data-x")) ? 99 : legend.attr("data-x") / 100;
  const py = isNaN(+legend.attr("data-y")) ? 93 : legend.attr("data-y") / 100;
  const bbox = legend.node().getBBox();
  const x = rn(svgWidth * px - bbox.width),
    y = rn(svgHeight * py - bbox.height);
  legend.attr("transform", `translate(${x},${y})`);
}

// draw legend with the same data, but using different settings
export function redrawLegend() {
  if (!legend.select("rect").size()) return;
  const name = legend.select("#legendLabel").text();
  const data = legend
    .attr("data")
    .split("|")
    .map(l => l.split(","));
  drawLegend(name, data);
}

export function dragLegendBox() {
  const tr = parseTransform(this.getAttribute("transform"));
  const x = +tr[0] - d3.event.x;
  const y = +tr[1] - d3.event.y;
  const bbox = legend.node().getBBox();

  d3.event.on("drag", function () {
    const px = rn(((x + d3.event.x + bbox.width) / svgWidth) * 100, 2);
    const py = rn(((y + d3.event.y + bbox.height) / svgHeight) * 100, 2);
    const transform = `translate(${x + d3.event.x},${y + d3.event.y})`;
    legend.attr("transform", transform).attr("data-x", px).attr("data-y", py);
  });
}

export function clearLegend() {
  legend.selectAll("*").remove();
  legend.attr("data", null);
}
