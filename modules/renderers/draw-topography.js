"use strict";

// Draw topographic hillshade-style fill per grid cell
function drawTopography() {
  TIME && console.time("drawTopography");

  const group = d3.select("#topography");
  group.selectAll("*").remove();

  const {cells, points, features: gridFeatures} = grid;

  // Colorimetry from user (positive altitudes, depressions, negative altitudes)
  // Start positive ramp at #BAAE9A as requested
  const POSITIVE_COLORS = [
    "#BAAE9A",
    "#AC9A7C",
    "#AA8753",
    "#B9985A",
    "#C3A76B",
    "#CAB982",
    "#D3CA9D",
    "#DED6A3",
    "#E8E1B6",
    "#EFEBC0",
    "#E1E4B5",
    "#D1D7AB",
    "#BDCC96",
    "#A8C68F",
    "#94BF8B",
    "#ACD0A5"
  ];
  const NEGATIVE_COLORS = [
    "#D8F2FE",
    "#C6ECFF",
    "#B9E3FF",
    "#ACDBFB",
    "#A1D2F7",
    "#96C9F0",
    "#8DC1EA",
    "#84B9E3",
    "#79B2DE",
    "#71ABD8"
  ];
  const DEPRESSIONS_COLOR = "#0978AB"; // lakes / inland depressions: Rivers, coasts, hydronyms color

  const posInterp = d3.interpolateRgbBasis(POSITIVE_COLORS);
  const negInterp = d3.interpolateRgbBasis(NEGATIVE_COLORS);

  // Base color scheme mirrors heightmap scheme
  // not used now; we fully replace with provided palette

  // Lighting settings (can be overridden by attributes)
  const azimuth = (+group.attr("azimuth") || 315) * (Math.PI / 180); // degrees → radians
  const altitude = (+group.attr("altitude") || 45) * (Math.PI / 180);
  const light = [Math.cos(azimuth) * Math.cos(altitude), Math.sin(azimuth) * Math.cos(altitude), Math.sin(altitude)];
  const zScale = +group.attr("zscale") || 0.8; // vertical exaggeration for normals

  let html = "";

  for (const i of cells.i) {
    const h = cells.h[i];
    const isWater = h < 20;
    const featureType = isWater && gridFeatures ? gridFeatures[cells.f[i]]?.type : null;
    const isLake = isWater && featureType === "lake";

    // Estimate gradient from neighbors
    const [cx, cy] = points[i];
    let gx = 0,
      gy = 0,
      wsum = 0;
    for (const n of cells.c[i]) {
      if (n < 0) continue;
      const [nx, ny] = points[n];
      const dx = nx - cx;
      const dy = ny - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const dh = (cells.h[n] - h) / 100; // normalize height difference
      const w = 1 / dist; // weight close neighbors higher
      gx += w * dh * (dx / dist);
      gy += w * dh * (dy / dist);
      wsum += w;
    }
    if (wsum) {
      gx /= wsum;
      gy /= wsum;
    }

    // Build surface normal and compute light intensity
    const nx = -gx * zScale;
    const ny = -gy * zScale;
    const nz = 1;
    const invLen = 1 / Math.hypot(nx, ny, nz);
    const n0 = [nx * invLen, ny * invLen, nz * invLen];
    const intensity = minmax(n0[0] * light[0] + n0[1] * light[1] + n0[2] * light[2], 0, 1);

    // Base color from provided palettes
    let baseColor;
    if (isWater) {
      if (isLake) baseColor = d3.color(DEPRESSIONS_COLOR);
      else {
        const t = minmax((20 - h) / 20, 0, 1); // shallow 0 → deep 1
        baseColor = d3.color(negInterp(t));
      }
    } else {
      const t = minmax((h - 20) / 80, 0, 1); // lowland 0 → highland 1
      baseColor = d3.color(posInterp(t));
    }

    // Modulate lightness by intensity (weaker effect on water)
    const hsl = d3.hsl(baseColor);
    const k = isWater ? 0.4 : 0.8;
    hsl.l = minmax(hsl.l * (0.6 + k * intensity), 0, 1);
    const color = hsl.toString();

    // Cell polygon
    const poly = getGridPolygon(i)
      .map(p => `${rn(p[0], 2)},${rn(p[1], 2)}`)
      .join(" ");
    html += `<polygon points="${poly}" fill="${color}" opacity="${(terrs.attr("opacity") || 1) * 1}" />`;
  }

  group.html(html);

  TIME && console.timeEnd("drawTopography");
}
