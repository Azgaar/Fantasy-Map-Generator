import { select } from "d3";
import type { Feature } from "../generators/features";
import { round } from "../utils";
import { buildCoastlinePath, fractalizeCoastline } from "./coastline-fractal";
import { pixiOwnsLayer } from "./pixi/pixi-renderer-ownership";
import { buildFeatureShape } from "./scene/layers/feature-shapes";

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
  const renderSvgLakes = !pixiOwnsLayer("lakes");
  const renderSvgCoastline = !pixiOwnsLayer("coastline");

  for (const feature of pack.features) {
    if (!feature || feature.type === "ocean") continue;

    html.paths.push(
      `<path d="${featurePathRenderer(feature)}" id="feature_${feature.i}" data-f="${feature.i}"></path>`
    );

    if (feature.type === "lake") {
      html.landMask.push(`<use href="#feature_${feature.i}" data-f="${feature.i}" fill="black"></use>`);
      html.waterMask.push(`<use href="#feature_${feature.i}" data-f="${feature.i}" fill="white"></use>`);

      if (renderSvgLakes) {
        const lakeGroup = feature.group || "freshwater";
        if (!html.lakes[lakeGroup]) html.lakes[lakeGroup] = [];
        html.lakes[lakeGroup].push(`<use href="#feature_${feature.i}" data-f="${feature.i}"></use>`);
      }
    } else {
      html.landMask.push(`<use href="#feature_${feature.i}" data-f="${feature.i}" fill="white"></use>`);
      html.waterMask.push(`<use href="#feature_${feature.i}" data-f="${feature.i}" fill="black"></use>`);

      if (renderSvgCoastline) {
        const coastlineGroup = feature.group === "lake_island" ? "lake_island" : "sea_island";
        if (!html.coastline[coastlineGroup]) html.coastline[coastlineGroup] = [];
        html.coastline[coastlineGroup].push(`<use href="#feature_${feature.i}" data-f="${feature.i}"></use>`);
      }
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
  const shape = buildFeatureShape(
    feature,
    pack.vertices,
    { height: graphHeight, width: graphWidth },
    {
      fractalize: (points, currentFeature) => fractalizeCoastline(points, currentFeature.i, currentFeature.type),
      secureBoundary: true,
      simplify
    }
  );
  if (!shape) {
    ERROR && console.error("Undefined point in getFeaturePath");
    return "";
  }
  return `${round(buildCoastlinePath(shape))}Z`;
}

window.drawFeatures = featuresRenderer;

export { featurePathRenderer as getFeaturePath, featuresRenderer as drawFeatures };
