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
