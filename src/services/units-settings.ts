type UnitSettings = {
  content: HTMLDivElement;
  distanceUnitInput: HTMLSelectElement;
  distanceScaleInput: HTMLInputElement;
  areaUnit: HTMLInputElement;
  heightUnit: HTMLSelectElement;
  heightExponentInput: HTMLInputElement;
  temperatureScale: HTMLSelectElement;
  populationRateInput: HTMLInputElement;
  urbanizationInput: HTMLInputElement;
  urbanDensityInput: HTMLInputElement;
  unitsRestore: HTMLButtonElement;
};

let settings: UnitSettings | undefined;

/** Creates the units form outside the document; the Units controller mounts it on demand. */
export function getUnitSettings(): UnitSettings {
  if (settings) return settings;
  const content = document.createElement("div");
  content.id = "unitsEditor";
  content.className = "stable";
  content.innerHTML = /* html */ `<div id="unitsBody" style="margin-left: 1.1em">
      <div class="unitsHeader" style="margin-top: 0.4em"><span class="icon-map-signs"></span><label>Distance:</label></div>
      <div data-tip="Select a distance unit or provide a custom name"><label>Distance unit:</label><select id="distanceUnitInput" data-stored="distanceUnit"><option value="mi" selected>Mile (mi)</option><option value="km">Kilometer (km)</option><option value="lg">League (lg)</option><option value="vr">Versta (vr)</option><option value="nmi">Nautical mile (nmi)</option><option value="nlg">Nautical league (nlg)</option><option value="custom_name">Custom name</option></select></div>
      <div data-tip="Select how many distance units are in one pixel"><i data-locked="0" id="lock_distanceScale" class="icon-lock-open"></i><slider-input id="distanceScaleInput" data-stored="distanceScale" min=".01" max="20" step=".1" value="3"><label>1 map pixel:</label></slider-input></div>
      <div data-tip='Area unit name, type "square" to add ² to the distance unit'><label>Area unit:</label><input id="areaUnit" data-stored="areaUnit" type="text" value="square" /></div>
      <div class="unitsHeader"><span class="icon-signal"></span><label>Altitude:</label></div>
      <div data-tip="Select an altitude unit or provide a custom name"><label>Height unit:</label><select id="heightUnit" data-stored="heightUnit"><option value="ft" selected>Feet (ft)</option><option value="m">Meters (m)</option><option value="f">Fathoms (f)</option><option value="custom_name">Custom name</option></select></div>
      <div data-tip="Set altitude change sharpness"><slider-input id="heightExponentInput" data-stored="heightExponent" min="1.5" max="2.2" step=".01" value="2"><label>Exponent:</label></slider-input></div>
      <div class="unitsHeader"><span class="icon-temperature-high"></span><label>Temperature:</label></div>
      <div><label>Temperature scale:</label><select id="temperatureScale" data-stored="temperatureScale"><option value="°C" selected>degree Celsius (°C)</option><option value="°F">degree Fahrenheit (°F)</option><option value="K">Kelvin (K)</option><option value="°R">degree Rankine (°R)</option><option value="°De">degree Delisle (°De)</option><option value="°N">degree Newton (°N)</option><option value="°Ré">degree Réaumur (°Ré)</option><option value="°Rø">degree Rømer (°Rø)</option></select></div>
      <div class="unitsHeader"><span class="icon-male"></span><label>Population:</label></div>
      <div data-tip="People per population point"><slider-input id="populationRateInput" data-stored="populationRate" min="10" max="10000" step="10" value="1000"><label>1 population point:</label></slider-input></div>
      <div data-tip="Urban population modifier"><slider-input id="urbanizationInput" data-stored="urbanization" min=".01" max="5" step=".01" value="1"><label>Urbanization rate:</label></slider-input></div>
      <div data-tip="Average population per MFCG building"><slider-input id="urbanDensityInput" data-stored="urbanDensity" min="1" max="200" step="1" value="10"><label>Urban density:</label></slider-input></div>
    </div><div id="unitsBottom"><button id="unitsRestore" data-tip="Restore default units settings" class="icon-ccw"></button></div>`;
  settings = {
    content,
    distanceUnitInput: find("distanceUnitInput"),
    distanceScaleInput: find("distanceScaleInput"),
    areaUnit: find("areaUnit"),
    heightUnit: find("heightUnit"),
    heightExponentInput: find("heightExponentInput"),
    temperatureScale: find("temperatureScale"),
    populationRateInput: find("populationRateInput"),
    urbanizationInput: find("urbanizationInput"),
    urbanDensityInput: find("urbanDensityInput"),
    unitsRestore: find("unitsRestore")
  };
  Object.assign(window, settings);
  return settings;

  function find<T extends HTMLElement>(id: string): T {
    const element = content.querySelector<T>(`#${id}`);
    if (!element) throw new Error(`Missing units setting: ${id}`);
    return element;
  }
}

export function getUnitSettingElement(id: string): HTMLElement | null {
  const unitSettings = getUnitSettings();
  return unitSettings.content.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
}
