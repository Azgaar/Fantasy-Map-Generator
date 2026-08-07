import { store } from "../state/store";

export interface MapLabel {
  id: number;
  text: string;
  x: number;
  y: number;
  rotation: number; // in degrees
  size: number;
}

export function mountLabelEditor(containerId: string, onUpdate: () => void) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div style="background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 0.5rem;">
      <h3 style="margin-top: 0; color: #fb7185; border-bottom: 1px solid #333; padding-bottom: 0.25rem;">Labels Editor</h3>
      
      <div>
        <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Label Text:</label>
        <input id="labelTextInput" type="text" value="New Territory" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
      </div>

      <div style="display: flex; gap: 0.5rem;">
        <div style="flex: 1;">
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Size:</label>
          <input id="labelSizeInput" type="number" value="16" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
        </div>
        <div style="flex: 1;">
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Rotation (°):</label>
          <input id="labelRotInput" type="number" value="0" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
        </div>
      </div>

      <button id="addLabelBtn" style="background: #e11d48; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; margin-top: 0.3rem;">
        Add Label to Center
      </button>
    </div>
  `;

  const txtInput = document.getElementById("labelTextInput") as HTMLInputElement;
  const sizeInput = document.getElementById("labelSizeInput") as HTMLInputElement;
  const rotInput = document.getElementById("labelRotInput") as HTMLInputElement;
  const btn = document.getElementById("addLabelBtn") as HTMLButtonElement;

  btn.addEventListener("click", () => {
    const state = store.getState() as any;
    const labels = state.labels || [];

    const newLabel: MapLabel = {
      id: Math.floor(Math.random() * 100000),
      text: txtInput.value,
      x: state.width / 2 || 400,
      y: state.height / 2 || 300,
      size: parseInt(sizeInput.value, 10) || 16,
      rotation: parseInt(rotInput.value, 10) || 0
    };

    store.updateState({ labels: [...labels, newLabel] });
    onUpdate();
  });
}
