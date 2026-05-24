import Alea from "alea";

/**
 * Safely serializes TypedArrays (Uint8Array, Int32Array, etc.) into standard JSON arrays.
 * Use this as the replacer function in JSON.stringify() during regression dumps.
 */
export const typedArrayReplacer = (_key: string, value: any) => {
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    return Array.from(value as any);
  }
  return value;
};

export const isPointInPolygon = (p: [number, number], poly: [number, number][]) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (
      poly[i][1] > p[1] !== poly[j][1] > p[1] &&
      p[0] < ((poly[j][0] - poly[i][0]) * (p[1] - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]
    ) {
      inside = !inside;
    }
  }
  return inside;
};

// src/tests/test.utils.ts
export interface TestOptions {
  seed?: string;
  width?: number;
  height?: number;
  points?: number;
  templateId?: string; // The ID of the template
  templateCustomRecipe?: string; // If provided, we override the template
}

export const defaultTestSetup = (options: TestOptions = {}) => {
  const { seed = "42", width = 1920, height = 1080, points = 2000, templateId = "highIsland", templateCustomRecipe } = options;

  // Handle custom recipe injection if provided
  if (templateCustomRecipe) {
    (globalThis as any).heightmapTemplates = {
      ...(globalThis as any).heightmapTemplates,
      custom_regression_recipe: { template: templateCustomRecipe }
    };
  }

  globalThis.seed = seed;
  globalThis.graphWidth = width;
  globalThis.graphHeight = height;
  Math.random = Alea(seed);

  (globalThis as any).document = {
    readyState: "complete",
    addEventListener: () => {},
    getElementById: (id: string) => {
      if (id === "pointsInput") return { dataset: { cells: points.toString() } };
      if (id === "mapWidthInput") return { value: width.toString() };
      if (id === "mapHeightInput") return { value: height.toString() };
      // If customRecipe exists, return the internal ID, otherwise return the templateId
      if (id === "templateInput") return { value: templateCustomRecipe ? "custom_regression_recipe" : templateId };
      return { value: "0", dataset: {} };
    }
  };
};
