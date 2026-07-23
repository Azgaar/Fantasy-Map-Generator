import { tip } from "@/components/tooltips";
import { timeOfDayPresets } from "@/data/view-3d-options";
import { ensureEl } from "@/utils";

// View3d controller: enters/exits the 3D view and owns the 3D settings dialog.
// Configuration lives on the global `options.threeD` (not in this controller);
// the heavy WebGL renderer is loaded lazily on first use.

type Renderer = typeof import("@/renderers/view-3d-renderer");
let renderer: Renderer | null = null;
const loadRenderer = (): Promise<Renderer> =>
  renderer ? Promise.resolve(renderer) : import("@/renderers/view-3d-renderer").then(m => (renderer = m));

// --- renderer bridge ---------------------------------------------------------
const create = (canvas: HTMLCanvasElement, type = "viewMesh") => loadRenderer().then(m => m.create(canvas, type));
const redraw = () => loadRenderer().then(m => m.redraw());
const update = () => loadRenderer().then(m => m.update());
const stop = () => loadRenderer().then(m => m.stop());
const setSunColor = (color: string) => loadRenderer().then(m => m.setSunColor(color));
const setScale = (scale: number) => loadRenderer().then(m => m.setScale(scale));
const setResolutionScale = (scale: number) => loadRenderer().then(m => m.setResolutionScale(scale));
const setLightness = (intensity: number) => loadRenderer().then(m => m.setLightness(intensity));
const setSun = (x: number, y: number, z?: number) => loadRenderer().then(m => m.setSun(x, y, z));
const setRotation = (speed: number) => loadRenderer().then(m => m.setRotation(speed));
const toggleLabels = () => loadRenderer().then(m => m.toggleLabels());
const toggleSubdivision = () => loadRenderer().then(m => m.toggle3dSubdivision());
const toggleErosion = () => loadRenderer().then(m => m.toggleErosion());
const setErosionStrength = (value: number) => loadRenderer().then(m => m.setErosionStrength(value));
const setErosionRiverDepth = (value: number) => loadRenderer().then(m => m.setErosionRiverDepth(value));
const setErosionDetail = (value: number) => loadRenderer().then(m => m.setErosionDetail(value));
const setErosionOctaves = (value: number) => loadRenderer().then(m => m.setErosionOctaves(value));
const toggleSatellite = () => loadRenderer().then(m => m.toggleSatellite());
const toggleWireframe = () => loadRenderer().then(m => m.toggleWireframe());
const toggleSky = () => loadRenderer().then(m => m.toggleSky());
const setResolution = (resolution: number) => loadRenderer().then(m => m.setResolution(resolution));
const setColors = (sky: string, water: string) => loadRenderer().then(m => m.setColors(sky, water));
const setTimeOfDay = (presetName: string) => loadRenderer().then(m => m.setTimeOfDay(presetName));
const saveScreenshot = () => loadRenderer().then(m => m.saveScreenshot());
const saveOBJ = () => loadRenderer().then(m => m.saveOBJ());
// read access to view/erosion state (used by label/icon placement and e2e tests)
const isOn = () => options.threeD.isOn;
const isCached = (key?: string) => loadRenderer().then(m => m.isCached(key));
const heightAt = (x: number, y: number, scale: number) => loadRenderer().then(m => m.heightAt(x, y, scale));

function teardown(): void {
  if (!document.getElementById("canvas3d")) return;
  void stop();
  document.getElementById("canvas3d")?.remove();
  if (document.getElementById("options3d")) $("#options3d").dialog("close");
  if (document.getElementById("preview3d")) $("#preview3d").dialog("close");
}

function enterStandard(): void {
  ensureEl("viewMode")
    .querySelectorAll(".pressed")
    .forEach(button => {
      button.classList.remove("pressed");
    });
  ensureEl("heightmap3DView").classList.remove("pressed");
  ensureEl("viewStandard").classList.add("pressed");
  teardown();
}

