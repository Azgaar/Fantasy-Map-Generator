import { forceCollide, forceSimulation, select, timeout } from "d3";
import type { Province } from "@/generators/provinces-generator";
import type { Burg } from "../generators/burgs-generator";
import type { State } from "../generators/states-generator";
import { minmax, rn } from "../utils";

declare global {
  var drawEmblems: () => void;
}

type EmblemType = "state" | "province" | "burg";

interface EmblemData {
  type: EmblemType;
  i: number;
  x: number;
  y: number;
  size: number;
  shift: number;
}

// biome-ignore lint/suspicious/noRedeclare: Legacy seam
const drawEmblems = (): void => {
  TIME && console.time("drawEmblems");
  const { states, provinces, burgs } = pack;

  const validStates = states.filter(s => s.i && !s.removed && s.coa && s.coa.size !== 0);
  const validProvinces = (provinces as Province[]).filter(p => p.i && !p.removed && p.coa && p.coa.size !== 0);
  const validBurgs = burgs.filter(b => b.i && !b.removed && b.coa && b.coa.size !== 0);

  const getStateEmblemsSize = (): number => {
    const startSize = minmax((graphHeight + graphWidth) / 40, 10, 100);
    const statesMod = 1 + validStates.length / 100 - (15 - validStates.length) / 200; // states number modifier
    const sizeMod = +select("#emblems").select("#stateEmblems").attr("data-size") || 1;
    return rn((startSize / statesMod) * sizeMod); // target size ~50px on 1536x754 map with 15 states
  };

  const getProvinceEmblemsSize = (): number => {
    const startSize = minmax((graphHeight + graphWidth) / 100, 5, 70);
    const provincesMod = 1 + validProvinces.length / 1000 - (115 - validProvinces.length) / 1000; // states number modifier
    const sizeMod = +select("#emblems").select("#provinceEmblems").attr("data-size") || 1;
    return rn((startSize / provincesMod) * sizeMod); // target size ~20px on 1536x754 map with 115 provinces
  };

  const getBurgEmblemSize = (): number => {
    const startSize = minmax((graphHeight + graphWidth) / 185, 2, 50);
    const burgsMod = 1 + validBurgs.length / 1000 - (450 - validBurgs.length) / 1000; // states number modifier
    const sizeMod = +select("#emblems").select("#burgEmblems").attr("data-size") || 1;
    return rn((startSize / burgsMod) * sizeMod); // target size ~8.5px on 1536x754 map with 450 burgs
  };

  const sizeBurgs = getBurgEmblemSize();
  const burgCOAs: EmblemData[] = validBurgs.map(burg => {
    const { x, y } = burg;
    const size = burg.coa!.size || 1;
    const shift = (sizeBurgs * size) / 2;
    return { type: "burg", i: burg.i!, x: burg.coa!.x || x, y: burg.coa!.y || y, size, shift };
  });

  const sizeProvinces = getProvinceEmblemsSize();
  const provinceCOAs: EmblemData[] = validProvinces.map(province => {
    const [x, y] = province.pole || pack.cells.p[province.center];
    const size = province.coa!.size || 1;
    const shift = (sizeProvinces * size) / 2;
    return { type: "province", i: province.i, x: province.coa!.x || x, y: province.coa!.y || y, size, shift };
  });

  const sizeStates = getStateEmblemsSize();
  const stateCOAs: EmblemData[] = validStates.map(state => {
    const [x, y] = state.pole || pack.cells.p[state.center!];
    const size = state.coa!.size || 1;
    const shift = (sizeStates * size) / 2;
    return { type: "state", i: state.i, x: state.coa!.x || x, y: state.coa!.y || y, size, shift };
  });

  const nodes = burgCOAs.concat(provinceCOAs).concat(stateCOAs);
  const simulation = forceSimulation(nodes)
    .alphaMin(0.6)
    .alphaDecay(0.2)
    .velocityDecay(0.6)
    .force(
      "collision",
      forceCollide<EmblemData>().radius(d => d.shift)
    )
    .stop();

  timeout(() => {
    const n = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()));
    for (let i = 0; i < n; ++i) {
      simulation.tick();
    }

    const burgNodes = nodes.filter(node => node.type === "burg");
    const burgString = burgNodes
      .map(
        d =>
          `<use data-i="${d.i}" x="${rn(d.x - d.shift)}" y="${rn(d.y - d.shift)}" width="${d.size}em" height="${d.size}em"/>`
      )
      .join("");
    select("#emblems > #burgEmblems").attr("font-size", sizeBurgs).html(burgString);

    const provinceNodes = nodes.filter(node => node.type === "province");
    const provinceString = provinceNodes
      .map(
        d =>
          `<use data-i="${d.i}" x="${rn(d.x - d.shift)}" y="${rn(d.y - d.shift)}" width="${d.size}em" height="${d.size}em"/>`
      )
      .join("");
    select("#emblems > #provinceEmblems").attr("font-size", sizeProvinces).html(provinceString);

    const stateNodes = nodes.filter(node => node.type === "state");
    const stateString = stateNodes
      .map(
        d =>
          `<use data-i="${d.i}" x="${rn(d.x - d.shift)}" y="${rn(d.y - d.shift)}" width="${d.size}em" height="${d.size}em"/>`
      )
      .join("");
    select("#emblems > #stateEmblems").attr("font-size", sizeStates).html(stateString);

    invokeActiveZooming();
  });

  TIME && console.timeEnd("drawEmblems");
};

export function clearEmblems(types: EmblemType[]): void {
  for (const type of types) {
    document.querySelectorAll(`[id^=${type}COA]`).forEach(element => {
      element.remove();
    });
    document.querySelectorAll(`#${type}Emblems > use`).forEach(element => {
      element.remove();
    });
  }
}

const getDataAndType = (id: string): [Burg[] | Province[] | State[], string] => {
  if (id === "burgEmblems") return [pack.burgs, "burg"];
  if (id === "provinceEmblems") return [pack.provinces, "province"];
  if (id === "stateEmblems") return [pack.states, "state"];
  throw new Error(`Unknown emblem type: ${id}`);
};

const redrawEmblemGroup = async (g: SVGGElement): Promise<void> => {
  const [data, type] = getDataAndType(g.id);

  for (const use of g.children) {
    const i = +(use as SVGUseElement).dataset.i!;
    const id = `${type}COA${i}`;
    COArenderer.trigger(id, data[i].coa);
    use.setAttribute("href", `#${id}`);
  }
};

export { drawEmblems, redrawEmblemGroup };

window.drawEmblems = drawEmblems;
