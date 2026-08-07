import { AppState } from "../state/store";

export function mountExportOptions(containerId: string, canvas: HTMLCanvasElement) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div style="background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 0.5rem;">
      <h3 style="margin-top: 0; color: #10b981; border-bottom: 1px solid #333; padding-bottom: 0.25rem;">Map Export Tools</h3>
      
      <div style="display: flex; gap: 0.5rem;">
        <button id="exportPngBtn" style="flex: 1; background: #059669; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">
          Export PNG
        </button>
        <button id="exportSvgBtn" style="flex: 1; background: #2563eb; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">
          Export SVG
        </button>
      </div>
    </div>
  `;

  const pngBtn = document.getElementById("exportPngBtn") as HTMLButtonElement;
  const svgBtn = document.getElementById("exportSvgBtn") as HTMLButtonElement;

  pngBtn.addEventListener("click", () => {
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "fantasy-map.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  svgBtn.addEventListener("click", () => {
    // Generate a simple vector representation of the map layers
    const state = (window as any).store.getState();
    const width = state.width || 800;
    const height = state.height || 600;

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`;

    // A. Draw heights grayscale cells if grid present
    if (state.grid && state.heights) {
      for (let i = 0; i < state.grid.points.length; i++) {
        const vertices = state.grid.cells.v[i];
        if (!vertices) continue;
        const pts = vertices.map((v: number) => state.grid.vertices.p[v]).filter(Boolean);
        if (pts.length === 0) continue;

        const pathPoints = pts.map((p: number[]) => `${p[0]},${p[1]}`).join(" ");
        const h = state.heights[i];
        const val = Math.round(50 + (h / 100) * 180);
        const fill = `rgb(${val}, ${val}, ${val})`;

        svgContent += `<polygon points="${pathPoints}" fill="${fill}" stroke="none" />`;
      }
    }

    svgContent += `</svg>`;

    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fantasy-map.svg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}