async function open(type: string): Promise<void> {
  enterStandard(); // tears down any current 3D view and resets the buttons
  ensureEl("viewStandard").classList.remove("pressed");
  ensureEl(type).classList.add("pressed");

  const canvas = document.createElement("canvas");
  canvas.id = "canvas3d";
  canvas.dataset.type = type;

  if (type === "heightmap3DView") {
    const preview3d = ensureEl("preview3d");
    canvas.width = parseFloat(preview3d.style.width) || graphWidth / 3;
    canvas.height = canvas.width / (graphWidth / graphHeight);
    canvas.style.display = "block";
  } else {
    canvas.width = svgWidth;
    canvas.height = svgHeight;
    canvas.style.position = "absolute";
    canvas.style.display = "none";
  }

  const started = await create(canvas, type);
  if (!started) return;

  canvas.style.display = "block";
  canvas.onmouseenter = () => {
    const help = "Drag to pan • Scroll to zoom • Right-click drag to rotate • <b>O</b> to toggle options";
    +canvas.dataset.hovered! > 2 ? tip("") : tip(help);
    canvas.dataset.hovered = String((+canvas.dataset.hovered! | 0) + 1);
  };

  if (type === "heightmap3DView") {
    renderPreviewDialog();
    ensureEl("preview3d").appendChild(canvas);
    $("#preview3d").dialog({
      title: "3D Preview",
      resizable: true,
      position: { my: "left bottom", at: "left+10 bottom-20", of: "svg" },
      resizeStop: resize3d,
      close: closePreview3d
    });
  } else document.body.insertBefore(canvas, ensureEl("optionsContainer"));

  toggleOptions();
}

