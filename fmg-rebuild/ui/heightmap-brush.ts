export interface BrushConfig {
  mode: "add" | "sub" | "set" | "smooth";
  value: number;
}

export function mountHeightBrush(containerId: string) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div style="background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 0.5rem;">
      <h3 style="margin-top: 0; color: #fbbf24; border-bottom: 1px solid #333; padding-bottom: 0.25rem;">Height Paint Brush</h3>
      
      <!-- Brush Modes -->
      <div>
        <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Brush Mode:</label>
        <select id="brushMode" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; cursor: pointer;">
          <option value="add">Add Height (+15)</option>
          <option value="sub">Lower Height (-15)</option>
          <option value="set">Set to Value</option>
          <option value="smooth">Smooth/Average</option>
        </select>
      </div>

      <!-- Height Set Input -->
      <div id="setHeightWrap" style="display: none;">
        <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Target Height (0-100):</label>
        <input id="setHeightVal" type="number" min="0" max="100" value="50" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
      </div>
    </div>
  `;

  const modeSelect = document.getElementById("brushMode") as HTMLSelectElement;
  const setWrap = document.getElementById("setHeightWrap") as HTMLDivElement;
  const setVal = document.getElementById("setHeightVal") as HTMLInputElement;

  modeSelect.addEventListener("change", () => {
    if (modeSelect.value === "set") {
      setWrap.style.display = "block";
    } else {
      setWrap.style.display = "none";
    }
  });

  // Export brush retrieval hook
  (window as any).getCurrentBrushConfig = (): BrushConfig => ({
    mode: modeSelect.value as any,
    value: parseInt(setVal.value, 10) || 50
  });
}
