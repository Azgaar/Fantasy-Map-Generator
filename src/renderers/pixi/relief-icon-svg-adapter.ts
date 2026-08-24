/** Temporary asset adapter until relief symbols are shipped as a Pixi atlas. */
export function readReliefSvgDataUri(icon: string, root: Document = document): string | null {
  return readSvgSymbolDataUri(icon, root);
}

export interface SvgSymbolPresentation {
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  viewBox?: string;
}

export function readSvgSymbolDataUri(
  icon: string,
  root: Document = document,
  presentation?: SvgSymbolPresentation
): string | null {
  const symbol = root.getElementById(icon);
  if (!(symbol instanceof SVGSymbolElement)) return null;
  const viewBox = presentation?.viewBox || symbol.getAttribute("viewBox") || "0 0 100 100";
  const attributes = presentation
    ? ` fill="${escapeXmlAttribute(presentation.fill)}" fill-opacity="${presentation.fillOpacity}" stroke="${escapeXmlAttribute(presentation.stroke)}" stroke-width="${presentation.strokeWidth}"`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${attributes}>${symbol.innerHTML}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function readSvgElementDataUri(id: string, viewBox: string, root: Document = document): string | null {
  const element = root.getElementById(id);
  if (!(element instanceof SVGElement)) return null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${element.outerHTML}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXmlAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
