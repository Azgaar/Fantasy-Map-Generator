import * as d3 from "d3";

import {rn} from "utils/numberUtils";
import {getRealHeight} from "utils/unitUtils";

export interface ILakeClimateData extends IPackFeatureLake {
  flux: number;
  temp: number;
  evaporation: number;
  outCell: number | undefined;
  river?: number;
  enteringFlux?: number;
}

export function getClimateData(
  lakes: IPackFeatureLake[],
  heights: Float32Array,
  drainableLakes: Dict<boolean>,
  gridReference: IPack["cells"]["g"],
  precipitation: IGrid["cells"]["prec"],
  temperature: IGrid["cells"]["temp"]
): ILakeClimateData[] {
  const lakeData = lakes.map(lake => {
    const {shoreline} = lake;

    // default flux: sum of precipitation around lake
    const flux = shoreline.reduce((acc, cellId) => acc + precipitation[gridReference[cellId]], 0);

    // temperature and evaporation to detect closed lakes
    const temp = rn(d3.mean(shoreline.map(cellId => temperature[gridReference[cellId]]))!, 1);

    const height = getRealHeight(lake.height); // height in meters
    const cellEvaporation = ((700 * (temp + 0.006 * height)) / 50 + 75) / (80 - temp); // based on Penman formula, [1-11]
    const evaporation = rn(cellEvaporation * lake.cells);

    const outCell =
      flux > evaporation && drainableLakes[lake.i]
        ? shoreline[d3.scan(shoreline, (a, b) => heights[a] - heights[b])!]
        : undefined;

    return {...lake, flux, temp, evaporation, outCell};
  });

  return lakeData;
}

export function mergeLakeData(features: TPackFeatures, lakeData: ILakeClimateData[], rivers: Pick<IRiver, "i">[]) {
  const updatedFeatures = features.map(feature => {
    if (!feature) return 0;
    if (feature.type !== "lake") return feature;

    const lake = lakeData.find(lake => lake.i === feature.i);
    if (!lake) return feature;

    const {firstCell, height, flux, temp, evaporation, cells} = lake;
    const inlets = lake.inlets?.filter(inlet => rivers.find(river => river.i === inlet));
    const outlet = rivers.find(river => river.i === lake.outlet)?.i;
    const group = defineLakeGroup({firstCell, height, flux, temp, evaporation, cells, inlets, outlet});

    const lakeFeature: IPackFeatureLake = {...feature, flux, temp, evaporation, inlets, outlet, group};
    if (!inlets || !inlets.length) delete lakeFeature.inlets;
    if (!outlet) delete lakeFeature.outlet;

    return lakeFeature;
  });

  return updatedFeatures as TPackFeatures;
}

function defineLakeGroup({
  firstCell,
  height,
  flux,
  temp,
  evaporation,
  cells,
  inlets,
  outlet
}: {
  firstCell: number;
  height: number;
  flux: number;
  temp: number;
  evaporation: number;
  cells: number;
  inlets?: number[];
  outlet?: number;
}): IPackFeatureLake["group"] {
  if (temp < -3) return "frozen";
  if (height > 60 && cells < 10 && firstCell % 10 === 0) return "lava";

  if ((!inlets || !inlets.length) && !outlet) {
    if (evaporation > flux * 4) return "dry";
    if (cells < 3 && firstCell % 10 === 0) return "sinkhole";
  }

  if (!outlet && evaporation > flux) return "salt";

  return "freshwater";
}
