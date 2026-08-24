import type { Style } from "@/types/style";
import { GRID_PATTERN_TYPES, type GridPatternType } from "./layers/grid-scene";
import { getMapRendererStyle } from "./map-style-state";
import type { MapStyle, PointSymbolStyle, SemanticLineStyle } from "./styles";

export type LegacyStylePresetValue = boolean | number | string | null | undefined;
export type LegacyStylePresetAttributes = Record<string, LegacyStylePresetValue>;
export type LegacyStylePreset = Record<string, LegacyStylePresetAttributes | undefined>;

const FALLBACK_LINES = {
  roads: { cap: "butt", color: "#d06324", dash: "2", opacity: 0.9, width: 0.7 },
  searoutes: { cap: "round", color: "#ffffff", dash: "1 2", opacity: 0.9, width: 0.35 },
  trails: { cap: "butt", color: "#d06324", dash: ".8 1.6", opacity: 0.9, width: 0.25 }
} as const satisfies Record<string, SemanticLineStyle>;

export function applyLegacyStylePresetToMapStyle(
  appStyle: Pick<Style, "mapRenderer">,
  preset: LegacyStylePreset,
  burgGroupNames: readonly string[] = []
): MapStyle {
  const next = getMapRendererStyle(appStyle);
  applyPhysicalStyles(next, preset);
  applyCellStyles(next, preset);
  applyLineAndAreaStyles(next, preset);
  applyEntityStyles(next, preset, burgGroupNames);
  appStyle.mapRenderer = next;
  return structuredClone(next);
}

/**
 * Imports renderer style from the SVG section of pre-Pixi map files. The returned state is semantic and can outlive
 * removal of every imported feature group. Current-format maps already contain `mapRenderer` and skip this adapter.
 */
export function hydrateLegacySvgStyle(
  appStyle: Pick<Style, "mapRenderer">,
  root: ParentNode,
  burgGroupNames: readonly string[] = []
): MapStyle {
  if (appStyle.mapRenderer) return getMapRendererStyle(appStyle);

  const schemaStyle = getMapRendererStyle({} as Pick<Style, "mapRenderer">);
  const schema = serializeMapStyleToLegacyPreset(schemaStyle, burgGroupNames);
  const preset: LegacyStylePreset = {};

  for (const [selector, attributes] of Object.entries(schema)) {
    if (!attributes) continue;
    const element = queryLegacyStyleElement(root, selector);
    if (!element) continue;

    const imported: LegacyStylePresetAttributes = {};
    for (const attribute of Object.keys(attributes)) {
      const value = readLegacyStyleValue(element, attribute);
      if (value !== null && value !== "") imported[attribute] = value;
    }
    if (Object.keys(imported).length) preset[selector] = imported;
  }

  return applyLegacyStylePresetToMapStyle(appStyle, preset, burgGroupNames);
}

function queryLegacyStyleElement(root: ParentNode, selector: string): SVGElement | null {
  try {
    return root.querySelector<SVGElement>(selector);
  } catch {
    return null;
  }
}

function readLegacyStyleValue(element: SVGElement, attribute: string): string | null {
  const inlineValue = element.style?.getPropertyValue(attribute);
  if (inlineValue) return inlineValue;
  if (attribute === "href") return element.getAttribute("href") || element.getAttribute("xlink:href");
  return element.getAttribute(attribute);
}

