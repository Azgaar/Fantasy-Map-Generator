// The shape of the styles record: one entry per style element (a layer, or `map`), each a tree of
//   attrs — SVG attributes, written to the element as they are; `null` means "attribute not set"
//   options — renderer inputs, never written to the DOM
//   groups — a record of user-named entries (label groups, lake types, …) sharing one shape
import { z } from "zod";
import type { FieldMeta } from "@/components/shared/schema-form";
import { GRID_TYPES } from "@/data/grid-types";
import { OCEAN_OUTLINES, OCEAN_PATTERNS } from "@/data/ocean-patterns";
import {
  CLIPS,
  CONTOUR_MODES,
  FONT_STYLES,
  FONT_WEIGHT_LABELS,
  FONT_WEIGHTS,
  HACHURE_MODES,
  HEIGHTMAP_CURVES,
  LAKE_EMBELLISHMENTS,
  LINECAPS,
  LINEJOINS,
  MAP_FILTERS,
  RELIEF_STYLES,
  WAVE_TYPES
} from "@/data/style-choices";
import { hexColor } from "@/utils/schemaUtils";
import { FORMATS, isLabelStyle } from "./styles-formats";

export const styleMeta = z.registry<FieldMeta>();

const meta = <T extends z.ZodType>(schema: T, fieldMeta: FieldMeta): T => {
  styleMeta.add(schema, fieldMeta);
  return schema;
};
// a clone reads its parent's meta under its own, so a variant overrides what it names and keeps the rest
const variant = <T extends z.ZodType>(schema: T, fieldMeta: FieldMeta): T => meta(schema.clone(), fieldMeta);
const hidden = <T extends z.ZodType>(schema: T): T => variant(schema, { hidden: true }); // stored, never edited

const range = (min: number, max: number, fieldMeta: FieldMeta = {}) => meta(z.number().min(min).max(max), fieldMeta);
const count = (min: number, max: number, fieldMeta: FieldMeta = {}) =>
  meta(z.number().int().min(min).max(max), fieldMeta);
const number = (fieldMeta: FieldMeta = {}) => meta(z.number(), fieldMeta); // a slider when `range` is given
const flag = (fieldMeta: FieldMeta) => meta(z.boolean(), fieldMeta);
const text = (fieldMeta: FieldMeta) => meta(z.string(), fieldMeta);
const choice = (choices: Record<string, string>, fieldMeta: FieldMeta = {}) =>
  meta(z.enum(Object.keys(choices)), { choices, ...fieldMeta });
const solidColor = (fieldMeta: FieldMeta = {}) => meta(hexColor.clone(), { control: "color", ...fieldMeta });

// --- shared attrs -----------------------------------------------------------------------------------
const opacity = range(0, 1, { nullAs: 1, tip: "Set opacity. 0: transparent, 1: solid" }).nullable();
const color = solidColor().nullable();
const fill = variant(color, { control: "color", group: "Fill", label: "Color", tip: "Set fill color" });
const fillOpacity = variant(opacity, {
  group: "Fill",
  label: "Opacity",
  nullAs: 1,
  tip: "Set fill opacity. 0: transparent, 1: solid"
});
const stroke = variant(color, { control: "color", group: "Stroke", label: "Color", tip: "Set stroke color" });
const strokeWidth = meta(z.number().min(0), {
  group: "Stroke",
  label: "Width",
  nullAs: 0,
  range: [0, 10],
  tip: "Set stroke width"
}).nullable();
const strokeDasharray = meta(z.string().regex(FORMATS.strokeDasharray), {
  group: "Stroke",
  label: "Dash array",
  tip: "Set stroke dash array, e.g. 5 2"
})
  .nullable()
  .default(null);
