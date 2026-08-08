export interface SetupConfig {
  cellsCount: number;
  statesCount: number;
  religionsCount: number;
  provincesRatio: number; // 0 to 10
  burgsCount: number;
  tempEquator: number;
  windsAngle: number;
  precipitationInput: number;
}

export function mountConfigurator(containerId: string, onConfigChange: (config: SetupConfig) => void) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div id="configPanel" style="background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 0.8rem;">
      <h3 style="margin-top: 0; color: #3b82f6; border-bottom: 1px solid #333; padding-bottom: 0.25rem;">World & Setup Config</h3>
      
      <!-- Grid Cells -->
      <div>
        <label style="display: flex; justify-content: space-between; color: #94a3b8;">
          <span>Desired Cells:</span>
          <span id="valCells" style="color: #fbbf24; font-weight: bold;">12000</span>
        </label>
        <input id="slideCells" type="range" min="1000" max="25000" step="1000" value="12000" style="width: 100%; cursor: pointer;" />
      </div>

      <!-- State & Burgs Counts -->
      <div style="display: flex; gap: 0.5rem;">
        <div style="flex: 1;">
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">States Count:</label>
          <input id="numStates" type="number" min="1" max="15" value="6" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
        </div>
        <div style="flex: 1;">
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Burgs Count:</label>
          <input id="numBurgs" type="number" min="5" max="50" value="25" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
        </div>
      </div>

      <!-- Religions & Provinces -->
      <div style="display: flex; gap: 0.5rem;">
        <div style="flex: 1;">
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Religions:</label>
          <input id="numReligions" type="number" min="0" max="10" value="5" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
        </div>
        <div style="flex: 1;">
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Provinces Ratio:</label>
          <input id="numProvinces" type="number" min="0" max="5" value="3" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
        </div>
      </div>

      <!-- Climate Controls -->
      <div style="border-top: 1px solid #333; padding-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem;">
        <div style="display: flex; gap: 0.5rem;">
          <div style="flex: 1;">
            <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Equator Temp (°C):</label>
            <input id="numTemp" type="number" value="28" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
          </div>
          <div style="flex: 1;">
            <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Wind Angle (°):</label>
            <input id="numWind" type="number" min="0" max="360" value="225" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
          </div>
        </div>
        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Precipitation (0-200%):</label>
          <input id="slidePrec" type="range" min="0" max="200" value="100" style="width: 100%; cursor: pointer;" />
        </div>
      </div>

      <button id="applyConfigBtn" style="background: linear-gradient(135deg, #3b82f6, #6366f1); border: none; padding: 0.5rem; color: white; font-weight: bold; border-radius: 6px; cursor: pointer; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.9" onmouseout="this.style.opacity=1.0">
        Apply Settings & Regen
      </button>
    </div>
  `;

  const slideCells = document.getElementById("slideCells") as HTMLInputElement;
  const valCells = document.getElementById("valCells") as HTMLSpanElement;
  const numStates = document.getElementById("numStates") as HTMLInputElement;
  const numBurgs = document.getElementById("numBurgs") as HTMLInputElement;
  const numReligions = document.getElementById("numReligions") as HTMLInputElement;
  const numProvinces = document.getElementById("numProvinces") as HTMLInputElement;
  const numTemp = document.getElementById("numTemp") as HTMLInputElement;
  const numWind = document.getElementById("numWind") as HTMLInputElement;
  const slidePrec = document.getElementById("slidePrec") as HTMLInputElement;
  const applyBtn = document.getElementById("applyConfigBtn") as HTMLButtonElement;

  slideCells.addEventListener("input", () => {
    valCells.innerText = slideCells.value;
  });

  const getConfig = (): SetupConfig => ({
    cellsCount: parseInt(slideCells.value, 10),
    statesCount: parseInt(numStates.value, 10),
    burgsCount: parseInt(numBurgs.value, 10),
    religionsCount: parseInt(numReligions.value, 10),
    provincesRatio: parseInt(numProvinces.value, 10),
    tempEquator: parseInt(numTemp.value, 10),
    windsAngle: parseInt(numWind.value, 10),
    precipitationInput: parseInt(slidePrec.value, 10)
  });

  applyBtn.addEventListener("click", () => {
    onConfigChange(getConfig());
  });

  // Export current config
  (window as any).getCurrentSetupConfig = getConfig;
}
