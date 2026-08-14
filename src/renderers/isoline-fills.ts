import type { getIsolines } from "@/utils";

type Isolines = ReturnType<typeof getIsolines>;

/** One fill path per isoline, plus a stroked path where the area borders water */
export function buildFillPaths(name: string, isolines: Isolines, getColor: (index: number) => string): string {
  return Object.entries(isolines)
    .map(([index, { fill, waterGap }]) => {
      const color = getColor(+index);
      let paths = "";
      if (fill) paths += /* html */ `<path d="${fill}" fill="${color}" id="${name}${index}" />`;
      if (waterGap)
        paths += /* html */ `<path d="${waterGap}" fill="none" stroke="${color}" stroke-width="3" id="${name}-gap${index}" />`;
      return paths;
    })
    .join("");
}