const strokeLinecap = choice(LINECAPS, { group: "Stroke", label: "Linecap", tip: "Set stroke linecap" }).nullable();
const strokeLinejoin = choice(LINEJOINS, { group: "Stroke", label: "Linejoin", tip: "Set stroke linejoin" }).nullable();
const fontFamily = text({ control: "font", group: "Font", label: "Family", tip: "Select font" });
// label groups size relative to the labels layer, which the zoom sizes in px
const fontSize = meta(z.string().regex(FORMATS.fontSize), {
  control: "percent",
  group: "Font",
  label: "Size",
  range: [1, 40],
  tip: "Set font size, relative to the labels layer"
});
const layerFontSize = meta(z.string().regex(FORMATS.fontSizePx), { hidden: true });
const fontStyle = choice(FONT_STYLES, { group: "Font", label: "Style", tip: "Set font style" })
  .nullable()
  .default(null);
const fontWeight = meta(z.literal(FONT_WEIGHTS), {
  control: "select",
  choices: FONT_WEIGHT_LABELS,
  group: "Font",
  label: "Weight",
  tip: "Set font weight from 100 to 950"
})
  .nullable()
  .default(null);
const letterSpacing = number({
  group: "Font",
  label: "Spacing",
  nullAs: 0,
  range: [-1, 10],
  tip: "Set letter spacing"
}).nullable();
const filter = meta(z.string().regex(FORMATS.filter), {
  control: "filter",
  tip: "Select filter for element. Please note filters may cause performance issues!"
}).nullable();
const blurFilter = meta(z.string().regex(FORMATS.blurFilter), {
  control: "blur",
  label: "Blur",
  range: [0, 10],
  tip: "Blur radius in pixels. Set to 0 for a solid line"
}).nullable();
// a defs reference the renderer owns (url(#fog), url(#vignette-mask)): stored, never edited
const mask = hidden(z.string().regex(FORMATS.mask).nullable());
// the layers that clip to land or water offer the two masks
const clip = choice(CLIPS, { label: "Clip to", tip: "Set clipping. Only non-clipped part will be visible" }).nullable();
const transform = hidden(z.string().nullable()); // a raw layer transform, not a style choice
const compassTransform = meta(z.string().regex(FORMATS.compassTransform), {
  control: "transform",
  label: "Placement",
  tip: "Set wind (compass) rose shift and size"
}).nullable();
const percentage = meta(z.string().regex(FORMATS.percentage), { control: "percent" });
// CSSStyleDeclaration.cssText: text-shadow, text-transform and the label shift transform live here
const labelStyle = meta(z.string().refine(isLabelStyle), {
  control: "labelStyle",
  group: "Text",
  label: "Style",
  tip: "Set text shadow, letter case and label shift"
}).nullable();

const strokeAttrs = {
  stroke,
  "stroke-width": strokeWidth,
  "stroke-dasharray": strokeDasharray,
  "stroke-linecap": strokeLinecap
};
const fillAttrs = { fill, "fill-opacity": fillOpacity };
const dashAttrs = {
  "stroke-width": strokeWidth,
  "stroke-dasharray": strokeDasharray,
  "stroke-linecap": strokeLinecap
};
const optionFontSize = number({ label: "Font size", range: [1, 50], step: 0.5, tip: "Set font size" });
// x/y shifts, in the unit of their element; a slider each: a dragged offset beats a typed one
const shift = (axis: string, reach: number, step: number, tip: string) =>
  number({ label: `Shift ${axis}`, range: [-reach, reach], step, tip });

// --- feature parts ----------------------------------------------------------------------------------
const lake = z.strictObject({
  attrs: z.strictObject({ opacity, ...fillAttrs, ...strokeAttrs, filter }),
  options: meta(
    z.strictObject({
      embellishment: choice(LAKE_EMBELLISHMENTS, {
        tip: "Fine ripples along the banks, fading into open water and scaled down for small lakes"
      }),
      density: range(0.1, 4, { tip: "How closely ripple rows are spaced" }),
      length: range(0.2, 4, { tip: "Ripple length, fitted to the available water width" }),
      halo: range(0, 2, {
        label: "Shore gap",
        step: 0.05,
        tip: "Clear water along the shoreline, relative to lake ripple scale"
      }),
      color: solidColor({ group: "Stroke", label: "Color" }),
      width: range(0.05, 2, { group: "Stroke", label: "Width", step: 0.05, tip: "Ripple stroke width in map pixels" }),
      opacity: range(0, 1, { group: "Stroke", label: "Opacity", step: 0.05, tip: "Opacity of the lake ripples" })
    }),
    { gate: "embellishment", label: "Embellishment" }
  ).default({ embellishment: "none", density: 1, length: 1, halo: 0.2, color: "#000000", width: 0.3, opacity: 0.6 })
});

