export interface RasterExportSize {
  height: number;
  width: number;
}

export interface RasterExportFrame extends RasterExportSize {
  x: number;
  y: number;
}

export interface RasterExportCrop extends RasterExportSize {
  x: number;
  y: number;
}

export interface RasterExportTile {
  column: number;
  content: RasterExportFrame;
  crop: RasterExportCrop;
  frame: RasterExportFrame;
  height: number;
  id: number;
  row: number;
  width: number;
}

export interface RasterExportPlan {
  columns: number;
  height: number;
  rows: number;
  tiles: RasterExportTile[];
  width: number;
}

export interface RasterExportPlanOptions {
  columns: number;
  height: number;
  maxTextureSize: number;
  overlap?: number;
  rows: number;
  scale: number;
  width: number;
}

/**
 * Plans full-map extraction in output pixels. Every Pixi frame includes a small overlap for stable edge
 * antialiasing, while `crop` identifies the non-overlapping pixels written to the final tile.
 */
export function createRasterExportPlan(options: RasterExportPlanOptions): RasterExportPlan {
  const width = positive(options.width, "width");
  const height = positive(options.height, "height");
  const scale = positive(options.scale, "scale");
  const maxTextureSize = Math.max(1, Math.floor(positive(options.maxTextureSize, "maxTextureSize")));
  const overlap = Math.max(0, Math.floor(options.overlap ?? 1));
  const contentLimit = maxTextureSize - overlap * 2;
  if (contentLimit < 1) throw new Error("Raster export texture limit is too small for overlap-safe tiling");

  const outputWidth = Math.max(1, Math.round(width * scale));
  const outputHeight = Math.max(1, Math.round(height * scale));
  const columns = Math.max(1, Math.floor(options.columns) || 1, Math.ceil(outputWidth / contentLimit));
  const rows = Math.max(1, Math.floor(options.rows) || 1, Math.ceil(outputHeight / contentLimit));
  const tiles: RasterExportTile[] = [];

  for (let row = 0; row < rows; row++) {
    const outputY0 = Math.round((outputHeight * row) / rows);
    const outputY1 = Math.round((outputHeight * (row + 1)) / rows);
    for (let column = 0; column < columns; column++) {
      const outputX0 = Math.round((outputWidth * column) / columns);
      const outputX1 = Math.round((outputWidth * (column + 1)) / columns);
      const left = column ? overlap : 0;
      const top = row ? overlap : 0;
      const right = column < columns - 1 ? overlap : 0;
      const bottom = row < rows - 1 ? overlap : 0;
      const contentWidth = outputX1 - outputX0;
      const contentHeight = outputY1 - outputY0;

      tiles.push({
        column,
        content: {
          height: contentHeight / scale,
          width: contentWidth / scale,
          x: outputX0 / scale,
          y: outputY0 / scale
        },
        crop: { height: contentHeight, width: contentWidth, x: left, y: top },
        frame: {
          height: (contentHeight + top + bottom) / scale,
          width: (contentWidth + left + right) / scale,
          x: (outputX0 - left) / scale,
          y: (outputY0 - top) / scale
        },
        height: contentHeight,
        id: row * columns + column + 1,
        row,
        width: contentWidth
      });
    }
  }

  return { columns, height: outputHeight, rows, tiles, width: outputWidth };
}

export function throwIfRasterExportAborted(signal?: AbortSignal): void {
  if (signal?.aborted)
    throw signal.reason instanceof Error ? signal.reason : new DOMException("Export canceled", "AbortError");
}

function positive(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Raster export ${name} must be a positive number`);
  return value;
}
