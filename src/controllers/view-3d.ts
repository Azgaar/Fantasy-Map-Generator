// Eager shim for the 3D view. The heavy three.js renderer lives in the lazily-loaded
// `view-3d-impl` chunk; this file keeps `ThreeD`/`ThreeDErosion` and the shared `options`
// available synchronously (e.g. main.js reads `ThreeD.options.isOn` on every redraw) and
// forwards every method to the impl, importing it on first use. See docs/architecture/lazy_loading.md

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

type Impl = typeof import("./view-3d-impl");

let impl: Impl | null = null;
const loadImpl = (): Promise<Impl> => (impl ? Promise.resolve(impl) : import("./view-3d-impl").then(m => (impl = m)));

const threeD = {
  options,
  timeOfDayPresets,
  create: (canvas: HTMLCanvasElement, type = "viewMesh") => loadImpl().then(m => m.create(canvas, type)),
  redraw: () => loadImpl().then(m => m.redraw()),
  update: () => loadImpl().then(m => m.update()),
  stop: () => loadImpl().then(m => m.stop()),
  setSunColor: (color: string) => loadImpl().then(m => m.setSunColor(color)),
  setScale: (scale: number) => loadImpl().then(m => m.setScale(scale)),
  setResolutionScale: (scale: number) => loadImpl().then(m => m.setResolutionScale(scale)),
  setLightness: (intensity: number) => loadImpl().then(m => m.setLightness(intensity)),
  setSun: (x: number, y: number, z: number) => loadImpl().then(m => m.setSun(x, y, z)),
  setRotation: (speed: number) => loadImpl().then(m => m.setRotation(speed)),
  toggleLabels: () => loadImpl().then(m => m.toggleLabels()),
  toggle3dSubdivision: () => loadImpl().then(m => m.toggle3dSubdivision()),
  toggleErosion: () => loadImpl().then(m => m.toggleErosion()),
  setErosionStrength: (value: number) => loadImpl().then(m => m.setErosionStrength(value)),
  setErosionRiverDepth: (value: number) => loadImpl().then(m => m.setErosionRiverDepth(value)),
  setErosionDetail: (value: number) => loadImpl().then(m => m.setErosionDetail(value)),
  setErosionOctaves: (value: number) => loadImpl().then(m => m.setErosionOctaves(value)),
  toggleSatellite: () => loadImpl().then(m => m.toggleSatellite()),
  toggleWireframe: () => loadImpl().then(m => m.toggleWireframe()),
  toggleSky: () => loadImpl().then(m => m.toggleSky()),
  setResolution: (resolution: number) => loadImpl().then(m => m.setResolution(resolution)),
  setColors: (sky: string, water: string) => loadImpl().then(m => m.setColors(sky, water)),
  setTimeOfDay: (presetName: string) => loadImpl().then(m => m.setTimeOfDay(presetName)),
  saveScreenshot: () => loadImpl().then(m => m.saveScreenshot()),
  saveOBJ: () => loadImpl().then(m => m.saveOBJ())
};

// exposes the erosion bake cache for runtime/e2e checks (e.g. window.ThreeDErosion.isCached()).
// Reads are synchronous; before the impl loads the cache is necessarily empty.
const threeDErosion = {
  isCached: (key?: string) => impl?.isCached(key) ?? false,
  heightAt: (x: number, y: number, scale: number) => impl?.heightAt(x, y, scale) ?? 0
};

declare global {
  var ThreeD: typeof threeD;
  var ThreeDErosion: typeof threeDErosion;
}

window.ThreeD = threeD;
window.ThreeDErosion = threeDErosion;