export function serializeMapStyleToLegacyPreset(
  rendererStyle: MapStyle,
  burgGroupNames: readonly string[] = []
): LegacyStylePreset {
  const preset: LegacyStylePreset = {
    "#map": { filter: rendererStyle.filter },
    "#armies": {
      "box-size": rendererStyle.military.boxSize,
      "fill-opacity": rendererStyle.military.fillOpacity,
      "font-size": rendererStyle.military.boxSize * 2,
      opacity: rendererStyle.military.opacity,
      stroke: rendererStyle.military.stroke,
      "stroke-width": rendererStyle.military.strokeWidth
    },
    "#biomes": {
      ...serializeLine(rendererStyle.biomes.stroke),
      filter: rendererStyle.biomes.filter,
      opacity: rendererStyle.biomes.opacity
    },
    "#cells": { opacity: rendererStyle.cells.opacity, ...serializeLine(rendererStyle.cells) },
    "#compass": { opacity: rendererStyle.compass.opacity },
    "#compass > use": {
      transform: `translate(${rendererStyle.compass.x} ${rendererStyle.compass.y}) scale(${rendererStyle.compass.scale})`
    },
    "#coordinates": {
      ...serializeLine(rendererStyle.coordinates.stroke),
      "data-size": rendererStyle.coordinates.fontSize,
      filter: rendererStyle.coordinates.filter,
      "font-size": rendererStyle.coordinates.fontSize,
      opacity: rendererStyle.coordinates.opacity
    },
    "#cults": {
      ...serializeLine(rendererStyle.cultures.stroke),
      filter: rendererStyle.cultures.filter,
      opacity: rendererStyle.cultures.opacity
    },
    "#emblems": {
      "data-automatic-visibility": Number(rendererStyle.emblems.automaticVisibility),
      filter: rendererStyle.emblems.filter,
      opacity: rendererStyle.emblems.opacity,
      "stroke-width": rendererStyle.emblems.strokeWidth
    },
    "#emblems > #burgEmblems": { "data-size": rendererStyle.emblems.burgSize },
    "#emblems > #provinceEmblems": { "data-size": rendererStyle.emblems.provinceSize },
    "#emblems > #stateEmblems": { "data-size": rendererStyle.emblems.stateSize },
    "#goodsBurgs": {
      "data-size": rendererStyle.goods.burgs.iconSize,
      opacity: rendererStyle.goods.burgs.opacity,
      stroke: rendererStyle.goods.burgs.stroke,
      "stroke-width": rendererStyle.goods.burgs.strokeWidth
    },
    "#goodsCells": { opacity: rendererStyle.goods.cells.opacity },
    "#goodsIcons": {
      "data-circle": Number(rendererStyle.goods.icons.circle),
      "data-size": rendererStyle.goods.icons.size,
      opacity: rendererStyle.goods.icons.opacity,
      "stroke-width": rendererStyle.goods.icons.strokeWidth
    },
    "#gridOverlay": {
      ...serializeLine(rendererStyle.grid.stroke),
      dx: rendererStyle.grid.dx,
      dy: rendererStyle.grid.dy,
      opacity: rendererStyle.grid.opacity,
      scale: rendererStyle.grid.scale,
      type: rendererStyle.grid.type
    },
    "#ice": {
      fill: rendererStyle.ice.default.fill.color,
      opacity: rendererStyle.ice.default.fill.opacity,
      stroke: rendererStyle.ice.default.stroke.color,
      "stroke-linecap": rendererStyle.ice.default.stroke.cap,
      "stroke-width": rendererStyle.ice.default.stroke.width
    },
    "#landmass": { fill: rendererStyle.landmass.color, opacity: rendererStyle.landmass.opacity },
    "#markets": {
      "data-icon": rendererStyle.markets.icon,
      "data-size": rendererStyle.markets.radius,
      "fill-opacity": rendererStyle.markets.areaOpacity,
      "font-size": rendererStyle.markets.iconSize,
      opacity: rendererStyle.markets.opacity,
      "stroke-opacity": rendererStyle.markets.borderOpacity,
      "stroke-width": rendererStyle.markets.borderWidth
    },
    "#markers": {
      opacity: rendererStyle.markers.opacity,
      rescale: Number(rendererStyle.markers.rescale)
    },
    "#oceanBase": { fill: rendererStyle.ocean.color },
    "#oceanLayers": {
      filter: rendererStyle.ocean.bands.filter,
      layers: rendererStyle.ocean.bands.layers
    },
    "#oceanicPattern": {
      href: rendererStyle.ocean.pattern.href ?? "",
      opacity: rendererStyle.ocean.pattern.opacity
    },
    "#population": {
      opacity: rendererStyle.population.opacity,
      "stroke-dasharray": rendererStyle.population.rural.dash,
      "stroke-linecap": rendererStyle.population.rural.cap,
      "stroke-width": rendererStyle.population.rural.width
    },
    "#prec": {
      ...serializeLine(rendererStyle.precipitation.stroke),
      fill: rendererStyle.precipitation.fill.color,
      opacity: rendererStyle.precipitation.opacity
    },
    "#provinceBorders": serializeLine(rendererStyle.borders.province),
    "#provs": {
      ...serializeLine(rendererStyle.provinces.stroke),
      filter: rendererStyle.provinces.filter,
      opacity: rendererStyle.provinces.opacity
    },
    "#relig": {
      ...serializeLine(rendererStyle.religions.stroke),
      filter: rendererStyle.religions.filter,
      opacity: rendererStyle.religions.opacity
    },
    "#rivers": { fill: rendererStyle.rivers.fill.color, opacity: rendererStyle.rivers.opacity },
    "#rural": { stroke: rendererStyle.population.rural.color },
    "#stateBorders": serializeLine(rendererStyle.borders.state),
    "#statesBody": {
      ...serializeLine(rendererStyle.states.stroke),
      filter: rendererStyle.states.filter,
      opacity: rendererStyle.states.opacity
    },
    "#statesHalo": {
      "data-width": rendererStyle.states.halo.width,
      filter: `blur(${rendererStyle.states.halo.blur}px)`,
      opacity: rendererStyle.states.halo.opacity,
      "stroke-width": rendererStyle.states.halo.width
    },
    "#temperature": {
      ...serializeLine(rendererStyle.temperature.stroke),
      fill: rendererStyle.temperature.labels.color,
      "fill-opacity": rendererStyle.temperature.bandOpacity,
      "font-family": rendererStyle.temperature.labels.fontFamily,
      "font-size": rendererStyle.temperature.labels.fontSize,
      opacity: rendererStyle.temperature.opacity
    },
    "#terrain": { opacity: rendererStyle.relief.opacity },
    "#terrs #landHeights": serializeHeightBand(rendererStyle.height.land),
    "#terrs #oceanHeights": {
      "data-render": Number(rendererStyle.height.ocean.render),
      ...serializeHeightBand(rendererStyle.height.ocean)
    },
    "#texture": {
      "data-href": rendererStyle.texture.href,
      "data-x": rendererStyle.texture.x,
      "data-y": rendererStyle.texture.y,
      filter: rendererStyle.texture.filter,
      mask:
        rendererStyle.texture.mask === "land"
          ? "url(#land)"
          : rendererStyle.texture.mask === "water"
            ? "url(#water)"
            : null,
      opacity: rendererStyle.texture.opacity
    },
    "#tradeAnimation": { opacity: rendererStyle.trade.opacity },
    "#urban": { stroke: rendererStyle.population.urban.color },
    "#zones": { ...serializeLine(rendererStyle.zones.stroke), opacity: rendererStyle.zones.opacity }
  };

  for (const [group, line] of Object.entries(rendererStyle.routes.roles)) preset[`#${group}`] = serializeLine(line);
  for (const group of ["roads", "trails", "searoutes"]) {
    preset[`#${group}`] ??= serializeLine(rendererStyle.routes.default);
  }
  for (const [role, line] of Object.entries(rendererStyle.coastline.roles)) {
    preset[`#${role}`] = serializeLine(line);
  }
  for (const [role, area] of Object.entries(rendererStyle.lakes.roles)) {
    preset[`#${role}`] = {
      ...serializeLine(area.stroke),
      fill: area.fill.color,
      opacity: area.fill.opacity
    };
  }
  for (const name of burgGroupNames) {
    preset[`#burgIcons > g#${name}`] = serializePointSymbol(
      rendererStyle.burgIcons.icons.roles[name] ?? rendererStyle.burgIcons.icons.default,
      true
    );
    preset[`#anchors > g#${name}`] = serializePointSymbol(
      rendererStyle.burgIcons.anchors.roles[name] ?? rendererStyle.burgIcons.anchors.default,
      false
    );
  }
  return preset;
}

