export interface RegimentDefinition {
  type: string;
  speed: number;
  combatValue: number;
}

export function mountMilitaryUnitEditor(containerId: string) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div style="background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 0.5rem;">
      <h3 style="margin-top: 0; color: #38bdf8; border-bottom: 1px solid #333; padding-bottom: 0.25rem;">Military Units Setup</h3>
      
      <div>
        <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Active Regiment Class:</label>
        <select id="milTypeSelect" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; cursor: pointer;">
          <option value="infantry">Infantry (Speed: 1.0, Attack: 10)</option>
          <option value="cavalry">Cavalry (Speed: 1.8, Attack: 15)</option>
          <option value="navy">Navy (Speed: 2.2, Attack: 20)</option>
        </select>
      </div>

      <div style="display: flex; gap: 0.5rem; margin-top: 0.2rem;">
        <div style="flex: 1;">
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Attack Rating:</label>
          <input id="milAttack" type="number" value="10" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
        </div>
        <div style="flex: 1;">
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Speed Rating:</label>
          <input id="milSpeed" type="number" step="0.1" value="1.0" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
        </div>
      </div>
    </div>
  `;

  const select = document.getElementById("milTypeSelect") as HTMLSelectElement;
  const attack = document.getElementById("milAttack") as HTMLInputElement;
  const speed = document.getElementById("milSpeed") as HTMLInputElement;

  select.addEventListener("change", () => {
    const val = select.value;
    if (val === "infantry") {
      attack.value = "10";
      speed.value = "1.0";
    } else if (val === "cavalry") {
      attack.value = "15";
      speed.value = "1.8";
    } else {
      attack.value = "20";
      speed.value = "2.2";
    }
  });
}