function renderPreviewDialog(): void {
  document.getElementById("preview3d")?.remove();
  const editorHtml = /* html */ `<div id="preview3d" class="dialog stable" style="padding: 0px"></div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
}

function closePreview3d(): void {
  $("#preview3d").dialog("destroy");
  ensureEl("preview3d").remove();
  enterStandard();
}

function resize3d(): void {
  const canvas = document.getElementById("canvas3d") as HTMLCanvasElement | null;
  if (!canvas) return;
  const preview3d = ensureEl("preview3d");
  canvas.width = parseFloat(preview3d.style.width);
  canvas.height = parseFloat(preview3d.style.height) - 2;
  void redraw();
}

// --- settings dialog ---------------------------------------------------------
function toggleOptions(): void {
  if (document.getElementById("options3d")) {
    $("#options3d").dialog("close");
    return;
  }

  renderOptionsDialog();

  $("#options3d").dialog({
    title: "3D mode settings",
    resizable: false,
    width: "fit-content",
    position: { my: "right top", at: "right-30 top+10", of: "svg", collision: "fit" },
    close: closeOptionsDialog
  });

  updateValues();
}

function renderOptionsDialog(): void {
  document.getElementById("options3d")?.remove();
  const editorHtml = /* html */ `<div id="options3d" class="dialog stable">
      <div id="options3dMesh" style="display: none">
        <div data-tip="Set map rotation speed. Set to 0 is you want to toggle off the rotation">
          <div>Rotation:</div>
          <input id="options3dMeshRotationRange" type="range" min="0" max="10" step=".1" />
          <input id="options3dMeshRotationNumber" type="number" min="0" max="10" step=".1" style="width: 4em" />
        </div>
        <div data-tip="Set height scale">
          <div>Height scale:</div>
          <input id="options3dScaleRange" type="range" min="0" max="100" />
          <input id="options3dScaleNumber" type="number" min="0" max="1000" style="width: 4em" />
        </div>
        <div data-tip="Set scene lightness">
          <div>Lightness:</div>
          <input id="options3dLightnessRange" type="range" min="0" max="100" />
          <input id="options3dLightnessNumber" type="number" min="0" max="500" style="width: 4em" />
        </div>
        <div data-tip="Set mesh texture resolution">
          <div>Texture resolution:</div>
          <select id="options3dMeshSkinResolution" style="width: 10em">
            <option value="512">512x512px</option>
            <option value="1024">1024x1024px</option>
            <option value="2048">2048x2048px</option>
            <option value="4096" selected>4096x4096px</option>
            <option value="8192">8192x8192px</option>
          </select>
        </div>
        <div data-tip="Quick preset lighting for different times of day" style="margin-top: 0.4em">
          <label>Time of day:</label>
          <select id="options3dTimeOfDay" style="width: 10em; margin-bottom: 0.3em">
            <option value="custom">Custom</option>
            <option value="dawn">Dawn</option>
            <option value="noon" selected>Noon</option>
            <option value="evening">Evening</option>
            <option value="night">Night</option>
          </select>
        </div>
        <div data-tip="Set sun position (x, y) and color" style="margin-top: 0.4em">
          <label>Sun position and color:</label>
          <div style="display: flex; gap: 0.2em">
            <input id="options3dSunX" type="number" min="-2500" max="2500" step="100" style="width: 4.7em" />
            <input id="options3dSunY" type="number" min="0" max="5000" step="100" style="width: 4.7em" />
            <input id="options3dSunColor" type="color" style="padding: 0; height: 1.5em; border: none" />
          </div>
        </div>
        <div data-tip="Toggle 3d labels" style="margin: 0.6em 0 0.3em -0.2em">
          <input id="options3dMeshLabels3d" class="checkbox" type="checkbox" />
          <label for="options3dMeshLabels3d" class="checkbox-label"><i>Show 3D labels</i></label>
        </div>
        <div data-tip="Toggle sky mode" style="margin: 0.6em 0 0.3em -0.2em">
          <input id="options3dMeshSkyMode" class="checkbox" type="checkbox" />
          <label for="options3dMeshSkyMode" class="checkbox-label"><i>Show sky and extend water</i></label>
        </div>
        <div
          data-tip="Increases the polygon count to smooth the sharp points. Please note that it can take some time to calculate"
          style="margin: 0.6em 0 0.3em -0.2em"
        >
          <input id="options3dSubdivide" class="checkbox" type="checkbox" />
          <label for="options3dSubdivide" class="checkbox-label"
            ><i>Smooth geometry <small style="color: darkred">[slow]</small></i></label
          >
        </div>

        <div
          data-tip="Texture the terrain as a satellite image. Replaces the standard map texture"
          style="margin: 0.6em 0 0.3em -0.2em"
        >
          <input id="options3dSatellite" class="checkbox" type="checkbox" />
          <label for="options3dSatellite" class="checkbox-label"><i>Satellite texture</i></label>
        </div>

        <div
          data-tip="Bake procedural erosion detail into the 3D terrain. Visual only, the map data is not changed"
          style="margin: 0.6em 0 0.3em -0.2em"
        >
          <input id="options3dErosion" class="checkbox" type="checkbox" />
          <label for="options3dErosion" class="checkbox-label"><i>Erode terrain</i></label>
        </div>

        <div id="options3dErosionSection" style="display: none">
          <div data-tip="Set eroded mesh detail level (vertices on the long side)">
            <div>Mesh detail:</div>
            <select id="options3dErosionDetail" style="width: 10em">
              <option value="256">256</option>
              <option value="512">512</option>
              <option value="1024" selected>1024</option>
              <option value="2048">2048 [slow]</option>
            </select>
          </div>

          <div data-tip="Set the strength of erosion gullies and ridges">
            <div>Gully strength:</div>
            <input id="options3dErosionStrengthRange" type="range" min="0" max="100" />
            <input id="options3dErosionStrengthNumber" type="number" min="0" max="100" style="width: 4em" />
          </div>

          <div data-tip="Set how deep the valleys are carved along the rivers">
            <div>River valleys:</div>
            <input id="options3dErosionRiverDepthRange" type="range" min="0" max="100" />
            <input id="options3dErosionRiverDepthNumber" type="number" min="0" max="100" style="width: 4em" />
          </div>

          <div data-tip="Set the number of erosion detail layers. More octaves add finer gullies">
            <div>Detail octaves:</div>
            <select id="options3dErosionOctaves" style="width: 6em">
              <option value="1">1</option>
              <option value="2" selected>2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </div>
        </div>

        <div data-tip="Toggle wireframe mode" style="margin: 0.6em 0 0.3em -0.2em">
          <input id="options3dMeshWireframeMode" class="checkbox" type="checkbox" />
          <label for="options3dMeshWireframeMode" class="checkbox-label"><i>Show wireframe</i></label>
        </div>
        <div data-tip="Set sky and water color" id="options3dColorSection" style="display: none">
          <span>Sky:</span
          ><input
            id="options3dMeshSky"
            type="color"
            style="width: 4.4em; height: 1em; border: 0; padding: 0; margin: 0 0.2em"
          />
          <span>Water:</span
          ><input
            id="options3dMeshWater"
            type="color"
            style="width: 4.4em; height: 1em; border: 0; padding: 0; margin: 0 0.2em"
          />
        </div>
      </div>
      <div id="options3dGlobe" style="display: none">
        <div data-tip="Set globe rotation speed. Set to 0 is you want to toggle off the rotation">
          <div>Rotation:</div>
          <input id="options3dGlobeRotationRange" type="range" min="0" max="10" step=".1" />
          <input id="options3dGlobeRotationNumber" type="number" min="0" max="10" step=".1" style="width: 4em" />
        </div>
        <div data-tip="Set globe texture resolution">
          <div>Texture resolution:</div>
          <select id="options3dGlobeResolution" style="width: 5em">
            <option value="0.5">0.5x</option>
            <option value="1">1x</option>
            <option value="2">2x</option>
            <option value="4">4x</option>
            <option value="8">8x</option>
          </select>
        </div>
        <div
          data-tip="Equirectangular projection is used: distortion is maximum on poles. Use map with aspect ratio 2:1 for best result"
          style="font-style: italic; margin: 0.2em 0"
        >
          Equirectangular projection is used
        </div>
      </div>
      <div id="options3dBottom" style="margin-top: 0.2em">
        <button id="options3dUpdate" data-tip="Update the scene" class="icon-cw"></button>
        <button
          data-tip="Configure world and map size and climate settings"
          onclick="window.Controllers.WorldConfigurator.open()"
          class="icon-globe"
        ></button>
        <button id="options3dSave" data-tip="Save screenshot of the 3d scene" class="icon-button-screenshot"></button>
        <button id="options3dOBJSave" data-tip="Save OBJ file of the 3d scene" class="icon-download"></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);

  ensureEl("options3dUpdate").addEventListener("click", () => void update());
  ensureEl("options3dSave").addEventListener("click", () => void saveScreenshot());
  ensureEl("options3dOBJSave").addEventListener("click", () => void saveOBJ());
  ensureEl("options3dScaleRange").addEventListener("input", onChangeHeightScale);
  ensureEl("options3dScaleNumber").addEventListener("change", onChangeHeightScale);
  ensureEl("options3dLightnessRange").addEventListener("input", onChangeLightness);
  ensureEl("options3dLightnessNumber").addEventListener("change", onChangeLightness);
  ensureEl("options3dSunX").addEventListener("change", onChangeSunPosition);
  ensureEl("options3dSunY").addEventListener("change", onChangeSunPosition);
  ensureEl("options3dMeshSkinResolution").addEventListener("change", onChangeResolutionScale);
  ensureEl("options3dMeshRotationRange").addEventListener("input", onChangeRotation);
  ensureEl("options3dMeshRotationNumber").addEventListener("change", onChangeRotation);
  ensureEl("options3dGlobeRotationRange").addEventListener("input", onChangeRotation);
  ensureEl("options3dGlobeRotationNumber").addEventListener("change", onChangeRotation);
  ensureEl("options3dMeshLabels3d").addEventListener("change", () => void toggleLabels());
  ensureEl("options3dMeshSkyMode").addEventListener("change", onToggleSkyMode);
  ensureEl("options3dMeshSky").addEventListener("input", onChangeColors);
  ensureEl("options3dMeshWater").addEventListener("input", onChangeColors);
  ensureEl("options3dGlobeResolution").addEventListener("change", onChangeResolution);
  ensureEl("options3dMeshWireframeMode").addEventListener("change", () => void toggleWireframe());
  ensureEl("options3dSunColor").addEventListener("input", onChangeSunColor);
  ensureEl("options3dSubdivide").addEventListener("change", () => void toggleSubdivision());
  ensureEl("options3dTimeOfDay").addEventListener("change", onChangeTimeOfDay);
  ensureEl("options3dErosion").addEventListener("change", onToggleErosion);
  ensureEl("options3dErosionDetail").addEventListener("change", onChangeErosionDetail);
  // "change" instead of "input": every value change triggers a GPU re-bake
  ensureEl("options3dErosionStrengthRange").addEventListener("change", onChangeErosionStrength);
  ensureEl("options3dErosionStrengthNumber").addEventListener("change", onChangeErosionStrength);
  ensureEl("options3dErosionRiverDepthRange").addEventListener("change", onChangeErosionRiverDepth);
  ensureEl("options3dErosionRiverDepthNumber").addEventListener("change", onChangeErosionRiverDepth);
  ensureEl("options3dErosionOctaves").addEventListener("change", onChangeErosionOctaves);
  ensureEl("options3dSatellite").addEventListener("change", onToggleSatellite);
}

