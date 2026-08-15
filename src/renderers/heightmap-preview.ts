export function drawHeightmapPreview(
  canvas: HTMLCanvasElement,
  heights: Uint8Array,
  width: number,
  height: number
): void {
  const context = canvas.getContext("2d");
  if (!context) return;

  const imageData = context.createImageData(width, height);
  heights.forEach((height, i) => {
    const normalized = height < 20 ? Math.max(height / 1.5, 0) : height;
    const value = (normalized / 100) * 255;
    const offset = i * 4;
    imageData.data[offset] = value;
    imageData.data[offset + 1] = value;
    imageData.data[offset + 2] = value;
    imageData.data[offset + 3] = 255;
  });
  context.putImageData(imageData, 0, 0);
}
