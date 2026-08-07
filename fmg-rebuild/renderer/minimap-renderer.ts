import { AppState } from "../state/store";

export function drawMinimap(canvas: HTMLCanvasElement, state: AppState) {
  const ctx = canvas.getContext("2d");
  if (!ctx || !state.grid || !state.heights) return;

  const { grid, heights } = state;
  const pointsN = grid.points.length;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // We map the full width/height to the minimap dimensions using scaling factors
  const scaleX = canvas.width / state.width;
  const scaleY = canvas.height / state.height;

  // Render a simple downscaled dot-grid or wireframe
  for (let i = 0; i < pointsN; i += 3) { // Skip points to draw fast
    const [x, y] = grid.points[i];
    const h = heights[i];

    // Grayscale heights coloring
    let color = "#1a1a24";
    if (h < 20) {
      color = "#1d3557";
    } else {
      const v = Math.round(50 + ((h - 20) / 80) * 150);
      color = `rgb(${v}, ${v + 20}, ${v})`;
    }

    ctx.fillStyle = color;
    ctx.fillRect(x * scaleX, y * scaleY, 2, 2);
  }
}
