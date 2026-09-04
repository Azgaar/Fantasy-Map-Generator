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
  /** what to ask the generators for */
  generation: z.strictObject({
    /** the graph the next map is built on: its extent, and how finely it is divided. A pin keeps
     * the extent; otherwise it follows the window */
    graph: z.strictObject({
      width: z.number().positive(),
      height: z.number().positive(),
      density: z.number() // the Points slider step; the cell count is derived from it, never stored
    }),
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

  /** how the app itself behaves: applied at once, generating nothing, describing no map */
  app: z.strictObject({
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
