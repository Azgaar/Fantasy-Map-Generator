import * as d3 from "d3";

import {openDialog} from "dialogs";
import {tip} from "scripts/tooltips";
import {handleMapClick} from "./onclick";
import {onMouseMove} from "./onhover";
import {clearLegend, dragLegendBox} from "modules/legend.js"; //MARKER: modules/legend.js

export function setDefaultEventHandlers() {
  window.Zoom.setZoomBehavior();

  viewbox
    .style("cursor", "default")
    .on(".drag", null)
    .on("click", handleMapClick)
    .on("touchmove mousemove", onMouseMove);

  scaleBar.on("mousemove", () => tip("Click to open Units Editor")).on("click", () => openDialog("unitsEditor"));

  legend
    .on("mousemove", () => tip("Drag to change the position. Click to hide the legend"))
    .on("click", clearLegend)
    .call(d3.drag().on("start", dragLegendBox));
}