const contours = meta(
  z.strictObject({
    mode: choice(CONTOUR_MODES, {
      tip: "Draw smooth elevation contours over the heightmap colors, or show only contour lines"
    }),
    interval: count(1, 20, {
      label: "Spacing",
      tip: "Elevation spacing between contours. Lower values show more detail; every fifth contour is heavier"
    }),
    color: solidColor({ tip: "Color of the contour lines" }),
    width: range(0.1, 2, { step: 0.05, tip: "Width of minor contours. Every fifth contour is twice as wide" }),
    opacity: range(0, 1, { step: 0.05, tip: "Opacity of the contour lines" })
  }),
  { gate: "mode" }
).default({ mode: "off", interval: 5, color: "#5c513e", width: 0.35, opacity: 0.5 });

// downhill pen strokes, denser and longer on steeper slopes
const hachures = meta(
  z.strictObject({
    mode: choice(HACHURE_MODES, {
      tip: "Draw downhill pen strokes over the heightmap colors, or show only the strokes"
    }),
    density: range(0.1, 4, {
      tip: "How closely the strokes are packed, relative to the default. Steep ground packs them tighter"
    }),
    length: range(0.2, 4, {
      tip: "Stroke length, relative to the default. Strokes stop early where the slope levels off"
    }),
    width: range(0.2, 4, {
      group: "Stroke",
      label: "Width",
      tip: "Stroke width at its root, relative to the default. Gentler ground draws lighter strokes"
    }),
    color: solidColor({ group: "Stroke", label: "Color", tip: "Color of the hachure strokes" }),
    opacity: range(0, 1, { step: 0.05, tip: "Opacity of the hachure strokes" })
  }),
  { gate: "mode" }
).default({ mode: "off", density: 1, length: 1, width: 1, color: "#5c513e", opacity: 0.65 });

const heightOptions = z.strictObject({
  scheme: text({ control: "scheme", label: "Color scheme", tip: "Select color scheme for the element" }),
  terracing: range(0, 20, { step: 1, tip: "Terracing power. Set to 0 to toggle off" }),
  skip: range(0, 10, {
    label: "Reduce layers",
    step: 1,
    tip: "Layers reduction rate. Increase to improve performance"
  }),
  relax: range(0, 10, {
    label: "Simplify line",
    step: 1,
    tip: "Line simplification rate. Increase to slightly improve performance"
  }),
  curve: choice(HEIGHTMAP_CURVES, { label: "Line style", tip: "Select line interpolation type" }),
  render: hidden(z.boolean()), // land is always rendered
  contours,
  hachures
});
const landHeights = z.strictObject({ attrs: z.strictObject({ opacity, filter, mask }), options: heightOptions });
// the ocean is drawn on request: the flag gates the whole section
const oceanHeights = meta(
  z.strictObject({
    attrs: landHeights.shape.attrs,
    options: heightOptions.extend({
      render: flag({ label: "Render ocean heights", tip: "Check to render ocean heights" })
    })
  }),
  { gate: "options.render" }
);

