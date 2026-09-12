import type { Layer } from "@/components/layers";
import { Coastline } from "@/generators/coastline-generator";
import type { Feature } from "@/generators/features-generator";
import { ensureEl, findEl } from "@/utils";

/**
 * The landmass is a plain rect shown through the land mask. The layer also owns the shared feature
 * geometry in defs: the coastline and lakes layers reference it, so it is drawn before both of them
 */
export function drawLandmass(layer: Layer): void {
  TIME && console.time("drawLandmass");

  const paths: string[] = [];
  const landMask: string[] = [];
  const waterMask: string[] = ['<rect x="0" y="0" width="100%" height="100%" fill="white" />'];

  for (const feature of pack.features) {
    if (!feature || feature.type === "ocean") continue;
    const isLake = feature.type === "lake";

    paths.push(
      `<path d="${Coastline.getFeaturePath(feature)}" id="feature_${feature.i}" data-f="${feature.i}"></path>`
    );
    landMask.push(
      `<use href="#feature_${feature.i}" data-f="${feature.i}" fill="${isLake ? "black" : "white"}"></use>`
    );
    waterMask.push(
      `<use href="#feature_${feature.i}" data-f="${feature.i}" fill="${isLake ? "white" : "black"}"></use>`
    );
  }

  ensureEl("featurePaths").innerHTML = paths.join("");
  ensureEl("land").innerHTML = landMask.join("");
  ensureEl("water").innerHTML = waterMask.join("");

  layer.getEl().innerHTML = /* html */ `<rect x="0" y="0" width="${options.map.graph.width}" height="${options.map.graph.height}" />`;

  TIME && console.timeEnd("drawLandmass");
}

/** Rebuild one feature's shared path; every layer referencing it follows */
export function drawFeaturePath(feature: Feature): void {
  findEl(`feature_${feature.i}`)?.setAttribute("d", Coastline.getFeaturePath(feature));
}
