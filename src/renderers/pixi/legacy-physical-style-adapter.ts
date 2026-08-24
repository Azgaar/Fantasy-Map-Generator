import type { Style } from "@/types/style";
import type {
  HeightBandStyle,
  HeightLayerStyle,
  MapStyle,
  OceanLayerStyle,
  TextureLayerStyle,
  TextureMask
} from "../scene/styles";

/** Import-only adapter for v1/v2 maps whose physical-layer style still lives on serialized SVG groups. */
export function hydrateLegacyPhysicalStyle(appStyle: Pick<Style, "mapRenderer">, root: ParentNode = document): void {
  const stored = appStyle.mapRenderer as Partial<MapStyle> | undefined;
  const legacyOcean = readLegacyOceanStyle(root);
  const ocean = legacyOcean
    ? ({
        ...legacyOcean,
        ...stored?.ocean,
        bands: { ...legacyOcean.bands, ...stored?.ocean?.bands },
        pattern: { ...legacyOcean.pattern, ...stored?.ocean?.pattern }
      } satisfies OceanLayerStyle)
    : stored?.ocean;
  const height = stored?.height ?? readLegacyHeightStyle(root);
  const texture = stored?.texture ?? readLegacyTextureStyle(root);
  if (!ocean && !height && !texture) return;
  appStyle.mapRenderer = {
    ...stored,
    ...(ocean ? { ocean } : {}),
    ...(height ? { height } : {}),
    ...(texture ? { texture } : {})
  } as MapStyle;
}

export function readLegacyOceanStyle(root: ParentNode): OceanLayerStyle | null {
  const layers = root.querySelector<SVGElement>("#oceanLayers");
  const base = root.querySelector<SVGElement>("#oceanBase");
  const pattern = root.querySelector<SVGElement>("#oceanicPattern");
  if (!layers || !base || !pattern) return null;
  return {
    bands: {
      color: "#ecf2f9",
      filter: layers.getAttribute("filter") || null,
      layers: layers.getAttribute("layers") || "none",
      opacity: 0.4
    },
    color: base.getAttribute("fill") || "#466eab",
    opacity: readNumber(base, "opacity", 1),
    pattern: {
      href: pattern.getAttribute("href") || pattern.getAttribute("xlink:href") || null,
      opacity: readNumber(pattern, "opacity", 1),
      tileSize: 100
    }
  };
}

export function readLegacyHeightStyle(root: ParentNode): HeightLayerStyle | null {
  const ocean = root.querySelector<SVGElement>("#oceanHeights");
  const land = root.querySelector<SVGElement>("#landHeights");
  if (!ocean || !land) return null;
  return {
    land: readHeightBand(land),
    ocean: { ...readHeightBand(ocean), render: readNumber(ocean, "data-render", 0) !== 0 }
  };
}

export function readLegacyTextureStyle(root: ParentNode): TextureLayerStyle | null {
  const texture = root.querySelector<SVGElement>("#texture");
  if (!texture) return null;
  return {
    filter: texture.getAttribute("filter") || null,
    href: texture.getAttribute("data-href") || null,
    mask: parseTextureMask(texture.getAttribute("mask")),
    opacity: readNumber(texture, "opacity", 1),
    x: readNumber(texture, "data-x", 0),
    y: readNumber(texture, "data-y", 0)
  };
}

function readHeightBand(element: SVGElement): HeightBandStyle {
  return {
    curve: element.getAttribute("curve") || "curveBasisClosed",
    filter: element.getAttribute("filter") || null,
    opacity: readNumber(element, "opacity", 1),
    relax: readNumber(element, "relax", 0),
    scheme: element.getAttribute("scheme") || "bright",
    skip: readNumber(element, "skip", 0),
    terracing: readNumber(element, "terracing", 0)
  };
}

function parseTextureMask(value: string | null): TextureMask {
  if (value?.includes("#land")) return "land";
  if (value?.includes("#water")) return "water";
  return "none";
}

function readNumber(element: Element, name: string, fallback: number): number {
  const raw = element.getAttribute(name);
  if (raw === null || raw === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}
