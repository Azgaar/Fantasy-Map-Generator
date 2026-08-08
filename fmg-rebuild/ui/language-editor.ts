import { generateName } from "../simulation/civilization/name-generator";

export function mountLanguageEditor(containerId: string) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div style="background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 0.5rem;">
      <h3 style="margin-top: 0; color: #a78bfa; border-bottom: 1px solid #333; padding-bottom: 0.25rem;">Language Syllable Editor</h3>
      
      <div>
        <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Select Language:</label>
        <select id="langSelect" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; cursor: pointer;">
          <option value="norse">Norse</option>
          <option value="roman">Roman</option>
          <option value="elven">Elven</option>
          <option value="english">English</option>
        </select>
      </div>

      <div>
        <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Custom Name Preview:</label>
        <div style="display: flex; gap: 0.5rem;">
          <input id="langTestPreview" type="text" readonly style="flex: 2; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: #fbbf24; border-radius: 4px; font-weight: bold;" />
          <button id="testGenBtn" style="flex: 1; background: #8b5cf6; border: none; padding: 0.25rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Test</button>
        </div>
      </div>
    </div>
  `;

  const langSelect = document.getElementById("langSelect") as HTMLSelectElement;
  const preview = document.getElementById("langTestPreview") as HTMLInputElement;
  const genBtn = document.getElementById("testGenBtn") as HTMLButtonElement;

  const testName = () => {
    const seed = "test-" + Math.floor(Math.random() * 100000);
    preview.value = generateName(langSelect.value, seed);
  };

  genBtn.addEventListener("click", testName);
  langSelect.addEventListener("change", testName);

  testName();
}
