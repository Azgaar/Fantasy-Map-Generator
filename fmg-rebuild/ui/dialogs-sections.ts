import { store } from "../state/store";

export function mountStyleAndBiomeEditor(containerId: string, onUpdate: () => void) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div style="background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 0.8rem;">
      <h3 style="margin-top: 0; color: #10b981; border-bottom: 1px solid #333; padding-bottom: 0.25rem;">Style & Biomes</h3>
      
      <!-- Style Preset -->
      <div>
        <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Visual Preset:</label>
        <select id="stylePreset" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; cursor: pointer;">
          <option value="classic">Classic (Default)</option>
          <option value="monochrome">Grayscale (Heights)</option>
          <option value="clean">Minimalist</option>
        </select>
      </div>

      <!-- Quick Biomes Info -->
      <div>
        <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Biomes Breakdown:</label>
        <div style="max-height: 80px; overflow-y: auto; background: #0f0f12; border: 1px solid #444; border-radius: 4px; padding: 0.3rem;">
          <ul id="biomesList" style="margin: 0; padding-left: 1.2rem; line-height: 1.3; color: #cbd5e1;">
            <li>No map generated yet</li>
          </ul>
        </div>
      </div>
    </div>
  `;

  const presetSelect = document.getElementById("stylePreset") as HTMLSelectElement;
  const listEl = document.getElementById("biomesList") as HTMLUListElement;

  presetSelect.addEventListener("change", () => {
    const val = presetSelect.value;
    const windowObj = window as any;

    if (val === "monochrome") {
      windowObj.triggerLayerSelect("heightmap");
    } else {
      windowObj.triggerLayerSelect("states");
    }
    onUpdate();
  });

  // Export biomes breakdown refresh hook
  (window as any).refreshBiomesList = () => {
    const state = store.getState() as any;
    if (!state.biomes) return;

    const counts: Record<number, number> = {};
    for (let i = 0; i < state.biomes.length; i++) {
      const b = state.biomes[i];
      counts[b] = (counts[b] || 0) + 1;
    }

    const biomeNames = ["Marine", "Hot desert", "Cold desert", "Savanna", "Grassland", "Tropical seasonal forest", "Temperate deciduous forest", "Tropical rainforest", "Temperate rainforest", "Taiga", "Tundra", "Glacier", "Wetland"];
    
    listEl.innerHTML = Object.entries(counts)
      .map(([bId, count]) => {
        const name = biomeNames[parseInt(bId, 10)] || "Unknown";
        return `<li>${name}: <strong>${count}</strong> cells</li>`;
      })
      .join("");
  };
}
