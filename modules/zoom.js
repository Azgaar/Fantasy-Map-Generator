"use strict";

// temporary expose to global
let scale = 1;
let viewX = 0;
let viewY = 0;

window.Zoom = (function () {
  function onZoom() {
    const {k, x, y} = d3.event.transform;

    const isScaleChanged = Boolean(scale - k);
    const isPositionChanged = Boolean(viewX - x || viewY - y);
    if (!isScaleChanged && !isPositionChanged) return;

    scale = k;
    viewX = x;
    viewY = y;

    handleZoom(isScaleChanged, isPositionChanged);
  }
  const onZoomDebouced = debounce(onZoom, 50);
  const zoom = d3.zoom().scaleExtent([1, 20]).on("zoom", onZoomDebouced);

  // zoom to a specific point
  function to(x, y, z = 8, d = 2000) {
    const transform = d3.zoomIdentity.translate(x * -z + graphWidth / 2, y * -z + graphHeight / 2).scale(z);
    svg.transition().duration(d).call(zoom.transform, transform);
  }

  // reset zoom to initial
  function reset(d = 1000) {
    svg.transition().duration(d).call(zoom.transform, d3.zoomIdentity);
  }

  function scaleExtent([min, max]) {
    zoom.scaleExtent([min, max]);
  }

  function translateExtent([x1, y1, x2, y2]) {
    zoom.translateExtent([
      [x1, y1],
      [x2, y2]
    ]);
  }

  function scaleTo(element, scale) {
    zoom.scaleTo(element, scale);
  }

  return {to, reset, scaleExtent, translateExtent, scaleTo};
})();
