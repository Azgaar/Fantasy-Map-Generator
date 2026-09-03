// What this browser wants, and what to do next. Nothing here enters a `.map`
import { z } from "zod";
import { burgGroup, coastlineSettings, labelGroup, militaryUnit, transport } from "@/components/facts-schema";

const threeD = z.strictObject({
  scale: z.number(),
  lightness: z.number(),
  shadow: z.number(),
  sun: z.strictObject({ x: z.number(), y: z.number(), z: z.number() }),
  rotateMesh: z.number(),
  rotateGlobe: z.number(),
  skyColor: z.string(),
  waterColor: z.string(),
  sunColor: z.string(),
  extendedWater: z.boolean(),
  labels3d: z.boolean(),
  satellite: z.boolean(),
  wireframe: z.boolean(),
  resolution: z.number(),
  resolutionScale: z.number(),
  subdivide: z.boolean(),
  erosion: z.boolean(),
  erosionDetail: z.number(),
  erosionStrength: z.number(),
  erosionRiverDepth: z.number(),
  erosionOctaves: z.number()
});

const tradeAnimation = z.strictObject({
  displayType: z.string(),
  concurrent: z.number(),
  duration: z.number(),
  landDurationModifier: z.number(),
  segmentChangePause: z.number(),
  markerSize: z.number()
});

export const optionsSchema = z.strictObject({
  /** the extent the next map is built on. A pin keeps it; otherwise it follows the window */
  nextMap: z.strictObject({
    width: z.number().positive(),
    height: z.number().positive(),
    density: z.number(), // the Points slider step
    points: z.number().positive() // the cell count that step resolves to
  }),

  /** what to ask the generators for */
  generation: z.strictObject({
    template: z.string(),
    resolveDepressionsSteps: z.number(),
    lakeElevationLimit: z.number(),
    cultures: z.strictObject({
      limit: z.number(),
      set: z.string(),
      sizeVariety: z.number(),
      growthRate: z.number()
    }),
    states: z.strictObject({ limit: z.number(), sizeVariety: z.number(), growthRate: z.number() }),
    provinces: z.strictObject({ ratio: z.number() }),
    religions: z.strictObject({ limit: z.number() }),
    burgs: z.strictObject({ limit: z.number() }) // 1000 means "auto"
  }),

  /** take effect at once, change nothing generated, and belong to the viewer rather than the map */
  view: z.strictObject({
    notesPinned: z.boolean(),
    emblemsShowAll: z.boolean(),
    emblemShape: z.string(),
    rendering: z.string(), // the svg shape-rendering the viewbox is drawn with
    onLoad: z.string(), // what the app does with no map asked for: "random" or "lastSaved"
    zoomExtent: z.strictObject({ min: z.number(), max: z.number() }),
    autosave: z.strictObject({ interval: z.number(), remind: z.boolean() }), // interval in minutes, 0 is off
    ui: z.strictObject({
      size: z.number().nullable(), // null until the user picks one: the interface follows the extent
      tooltipSize: z.number(),
      themeColor: z.string(),
      transparency: z.number(),
      assistant: z.string(),
      speakerVoice: z.string(), // the index into the browser's voice list, "" until one is picked
      clickArrowTip: z.boolean() // the hint on the options trigger, until the user has found it
    }),
    export: z.strictObject({
      pngResolution: z.number(),
      tiles: z.strictObject({ cols: z.number(), rows: z.number(), scale: z.number() })
    }),
    trade: z.strictObject({ animation: tradeAnimation }),
    threeD
  }),

  /** the user's own definition sets, carried to the next map */
  library: z.strictObject({
    military: z.array(militaryUnit).nullable(),
    transports: z.array(transport).nullable(),
    burgGroups: z.array(burgGroup).nullable(),
    labelGroups: z.array(labelGroup).nullable(),
    coastline: coastlineSettings.nullable()
  })
});

export type OptionsData = z.infer<typeof optionsSchema>;
export type OptionsSection = keyof OptionsData;

export const STORAGE_KEY = "fmg-options";

/** pale magenta: the theme every dialog starts from */
export const THEME_COLOR = "#997787";

/** cells the grid is built from, per density step of the Points slider */
export const CELLS_BY_DENSITY: Record<number, number> = {
  1: 1000,
  2: 2000,
  3: 5000,
  4: 10000,
  5: 20000,
  6: 30000,
  7: 40000,
  8: 50000,
  9: 60000,
  10: 70000,
  11: 80000,
  12: 90000,
  13: 100000
};
export const DEFAULT_DENSITY = 4;

/** A fresh browser's options. The values here are the schema's defaults: nothing else defines them */
export function getDefaultOptions(): OptionsData {
  return {
    nextMap: { width: 1280, height: 800, density: DEFAULT_DENSITY, points: CELLS_BY_DENSITY[DEFAULT_DENSITY] },
    generation: {
      template: "",
      resolveDepressionsSteps: 250,
      lakeElevationLimit: 20,
      cultures: { limit: 12, set: "world", sizeVariety: 4, growthRate: 1 },
      states: { limit: 18, sizeVariety: 4, growthRate: 1 },
      provinces: { ratio: 20 },
      religions: { limit: 6 },
      burgs: { limit: 1000 }
    },
    view: {
      notesPinned: false,
      emblemsShowAll: false,
      emblemShape: "culture",
      rendering: "optimizeSpeed",
      onLoad: "random",
      zoomExtent: { min: 1, max: 20 },
      autosave: { interval: 15, remind: true },
      ui: {
        size: null,
        tooltipSize: 14,
        themeColor: THEME_COLOR,
        transparency: 5,
        assistant: "show",
        speakerVoice: "",
        clickArrowTip: true
      },
      export: { pngResolution: 1, tiles: { cols: 8, rows: 8, scale: 1 } },
      trade: {
        animation: {
          displayType: "both",
          concurrent: 30,
          duration: 250,
          landDurationModifier: 5,
          segmentChangePause: 1000,
          markerSize: 4
        }
      },
      threeD: {
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
      }
    },
    library: { military: null, transports: null, burgGroups: null, labelGroups: null, coastline: null }
  };
}
