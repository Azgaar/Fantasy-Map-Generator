import type { ScaleSequential } from "d3";
import type { LabelGroup } from "@/generators/labels-generator";
import type { TradeAnimationModule } from "@/renderers/trade-animation";
import type { BurgGroup } from "@/types/burg-groups";
import type { Grid } from "@/types/grid";
import type { PackedGraph } from "@/types/PackedGraph";
import type { Style } from "@/types/style";

export interface MilitaryUnit {
  icon: string;
  name: string;
  rural: number;
  urban: number;
  crew: number;
  power: number;
  type: string;
  separate: number;
  biomes?: number[];
  states?: number[];
  cultures?: number[];
  religions?: number[];
}

export interface ApplicationOptions {
  year: number;
  era: string;
  eraShort: string;
  pinNotes: boolean;
  winds: number[];
  temperatureEquator: number;
  temperatureNorthPole: number;
  temperatureSouthPole: number;
  mapSize: number;
  latitude: number;
  longitude: number;
  prec: number;
  showBurgPreview: boolean;
  burgs: { groups: BurgGroup[] };
  labels: { resizeOnZoom: boolean; showAll: boolean; groups: LabelGroup[] };
  military: MilitaryUnit[];
  trade: { animation: ReturnType<TradeAnimationModule["getDefaultOptions"]> };
}

export interface MapCoordinates {
  latT: number;
  latN: number;
  latS: number;
  lonT: number;
  lonW: number;
  lonE: number;
}

export interface MapHistoryEntry {
  seed: string;
  width: number;
  height: number;
  template: string;
  created: number;
}

export interface Note {
  id: string;
  legend: string;
  name: string;
}

export interface ApplicationState {
  DEBUG: { stateLabels?: boolean; [key: string]: boolean | undefined };
  ERROR: boolean;
  INFO: boolean;
  MOBILE: boolean;
  TIME: boolean;
  WARN: boolean;
  color: ScaleSequential<string, never>;
  customization: number;
  distanceScale: number;
  graphHeight: number;
  graphWidth: number;
  grid: Grid;
  mapCoordinates: MapCoordinates;
  mapHistory: MapHistoryEntry[];
  mapId: number;
  modules: Record<string, boolean>;
  notes: Note[];
  options: ApplicationOptions;
  pack: PackedGraph;
  populationRate: number;
  scale: number;
  seed: string;
  style: Style;
  svgHeight: number;
  svgWidth: number;
  urbanDensity: number;
  urbanization: number;
  viewX: number;
  viewY: number;
}

export type ApplicationStateInitial = Omit<ApplicationState, "grid" | "mapId" | "pack" | "seed"> & {
  grid?: Grid;
  mapId?: number;
  pack?: PackedGraph;
  seed?: string;
};

const LEGACY_STATE_KEYS = [
  "DEBUG",
  "ERROR",
  "INFO",
  "MOBILE",
  "TIME",
  "WARN",
  "color",
  "customization",
  "distanceScale",
  "graphHeight",
  "graphWidth",
  "grid",
  "mapCoordinates",
  "mapHistory",
  "mapId",
  "modules",
  "notes",
  "options",
  "pack",
  "populationRate",
  "scale",
  "seed",
  "style",
  "svgHeight",
  "svgWidth",
  "urbanDensity",
  "urbanization",
  "viewX",
  "viewY"
] as const satisfies readonly (keyof ApplicationState)[];

let applicationState: ApplicationState | null = null;

export function initializeApplicationState(
  initial: ApplicationStateInitial,
  legacyTarget: Record<string, unknown> = globalThis as unknown as Record<string, unknown>
): ApplicationState {
  if (applicationState) throw new Error("Application state is already initialized");

  applicationState = {
    ...initial,
    grid: initial.grid ?? ({} as Grid),
    mapId: initial.mapId ?? 0,
    pack: initial.pack ?? ({} as PackedGraph),
    seed: initial.seed ?? ""
  };
  installLegacyStateAccessors(applicationState, legacyTarget);
  return applicationState;
}

export function getApplicationState(): ApplicationState {
  if (!applicationState) throw new Error("Application state has not been initialized");
  return applicationState;
}

function installLegacyStateAccessors(state: ApplicationState, target: Record<string, unknown>): void {
  for (const key of LEGACY_STATE_KEYS) {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (descriptor && !descriptor.configurable) {
      throw new Error(`Cannot install application state accessor for non-configurable global ${key}`);
    }

    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: true,
      get: () => state[key],
      set: value => {
        state[key] = value as never;
      }
    });
  }
}

export function resetApplicationStateForTests(): void {
  applicationState = null;
}
