type Options = {
  isOn: boolean;
  isGlobe: boolean;
  scale: number;
  lightness: number;
  shadow: number;
  sun: { x: number; y: number; z: number };
  rotateMesh: number;
  rotateGlobe: number;
  skyColor: string;
  waterColor: string;
  sunColor: string;
  extendedWater: boolean;
  labels3d: boolean;
  wireframe: boolean;
  resolution: number;
  resolutionScale: number;
  subdivide: boolean;
  erosion: boolean;
  erosionDetail: number;
  erosionStrength: number;
  erosionRiverDepth: number;
  erosionOctaves: number;
  satellite: boolean;
};

type TimeOfDayPreset = {
  sun: { x: number; y: number; z: number };
  sunColor: string;
  lightness: number;
  skyColor: string;
  waterColor: string;
};

// Shared, mutable state. The impl imports these same objects, so its mutations are
// visible to the synchronous reads here and in the legacy UI.
export const options: Options = {
  isOn: false,
  isGlobe: false,
  scale: 50,
  lightness: 0.6,
  shadow: 0.5,
  sun: { x: 100, y: 800, z: 1000 },
  rotateMesh: 0,
  rotateGlobe: 0.5,
  skyColor: "#9ecef5",
  waterColor: "#466eab",
  sunColor: "#cccccc",
  extendedWater: false,
  labels3d: false,
  satellite: false,
  wireframe: false,
  resolution: 2,
  resolutionScale: 4096,
  subdivide: false,
  erosion: false,
  erosionDetail: 1024,
  erosionStrength: 30,
  erosionRiverDepth: 10,
  erosionOctaves: 2
};

export const timeOfDayPresets: Record<string, TimeOfDayPreset> = {
  dawn: {
    sun: { x: -500, y: 400, z: 800 },
    sunColor: "#ff9a56",
    lightness: 0.4,
    skyColor: "#ffccaa",
    waterColor: "#2d4d6b"
  },
  noon: {
    sun: { x: 100, y: 800, z: 1000 },
    sunColor: "#cccccc",
    lightness: 0.6,
    skyColor: "#9ecef5",
    waterColor: "#466eab"
  },
  evening: {
    sun: { x: 500, y: 400, z: 800 },
    sunColor: "#ff6b35",
    lightness: 0.5,
    skyColor: "#ff8c42",
    waterColor: "#1e3a52"
  },
  night: {
    sun: { x: 0, y: -500, z: 1000 },
    sunColor: "#4a5568",
    lightness: 0.2,
    skyColor: "#1a1a2e",
    waterColor: "#0f1419"
  }
};

type Renderer = typeof import("../renderers/view-3d-renderer");
let renderer: Renderer | null = null;
const loadRenderer = (): Promise<Renderer> =>
  renderer ? Promise.resolve(renderer) : import("../renderers/view-3d-renderer").then(m => (renderer = m));

const threeD = {
  options,
  timeOfDayPresets,
  create: (canvas: HTMLCanvasElement, type = "viewMesh") => loadRenderer().then(m => m.create(canvas, type)),
  redraw: () => loadRenderer().then(m => m.redraw()),
  update: () => loadRenderer().then(m => m.update()),
  stop: () => loadRenderer().then(m => m.stop()),
  setSunColor: (color: string) => loadRenderer().then(m => m.setSunColor(color)),
  setScale: (scale: number) => loadRenderer().then(m => m.setScale(scale)),
  setResolutionScale: (scale: number) => loadRenderer().then(m => m.setResolutionScale(scale)),
  setLightness: (intensity: number) => loadRenderer().then(m => m.setLightness(intensity)),
  setSun: (x: number, y: number, z?: number) => loadRenderer().then(m => m.setSun(x, y, z)),
  setRotation: (speed: number) => loadRenderer().then(m => m.setRotation(speed)),
  toggleLabels: () => loadRenderer().then(m => m.toggleLabels()),
  toggle3dSubdivision: () => loadRenderer().then(m => m.toggle3dSubdivision()),
  toggleErosion: () => loadRenderer().then(m => m.toggleErosion()),
  setErosionStrength: (value: number) => loadRenderer().then(m => m.setErosionStrength(value)),
  setErosionRiverDepth: (value: number) => loadRenderer().then(m => m.setErosionRiverDepth(value)),
  setErosionDetail: (value: number) => loadRenderer().then(m => m.setErosionDetail(value)),
  setErosionOctaves: (value: number) => loadRenderer().then(m => m.setErosionOctaves(value)),
  toggleSatellite: () => loadRenderer().then(m => m.toggleSatellite()),
  toggleWireframe: () => loadRenderer().then(m => m.toggleWireframe()),
  toggleSky: () => loadRenderer().then(m => m.toggleSky()),
  setResolution: (resolution: number) => loadRenderer().then(m => m.setResolution(resolution)),
  setColors: (sky: string, water: string) => loadRenderer().then(m => m.setColors(sky, water)),
  setTimeOfDay: (presetName: string) => loadRenderer().then(m => m.setTimeOfDay(presetName)),
  saveScreenshot: () => loadRenderer().then(m => m.saveScreenshot()),
  saveOBJ: () => loadRenderer().then(m => m.saveOBJ())
};

const threeDErosion = {
  isCached: (key?: string) => renderer?.isCached(key) ?? false,
  heightAt: (x: number, y: number, scale: number) => renderer?.heightAt(x, y, scale) ?? 0
};

declare global {
  var ThreeD: typeof threeD;
  var ThreeDErosion: typeof threeDErosion;
}

window.ThreeD = threeD;
window.ThreeDErosion = threeDErosion;
