// Migration-era compatibility bridge for legacy single-SVG callers.
// New code should use Scene and Layers directly.
// This bridge is intentionally narrow: only three lookups are provided.

declare global {
  var getLayerSvg: (id: string) => SVGSVGElement | null;
  var getLayerSurface: (id: string) => Element | null;
  var queryMap: (selector: string) => Element | null;
}

window.getLayerSvg = (id: string): SVGSVGElement | null => {
  const surface = Layers.get(id)?.surface;
  if (!surface) return null;
  if (surface instanceof SVGSVGElement) return surface;
  const root = surface.closest("svg");
  return root instanceof SVGSVGElement ? root : null;
};

window.getLayerSurface = (id: string): Element | null => {
  return Layers.get(id)?.surface ?? null;
};

window.queryMap = (selector: string): Element | null => {
  return Scene.getMapSvg().querySelector(selector);
};
