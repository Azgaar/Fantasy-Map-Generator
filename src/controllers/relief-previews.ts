// Relief art in the interface: painted in the relief style and cropped to what it draws, since relief art
// sits small in its frame (vegetation fills a tenth to a third of it)
import { Icons } from "@/components/icons";
import type { ReliefRule } from "@/components/options-schema";
import type { ReliefPool, ReliefSet } from "@/generators/relief-generator";
import { capitalize, escapeHtml, rn } from "@/utils";

/** a relief set symbol in the relief style's stroke, as the map draws it, to be cropped by `fitReliefArt` */
export function reliefArtHtml(id: string, attributes = ""): string {
  return Icons.html(id, { stroke: styles.relief.attrs.stroke ?? undefined }, ` data-fit${attributes}`);
}

/** a relief pool entry: a type in the given set, or any other icon as the library draws it */
export function poolEntryHtml(entry: string, set: ReliefSet): string {
  return Relief.isType(entry) ? reliefArtHtml(Relief.entrySymbol(entry, set)) : Icons.html(entry);
}

export const poolEntryName = (entry: string): string =>
  Relief.isType(entry) ? Relief.labelOf(entry) : capitalize(Icons.name(entry));

const POOL_PREVIEW = 3; // entries drawn, the heaviest first

/** a clickable pool summary: its heaviest entries drawn, the whole pool in the tip */
export function poolPreviewHtml(pool: ReliefPool, density: number, className: string): string {
  const entries = Object.entries(pool).sort(([, a], [, b]) => b.weight - a.weight);
  const total = entries.reduce((sum, [, { weight }]) => sum + weight, 0);
  const shares = entries
    .map(([entry, { weight }]) => `${poolEntryName(entry)} ${rn((weight / total) * 100)}%`)
    .join(", ");
  const tipText = total && density ? `Relief: ${shares}. Density ${density}` : "No relief";
  const previews =
    total && density
      ? entries
          .slice(0, POOL_PREVIEW)
          .map(([entry]) => poolEntryHtml(entry, styles.relief.options.set))
          .join("") + (entries.length > POOL_PREVIEW ? `<small>+${entries.length - POOL_PREVIEW}</small>` : "")
      : "–";
  return `<span class="${className} pointer" data-tip="${escapeHtml(`${tipText}. Click to edit`)}">${previews}</span>`;
}

const PATCH_ASPECT = 4; // width to height
// the share of the patch height the largest base box takes: vegetation sits small in its box, peaks fill theirs
const PATCH_FILL = { pool: 0.9, rule: 0.7 };
const PATCH_LIMIT = 3000; // icons drawn at most

/**
 * A patch of the relief a pool places, at the map's sizes and spacing and in the relief style; a rule's height
 * rises left to right. The zoom follows the base size only, so resizing an entry changes that entry alone
 */
export function reliefPatchHtml(pool: ReliefPool, density: number, rule: ReliefRule | undefined, seed: number): string {
  const entries = Object.values(pool).filter(({ weight }) => weight > 0);
  if (!density || !entries.length) return "";

  const { set, size: styleSize } = styles.relief.options;
  const base = rule ? rule.size.max : Relief.poolSize(1);
  const height = (base * styleSize) / PATCH_FILL[rule ? "rule" : "pool"];
  const width = height * PATCH_ASPECT;
  const random = aleaPRNG(seed);
  const radius = Relief.spacing(density);

  const points: [number, number][] = [];
  for (const point of Relief.samplePatch(width, height, radius, random)) {
    points.push(point);
    if (points.length >= PATCH_LIMIT) break;
  }

  const icons = points.map(([x, y]) => {
    // three rolls a point whatever it draws, so a change to one entry leaves the others in place
    const [sizeRoll, entryRoll, variantRoll] = [random(), random(), random()];
    const h = rule ? rule.height.min + (x / width) * (rule.height.max - rule.height.min) : 0;
    const entry = Relief.pickEntry(pool, entryRoll)!;
    const s = (rule ? Relief.ruleSize(rule, h) : Relief.poolSize(sizeRoll)) * (pool[entry].size ?? 1) * styleSize;
    const symbol = Relief.isType(entry)
      ? Relief.symbolId(Relief.ref(entry, 1 + Math.floor(variantRoll * Relief.variantsOf(entry))), set)
      : entry;
    return { symbol, x: rn(x - s / 2, 2), y: rn(y - s / 2, 2), s: rn(s, 2) };
  });
  icons.sort((a, b) => a.y + a.s - (b.y + b.s)); // as on the map: the box ending lower draws on top

  const { stroke, opacity } = styles.relief.attrs;
  const paint = [
    stroke && ` stroke="${escapeHtml(stroke)}"`,
    opacity !== null && opacity !== undefined && ` opacity="${opacity}"`
  ]
    .filter(Boolean)
    .join("");
  const uses = icons
    .map(
      ({ symbol, x, y, s }) =>
        `<use href="${escapeHtml(Icons.href(symbol))}" x="${x}" y="${y}" width="${s}" height="${s}"/>`
    )
    .join("");
  return `<svg viewBox="0 0 ${rn(width, 2)} ${rn(height, 2)}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g${paint}>${uses}</g></svg>`;
}

/** crop the relief art in a container to what it draws, once its set is in the page */
export async function fitReliefArt(container: Element, set: ReliefSet): Promise<void> {
  await Icons.retry(Relief.iconSetId(set));
  for (const svg of container.querySelectorAll<SVGSVGElement>("svg[data-fit]")) {
    const box = svg.querySelector("use")?.getBBox();
    if (!box?.width || !box.height) continue; // not laid out: keep the frame
    const side = Math.max(box.width, box.height) * 1.15;
    const frame = [box.x + box.width / 2 - side / 2, box.y + box.height / 2 - side / 2, side, side];
    svg.setAttribute("viewBox", Icons.formatFrame(frame));
    svg.removeAttribute("data-fit");
  }
}
