import { ensureEl } from "@/utils";

export function drawRivers(): void {
  TIME && console.time("drawRivers");

  const riverPaths = pack.rivers.map(({ cells, points, i, widthFactor, sourceWidth }) => {
    if (!cells || cells.length < 2) return "";

    if (points && points.length !== cells.length) {
      ERROR &&
        console.error(`River ${i} has ${cells.length} cells, but only ${points.length} points. Resetting points data`);
      points = undefined;
    }

    const meanderedPoints = Rivers.addMeandering(cells, points);
    return /* html */ `<path id="river${i}" d="${Rivers.getRiverPath(meanderedPoints, widthFactor, sourceWidth)}"/>`;
  });

  ensureEl("rivers").innerHTML = riverPaths.join("");

  TIME && console.timeEnd("drawRivers");
}