const coastlineBands = meta(
  z.strictObject({
    render: flag({ label: "Coastline bands", tip: "Draw concentric bands that follow the coastline" }),
    count: count(1, 8, { tip: "Number of bands around the coast" }),
    spacing: range(0.2, 5, { tip: "Band spacing in map units; bands widen farther from shore" }),
    width: range(0.05, 1, {
      group: "Outline",
      label: "Width",
      step: 0.05,
      tip: "Width of the dark lines separating bands"
    }),
    color: solidColor({ group: "Outline", label: "Color" }),
    shore: solidColor({ label: "Shore tint", tip: "Tint over the existing ocean, strongest near the shore" }),
    shade: range(0, 1, {
      label: "Shading",
      step: 0.05,
      tip: "Strength of the nearshore tint; zero leaves only outlines over the ocean texture"
    }).default(0.35),
    opacity: range(0, 1, { step: 0.05 })
  }),
  { gate: "render", label: "Coastline bands" }
).default({
  render: false,
  count: 5,
  spacing: 1.1,
  width: 0.25,
  color: "#575448",
  shore: "#b9b6a1",
  shade: 0.35,
  opacity: 1
});

// coastal and distant-sea strokes around a clear offshore band
const oceanWaves = meta(
  z.strictObject({
    attrs: z.strictObject({
      opacity: variant(opacity, { nullAs: 1, tip: "Opacity of the coastal strokes" }),
      stroke: variant(stroke, {
        control: "color",
        group: "Stroke",
        label: "Color",
        tip: "Color of the coastal strokes"
      }),
      "stroke-width": variant(strokeWidth, {
        group: "Stroke",
        label: "Width",
        nullAs: 0,
        range: [0.05, 2],
        step: 0.05,
        tip: "Stroke width in map pixels"
      }),
      "stroke-dasharray": variant(strokeDasharray, {
        group: "Stroke",
        label: "Dash array",
        tip: "Optional SVG dash pattern, such as 3 2 or 1 2 5 2"
      }),
      filter
    }),
    options: z.strictObject({
      render: flag({
        label: "Ocean embellishment",
        tip: "Decorate coastal and distant water around a clear offshore band"
      }),
      type: choice(WAVE_TYPES, { tip: "Choose the shape of the ocean embellishments" }).default("waves"),
      density: range(0.1, 4, { tip: "How closely embellishments are spaced, relative to the default" }),
      length: range(0.2, 4, { tip: "Stroke length, relative to the default" }),
      reach: range(1, 12, {
        step: 0.5,
        tip: "Distance into the sea over which embellishments fade, in cell spacings"
      }),
      halo: range(0, 2, {
        label: "Coastal gap",
        step: 0.05,
        tip: "Clear water beyond the coastline bands (or shore), in cell spacings"
      })
    })
  }),
  { gate: "options.render", label: "Ocean embellishment" }
).default({
  attrs: { opacity: 0.5, stroke: "#1f3846", "stroke-width": 0.5, "stroke-dasharray": null, filter: null },
  options: { render: false, type: "waves", density: 1, length: 1, reach: 4, halo: 0.25 }
});

const burgGroupAttrs = z.strictObject({
  opacity,
  ...fillAttrs,
  ...strokeAttrs,
  "stroke-linejoin": strokeLinejoin,
  filter
});
const burgGroup = z.strictObject({
  attrs: burgGroupAttrs,
  options: z.strictObject({
    size: number({ label: "Icon size", range: [0.01, 20], step: 0.01, tip: "Set icon size" }),
    icon: text({ control: "icon", tip: "Select group icon" }),
    dx: meta(z.number().optional(), {
      label: "Shift x",
      range: [-2, 2],
      step: 0.05,
      nullAs: 0,
      tip: "Horizontal shift in icon-size units (positive moves right)"
    }),
    dy: meta(z.number().optional(), {
      label: "Shift y",
      range: [-2, 2],
      step: 0.05,
      nullAs: 0,
      tip: "Vertical shift in icon-size units (positive moves down)"
    })
  })
});
// anchors ignored icon before ports became stylable, so older records carry the burg default: keep drawing the anchor
const anchorIcon = meta(
  z.string().transform(icon => (icon === "#icon-circle" ? "#icon-anchor" : icon)),
  { control: "icon", tip: "Select the port icon for this burg group" }
);
const anchorGroup = z.strictObject({
  attrs: burgGroupAttrs,
  options: burgGroup.shape.options.extend({ icon: anchorIcon })
});
const nonEmpty = (groups: Record<string, unknown>) => Object.keys(groups).length > 0;

