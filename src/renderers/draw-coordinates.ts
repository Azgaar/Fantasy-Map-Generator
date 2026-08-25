import { geoEquirectangular, geoGraticule, geoPath, select } from "d3";
import { ensureEl, rn, round } from "@/utils";

const STEPS = [0.5, 1, 2, 5, 10, 15, 30]; // possible distances between the graticule lines, in degrees

export function drawCoordinates(): void {
  const coordinates = select(ensureEl<SVGGElement>("coordinates"));
  coordinates.selectAll("*").remove(); // redraw every time: the label size depends on the zoom level

  const { lonT, lonW, lonE, latN, latS } = mapCoordinates as Required<typeof mapCoordinates>;
  const goal = lonT / scale / 10;
  const step = STEPS.reduce((prev, curr) => (Math.abs(curr - goal) < Math.abs(prev - goal) ? curr : prev));

  const desiredSize = styles.coordinates.options.fontSize;
  coordinates.attr("font-size", Math.max(rn(desiredSize / scale ** 0.8, 2), 0.1));

  const graticule = geoGraticule()
    .extent([
      [lonW, latN],
      [lonE + 0.1, latS + 0.1]
    ])
    .stepMajor([400, 400])
    .stepMinor([step, step]);
  const projection = geoEquirectangular().fitSize([graphWidth, graphHeight], graticule());

  // labels are placed at the top left corner of the screen, in map coordinates
  const point = new DOMPoint(scale + desiredSize + 2, scale + desiredSize / 2);
  const corner = point.matrixTransform(ensureEl<SVGGElement>("viewbox").getScreenCTM()!.inverse());

  const labels = graticule.lines().map(line => {
    const isLatitude = line.coordinates[0][1] === line.coordinates[1][1];
    const [lon, lat] = line.coordinates[0];
    const position = projection([lon, lat])!;
    const [x, y] = isLatitude ? [rn(corner.x, 2), rn(position[1], 2)] : [rn(position[0], 2), rn(corner.y, 2)];

    const value = isLatitude ? lat : lon;
    let text = "";
    if (Number.isInteger(value) && value) {
      if (isLatitude) text = lat < 0 ? `${-lat}°S` : `${lat}°N`;
      else text = lon < 0 ? `${-lon}°W` : `${lon}°E`;
    } else if (!value) text = String(value);

    return { x, y, text };
  });

  coordinates
    .append("g")
    .attr("id", "coordinateGrid")
    .append("path")
    .attr("d", round(geoPath(projection)(graticule())!))
    .attr("vector-effect", "non-scaling-stroke");

  coordinates
    .append("g")
    .attr("id", "coordinateLabels")
    .selectAll("text")
    .data(labels)
    .enter()
    .append("text")
    .attr("text-rendering", "optimizeSpeed")
    .attr("x", label => label.x)
    .attr("y", label => label.y)
    .text(label => label.text);
}