function applyPhysicalStyles(next: MapStyle, preset: LegacyStylePreset): void {
  const map = preset["#map"];
  if (map) next.filter = textOrNull(map.filter);
  const oceanBase = preset["#oceanBase"];
  const oceanLayers = preset["#oceanLayers"];
  const oceanPattern = preset["#oceanicPattern"];
  if (oceanBase || oceanLayers || oceanPattern) {
    next.ocean = {
      ...next.ocean,
      bands: {
        ...next.ocean.bands,
        filter: textOrNull(oceanLayers?.filter),
        layers: text(oceanLayers?.layers, "none")
      },
      color: text(oceanBase?.fill, next.ocean.color),
      pattern: {
        ...next.ocean.pattern,
        href: textOrNull(oceanPattern?.href),
        opacity: number(oceanPattern?.opacity, 1)
      }
    };
  }

  const texture = preset["#texture"];
  if (texture) {
    const mask = text(texture.mask, "");
    next.texture = {
      filter: textOrNull(texture.filter),
      href: textOrNull(texture["data-href"]),
      mask: mask.includes("#land") ? "land" : mask.includes("#water") ? "water" : "none",
      opacity: number(texture.opacity, 1),
      x: number(texture["data-x"], 0),
      y: number(texture["data-y"], 0)
    };
  }

  const land = preset["#terrs #landHeights"] ?? preset["#landHeights"];
  const ocean = preset["#terrs #oceanHeights"] ?? preset["#oceanHeights"];
  if (land) next.height.land = readHeightBand(land, next.height.land);
  if (ocean) {
    next.height.ocean = {
      ...readHeightBand(ocean, next.height.ocean),
      render: number(ocean["data-render"], next.height.ocean.render ? 1 : 0) !== 0
    };
  }

  const landmass = preset["#landmass"];
  if (landmass) {
    next.landmass = {
      color: text(landmass.fill, next.landmass.color),
      opacity: number(landmass.opacity, next.landmass.opacity)
    };
  }
}

