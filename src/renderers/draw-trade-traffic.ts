// Routes as wide as the square root of the units of the shown goods they carried
import { Goods } from "@/model/economy/goods-generator";
import { Routes } from "@/model/economy/routes-generator";
import { TradeTraffic, type TrafficLink } from "@/model/economy/trade-traffic";
import { type Box, boundsIntersect } from "@/renderers/viewport/viewport-renderer";
import { getPercentile, rn } from "@/utils/number-utils";
import { getBoundingBox } from "@/utils/path-utils";

const SATURATION = 0.95; // percentile of the links' units from which routes are drawn at full width
const MIN_SHARE = 0.01; // of the saturation units: quieter links are left out
const MIN_WIDTH = 0.15; // map units

type TrafficLine = Box & { d: string; share: number; cells: number[] }; // share: of the full width, at most 1

let lines: TrafficLine[] = [];
let color = ""; // of the one shown good, else the style's

/** Each route stretch carrying the shown goods, a link apart; a shared link is drawn once */
export function buildTraffic(shown: Set<number>): void {
  const units = new Map<TrafficLink, number>();
  for (const link of TradeTraffic.getLinks()) {
    let sum = 0;
    for (const [goodId, goodUnits] of link.goods) if (shown.has(goodId)) sum += goodUnits;
    if (sum) units.set(link, sum);
  }
  const saturation = getPercentile([...units.values()], SATURATION) ?? 0;
  color = shown.size === 1 ? (Goods.get([...shown][0])?.color ?? "") : "";
  lines = [];

  const drawnBy = new Map<TrafficLink, number>();
  for (const route of saturation ? pack.routes : []) {
    const { points } = route;
    if (!points || points.length < 2) continue;
    const links = getSegmentLinks(points.map(point => point[2]));

    for (let start = 0; start < links.length; ) {
      const link = links[start];
      let end = start;
      while (end + 1 < links.length && links[end + 1] === link) end++;

      const share = link ? Math.min(1, (units.get(link) ?? 0) / saturation) : 0;
      if (link && share >= MIN_SHARE && (drawnBy.get(link) ?? route.i) === route.i) {
        drawnBy.set(link, route.i);
        const run = points.slice(start, end + 2);
        const d = Routes.getPath({ group: route.group, points: run });
        lines.push({ ...getBoundingBox(run), d, share: Math.sqrt(share), cells: link.cells });
      }
      start = end + 1;
    }
  }
  lines.sort((a, b) => b.share - a.share); // the narrowest on top to stay hoverable
}

export function clearTraffic(): void {
  lines = [];
}

export function renderTraffic(bounds: Box): string {
  const maxWidth = styles.goods.groups.goodsTraffic.options.size;
  const stroke = color ? ` stroke="${color}"` : "";
  const markup: string[] = [];
  for (const line of lines) {
    const width = rn(Math.max(MIN_WIDTH, maxWidth * line.share), 2);
    const half = width / 2;
    const box = { x0: line.x0 - half, y0: line.y0 - half, x1: line.x1 + half, y1: line.y1 + half };
    if (!boundsIntersect(box, bounds)) continue;
    markup.push(`<path d="${line.d}" stroke-width="${width}"${stroke} data-cells="${line.cells}"/>`);
  }
  return markup.join("");
}

/** Each segment's link; the segments inside one cell take the link they lead into or out of */
function getSegmentLinks(cells: number[]): (TrafficLink | undefined)[] {
  const links: (TrafficLink | undefined)[] = [];
  const inside: boolean[] = [];
  for (let i = 0; i < cells.length - 1; i++) {
    inside[i] = cells[i] === cells[i + 1];
    links[i] = inside[i] ? undefined : TradeTraffic.get(cells[i], cells[i + 1]);
  }
  for (let i = 1; i < links.length; i++) if (inside[i]) links[i] = links[i - 1];
  for (let i = links.length - 2; i >= 0; i--) if (inside[i] && links[i] === undefined) links[i] = links[i + 1];
  return links;
}
