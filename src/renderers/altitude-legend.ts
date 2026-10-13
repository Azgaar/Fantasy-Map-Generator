// The Altitude legend: heightmap colours in bands bounded by round heights and depths, as on a physical map

import { extent } from "d3";
import { tip } from "@/components/tooltips";
import { getHeightUnitRatio, metersToHeight } from "@/utils";
import { t } from "@/utils/i18n";
import { hasHeightTints } from "./draw-heightmap";
import { clearLegend, drawLegend, hasLegend } from "./draw-legend";
import { HeightmapColorSchemes } from "./heightmap-color-schemes";

const LEGEND_NAME = "Altitude";
const SEA_LEVEL = 20;
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

// the tinted bands of the map as [colour, label] rows: the land from the top down, then the sea from the shore out
function getLegendRows(): [string, string][] {
  const { landHeights, oceanHeights } = styles.heightmap.groups;
  const unit = options.map.units.height.unit;
  const ratio = getHeightUnitRatio();
  const [min = SEA_LEVEL, max = 0] = extent(grid.cells.h);

  const rows = (bands: AltitudeBand[], schemeName: string, suffix = ""): [string, string][] => {
    const scheme = HeightmapColorSchemes.get(schemeName);
    return bands.map(({ from, to, height }) => [
      HeightmapColorSchemes.getColor(height, scheme),
      (to ? `${from}–${to}${unit}` : `> ${from}${unit}`) + suffix
    ]);
  };

  const tintedLand = hasHeightTints(landHeights.options) && max >= SEA_LEVEL;
  const land = tintedLand ? getAltitudeBands(max, value => metersToHeight(value / ratio)).reverse() : [];

  const tintedOcean = oceanHeights.options.render && hasHeightTints(oceanHeights.options) && min < SEA_LEVEL;
  const ocean = tintedOcean ? getAltitudeBands(min, value => metersToHeight(-value / ratio)) : [];

  return [...rows(land, landHeights.options.scheme), ...rows(ocean, oceanHeights.options.scheme, " deep")];
}

function drawAltitudeLegend(): void {
  const rows = getLegendRows();
  if (!rows.length) {
    clearLegend(LEGEND_NAME);
    return void tip(t("The heightmap style has no elevation colors to show"), false, "error");
  }
  drawLegend(
    LEGEND_NAME,
    rows.map(([color, label], i) => [i, color, label])
  );
}

/** Show the Altitude legend box, or hide it if it is shown */
function toggle(): void {
  if (hasLegend(LEGEND_NAME)) clearLegend(LEGEND_NAME);
  else drawAltitudeLegend();
}

/** Redraw a shown Altitude legend box after the heights, colours or units it reads have changed */
function refresh(): void {
  if (hasLegend(LEGEND_NAME)) drawAltitudeLegend();
}

export const AltitudeLegend = { toggle, refresh };
