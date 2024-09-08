import { getGridPolygon } from "utils/graphUtils";
import { P, normalize, rn, last } from "utils";
import { clipPoly } from "utils/lineUtils";
import { ERROR } from "config/logging";
import * as d3 from "d3";

export function drawIce() {
  const ice = d3.select("#ice");
  const { ice: icePack } = pack;

  for (const shield of icePack.iceShields) {
    ice
      .append("polygon")
      .attr("points", shield.points.toString())
  }

  for (const iceberg of icePack.icebergs) {
    ice
    .append("polygon")
    .attr("points", iceberg.points.toString())
  }
}
