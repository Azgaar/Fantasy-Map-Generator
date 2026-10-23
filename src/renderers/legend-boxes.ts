// Showing and hiding the legend boxes: the map data changes, then the legend layer draws it
import { color, extent } from "d3";
import { Legends } from "@/model/annotations/legends";
import { getHeightUnitRatio, metersToHeight } from "@/model/units";
import { hasHeightTints } from "@/renderers/heightmap/draw-heightmap";
import { HeightmapColorSchemes } from "@/renderers/heightmap/heightmap-color-schemes";
import { legendPositions } from "@/renderers/legend-positions";
import type { LegendItem } from "@/types/Legend";
import { tip } from "@/ui/tooltips";
import { SEA_LEVEL } from "@/utils/heightUtils";
import { t } from "@/utils/i18n";
import { Layers } from "./layers";

/** Show the named box with the items, or report that there is nothing to list */
function show(name: string, items: LegendItem[], emptyMessage: string): void {
  if (!items.length) {
    hide(name);
    return void tip(emptyMessage, false, "error");
  }
  Legends.set(name, items);
  Layers.draw("legend");
}

function hide(name: string): void {
  Legends.remove(name);
  legendPositions.release(name); // an auto-placed box gives its slot back, a dragged one keeps it
  Layers.draw("legend");
}

/** Hide the named box if it is shown, else show it with the items it lists now */
function toggle(name: string, getItems: () => LegendItem[], emptyMessage: string): void {
  if (Legends.has(name)) hide(name);
  else show(name, getItems(), emptyMessage);
}

// The Altitude box: heightmap colours in bands bounded by round heights and depths, as on a physical map

const ALTITUDE = "Altitude";
const MIN_BAND = 4; // generator heights a band spans at least, so neighbouring swatches differ visibly

// 1, 2, 5, 10, 20, 50… in the user unit, the largest first
const ROUND_VALUES = Array.from({ length: 21 }, (_, i) => [1, 2, 5][i % 3] * 10 ** Math.floor(i / 3)).reverse();

/** A band from one round value to the next (open-ended when `to` is absent), with its mid generator height */
export interface AltitudeBand {
  from: number;
  to?: number;
  height: number;
}

/**
 * Bands from sea level to the extreme generator height, bounded by round values in the user unit.
 * Bounds are picked from the extreme towards the sea, so the widest bands get the roundest values
 * @param toHeight - generator height of a value in the user unit, a height for land or a depth for water
 */
export function getAltitudeBands(extreme: number, toHeight: (value: number) => number): AltitudeBand[] {
  const direction = Math.sign(extreme - SEA_LEVEL);
  const bounds: number[] = [];
  let last = extreme;

  for (const value of ROUND_VALUES) {
    const height = toHeight(value);
    if ((last - height) * direction < MIN_BAND || (height - SEA_LEVEL) * direction < MIN_BAND) continue;
    bounds.unshift(value);
    last = height;
  }

  const edges = [0, ...bounds];
  return edges.map((from, i) => {
    const to = edges[i + 1];
    const low = from ? toHeight(from) : SEA_LEVEL;
    const high = to ? toHeight(to) : extreme;
    return { from, to, height: (low + high) / 2 };
  });
}

// the tinted bands of the map as legend rows: the land from the top down, then the sea from the shore out
function getAltitudeItems(): LegendItem[] {
  const { landHeights, oceanHeights } = styles.heightmap.groups;
  const unit = options.map.units.height.unit;
  const ratio = getHeightUnitRatio();
  const [min = SEA_LEVEL, max = 0] = extent(grid.cells.h);

  const rows = (bands: AltitudeBand[], schemeName: string, suffix = ""): [string, string][] => {
    const scheme = HeightmapColorSchemes.get(schemeName);
    return bands.map(({ from, to, height }) => [
      color(HeightmapColorSchemes.getColor(height, scheme))?.formatHex() ?? "", // a scheme gives rgb(), which holds commas
      (to ? `${from}–${to}${unit}` : `> ${from}${unit}`) + suffix
    ]);
  };

  const tintedLand = hasHeightTints(landHeights.options) && max >= SEA_LEVEL;
  const land = tintedLand ? getAltitudeBands(max, value => metersToHeight(value / ratio)).reverse() : [];

  const tintedOcean = oceanHeights.options.render && hasHeightTints(oceanHeights.options) && min < SEA_LEVEL;
  const ocean = tintedOcean ? getAltitudeBands(min, value => metersToHeight(-value / ratio)) : [];

  const bands = [...rows(land, landHeights.options.scheme), ...rows(ocean, oceanHeights.options.scheme, " deep")];
  return bands.map(([fill, label], i) => [i, fill, label]);
}

const noAltitudeMessage = () => t("The heightmap style has no elevation colors to show");

/** Show the Altitude box, or hide it if it is shown */
function toggleAltitude(): void {
  toggle(ALTITUDE, getAltitudeItems, noAltitudeMessage());
}

/** Redraw a shown Altitude box after the heights, colours or units it reads have changed */
function refreshAltitude(): void {
  if (Legends.has(ALTITUDE)) show(ALTITUDE, getAltitudeItems(), noAltitudeMessage());
}

export const LegendBoxes = { hide, toggle, toggleAltitude, refreshAltitude };
