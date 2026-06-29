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

// --- enter / exit ------------------------------------------------------------
function teardown(): void {
  if (!document.getElementById("canvas3d")) return;
  void stop();
  document.getElementById("canvas3d")?.remove();
  if (ensureEl("options3dUpdate").offsetParent) $("#options3d").dialog("close");
  if (ensureEl("preview3d").offsetParent) $("#preview3d").dialog("close");
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
    ensureEl("preview3d").appendChild(canvas);
    $("#preview3d").dialog({
      title: "3D Preview",
      resizable: true,
      position: { my: "left bottom", at: "left+10 bottom-20", of: "svg" },
      resizeStop: resize3d,
      close: enterStandard
    });
  } else document.body.insertBefore(canvas, ensureEl("optionsContainer"));

  toggleOptions();
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
let optionsBound = false;

function toggleOptions(): void {
  if (ensureEl("options3dUpdate").offsetParent) {
    $("#options3d").dialog("close");
    return;
  }
  $("#options3d").dialog({
    title: "3D mode settings",
    resizable: false,
    width: fitContent(),
    position: { my: "right top", at: "right-30 top+10", of: "svg", collision: "fit" }
  });

  updateValues();

  if (optionsBound) return;
  optionsBound = true;

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
