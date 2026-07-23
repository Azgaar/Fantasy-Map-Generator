import { select } from "d3";
import type { Feature } from "../generators/features";
import { clipPoly, round } from "../utils";
import { buildCoastlinePath, fractalizeCoastline } from "./coastline-fractal";

declare global {
  var drawFeatures: () => void;
  var simplify: (points: [number, number][], tolerance: number, highestQuality?: boolean) => [number, number][];
}

interface FeaturesHtml {
  paths: string[];
  landMask: string[];
  waterMask: string[];
  coastline: { [key: string]: string[] };
  lakes: { [key: string]: string[] };
}

const featuresRenderer = (): void => {
  TIME && console.time("drawFeatures");

  const html: FeaturesHtml = {
    paths: [],
    landMask: [],
    waterMask: ['<rect x="0" y="0" width="100%" height="100%" fill="white" />'],
    coastline: {},
    lakes: {}
  };

  for (const feature of pack.features) {
    if (!feature || feature.type === "ocean") continue;

    html.paths.push(
      `<path d="${featurePathRenderer(feature)}" id="feature_${feature.i}" data-f="${feature.i}"></path>`
    );

    if (feature.type === "lake") {
      html.landMask.push(`<use href="#feature_${feature.i}" data-f="${feature.i}" fill="black"></use>`);
      html.waterMask.push(`<use href="#feature_${feature.i}" data-f="${feature.i}" fill="white"></use>`);

      const lakeGroup = feature.group || "freshwater";
      if (!html.lakes[lakeGroup]) html.lakes[lakeGroup] = [];
      html.lakes[lakeGroup].push(`<use href="#feature_${feature.i}" data-f="${feature.i}"></use>`);
    } else {
      html.landMask.push(`<use href="#feature_${feature.i}" data-f="${feature.i}" fill="white"></use>`);
      html.waterMask.push(`<use href="#feature_${feature.i}" data-f="${feature.i}" fill="black"></use>`);

      const coastlineGroup = feature.group === "lake_island" ? "lake_island" : "sea_island";
      if (!html.coastline[coastlineGroup]) html.coastline[coastlineGroup] = [];
      html.coastline[coastlineGroup].push(`<use href="#feature_${feature.i}" data-f="${feature.i}"></use>`);
    }
  }

  select("#deftemp").select("#featurePaths").html(html.paths.join(""));
  select("#deftemp").select("#land").html(html.landMask.join(""));
  select("#deftemp").select("#water").html(html.waterMask.join(""));

  select("#coastline")
    .selectAll<SVGGElement, unknown>("g")
    .each(function () {
      const paths = html.coastline[this.id] || [];
      select(this).html(paths.join(""));
    });

  select("#lakes")
    .selectAll<SVGGElement, unknown>("g")
    .each(function () {
      const paths = html.lakes[this.id] || [];
      select(this).html(paths.join(""));
    });

  TIME && console.timeEnd("drawFeatures");
};

function featurePathRenderer(feature: Feature): string {
  const points = feature.vertices.map(vertex => pack.vertices.p[vertex]);
  if (points.some(point => point === undefined)) {
    ERROR && console.error("Undefined point in getFeaturePath");
    return "";
  }

  const simplifiedPoints = simplify(points, 0.3);
  const clippedPoints = clipPoly(simplifiedPoints, graphWidth, graphHeight, 1);
  const shape = fractalizeCoastline(clippedPoints, feature.i, feature.type);
  return `${round(buildCoastlinePath(shape))}Z`;
}

window.drawFeatures = featuresRenderer;

export { featurePathRenderer as getFeaturePath, featuresRenderer as drawFeatures };
