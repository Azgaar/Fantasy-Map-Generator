// Currents: the rivers re-read as flow toward the void — Astral only, inside the Hyperlanes layer.
// The group is emitted on demand instead of declared in the registry: declared children are created
// at init and recreated on every restore, which would leak a #currents node into standard maps
import { isAstralView, subscribeAstralView } from "@/components/options/view-mode";
import { createEl } from "@/utils/nodeUtils";
import { rn } from "@/utils/numberUtils";
import { currentPath, currentWidth } from "./currents";

const GROUP = "currents";
let subscribed = false;

export function drawCurrents(): void {
  // lazy: the module can load mid-cycle through view-mode's conquest import, before it can take a listener
  if (!subscribed) {
    subscribed = true;
    subscribeAstralView(drawCurrents);
  }
  TIME && console.time("drawCurrents");
  const group = document.getElementById(GROUP) as SVGGElement | null;
  const routes = document.getElementById("routes");

  if (!isAstralView() || !routes)
    group?.remove(); // standard maps carry no currents node
  else {
    const node = group ?? createGroup(routes);
    syncAttrs(node);
    node.innerHTML = buildPaths();
  }

  TIME && console.timeEnd("drawCurrents");
}/** the group the registry would have stamped, created under the Hyperlanes layer on demand */
function createGroup(routes: Element): SVGGElement {
  const group = createEl<SVGGElement>("g", GROUP);
  group.dataset.group = GROUP; // styles address groups by data-group, not element id
  routes.append(group);
  return group;
}

/** the group mirrors the style; applyStyle keeps it in step when the style changes under it */
function syncAttrs(node: SVGGElement): void {
  const attrs = styles.routes.groups[GROUP]?.attrs;
  if (!attrs) return;
  for (const [name, value] of Object.entries(attrs)) {
    if (value === null || value === undefined) node.removeAttribute(name);
    else node.setAttribute(name, String(value));
  }
}

/** one path per river; the group's stroke-width scales the ladder, discharge spreads it */
function buildPaths(): string {
  const groupWidth = styles.routes.groups[GROUP]?.attrs["stroke-width"];
  const scale = typeof groupWidth === "number" && groupWidth > 0 ? groupWidth : 1;

  const paths: string[] = [];
  for (const river of pack.rivers ?? []) {
    if (!river.cells || river.cells.length < 2) continue;
    let points = river.points ?? null;
    if (points && points.length !== river.cells.length) points = null;

    const d = currentPath(Rivers.getRiverPoints(river.cells, points));
    if (d) {
      const width = rn(currentWidth(river.discharge) * scale, 2);
      paths.push(`<path id="current${river.i}" d="${d}" stroke-width="${width}"/>`);
    }
  }
  return paths.join("");
}