function closeOptionsDialog(): void {
  $("#options3d").dialog("destroy");
  ensureEl("options3d").remove();
}

function setInput(id: string, value: string | number): void {
  ensureEl<HTMLInputElement>(id).value = String(value);
}

function updateValues(): void {
  const o = options.threeD;
  const globe = (document.getElementById("canvas3d") as HTMLElement | null)?.dataset.type === "viewGlobe";
  ensureEl("options3dMesh").style.display = globe ? "none" : "block";
  ensureEl("options3dGlobe").style.display = globe ? "block" : "none";
  ensureEl("options3dOBJSave").style.display = globe ? "none" : "inline-block";
  setInput("options3dScaleRange", o.scale);
  setInput("options3dScaleNumber", o.scale);
  setInput("options3dLightnessRange", o.lightness * 100);
  setInput("options3dLightnessNumber", o.lightness * 100);
  setInput("options3dSunX", o.sun.x);
  setInput("options3dSunY", o.sun.y);
  setInput("options3dMeshRotationRange", o.rotateMesh);
  setInput("options3dMeshRotationNumber", o.rotateMesh);
  setInput("options3dMeshSkinResolution", o.resolutionScale);
  setInput("options3dGlobeRotationRange", o.rotateGlobe);
  setInput("options3dGlobeRotationNumber", o.rotateGlobe);
  setInput("options3dMeshLabels3d", String(o.labels3d));
  setInput("options3dMeshSkyMode", String(o.extendedWater));
  ensureEl("options3dColorSection").style.display = o.extendedWater ? "block" : "none";
  setInput("options3dMeshSky", o.skyColor);
  setInput("options3dMeshWater", o.waterColor);
  setInput("options3dGlobeResolution", o.resolution);
  setInput("options3dSunColor", o.sunColor);
  setInput("options3dSubdivide", String(o.subdivide));
  ensureEl<HTMLInputElement>("options3dSubdivide").disabled = Boolean(o.erosion);
  ensureEl<HTMLInputElement>("options3dErosion").checked = Boolean(o.erosion);
  ensureEl("options3dErosionSection").style.display = o.erosion ? "block" : "none";
  setInput("options3dErosionDetail", o.erosionDetail);
  setInput("options3dErosionStrengthRange", o.erosionStrength);
  setInput("options3dErosionStrengthNumber", o.erosionStrength);
  setInput("options3dErosionRiverDepthRange", o.erosionRiverDepth);
  setInput("options3dErosionRiverDepthNumber", o.erosionRiverDepth);
  setInput("options3dErosionOctaves", o.erosionOctaves);
  ensureEl<HTMLInputElement>("options3dSatellite").checked = Boolean(o.satellite);
  updateTimeOfDayPreset();
}

