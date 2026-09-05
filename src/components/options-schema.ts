import { z } from "zod";
import { burgGroup, coastlineSettings, labelGroup, militaryUnit, transport } from "@/components/facts-schema";
import { MAX_DENSITY, MIN_DENSITY } from "@/data/graph-density";
import { count, hexColor, nonNegative, percent, positive, ratio } from "@/utils/schemaUtils";

const threeD = z.strictObject({
  scale: positive,
  lightness: ratio,
  shadow: ratio,
  sun: z.strictObject({ x: z.number(), y: z.number(), z: z.number() }),
  rotateMesh: z.number(),
  rotateGlobe: z.number(),
  skyColor: hexColor,
  waterColor: hexColor,
  sunColor: hexColor,
  extendedWater: z.boolean(),
  labels3d: z.boolean(),
  satellite: z.boolean(),
  wireframe: z.boolean(),
  resolution: positive,
  resolutionScale: positive,
  subdivide: z.boolean(),
  erosion: z.boolean(),
  erosionDetail: nonNegative,
  erosionStrength: nonNegative,
  erosionRiverDepth: nonNegative,
  erosionOctaves: count
});

const tradeAnimation = z.strictObject({
  displayType: z.enum(["local", "global", "both"]),
  concurrent: count.positive(),
  duration: positive,
  landDurationModifier: nonNegative,
  segmentChangePause: nonNegative,
  markerSize: positive
});

export const optionsSchema = z.strictObject({
  /** what to ask the generators for */
  generation: z.strictObject({
    /** the graph the next map is built on: its extent, and how finely it is divided. A pin keeps
     * the extent; otherwise it follows the window */
    graph: z.strictObject({
      width: positive,
      height: positive,
      // the Points slider step; the cell count is derived from it, never stored. A step the table
      // has no entry for silently generates a default-sized map, so it is bounded here
      density: count.min(MIN_DENSITY).max(MAX_DENSITY)
    }),
    template: z.string(), // ids include the user's own precreated heightmaps, so no enum
    resolveDepressionsSteps: count,
    lakeElevationLimit: nonNegative,
    cultures: z.strictObject({
      limit: count,
      set: z.string().min(1),
      sizeVariety: nonNegative,
      growthRate: nonNegative
    }),
    states: z.strictObject({ limit: count, sizeVariety: nonNegative, growthRate: nonNegative }),
    provinces: z.strictObject({ ratio: percent }),
    religions: z.strictObject({ limit: count }),
    burgs: z.strictObject({ limit: count }) // 1000 means "auto"
  }),

  /** how the app itself behaves: applied at once, generating nothing, describing no map */
  app: z.strictObject({
    notesPinned: z.boolean(),
    // "show everything regardless of zoom" is this browser inspecting the map, not the map itself
    emblems: z.strictObject({ showAll: z.boolean(), shape: z.string().min(1) }),
    labels: z.strictObject({ showAll: z.boolean() }),
    rendering: z.enum(["geometricPrecision", "optimizeSpeed"]), // the viewbox shape-rendering
    onLoad: z.enum(["random", "lastSaved"]), // what the app does with no map asked for
    zoomExtent: z.strictObject({ min: positive, max: positive }).refine(({ min, max }) => min <= max, {
      message: "zoomExtent.min must not exceed max"
    }),
    // the map window on screen. null until the user sets one: it then follows the browser window
    viewport: z.strictObject({ width: positive, height: positive }).nullable(),
    autosave: z.strictObject({ interval: count, remind: z.boolean() }), // interval in minutes, 0 is off
    ui: z.strictObject({
      size: positive.nullable(), // null until the user picks one: the interface follows the extent
      tooltipSize: positive,
      themeColor: hexColor,
      transparency: percent,
      assistant: z.enum(["show", "hide"]),
      speakerVoice: z.string(), // the index into the browser's voice list, "" until one is picked
      clickArrowTip: z.boolean() // the hint on the options trigger, until the user has found it
    }),
    export: z.strictObject({
      pngResolution: positive,
      tiles: z.strictObject({ cols: count.positive(), rows: count.positive(), scale: positive })
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