function applyCellStyles(next: MapStyle, preset: LegacyStylePreset): void {
  for (const [layer, selector] of [
    ["biomes", "#biomes"],
    ["cultures", "#cults"],
    ["provinces", "#provs"],
    ["religions", "#relig"],
    ["states", "#statesBody"]
  ] as const) {
    const attributes = preset[selector];
    if (!attributes) continue;
    const layerStyle = next[layer];
    layerStyle.filter = textOrNull(attributes.filter);
    layerStyle.opacity = number(attributes.opacity, layerStyle.opacity);
    layerStyle.stroke = readLine(attributes, layerStyle.stroke);
  }

  const statesHalo = preset["#statesHalo"];
  if (statesHalo) {
    next.states.halo = {
      blur: readBlur(statesHalo.filter, next.states.halo.blur),
      opacity: number(statesHalo.opacity, next.states.halo.opacity),
      width: number(statesHalo["data-width"] ?? statesHalo["stroke-width"], next.states.halo.width)
    };
  }

  const cells = preset["#cells"];
  if (cells) next.cells = readLine(cells, next.cells, number(cells.opacity, next.cells.opacity));

  const grid = preset["#gridOverlay"];
  if (grid) {
    const type = text(grid.type, next.grid.type);
    next.grid = {
      ...next.grid,
      dx: number(grid.dx, 0),
      dy: number(grid.dy, 0),
      opacity: number(grid.opacity, 1),
      scale: number(grid.scale, 1),
      stroke: readLine(grid, next.grid.stroke),
      type: isGridPattern(type) ? type : "pointyHex"
    };
  }

  const coordinates = preset["#coordinates"];
  if (coordinates) {
    next.coordinates = {
      ...next.coordinates,
      filter: textOrNull(coordinates.filter),
      fontSize: number(coordinates["data-size"] ?? coordinates["font-size"], 12),
      opacity: number(coordinates.opacity, 1),
      stroke: readLine(coordinates, next.coordinates.stroke)
    };
  }

  const zones = preset["#zones"];
  if (zones) {
    next.zones = {
      ...next.zones,
      opacity: number(zones.opacity, 1),
      stroke: readLine(zones, next.zones.stroke)
    };
  }
}

