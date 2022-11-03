import {DISTANCE_FIELD, MIN_LAND_HEIGHT} from "config/generation";

// return cell index on a regular square grid
export function findGridCell(x: number, y: number, grid: IGrid) {
  /* use */ const {spacing, cellsX, cellsY} = grid;
  return Math.floor(Math.min(y / spacing, cellsY - 1)) * cellsX + Math.floor(Math.min(x / spacing, cellsX - 1));
}

// return array of cell indexes in radius on a regular square grid
export function findGridAll(x: number, y: number, radius: number) {
  const c = grid.cells.c;
  let r = Math.floor(radius / grid.spacing);
  let found = [findGridCell(x, y, grid)];
  if (!r || radius === 1) return found;
  if (r > 0) found = found.concat(c[found[0]]);
  if (r > 1) {
    let frontier = c[found[0]];
    while (r > 1) {
      let cycle = frontier.slice();
      frontier = [];
      cycle.forEach(function (s) {
        c[s].forEach(function (e) {
          if (found.indexOf(e) !== -1) return;
          found.push(e);
          frontier.push(e);
        });
      });
      r--;
    }
  }

  return found;
}

// return array of cell indexes in radius
export function findAll(x: number, y: number, radius: number) {
  const found = pack.cells.q.findAll(x, y, radius);
  return found.map(data => data[2]);
}

// get polygon points for packed cells knowing cell id
export function getPackPolygon(i: number) {
  return pack.cells.v[i].map(v => pack.vertices.p[v]);
}

// return closest cell index
export function findCell(x: number, y: number): number;
export function findCell(x: number, y: number, radius: number): number | undefined;
export function findCell(x: number, y: number, radius = Infinity): number | undefined {
  const found = pack.cells.q.find(x, y, radius);
  return found?.[2];
}

// get polygon points for initial cells knowing cell id
export function getGridPolygon(i: number): TPoints {
  return grid.cells.v[i].map(v => grid.vertices.p[v]);
}

export function isLand(cellId: number) {
  return pack.cells.h[cellId] >= MIN_LAND_HEIGHT;
}

export function isWater(cellId: number) {
  return pack.cells.h[cellId] < MIN_LAND_HEIGHT;
}

export function isCoastal(i: number) {
  return pack.cells.t[i] === DISTANCE_FIELD.LAND_COAST;
}
