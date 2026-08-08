import { Burg } from "../simulation/civilization/burg-generator";
import { store } from "../state/store";

export function mountBurgEditor(containerId: string, onUpdate: () => void) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div id="burgEditorPanel" style="display: none; background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box;">
      <h3 style="margin-top: 0; color: #f43f5e; border-bottom: 1px solid #333; padding-bottom: 0.25rem;">Burg Editor</h3>
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">City Name:</label>
          <input id="editBurgName" type="text" style="width: 100%; padding: 0.3rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
        </div>
        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Population:</label>
          <input id="editBurgPop" type="number" style="width: 100%; padding: 0.3rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
        </div>
        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
          <button id="saveBurgBtn" style="flex: 1; background: #10b981; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Save</button>
          <button id="closeBurgBtn" style="flex: 1; background: #4b5563; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Cancel</button>
        </div>
      </div>
    </div>
  `;

  let activeBurg: Burg | null = null;

  const panel = document.getElementById("burgEditorPanel") as HTMLDivElement;
  const nameInput = document.getElementById("editBurgName") as HTMLInputElement;
  const popInput = document.getElementById("editBurgPop") as HTMLInputElement;
  const saveBtn = document.getElementById("saveBurgBtn") as HTMLButtonElement;
  const closeBtn = document.getElementById("closeBurgBtn") as HTMLButtonElement;

  closeBtn.addEventListener("click", () => {
    panel.style.display = "none";
  });

  saveBtn.addEventListener("click", () => {
    if (activeBurg) {
      activeBurg.name = nameInput.value;
      activeBurg.population = parseInt(popInput.value, 10) || 1000;

      // Update state store
      const state = store.getState() as any;
      if (state.burgs) {
        const updatedBurgs = state.burgs.map((b: Burg) => b.id === activeBurg!.id ? { ...activeBurg } : b);
        store.updateState({ burgs: updatedBurgs });
      }

      panel.style.display = "none";
      onUpdate();
    }
  });

  // Export activation hook
  (window as any).openBurgEditor = (burg: Burg) => {
    activeBurg = burg;
    nameInput.value = burg.name;
    popInput.value = String(burg.population);
    panel.style.display = "block";
  };
}
