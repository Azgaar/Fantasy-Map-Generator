import { clipPoly } from "@/utils";

/**
 * Ocean outlines: closed rings traced around the coast at a given distance from it. `t` is the
 * distance-from-coast marker held in grid.cells.t, negative for water: -1 is the ring hugging the
 * coast, -2 the one behind it, and so on down to -9
 */
export interface OceanOutline {
  t: number;
  rings: [number, number][][];
}

class OceanModule {
  /** read the distances the `layers` attribute asks for: a preset list or none */
  getLimits(outline: string): number[] {
    if (!outline || outline === "none") return [];
    return outline.split(",").map(Number).filter(Boolean);
  }

  /** trace the ocean rings for the requested distances, clipped to the map */
  generate(limits: number[]): OceanOutline[] {
    const { cells, vertices } = grid;
    const pointsN = cells.i.length;
    const used = new Uint8Array(pointsN); // cells already covered by a traced ring
    const outlines = new Map<number, [number, number][][]>(limits.map(t => [t, []]));

    for (const i of cells.i) {
      const t = cells.t[i];
      if (t > 0 || used[i] || !outlines.has(t)) continue;

      const start = findStart(i, t);
      if (!start) continue;
      used[i] = 1;

      const chain = connectVertices(start, t);
      if (chain.length < 4) continue;

      // keep every n-th point, n growing with the distance from the coast, but never drop a border vertex
      const relax = 1 + t * -2;
      const relaxed = chain.filter((v, index) => !(index % relax) || vertices.c[v].some((c: number) => c >= pointsN));
      if (relaxed.length < 4) continue;

      const ring = clipPoly(
        relaxed.map(v => vertices.p[v]),
        graphWidth,
        graphHeight
      );
      outlines.get(t)!.push(ring);
    }

    // in limits order, so the renderer stacks the rings from the coast outwards
    return limits.map(t => ({ t, rings: outlines.get(t)! }));

    /** find the vertex of cell `i` to start tracing from: a map border one, or one facing shallower water */
    function findStart(i: number, t: number): number | undefined {
      if (cells.b[i]) return cells.v[i].find((v: number) => vertices.c[v].some((c: number) => c >= pointsN));
      return cells.v[i][cells.c[i].findIndex((c: number) => cells.t[c] < t || !cells.t[c])];
    }

    /** walk the border of the `t` area from `start` back to itself, collecting the vertices */
    function connectVertices(start: number, t: number): number[] {
      const chain: number[] = [];

      for (let i = 0, current = start; i === 0 || (current !== start && i < 10000); i++) {
        const prev = chain[chain.length - 1];
        chain.push(current);

        const c = vertices.c[current]; // cells adjacent to the vertex
        for (const cell of c) if (cells.t[cell] === t) used[cell] = 1;

        const v = vertices.v[current]; // neighbouring vertices
        const c0 = !cells.t[c[0]] || cells.t[c[0]] === t - 1;
        const c1 = !cells.t[c[1]] || cells.t[c[1]] === t - 1;
        const c2 = !cells.t[c[2]] || cells.t[c[2]] === t - 1;
        if (v[0] !== undefined && v[0] !== prev && c0 !== c1) current = v[0];
        else if (v[1] !== undefined && v[1] !== prev && c1 !== c2) current = v[1];
        else if (v[2] !== undefined && v[2] !== prev && c0 !== c2) current = v[2];

        if (current === chain[chain.length - 1]) {
          ERROR && console.error("Next vertex is not found");
          break;
        }
      }

      chain.push(chain[0]); // close the ring
      return chain;
    }
  }
}

export const Ocean = new OceanModule();