function applyLineAndAreaStyles(next: MapStyle, preset: LegacyStylePreset): void {
  const stateBorders = preset["#stateBorders"];
  const provinceBorders = preset["#provinceBorders"];
  if (stateBorders) {
    next.borders.state = readLine(
      stateBorders,
      next.borders.state,
      number(stateBorders.opacity, next.borders.state.opacity)
    );
  }
  if (provinceBorders) {
    next.borders.province = readLine(
      provinceBorders,
      next.borders.province,
      number(provinceBorders.opacity, next.borders.province.opacity)
    );
  }

  const coastlineRoles = { ...next.coastline.roles };
  for (const [role, selector] of [
    ["sea_island", "#sea_island"],
    ["lake_island", "#lake_island"]
  ] as const) {
    const attributes = preset[selector];
    if (!attributes) continue;
    const fallback = coastlineRoles[role] ?? next.coastline.default;
    coastlineRoles[role] = readLine(attributes, fallback, number(attributes.opacity, fallback.opacity));
  }
  next.coastline = { ...next.coastline, roles: coastlineRoles };

  const lakeRoles = { ...next.lakes.roles };
  for (const role of ["freshwater", "salt", "sinkhole", "frozen", "lava", "dry"]) {
    const attributes = preset[`#${role}`];
    if (!attributes) continue;
    const fallback = lakeRoles[role] ?? next.lakes.default;
    lakeRoles[role] = {
      fill: {
        color: text(attributes.fill, fallback.fill.color),
        opacity: number(attributes.opacity, fallback.fill.opacity)
      },
      stroke: readLine(attributes, fallback.stroke)
    };
  }
  next.lakes = { ...next.lakes, roles: lakeRoles };

  const precipitation = preset["#prec"];
  if (precipitation) {
    next.precipitation = {
      ...next.precipitation,
      fill: {
        ...next.precipitation.fill,
        color: text(precipitation.fill, next.precipitation.fill.color)
      },
      opacity: number(precipitation.opacity, 1),
      stroke: readLine(precipitation, next.precipitation.stroke)
    };
  }

  const temperature = preset["#temperature"];
  if (temperature) {
    next.temperature = {
      ...next.temperature,
      bandOpacity: number(temperature["fill-opacity"], 0.3),
      labels: {
        ...next.temperature.labels,
        color: text(temperature.fill, next.temperature.labels.color),
        fontFamily: text(temperature["font-family"], "Arial, sans-serif"),
        fontSize: number(temperature["font-size"], 8),
        fontWeight: "bold"
      },
      opacity: number(temperature.opacity, 1),
      stroke: readLine(temperature, next.temperature.stroke)
    };
  }

  const rivers = preset["#rivers"];
  if (rivers) {
    next.rivers = {
      ...next.rivers,
      fill: { ...next.rivers.fill, color: text(rivers.fill, next.rivers.fill.color) },
      opacity: number(rivers.opacity, 1)
    };
  }

  const relief = preset["#terrain"];
  if (relief) next.relief = { opacity: number(relief.opacity, next.relief.opacity) };

  const routeRoles = { ...next.routes.roles };
  for (const group of ["roads", "trails", "searoutes"] as const) {
    const attributes = preset[`#${group}`];
    if (!attributes) continue;
    const fallback = routeRoles[group] ?? next.routes.default ?? FALLBACK_LINES[group];
    routeRoles[group] = readLine(attributes, fallback, number(attributes.opacity, fallback.opacity));
  }
  next.routes = {
    ...next.routes,
    default: next.routes.default ?? routeRoles.roads ?? FALLBACK_LINES.roads,
    roles: routeRoles
  };

  const ice = preset["#ice"];
  if (ice) {
    const area = {
      fill: {
        color: text(ice.fill, next.ice.default.fill.color),
        opacity: number(ice.opacity, next.ice.default.fill.opacity)
      },
      stroke: readLine(ice, next.ice.default.stroke)
    };
    next.ice = { default: area, opacity: 1, roles: { glacier: area, iceberg: area } };
  }
}