function updateTimeOfDayPreset(): void {
  const presetSelect = ensureEl<HTMLSelectElement>("options3dTimeOfDay");
  const o = options.threeD;

  let matchingPreset = "custom";
  for (const [name, preset] of Object.entries(timeOfDayPresets)) {
    if (
      preset.sun.x === o.sun.x &&
      preset.sun.y === o.sun.y &&
      preset.sun.z === o.sun.z &&
      preset.sunColor === o.sunColor &&
      Math.abs(preset.lightness - o.lightness) < 0.05
    ) {
      matchingPreset = name;
      break;
    }
  }

  presetSelect.value = matchingPreset;
}

function markCustomPreset(): void {
  const presetSelect = ensureEl<HTMLSelectElement>("options3dTimeOfDay");
  if (presetSelect.value !== "custom") presetSelect.value = "custom";
}

function onChangeTimeOfDay(this: HTMLSelectElement): void {
  if (this.value === "custom") return;
  void setTimeOfDay(this.value);
  updateValues();
}

function onChangeHeightScale(this: HTMLInputElement): void {
  setInput("options3dScaleRange", this.value);
  setInput("options3dScaleNumber", this.value);
  void setScale(+this.value);
}

function onChangeResolutionScale(this: HTMLInputElement): void {
  setInput("options3dMeshSkinResolution", this.value);
  void setResolutionScale(+this.value);
}

