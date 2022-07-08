export function drawRivers() {
  rivers.selectAll("*").remove();

  const {addMeandering, getRiverPath} = Rivers;

  const riverPaths = pack.rivers.map(({cells, points, i, widthFactor, sourceWidth}) => {
    if (!cells || cells.length < 2) return;

    if (points && points.length !== cells.length) {
      const error = `River ${i} has ${cells.length} cells, but only ${points.length} points defined. Resetting points data`;
      console.error(error);
      points = undefined;
    }

    const meanderedPoints = addMeandering(cells, points);
    const path = getRiverPath(meanderedPoints, widthFactor, sourceWidth);
    return `<path id="river${i}" d="${path}"/>`;
  });

  rivers.html(riverPaths.join(""));
}