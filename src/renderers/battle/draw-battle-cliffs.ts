import type { Battlefield, FieldCliff } from "@/model/political/battle/battlefield";
import type { Point } from "@/types/global";
import { walkLine } from "@/utils/path-utils";

const INK = "#6c645a";
const OPACITY = 0.9;
const LINE = 1; // points
const TOOTH: [long: number, wide: number, apart: number] = [2, 1.3, 2.4]; // points, the longer the higher the cliff
const TOOTH_PER_METRE = 0.07; // points of a tooth's length for each metre of the cliff, up to twice its own
const ROUNDS = 6; // of averaging the grid's steps out of a line

class BattleCliffsRenderer {
  /** Cliffs as old battle plans draw them: a line along the top, teeth hanging from it down the face */
  getMarkup(field: Battlefield, pt: number): string {
    if (!field.cliffs.length) return "";
    let line = "";
    let teeth = "";
    for (const { points, height } of this.getLines(field.cliffs)) {
      line += `M${points.map(this.format).join("L")}`;
      const [base, wide, apart] = TOOTH.map(size => size * pt);
      const long = Math.min(base + height * TOOTH_PER_METRE * pt, base * 2);
      walkLine(points, apart, (at, [ux, uy]) => {
        const [dx, dy] = [-uy, ux]; // the top is on the left of the way along: the face is on the right
        const [hx, hy] = [(ux * wide) / 2, (uy * wide) / 2];
        teeth += `M${this.format([at[0] - hx, at[1] - hy])}L${this.format([at[0] + hx, at[1] + hy])}L${this.format([at[0] + dx * long, at[1] + dy * long])}Z`;
      });
    }
    return /* html */ `<g class="battleCliffs" pointer-events="none" opacity="${OPACITY}">
      <path d="${teeth}" fill="${INK}"/>
      <path d="${line}" fill="none" stroke="${INK}" stroke-width="${LINE * pt}" stroke-linejoin="round" stroke-linecap="round"/>
    </g>`;
  }

  /** The pieces of cliff as smooth lines: stretches laid end to end are one piece, the grid's steps averaged out */
  private getLines(cliffs: FieldCliff[]): { points: Point[]; height: number }[] {
    const pieces: FieldCliff[][] = [];
    for (const cliff of cliffs) {
      const last = pieces.at(-1)?.at(-1);
      if (last && last.b[0] === cliff.a[0] && last.b[1] === cliff.a[1]) pieces.at(-1)!.push(cliff);
      else pieces.push([cliff]);
    }
    return pieces.map(piece => {
      const points = [piece[0].a, ...piece.map(cliff => cliff.b)];
      const closed = points.length > 2 && points[0][0] === points.at(-1)![0] && points[0][1] === points.at(-1)![1];
      let line = points;
      for (let i = 0; i < ROUNDS; i++) line = this.average(line, closed);
      const height = piece.reduce((sum, cliff) => sum + cliff.height, 0) / piece.length;
      return { points: this.cut(this.cut(line, closed), closed), height };
    });
  }

  /** Each point moved halfway to the middle of its neighbours; an open line keeps its ends */
  private average(points: Point[], closed: boolean): Point[] {
    const ring = closed ? points.slice(0, -1) : points;
    const count = ring.length;
    const moved = ring.map((point, i): Point => {
      if (!closed && (i === 0 || i === count - 1)) return point;
      const [a, b] = [ring[(i - 1 + count) % count], ring[(i + 1) % count]];
      return [(a[0] + 2 * point[0] + b[0]) / 4, (a[1] + 2 * point[1] + b[1]) / 4];
    });
    return closed ? [...moved, moved[0]] : moved;
  }

  /** Chaikin's corner cutting: each corner cut at a quarter of the sides by it; an open line keeps its ends */
  private cut(points: Point[], closed: boolean): Point[] {
    const ring = closed ? points.slice(0, -1) : points;
    const cut: Point[] = closed ? [] : [ring[0]];
    const count = closed ? ring.length : ring.length - 1;
    for (let i = 0; i < count; i++) {
      const [a, b] = [ring[i], ring[(i + 1) % ring.length]];
      cut.push(
        [a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25],
        [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]
      );
    }
    if (closed) cut.push(cut[0]);
    else cut.push(ring.at(-1)!);
    return cut;
  }

  private readonly format = ([x, y]: Point): string => `${x.toFixed(1)} ${y.toFixed(1)}`;
}

export const BattleCliffsView = new BattleCliffsRenderer();
