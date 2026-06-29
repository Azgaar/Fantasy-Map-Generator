export type ThreeDOptions = {
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

export type TimeOfDayPreset = {
  sun: { x: number; y: number; z: number };
  sunColor: string;
  lightness: number;
  skyColor: string;
  waterColor: string;
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
