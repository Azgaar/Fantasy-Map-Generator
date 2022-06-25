export function restoreDefaultEvents() {
  Zoom.setZoomBehavior();
  viewbox.style("cursor", "default").on(".drag", null).on("click", clicked).on("touchmove mousemove", onMouseMove);
  legend.call(d3.drag().on("start", dragLegendBox));
}
