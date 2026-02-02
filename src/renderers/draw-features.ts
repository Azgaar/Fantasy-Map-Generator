import { curveBasisClosed, line, select } from "d3";
import type { PackedGraphFeature } from "../modules/features";
import { clipPoly, round } from "../utils";

declare global {
  var drawFeatures: () => void;
  var simplify: (
    points: [number, number][],
    tolerance: number,
    highestQuality?: boolean,
  ) => [number, number][];
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
    lakes: {},
  };

  for (const feature of pack.features) {
    if (!feature || feature.type === "ocean") continue;

    html.paths.push(
      `<path d="${getFeaturePath(feature)}" id="feature_${feature.i}" data-f="${feature.i}"></path>`,
    );

    if (feature.type === "lake") {
      html.landMask.push(
        `<use href="#feature_${feature.i}" data-f="${feature.i}" fill="black"></use>`,
      );

      const lakeGroup = feature.group || "freshwater";
      if (!html.lakes[lakeGroup]) html.lakes[lakeGroup] = [];
      html.lakes[lakeGroup].push(
        `<use href="#feature_${feature.i}" data-f="${feature.i}"></use>`,
      );
    } else {
      html.landMask.push(
        `<use href="#feature_${feature.i}" data-f="${feature.i}" fill="white"></use>`,
      );
      html.waterMask.push(
        `<use href="#feature_${feature.i}" data-f="${feature.i}" fill="black"></use>`,
      );

      const coastlineGroup =
        feature.group === "lake_island" ? "lake_island" : "sea_island";
      if (!html.coastline[coastlineGroup]) html.coastline[coastlineGroup] = [];
      html.coastline[coastlineGroup].push(
        `<use href="#feature_${feature.i}" data-f="${feature.i}"></use>`,
      );
    }
  }

  defs.select("#featurePaths").html(html.paths.join(""));
  defs.select("#land").html(html.landMask.join(""));
  defs.select("#water").html(html.waterMask.join(""));

  coastline.selectAll<SVGGElement, unknown>("g").each(function () {
    const paths = html.coastline[this.id] || [];
    select(this).html(paths.join(""));
  });

  lakes.selectAll<SVGGElement, unknown>("g").each(function () {
    const paths = html.lakes[this.id] || [];
    select(this).html(paths.join(""));
  });

  TIME && console.timeEnd("drawFeatures");
};

function getFeaturePath(feature: PackedGraphFeature): string {
  const points: [number, number][] = feature.vertices.map(
    (vertex: number) => pack.vertices.p[vertex],
  );
  if (points.some((point) => point === undefined)) {
    ERROR && console.error("Undefined point in getFeaturePath");
    return "";
  }

  const simplifiedPoints = simplify(points, 0.3);
  const clippedPoints = clipPoly(simplifiedPoints, graphWidth, graphHeight, 1);

  const lineGen = line().curve(curveBasisClosed);
  const path = `${round(lineGen(clippedPoints) || "")}Z`;

  return path;
}

window.drawFeatures = featuresRenderer;
