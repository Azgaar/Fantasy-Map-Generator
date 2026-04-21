export interface TectonicPlate {
  id: number;
  cells: Set<number>;
  isOceanic: boolean;
  velocity: [number, number, number]; // 3D velocity vector on sphere surface
  baseElevation: number;
  seedCell: number;
}

export type BoundarySubtype =
  | "cont-cont"
  | "ocean-cont"
  | "ocean-ocean"
  | "cont-rift"
  | "ocean-rift"
  | "transform";

export interface PlateBoundary {
  plateA: number;
  plateB: number;
  cells: number[];
  convergence: number;
  subtype: BoundarySubtype;
}

export interface TectonicConfig {
  plateCount: number;
  continentalRatio: number;
  collisionIntensity: number;
  noiseLevel: number;
  hotspotCount: number;
  smoothingPasses: number;
  erosionPasses: number;
  seaLevel: number; // elevation shift: 0 = default, positive = more water, negative = more land
}

export const DEFAULT_TECTONIC_CONFIG: TectonicConfig = {
  plateCount: 12,
  continentalRatio: 0.35,
  collisionIntensity: 1.0,
  noiseLevel: 0.3,
  hotspotCount: 3,
  smoothingPasses: 3,
  erosionPasses: 2,
  seaLevel: 0
};

export interface TectonicMetadata {
  plateIds: Uint8Array;
  boundaryType: Int8Array;
  roughness: Float32Array;
  isOceanic: Uint8Array;
  plates: TectonicPlate[];
  boundaries: PlateBoundary[];
}

declare global {
  var tectonicMetadata: TectonicMetadata | null;
  var tectonicGenerator: import("../modules/tectonic-generator").TectonicPlateGenerator | null;
}
