import { ERROR } from "config/logging";
import { aleaPRNG } from "scripts/aleaPRNG";
import { clipPoly, last, normalize, P, rn } from "utils";

export function generateIce(
  cells: Pick<IPack["cells"], "i" | "h" | "c" | "v" | "p">,
  vertices: IGraphVertices,
  temp: Int8Array,
  features: TGridFeatures,
  gridCells: Pick<IGrid["cells"], "f" | "t">
): IIce {
  const shieldMin = -8; // max temp to form ice shield (glacier)
  const icebergMax = 1; // max temp to form an iceberg
  const nOfCells = cells.i.length;
  const used = new Uint8Array(cells.i.length);

  Math.random = aleaPRNG(seed);
  const icePack: IIce = { icebergs: [], iceShields: [] };
  for (const i of cells.i) {
    const temperature = temp[i];
    if (temperature > icebergMax) continue; // too warm: no ice
    if (temperature > shieldMin && cells.h[i] >= 20) continue; // non-glacier land: no ice

    if (temperature <= shieldMin) {
      // very cold: ice shield
      if (used[i]) continue; // already rendered
      const onborder = cells.c[i].some((n) => temp[n] > shieldMin);
      if (!onborder) continue; // need to start from onborder cell
      const vertex = cells.v[i].find((v) =>
        vertices.c[v]?.some((i) => temp[i] > shieldMin)
      );
      if (vertex === undefined) continue; // no suitable vertex found
      const chain = connectVertices(vertex);
      if (chain.length < 3) continue;
      const points = clipPoly(chain.map((v) => vertices.p[v]));
      icePack.iceShields.push({ points, transform: { x: 0, y: 0 } });
      continue;
    }
    // mildly cold: iceberd
    if (P(normalize(temperature, -7, 2.5))) continue; // t[-5; 2] cold: skip some cells
    if (
      gridCells.f[i] !== 0 &&
      (features[gridCells.f[i]] as IGridFeature).type === "lake"
    )
      continue; // lake: no icebers // MARKER as IGridFeature
    let size = (6.5 + temperature) / 10; // iceberg size: 0 = full size, 1 = zero size
    if (gridCells.t[i] === -1) size *= 1.3; // coasline: smaller icebers
    size = Math.min(size * (0.4 + Math.random() * 1.2), 0.95); // randomize iceberg size
    icePack.icebergs.push(generateIceberg(i, size));
  }
  return icePack;

  // Helper functions
  function generateIceberg(i: number, size: number): IiceBerg {
    const cellMidPoint = cells.p[i];
    const points: TPoints = cells.v[i]
      .map((v) => vertices.p[v])
      .map((point) => [
        (point[0] + (cellMidPoint[0] - point[0]) * size) | 0,
        (point[1] + (cellMidPoint[1] - point[1]) * size) | 0,
      ]);
    return {
      points,
      transform: { x: 0, y: 0 },
      cell: i,
      size: rn(1 - size, 2),
    };
  }

  // connect vertices to chain
  function connectVertices(start: number) {
    const chain = []; // vertices chain to form a path
    for (
      let i = 0, current = start;
      i === 0 || (current !== start && i < 20000);
      i++
    ) {
      const prev = last(chain); // previous vertex in chain
      chain.push(current); // add current vertex to sequence
      const currentVertex = vertices.c[current]; // cells adjacent to vertex
      currentVertex
        .filter((cellIndicie) => temp[cellIndicie] <= shieldMin)
        .forEach((cellIndice) => (used[cellIndice] = 1));
      const c0 =
        currentVertex[0] >= nOfCells || temp[currentVertex[0]] > shieldMin;
      const c1 =
        currentVertex[1] >= nOfCells || temp[currentVertex[1]] > shieldMin;
      const c2 =
        currentVertex[2] >= nOfCells || temp[currentVertex[2]] > shieldMin;
      const vertexNeighbors = vertices.v[current]; // neighboring vertices
      if (vertexNeighbors[0] !== prev && c0 !== c1)
        current = vertexNeighbors[0];
      else if (vertexNeighbors[1] !== prev && c1 !== c2)
        current = vertexNeighbors[1];
      else if (vertexNeighbors[2] !== prev && c0 !== c2)
        current = vertexNeighbors[2];
      if (current === chain[chain.length - 1]) {
        ERROR && console.error("Next vertex is not found");
        break;
      }
    }
    return chain;
  }
}