function onChangeLightness(this: HTMLInputElement): void {
  setInput("options3dLightnessRange", this.value);
  setInput("options3dLightnessNumber", this.value);
  void setLightness(+this.value / 100);
  markCustomPreset();
}

function onChangeSunColor(): void {
  void setSunColor(ensureEl<HTMLInputElement>("options3dSunColor").value);
  markCustomPreset();
}

function onChangeSunPosition(): void {
  const x = +ensureEl<HTMLInputElement>("options3dSunX").value;
  const y = +ensureEl<HTMLInputElement>("options3dSunY").value;
  void setSun(x, y);
  markCustomPreset();
}

function onChangeRotation(this: HTMLInputElement): void {
  const sibling = (this.nextElementSibling || this.previousElementSibling) as HTMLInputElement | null;
  if (sibling) sibling.value = this.value;
  void setRotation(+this.value);
}

function onToggleErosion(): void {
  const enabled = !options.threeD.erosion;
  ensureEl("options3dErosionSection").style.display = enabled ? "block" : "none";
  ensureEl<HTMLInputElement>("options3dSubdivide").disabled = enabled; // dense geometry: subdivision ignored
  if (enabled) tip("Baking eroded terrain...", false, "warn", 4000);
  void toggleErosion();
}

function onChangeErosionDetail(this: HTMLInputElement): void {
  void setErosionDetail(+this.value);
}

function onChangeErosionStrength(this: HTMLInputElement): void {
  setInput("options3dErosionStrengthRange", this.value);
  setInput("options3dErosionStrengthNumber", this.value);
  void setErosionStrength(+this.value);
}

function onChangeErosionRiverDepth(this: HTMLInputElement): void {
  setInput("options3dErosionRiverDepthRange", this.value);
  setInput("options3dErosionRiverDepthNumber", this.value);
  void setErosionRiverDepth(+this.value);
}

function onToggleSatellite(): void {
  if (!options.threeD.satellite) tip("Baking satellite texture...", false, "warn", 4000);
  void toggleSatellite();
}

function onChangeErosionOctaves(this: HTMLInputElement): void {
  void setErosionOctaves(+this.value);
}

function onToggleSkyMode(): void {
  const hide = options.threeD.extendedWater;
  ensureEl("options3dColorSection").style.display = hide ? "none" : "block";
  void toggleSky();
}

function onChangeColors(): void {
  void setColors(
    ensureEl<HTMLInputElement>("options3dMeshSky").value,
    ensureEl<HTMLInputElement>("options3dMeshWater").value
  );
}

function onChangeResolution(this: HTMLInputElement): void {
  void setResolution(+this.value);
}

export const View3d = { open, enterStandard, toggleOptions, redraw, update, isOn, isCached, heightAt };
