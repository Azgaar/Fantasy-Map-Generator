export interface BurgType {
  name: string;
  popMultiplier: number;
}

export function mountBurgTypeEditor(containerId: string) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div style="background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 0.6rem;">
      <h3 style="margin-top: 0; color: #ec4899; border-bottom: 1px solid #333; padding-bottom: 0.25rem;">Burg Types & Buildings</h3>
      
      <!-- Buildings Checkboxes -->
      <div>
        <label style="display: block; margin-bottom: 0.3rem; color: #94a3b8;">Infrastructure / Buildings:</label>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem;">
          <label><input type="checkbox" checked /> Castle</label>
          <label><input type="checkbox" checked /> Port</label>
          <label><input type="checkbox" /> Temple</label>
          <label><input type="checkbox" /> Academy</label>
        </div>
      </div>

      <!-- Burg Type selector -->
      <div>
        <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Burg Class Type:</label>
        <select id="burgTypeSelect" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; cursor: pointer;">
          <option value="generic">Generic Town (1.0x)</option>
          <option value="fort">Military Fort (0.6x)</option>
          <option value="metropolis">Metropolis (2.5x)</option>
          <option value="port">Trade Port (1.8x)</option>
        </select>
      </div>
    </div>
  `;
}
