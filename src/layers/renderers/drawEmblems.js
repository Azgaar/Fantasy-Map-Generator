import {getProvincesVertices} from "./drawProvinces";
import {minmax, rn} from "/src/utils/numberUtils";
import {byId} from "/src/utils/shorthands";

export function drawEmblems() {
  const {states, provinces, burgs} = pack;

  const validStates = states.filter(s => s.i && !s.removed && s.coa && s.coaSize != 0);
  const validProvinces = provinces.filter(p => p.i && !p.removed && p.coa && p.coaSize != 0);
  const validBurgs = burgs.filter(b => b.i && !b.removed && b.coa && b.coaSize != 0);

  const getStateEmblemsSize = () => {
    const startSize = minmax((graphHeight + graphWidth) / 40, 10, 100);
    const statesMod = 1 + validStates.length / 100 - (15 - validStates.length) / 200; // states number modifier
    const sizeMod = +byId("emblemsStateSizeInput").value || 1;
    return rn((startSize / statesMod) * sizeMod); // target size ~50px on 1536x754 map with 15 states
  };

  const getProvinceEmblemsSize = () => {
    const startSize = minmax((graphHeight + graphWidth) / 100, 5, 70);
    const provincesMod = 1 + validProvinces.length / 1000 - (115 - validProvinces.length) / 1000; // states number modifier
    const sizeMod = +byId("emblemsProvinceSizeInput").value || 1;
    return rn((startSize / provincesMod) * sizeMod); // target size ~20px on 1536x754 map with 115 provinces
  };

  const getBurgEmblemSize = () => {
    const startSize = minmax((graphHeight + graphWidth) / 185, 2, 50);
    const burgsMod = 1 + validBurgs.length / 1000 - (450 - validBurgs.length) / 1000; // states number modifier
    const sizeMod = +byId("emblemsBurgSizeInput").value || 1;
    return rn((startSize / burgsMod) * sizeMod); // target size ~8.5px on 1536x754 map with 450 burgs
  };

  const sizeBurgs = getBurgEmblemSize();
  const burgCOAs = validBurgs.map(burg => {
    const {x, y} = burg;
    const size = burg.coaSize || 1;
    const shift = (sizeBurgs * size) / 2;
    return {type: "burg", i: burg.i, x, y, size, shift};
  });

  const sizeProvinces = getProvinceEmblemsSize();
  const provinceCOAs = validProvinces.map(province => {
    if (!province.pole) getProvincesVertices();
    const [x, y] = province.pole || pack.cells.p[province.center];
    const size = province.coaSize || 1;
    const shift = (sizeProvinces * size) / 2;
    return {type: "province", i: province.i, x, y, size, shift};
  });

  const sizeStates = getStateEmblemsSize();
  const stateCOAs = validStates.map(state => {
    const [x, y] = state.pole || pack.cells.p[state.center];
    const size = state.coaSize || 1;
    const shift = (sizeStates * size) / 2;
    return {type: "state", i: state.i, x, y, size, shift};
  });

  const nodes = burgCOAs.concat(provinceCOAs).concat(stateCOAs);
  const simulation = d3
    .forceSimulation(nodes)
    .alphaMin(0.6)
    .alphaDecay(0.2)
    .velocityDecay(0.6)
    .force(
      "collision",
      d3.forceCollide().radius(d => d.shift)
    )
    .stop();

  d3.timeout(function () {
    const n = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()));
    for (let i = 0; i < n; ++i) {
      simulation.tick();
    }

    const burgNodes = nodes.filter(node => node.type === "burg");
    const burgString = burgNodes
      .map(
        d =>
          `<use data-i="${d.i}" x="${rn(d.x - d.shift)}" y="${rn(d.y - d.shift)}" width="${d.size}em" height="${
            d.size
          }em"/>`
      )
      .join("");
    emblems.select("#burgEmblems").attr("font-size", sizeBurgs).html(burgString);

    const provinceNodes = nodes.filter(node => node.type === "province");
    const provinceString = provinceNodes
      .map(
        d =>
          `<use data-i="${d.i}" x="${rn(d.x - d.shift)}" y="${rn(d.y - d.shift)}" width="${d.size}em" height="${
            d.size
          }em"/>`
      )
      .join("");
    emblems.select("#provinceEmblems").attr("font-size", sizeProvinces).html(provinceString);

    const stateNodes = nodes.filter(node => node.type === "state");
    const stateString = stateNodes
      .map(
        d =>
          `<use data-i="${d.i}" x="${rn(d.x - d.shift)}" y="${rn(d.y - d.shift)}"
            width="${d.size}em" height="${d.size}em"/>`
      )
      .join("");
    emblems.select("#stateEmblems").attr("font-size", sizeStates).html(stateString);

    Zoom.invoke();
  });
}
