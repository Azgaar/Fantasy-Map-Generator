import {getGridPolygon, getPackPolygon} from "utils/graphUtils";

export function drawCells() {
  viewbox.select("#cells").selectAll("path").remove();

  const cellIds = customization === 1 ? grid.cells.i : pack.cells.i;
  const getPolygon = customization === 1 ? getGridPolygon : getPackPolygon;

  const paths = Array.from(cellIds).map(getPolygon);
  viewbox
    .select("#cells")
    .append("path")
    .attr("d", "M" + paths.join("M"));
}