const emblemGroup = z.strictObject({
  options: z.strictObject({ size: number({ range: [0, 5], step: 0.01, tip: "Set emblems size multiplier" }) })
});

const padding = (side: string) =>
  number({ group: "Padding", label: side, range: [0, 50], step: 0.5, tip: "Background element padding in pixels" });

// --- the record -------------------------------------------------------------------------------------
export const stylesSchema = z.strictObject({
  // the whole-map filter: the option is what the user picks, the attr mirrors it as url(#filter-<id>)
  map: z.strictObject({
    attrs: z.strictObject({ filter: hidden(filter) }),
    options: z.strictObject({
      dataFilter: choice(MAP_FILTERS, {
        control: "mapFilter",
        label: "Global filter",
        tip: "Set a filter to be applied to the map in general"
      }).nullable()
    })
  }),
  ocean: z.strictObject({
    // pattern/patternOpacity style #oceanicPattern, a defs resource the renderer owns
    options: z.strictObject({
      pattern: choice(OCEAN_PATTERNS, { group: "Pattern", label: "Type", tip: "Select ocean pattern" }),
      patternOpacity: range(0, 1, { group: "Pattern", label: "Opacity", tip: "Set ocean pattern opacity" }),
      bands: coastlineBands
    }),
    base: z.strictObject({
      attrs: z.strictObject({ fill: variant(fill, { control: "color", tip: "Set ocean color" }) })
    }),
    oceanLayers: z.strictObject({
      attrs: z.strictObject({ filter }),
      options: z.strictObject({
        outline: choice(OCEAN_OUTLINES, { label: "Ocean layers", tip: "Define the coast outline contours scheme" })
      })
    }),
    oceanWaves
  }),
  landmass: z.strictObject({ attrs: z.strictObject({ opacity, fill, filter }) }),
  texture: z.strictObject({
    attrs: z.strictObject({ opacity, filter, mask: clip }),
    options: z.strictObject({
      href: text({
        control: "texture",
        label: "Image",
        tip: "Select texture image. Big textures can highly affect performance"
      }),
      x: shift("x", 500, 1, "Shift texture by x axis in pixels"),
      y: shift("y", 500, 1, "Shift texture by y axis in pixels")
    })
  }),
  heightmap: z.strictObject({ landHeights, oceanHeights }),
  biomes: z.strictObject({ attrs: z.strictObject({ opacity, filter, mask: clip }) }),
  cells: z.strictObject({ attrs: z.strictObject({ opacity, ...strokeAttrs, filter, mask: clip }) }),
  grid: z.strictObject({
    attrs: z.strictObject({ opacity, ...strokeAttrs, transform, filter, mask: clip }),
    options: z.strictObject({
      type: choice(GRID_TYPES, { tip: "Select grid overlay type" }),
      scale: number({ range: [0.1, 10], step: 0.01, tip: "Set grid cells scale multiplier" }),
      dx: shift("x", 100, 1, "Shift by x axis in pixels"),
      dy: shift("y", 100, 1, "Shift by y axis in pixels")
    })
  }),
  coordinates: z.strictObject({
    attrs: z.strictObject({ opacity, ...strokeAttrs, filter, mask: clip }),
    options: z.strictObject({ fontSize: optionFontSize })
  }),
  compass: z.strictObject({
    attrs: z.strictObject({
      opacity,
      transform,
      filter,
      mask: clip,
      "shape-rendering": hidden(z.string().nullable())
    }),
    compassRose: z.strictObject({ attrs: z.strictObject({ transform: compassTransform }) })
  }),
  rivers: z.strictObject({ attrs: z.strictObject({ opacity, fill, filter }) }),
  lakes: z.strictObject({ groups: z.record(z.string(), lake) }), // stock groups plus user-created ones
  coastline: z.strictObject({
    // autoFilter is FMG's own zoom-driven filter pick, not a stored attribute
    sea_island: z.strictObject({
      attrs: z.strictObject({ opacity, ...strokeAttrs, filter }),
      options: z.strictObject({ autoFilter: hidden(z.number()) })
    }),
    lake_island: z.strictObject({ attrs: z.strictObject({ opacity, ...strokeAttrs, filter }) })
  }),
  // density defines icon placement: changing it regenerates the icons, not just restyles them
  relief: z.strictObject({
    attrs: z.strictObject({ opacity, filter, mask: clip }),
    options: z.strictObject({
      set: choice(RELIEF_STYLES, {
        label: "Style",
        tip: "Select set of relief icons. Existing icons are restyled, not regenerated"
      }),
      size: number({
        range: [0.2, 4],
        step: 0.01,
        tip: "Define the size of relief icons. Existing icons are resized, not regenerated"
      }),
      density: number({
        range: [0.3, 0.8],
        step: 0.01,
        tip: "Define the density of relief icons. All relief icons are regenerated, discarding manual edits. Highly affects performance!"
      })
    })
  }),
  religions: z.strictObject({ attrs: z.strictObject({ opacity, ...strokeAttrs, filter }) }),
  cultures: z.strictObject({ attrs: z.strictObject({ opacity, ...strokeAttrs, filter }) }),
  states: z.strictObject({
    statesBody: z.strictObject({
      attrs: z.strictObject({
        opacity: variant(opacity, { nullAs: 1, tip: "Set states fill opacity. 0: invisible, 1: solid" }),
        filter: variant(filter, {
          control: "filter",
          tip: "Select filter for states fill. Please note filters may cause performance issues!"
        })
      })
    }),
    // rendered only when performance is set to best quality; the width lives on options, the attr mirrors it
    statesHalo: z.strictObject({
      attrs: z.strictObject({
        opacity: variant(opacity, { nullAs: 1, tip: "Set states halo effect opacity. 0: invisible, 1: solid" }),
        "stroke-width": hidden(strokeWidth),
        filter: blurFilter
      }),
      options: z.strictObject({
        width: number({ range: [0, 30], step: 0.1, tip: "Set states halo effect width" })
      })
    })
  }),
  provinces: z.strictObject({ attrs: z.strictObject({ opacity, filter }) }),
  zones: z.strictObject({ attrs: z.strictObject({ opacity, ...strokeAttrs, filter, mask: clip }) }),
  borders: z.strictObject({
    stateBorders: z.strictObject({ attrs: z.strictObject({ opacity, ...strokeAttrs, filter }) }),
    provinceBorders: z.strictObject({ attrs: z.strictObject({ opacity, ...strokeAttrs, filter }) })
  }),
  routes: z.strictObject({
    groups: z.record(
      z.string(),
      z.strictObject({ attrs: z.strictObject({ opacity, ...strokeAttrs, filter, mask: clip }) })
    )
  }),
  journeys: z.strictObject({ attrs: z.strictObject({ opacity, ...dashAttrs, filter, mask: clip }) }),
  temperature: z.strictObject({
    attrs: z.strictObject({
      opacity,
      fill: variant(fill, { control: "color", group: undefined, label: "Labels color", tip: "Set labels color" }),
      "fill-opacity": variant(opacity, {
        nullAs: 1,
        tip: "Define transparency of temperature layer. Set to 0 to make it fully transparent"
      }),
      ...strokeAttrs,
      "font-size": meta(z.string().regex(FORMATS.fontSizePx), {
        control: "px",
        label: "Labels size",
        range: [1, 40],
        tip: "Set labels size in pixels"
      }),
      filter,
      mask: clip
    })
  }),
  ice: z.strictObject({ attrs: z.strictObject({ opacity, fill, ...strokeAttrs, filter }) }),
  precipitation: z.strictObject({ attrs: z.strictObject({ opacity, fill, ...strokeAttrs, filter, mask: clip }) }),
  population: z.strictObject({
    attrs: z.strictObject({ opacity, ...dashAttrs, filter, mask: clip }),
    rural: z.strictObject({
      attrs: z.strictObject({
        stroke: variant(stroke, {
          control: "color",
          group: undefined,
          label: "Color",
          tip: "Set bar color for rural population"
        })
      })
    }),
    urban: z.strictObject({
      attrs: z.strictObject({
        stroke: variant(stroke, {
          control: "color",
          group: undefined,
          label: "Color",
          tip: "Set bar color for urban population"
        })
      })
    })
  }),
  emblems: z.strictObject({
    attrs: z.strictObject({ opacity, "stroke-width": strokeWidth, filter }),
    stateEmblems: emblemGroup,
    provinceEmblems: emblemGroup,
    burgEmblems: emblemGroup
  }),
  labels: z.strictObject({
    attrs: z.strictObject({ "font-size": layerFontSize }), // the zoom writes it
    groups: z.record(
      z.string(),
      z.strictObject({
        attrs: z.strictObject({
          opacity,
          ...fillAttrs,
          ...strokeAttrs,
          "font-family": fontFamily,
          "font-size": fontSize,
          "font-style": fontStyle,
          "font-weight": fontWeight,
          "letter-spacing": letterSpacing,
          style: labelStyle,
          filter
        })
      })
    )
  }),
  // both records are keyed by the burg groups; the editor shows a group's icon and anchor together
  burgIcons: z.strictObject({
    burgIcons: z.strictObject({ groups: z.record(z.string(), burgGroup).refine(nonEmpty) }),
    anchors: z.strictObject({ groups: z.record(z.string(), anchorGroup).refine(nonEmpty) })
  }),
  goods: z.strictObject({
    goodsCells: z.strictObject({ attrs: z.strictObject({ opacity, filter }) }),
    goodsIcons: z.strictObject({
      attrs: z.strictObject({ opacity, "stroke-width": strokeWidth, filter }),
      options: z.strictObject({
        size: number({
          label: "Marker size",
          range: [1, 20],
          step: 0.5,
          tip: "Set good marker (icon and circle) size in pixels"
        }),
        circle: flag({ label: "Show circle", tip: "Show or hide circle around good icons" })
      })
    }),
    goodsBurgs: z.strictObject({
      attrs: z.strictObject({ opacity, stroke, "stroke-width": strokeWidth, filter }),
      options: z.strictObject({
        size: number({
          label: "Plate size",
          range: [1, 12],
          step: 0.5,
          tip: "Set burg production plate icon size in pixels. Plate and font scale together with it"
        })
      })
    })
  }),
  markets: z.strictObject({
    attrs: z.strictObject({
      opacity,
      fill,
      "fill-opacity": variant(opacity, {
        group: "Fill",
        label: "Opacity",
        nullAs: 1,
        tip: "Set market territory zone fill transparency. Defaults to transparent"
      }),
      "stroke-width": strokeWidth,
      "stroke-opacity": variant(opacity, { group: "Stroke", label: "Opacity", nullAs: 1, tip: "Set stroke opacity" }),
      filter
    }),
    options: z.strictObject({
      size: number({
        label: "Marker size",
        range: [1, 12],
        step: 0.5,
        tip: "Set market marker (circle) size in pixels"
      }),
      fontSize: number({
        label: "Icon size",
        range: [1, 20],
        step: 0.5,
        tip: "Set market marker emoji icon size in pixels"
      }),
      icon: text({ control: "emoji", label: "Marker icon", tip: "Set the emoji icon shown inside the market marker" })
    })
  }),
  trade: z.strictObject({ attrs: z.strictObject({ opacity, filter }) }),
  markers: z.strictObject({
    attrs: z.strictObject({ opacity, filter }),
    // TODO: move to global options.markers.resizeOnZoom
    options: z.strictObject({
      rescale: number({
        control: "checkbox", // a 0/1 flag the renderer reads as a number
        label: "Constant size",
        tip: "Try to keep the same size on any map scale, turn off to get size change depending on scale"
      })
    })
  }),
  military: z.strictObject({
    attrs: z.strictObject({
      opacity,
      ...strokeAttrs,
      "fill-opacity": variant(opacity, {
        nullAs: 1,
        tip: "Set fill transparency. Set to 0 to make it fully transparent"
      }),
      filter
    }),
    options: z.strictObject({
      fontSize: hidden(z.number()), // follows boxSize
      boxSize: number({
        range: [0, 10],
        step: 0.1,
        tip: "Set regiment box size. All regiments will be redrawn on change (position will defaulted)"
      })
    })
  }),
  rulers: z.strictObject({
    attrs: z.strictObject({ opacity, ...dashAttrs, filter }),
    options: z.strictObject({ fontSize: optionFontSize })
  }),
  scaleBar: z.strictObject({
    attrs: z.strictObject({
      opacity,
      fill,
      "font-size": number({
        label: "Font size",
        nullAs: 10,
        range: [1, 40],
        step: 0.5,
        tip: "Set font size"
      }).nullable()
    }),
    // `label` names the unit under the bar; `x`/`y` place it, as percentages of the map extent
    options: z.strictObject({
      barSize: number({ label: "Bar size", range: [0.5, 5], step: 0.1, tip: "Set bar size" }),
      label: text({ tip: "Type scale bar label, leave blank to hide label" }),
      x: number({ label: "Position x", range: [0, 100], step: 0.1, tip: "Scale bar right edge, in percents" }),
      y: number({ label: "Position y", range: [0, 100], step: 0.1, tip: "Scale bar bottom edge, in percents" })
    }),
    back: meta(
      z.strictObject({
        attrs: z.strictObject({ opacity, ...fillAttrs, stroke, "stroke-width": strokeWidth, filter }),
        options: z.strictObject({
          top: padding("Top"),
          right: padding("Right"),
          bottom: padding("Bottom"),
          left: padding("Left")
        })
      }),
      { label: "Background" }
    )
  }),
  legend: z.strictObject({
    attrs: z.strictObject({ ...strokeAttrs, "font-family": fontFamily }),
    options: z.strictObject({
      fontSize: optionFontSize,
      x: hidden(z.number()), // dragged into place
      y: hidden(z.number()),
      columns: number({
        label: "Column items",
        range: [1, 30],
        step: 1,
        tip: "Set maximum number of items in one column"
      })
    }),
    box: meta(
      z.strictObject({
        attrs: z.strictObject(fillAttrs)
      }),
      { label: "Background" }
    )
  }),
  fogging: z.strictObject({ attrs: z.strictObject({ opacity, fill, mask, filter }) }),
  // the geometry options shape #vignette-rect, the mask rect in defs the renderer owns
  vignette: z.strictObject({
    attrs: z.strictObject({ opacity, fill, mask, filter }),
    options: z.strictObject({
      x: variant(percentage, {
        label: "Position x",
        range: [0, 100],
        step: 0.1,
        tip: "Vignette rectangle x, in percents"
      }),
      y: variant(percentage, {
        label: "Position y",
        range: [0, 100],
        step: 0.1,
        tip: "Vignette rectangle y, in percents"
      }),
      width: variant(percentage, { range: [0, 100], step: 0.1, tip: "Vignette rectangle width, in percents" }),
      height: variant(percentage, { range: [0, 100], step: 0.1, tip: "Vignette rectangle height, in percents" }),
      rx: variant(percentage, { label: "Radius x", range: [0, 50], step: 0.1, tip: "Vignette X radius, in percents" }),
      ry: variant(percentage, { label: "Radius y", range: [0, 50], step: 0.1, tip: "Vignette Y radius, in percents" }),
      filter: variant(blurFilter, {
        control: "blur",
        label: "Blur",
        range: [0, 400],
        step: 1,
        tip: "Set vignette blur propagation, in pixels"
      })
    })
  })
});

export type Styles = z.infer<typeof stylesSchema>;
export type StyleElement = keyof Styles;
