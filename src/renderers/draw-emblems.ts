import { forceCollide, forceSimulation, timeout } from "d3";
import type { Province } from "@/generators/provinces-generator";
import { ensureEl, minmax, rn } from "@/utils";
import type { Burg } from "../generators/burgs-generator";
import type { State } from "../generators/states-generator";

type EmblemType = "state" | "province" | "burg";

interface EmblemData {
  type: EmblemType;
  i: number;
  x: number;
  y: number;
  size: number;
  shift: number;
}

const GROUPS: Record<EmblemType, string> = {
  burg: "burgEmblems",
  province: "provinceEmblems",
  state: "stateEmblems"
};

// sizing is tuned for a 1536x754 map: ~50px for 15 states, ~20px for 115 provinces, ~8.5px for 450 burgs
interface Sizing {
  extent: number; // map size is divided by it to get the base size
  min: number;
  max: number;
  expected: number; // number of elements the base size is tuned for
  countDivisor: number;
  deficitDivisor: number;
}

const SIZING: Record<EmblemType, Sizing> = {
  state: { extent: 40, min: 10, max: 100, expected: 15, countDivisor: 100, deficitDivisor: 200 },
  province: { extent: 100, min: 5, max: 70, expected: 115, countDivisor: 1000, deficitDivisor: 1000 },
  burg: { extent: 185, min: 2, max: 50, expected: 450, countDivisor: 1000, deficitDivisor: 1000 }
};

// emblems shrink as their number grows, so that a crowded map does not turn into a wall of shields
function getEmblemSize(type: EmblemType, count: number): number {
  const { extent, min, max, expected, countDivisor, deficitDivisor } = SIZING[type];
  const startSize = minmax((graphHeight + graphWidth) / extent, min, max);
  const countMod = 1 + count / countDivisor - (expected - count) / deficitDivisor;
  const sizeMod = Number(ensureEl(GROUPS[type]).getAttribute("data-size")) || 1;
  return rn((startSize / countMod) * sizeMod);
}

export function drawEmblems(): void {
  TIME && console.time("drawEmblems");
  const { cells, states, provinces, burgs } = pack;

  const validStates = states.filter(s => s.i && !s.removed && s.coa && s.coa.size !== 0);
  const validProvinces = (provinces as Province[]).filter(p => p.i && !p.removed && p.coa && p.coa.size !== 0);
  const validBurgs = burgs.filter(b => b.i && !b.removed && b.coa && b.coa.size !== 0);

  const sizes = {
    burg: getEmblemSize("burg", validBurgs.length),
    province: getEmblemSize("province", validProvinces.length),
    state: getEmblemSize("state", validStates.length)
  };

  // the emblem sits on its element's pole unless the user has dragged it elsewhere
  const getNode = (type: EmblemType, i: number, [poleX, poleY]: number[], coa: any): EmblemData => {
    const size = coa.size || 1;
    return { type, i, x: coa.x || poleX, y: coa.y || poleY, size, shift: (sizes[type] * size) / 2 };
  };

  const nodes: EmblemData[] = [
    ...validBurgs.map(burg => getNode("burg", burg.i!, [burg.x!, burg.y!], burg.coa)),
    ...validProvinces.map(p => getNode("province", p.i, p.pole || cells.p[p.center], p.coa)),
    ...validStates.map(s => getNode("state", s.i, s.pole || cells.p[s.center!], s.coa))
  ];

  const simulation = forceSimulation(nodes)
    .alphaMin(0.6)
    .alphaDecay(0.2)
    .velocityDecay(0.6)
    .force(
      "collision",
      forceCollide<EmblemData>().radius(d => d.shift)
    )
    .stop();

  // the collision pass is heavy, so it is deferred to the next frame
  timeout(() => {
    const ticks = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()));
    for (let i = 0; i < ticks; i++) simulation.tick();

    for (const type of ["burg", "province", "state"] as const) {
      const group = ensureEl(GROUPS[type]);
      group.setAttribute("font-size", String(sizes[type]));
      group.innerHTML = nodes
        .filter(node => node.type === type)
        .map(
          ({ i, x, y, size, shift }) =>
            `<use data-i="${i}" x="${rn(x - shift)}" y="${rn(y - shift)}" width="${size}em" height="${size}em"/>`
        )
        .join("");
    }

    invokeActiveZooming();
    TIME && console.timeEnd("drawEmblems");
  });
}

/** render the emblems of a group that is scrolled into view: the `use` elements are drawn without a target */
export function redrawEmblemGroup(group: SVGGElement): void {
  const [data, type] = getDataAndType(group.id);

  for (const use of group.children) {
    const i = +(use as SVGUseElement).dataset.i!;
    const id = `${type}COA${i}`;
    COArenderer.trigger(id, data[i].coa);
    use.setAttribute("href", `#${id}`);
  }
}

function getDataAndType(groupId: string): [Burg[] | Province[] | State[], EmblemType] {
  if (groupId === GROUPS.burg) return [pack.burgs, "burg"];
  if (groupId === GROUPS.province) return [pack.provinces, "province"];
  if (groupId === GROUPS.state) return [pack.states, "state"];
  throw new Error(`Unknown emblem group: ${groupId}`);
}
