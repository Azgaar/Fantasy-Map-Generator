import { State } from "../simulation/civilization/state-generator";
import { store } from "../state/store";

export function mountStateEditor(containerId: string, onUpdate: () => void) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div id="stateEditorPanel" style="display: none; background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box;">
      <h3 style="margin-top: 0; color: #3b82f6; border-bottom: 1px solid #333; padding-bottom: 0.25rem;">State Editor</h3>
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">State Name:</label>
          <input id="editStateName" type="text" style="width: 100%; padding: 0.3rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
        </div>
        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Border Color (Hex):</label>
          <input id="editStateColor" type="color" style="width: 100%; height: 35px; border: none; background: transparent; cursor: pointer;" />
        </div>
        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
          <button id="saveStateBtn" style="flex: 1; background: #10b981; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Save</button>
          <button id="closeStateBtn" style="flex: 1; background: #4b5563; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Cancel</button>
        </div>
      </div>
    </div>
  `;

  let activeState: State | null = null;

  const panel = document.getElementById("stateEditorPanel") as HTMLDivElement;
  const nameInput = document.getElementById("editStateName") as HTMLInputElement;
  const colorInput = document.getElementById("editStateColor") as HTMLInputElement;
  const saveBtn = document.getElementById("saveStateBtn") as HTMLButtonElement;
  const closeBtn = document.getElementById("closeStateBtn") as HTMLButtonElement;

  closeBtn.addEventListener("click", () => {
    panel.style.display = "none";
  });

  saveBtn.addEventListener("click", () => {
    if (activeState) {
      activeState.name = nameInput.value;
      activeState.color = colorInput.value;

      // Update state store
      const state = store.getState() as any;
      if (state.states) {
        const updatedStates = state.states.map((s: State) => s.id === activeState!.id ? { ...activeState } : s);
        store.updateState({ states: updatedStates });
      }

      panel.style.display = "none";
      onUpdate();
    }
  });

  // Export activation hook
  (window as any).openStateEditor = (state: State) => {
    activeState = state;
    nameInput.value = state.name;
    colorInput.value = state.color;
    panel.style.display = "block";
  };
}