function applyEntityStyles(next: MapStyle, preset: LegacyStylePreset, burgGroupNames: readonly string[]): void {
  const burgIconRoles: Record<string, PointSymbolStyle> = {};
  const burgAnchorRoles: Record<string, PointSymbolStyle> = {};
  for (const name of burgGroupNames) {
    const iconPreset = preset[`#burgIcons > g#${name}`];
    if (iconPreset) burgIconRoles[name] = pointSymbolStyle(iconPreset, "circle");
    const anchorPreset = preset[`#anchors > g#${name}`];
    if (anchorPreset) burgAnchorRoles[name] = pointSymbolStyle(anchorPreset, "anchor");
  }
  if (Object.keys(burgIconRoles).length || Object.keys(burgAnchorRoles).length) {
    next.burgIcons = {
      anchors: {
        default: burgAnchorRoles.town ?? Object.values(burgAnchorRoles)[0] ?? pointSymbolStyle({}, "anchor"),
        roles: burgAnchorRoles
      },
      icons: {
        default: burgIconRoles.town ?? Object.values(burgIconRoles)[0] ?? pointSymbolStyle({}, "circle"),
        roles: burgIconRoles
      },
      opacity: 1
    };
  }

  const markers = preset["#markers"];
  if (markers) {
    next.markers = {
      opacity: number(markers.opacity, 1),
      rescale: Boolean(number(markers.rescale, 1))
    };
  }

  const cells = preset["#goodsCells"];
  const icons = preset["#goodsIcons"];
  const burgs = preset["#goodsBurgs"];
  if (cells || icons || burgs) {
    next.goods = {
      ...next.goods,
      burgs: {
        ...next.goods.burgs,
        iconSize: number(burgs?.["data-size"], next.goods.burgs.iconSize),
        opacity: number(burgs?.opacity, next.goods.burgs.opacity),
        stroke: text(burgs?.stroke, next.goods.burgs.stroke),
        strokeWidth: number(burgs?.["stroke-width"], next.goods.burgs.strokeWidth)
      },
      cells: { opacity: number(cells?.opacity, next.goods.cells.opacity) },
      icons: {
        ...next.goods.icons,
        circle: Boolean(number(icons?.["data-circle"], next.goods.icons.circle ? 1 : 0)),
        opacity: number(icons?.opacity, next.goods.icons.opacity),
        size: number(icons?.["data-size"], next.goods.icons.size),
        strokeWidth: number(icons?.["stroke-width"], next.goods.icons.strokeWidth)
      },
      opacity: 1
    };
  }

  const markets = preset["#markets"];
  if (markets) {
    next.markets = {
      ...next.markets,
      areaOpacity: number(markets["fill-opacity"], 0.03),
      borderOpacity: number(markets["stroke-opacity"], 0.8),
      borderWidth: number(markets["stroke-width"], 1),
      icon: text(markets["data-icon"], "⚖️"),
      iconSize: number(markets["font-size"], 5),
      opacity: number(markets.opacity, 1),
      radius: number(markets["data-size"], 3)
    };
  }

  const population = preset["#population"];
  const rural = preset["#rural"];
  const urban = preset["#urban"];
  if (population || rural || urban) {
    next.population = {
      ...next.population,
      opacity: number(population?.opacity, next.population.opacity),
      rural: readPopulationLine(next.population.rural, population, rural, "#0000ff"),
      urban: readPopulationLine(next.population.urban, population, urban, "#ff0000")
    };
  }

  const armies = preset["#armies"];
  if (armies) {
    next.military = {
      ...next.military,
      boxSize: number(armies["box-size"], 3),
      fillOpacity: number(armies["fill-opacity"], 1),
      opacity: number(armies.opacity, 1),
      stroke: text(armies.stroke, "#000000"),
      strokeWidth: number(armies["stroke-width"], 0.3)
    };
  }

  const emblems = preset["#emblems"];
  const stateEmblems = preset["#emblems > #stateEmblems"];
  const provinceEmblems = preset["#emblems > #provinceEmblems"];
  const burgEmblems = preset["#emblems > #burgEmblems"];
  if (emblems || stateEmblems || provinceEmblems || burgEmblems) {
    next.emblems = {
      ...next.emblems,
      automaticVisibility: Boolean(
        number(emblems?.["data-automatic-visibility"], next.emblems.automaticVisibility ? 1 : 0)
      ),
      burgSize: number(burgEmblems?.["data-size"], next.emblems.burgSize),
      filter: textOrNull(emblems?.filter),
      opacity: number(emblems?.opacity, next.emblems.opacity),
      provinceSize: number(provinceEmblems?.["data-size"], next.emblems.provinceSize),
      stateSize: number(stateEmblems?.["data-size"], next.emblems.stateSize),
      strokeWidth: number(emblems?.["stroke-width"], next.emblems.strokeWidth)
    };
  }

  const compass = preset["#compass"];
  const compassUse = preset["#compass > use"];
  if (compass || compassUse) {
    const transform = text(compassUse?.transform, "");
    const translate = transform.match(/translate\(\s*([-+.\d]+)[ ,]+([-+.\d]+)/);
    const scale = transform.match(/scale\(\s*([-+.\d]+)/);
    next.compass = {
      ...next.compass,
      opacity: number(compass?.opacity, 0.8),
      scale: number(scale?.[1], 0.25),
      x: number(translate?.[1], 80),
      y: number(translate?.[2], 80)
    };
  }

  const trade = preset["#tradeAnimation"];
  if (trade) next.trade = { ...next.trade, opacity: number(trade.opacity, 1) };
}

function readHeightBand(
  attributes: LegacyStylePresetAttributes,
  fallback: MapStyle["height"]["land"]
): MapStyle["height"]["land"] {
  return {
    curve: text(attributes.curve, fallback.curve),
    filter: textOrNull(attributes.filter),
    opacity: number(attributes.opacity, fallback.opacity),
    relax: number(attributes.relax, fallback.relax),
    scheme: text(attributes.scheme, fallback.scheme),
    skip: number(attributes.skip, fallback.skip),
    terracing: number(attributes.terracing, fallback.terracing)
  };
}

function readLine(
  attributes: LegacyStylePresetAttributes,
  fallback: SemanticLineStyle,
  opacity = fallback.opacity
): SemanticLineStyle {
  const cap = text(attributes["stroke-linecap"], fallback.cap);
  return {
    cap: cap === "round" || cap === "square" ? cap : "butt",
    color: text(attributes.stroke, fallback.color),
    dash: text(attributes["stroke-dasharray"], ""),
    join: lineJoin(attributes["stroke-linejoin"], fallback.join ?? "round"),
    opacity,
    width: number(attributes["stroke-width"], fallback.width)
  };
}

function readPopulationLine(
  fallback: SemanticLineStyle,
  population: LegacyStylePresetAttributes | undefined,
  role: LegacyStylePresetAttributes | undefined,
  fallbackColor: string
): SemanticLineStyle {
  return {
    ...fallback,
    cap: lineCap(population?.["stroke-linecap"], fallback.cap),
    color: text(role?.stroke, fallback.color || fallbackColor),
    dash: text(population?.["stroke-dasharray"], ""),
    width: number(population?.["stroke-width"], fallback.width)
  };
}

function pointSymbolStyle(attributes: LegacyStylePresetAttributes, fallbackIcon: string): PointSymbolStyle {
  return {
    fill: text(attributes.fill, "#ffffff"),
    fillOpacity: number(attributes["fill-opacity"], 1),
    icon: text(attributes["data-icon"], fallbackIcon).replace(/^#?icon-/, ""),
    opacity: number(attributes.opacity, 1),
    size: number(attributes["font-size"], 1),
    stroke: text(attributes.stroke, "#3e3e4b"),
    strokeWidth: number(attributes["stroke-width"], 0)
  };
}

function serializeHeightBand(band: MapStyle["height"]["land"]): LegacyStylePresetAttributes {
  return {
    curve: band.curve,
    filter: band.filter,
    opacity: band.opacity,
    relax: band.relax,
    scheme: band.scheme,
    skip: band.skip,
    terracing: band.terracing
  };
}

function serializeLine(line: SemanticLineStyle): LegacyStylePresetAttributes {
  return {
    opacity: line.opacity,
    stroke: line.color,
    "stroke-dasharray": line.dash,
    "stroke-linecap": line.cap,
    "stroke-linejoin": line.join ?? "round",
    "stroke-width": line.width
  };
}

function lineJoin(value: LegacyStylePresetValue, fallback: CanvasLineJoin): CanvasLineJoin {
  const join = text(value, fallback);
  return join === "bevel" || join === "miter" ? join : "round";
}

function readBlur(value: LegacyStylePresetValue, fallback: number): number {
  const match = text(value, "").match(/blur\(\s*([\d.]+)px\s*\)/i);
  return match ? number(match[1], fallback) : fallback;
}

function serializePointSymbol(symbol: PointSymbolStyle, includeIcon: boolean): LegacyStylePresetAttributes {
  return {
    ...(includeIcon ? { "data-icon": `#icon-${symbol.icon}` } : {}),
    fill: symbol.fill,
    "fill-opacity": symbol.fillOpacity,
    "font-size": symbol.size,
    opacity: symbol.opacity,
    stroke: symbol.stroke,
    "stroke-width": symbol.strokeWidth
  };
}

function number(value: LegacyStylePresetValue, fallback: number): number {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: LegacyStylePresetValue, fallback: string): string {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function textOrNull(value: LegacyStylePresetValue): string | null {
  return value === null || value === undefined || value === "" || value === "null" ? null : String(value);
}

function lineCap(value: LegacyStylePresetValue, fallback: CanvasLineCap): CanvasLineCap {
  const parsed = text(value, fallback);
  return parsed === "round" || parsed === "square" ? parsed : "butt";
}

function isGridPattern(value: string): value is GridPatternType {
  return GRID_PATTERN_TYPES.includes(value as GridPatternType);
}
