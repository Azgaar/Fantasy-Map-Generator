import { store } from "../state/store";

export function mountImageImporter(containerId: string, onUpdate: () => void) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div style="background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 0.5rem;">
      <h3 style="margin-top: 0; color: #a855f7; border-bottom: 1px solid #333; padding-bottom: 0.25rem;">Heightmap Image Importer</h3>
      <p style="margin: 0; font-size: 0.75rem; color: #94a3b8; line-height: 1.3;">Upload a grayscale image to map pixel values to heights.</p>
      
      <input id="imageFileInput" type="file" accept="image/*" style="display: none;" />
      <button id="uploadImgBtn" style="background: #7c3aed; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">
        Select Grayscale Image
      </button>
    </div>
  `;

  const fileInput = document.getElementById("imageFileInput") as HTMLInputElement;
  const btn = document.getElementById("uploadImgBtn") as HTMLButtonElement;

  btn.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", (e) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const state = store.getState() as any;
      if (!state.grid || !state.heights) return;

      // Draw image to canvas to parse pixel colors
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = state.width;
      tempCanvas.height = state.height;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) return;

      tempCtx.drawImage(img, 0, 0, state.width, state.height);
      const imgData = tempCtx.getImageData(0, 0, state.width, state.height);

      // Map closest grid coordinate pixels to heights
      const heights = state.heights;
      const points = state.grid.points;

      for (let i = 0; i < points.length; i++) {
        const [px, py] = points[i];
        const cx = Math.min(Math.max(Math.round(px), 0), state.width - 1);
        const cy = Math.min(Math.max(Math.round(py), 0), state.height - 1);

        // Get index in canvas buffer
        const idx = (cy * state.width + cx) * 4;
        const r = imgData.data[idx];
        const g = imgData.data[idx + 1];
        const b = imgData.data[idx + 2];

        // Grayscale conversion
        const val = Math.round((r + g + b) / 3);
        // Map 0-255 to 0-100
        heights[i] = Math.round((val / 255) * 100);
      }

      store.updateState({ heights });
      onUpdate();
      URL.revokeObjectURL(img.src);
    };
  });
}
