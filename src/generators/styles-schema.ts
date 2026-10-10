// The shape of styles: one root node per style element. Every node carries the same three bags:
//   attrs   — SVG attributes, written to the element as they are; `null` means "attribute not set"
//   options — renderer inputs, never written to the DOM
//   groups  — named child nodes, fixed (statesBody, oceanWaves) or user-created (label groups)
import { z } from "zod";
import { GRID_TYPES } from "@/data/grid-types";
import { OCEAN_OUTLINES, OCEAN_PATTERNS } from "@/data/ocean-patterns";
import {
  CLIPS,
  CONTOUR_MODES,
  FONT_STYLES,
  FONT_WEIGHTS,
  HACHURE_MODES,
  HEIGHTMAP_CURVES,
  LAKE_EMBELLISHMENTS,
  LINECAPS,
  LINEJOINS,
  MAP_FILTERS,
  POPULATION_TYPES,
  RELIEF_SET_LABELS,
  RELIEF_SETS,
  WAVE_TYPES
} from "@/data/style-choices";
import type { StyleMeta } from "@/types/styles";
import { sentences, t } from "@/utils/i18n";
import { hexColor } from "@/utils/schemaUtils";
import { FORMATS, isLabelStyle } from "./styles-formats";

export const styleMeta = z.registry<StyleMeta>();

const meta = <T extends z.ZodType>(schema: T, fieldMeta: StyleMeta): T => {
  styleMeta.add(schema, fieldMeta);
  return schema;
};
// a clone reads its parent's meta under its own, so a variant overrides what it names and keeps the rest
const variant = <T extends z.ZodType>(schema: T, fieldMeta: StyleMeta): T => meta(schema.clone(), fieldMeta);
const hidden = <T extends z.ZodType>(schema: T): T => variant(schema, { hidden: true }); // stored, never edited

const range = (min: number, max: number, fieldMeta: StyleMeta = {}) => meta(z.number().min(min).max(max), fieldMeta);
const count = (min: number, max: number, fieldMeta: StyleMeta = {}) =>
  meta(z.number().int().min(min).max(max), fieldMeta);
const number = (fieldMeta: StyleMeta = {}) => meta(z.number(), fieldMeta); // a slider when `range` is given
const flag = (fieldMeta: StyleMeta) => meta(z.boolean(), fieldMeta);
const text = (fieldMeta: StyleMeta) => meta(z.string(), fieldMeta);
const choice = (choices: Record<string, string>, fieldMeta: StyleMeta = {}) =>
  meta(z.enum(Object.keys(choices)), { choices, ...fieldMeta });
const solidColor = (fieldMeta: StyleMeta = {}) => meta(hexColor.clone(), { control: "color", ...fieldMeta });

// --- shared attrs -----------------------------------------------------------------------------------
const opacity = range(0, 1, {
  label: t("Opacity"),
  nullAs: 1,
  tip: sentences(t("Set opacity"), `0: ${t("transparent")}, 1: ${t("solid")}`)
}).nullable();

const color = solidColor().nullable();

const fill = variant(color, { label: t("Color"), tip: t("Set fill color") });
const fillOpacity = variant(opacity, {
  label: t("Opacity"),
  tip: sentences(t("Set fill opacity"), `0: ${t("transparent")}, 1: ${t("solid")}`)
});

const stroke = variant(color, { label: t("Color"), tip: t("Set stroke color") });
const strokeOpacity = variant(opacity, {
  label: t("Opacity"),
  tip: sentences(t("Set stroke opacity"), `0: ${t("transparent")}, 1: ${t("solid")}`)
});

const strokeWidth = meta(z.number().min(0), {
  label: t("Width"),
  nullAs: 0,
  range: [0, 10],
  tip: t("Set stroke width")
}).nullable();

const strokeDasharray = meta(z.string().regex(FORMATS.strokeDasharray), {
  control: "dash",
  label: t("Dash array"),
  tip: t("Set stroke dash array, e.g. {{example}}", { example: "5 2" })
})
  .nullable()
  .default(null);

const strokeLinecap = choice(LINECAPS, { label: t("Linecap") }).nullable();

const strokeLinejoin = choice(LINEJOINS, { label: t("Linejoin") }).nullable();

const fontFamily = text({ control: "font", label: t("Family"), tip: t("Select font") });

const fontSizePx = meta(z.string().regex(FORMATS.fontSizePx), {
  control: "px",
  label: t("Size"),
  range: [1, 40],
  tip: t("Set font size in pixels")
});

const filter = meta(z.string().regex(FORMATS.filter), {
  control: "filter",
  label: t("Filter"),
  tip: t("Select filter for element. Filters may cause performance issues!")
}).nullable();

const blurFilter = meta(z.string().regex(FORMATS.blurFilter), {
  control: "blur",
  label: t("Blur"),
  range: [0, 10],
  tip: t("Blur radius in pixels. Set to 0 for a solid line")
}).nullable();

// a defs reference the renderer owns (url(#fog), url(#vignette-mask)): stored, never edited
const mask = hidden(z.string().regex(FORMATS.mask).nullable());

// the layers that clip to land or water offer the two masks
const clip = choice(CLIPS, {
  label: t("Clip"),
  tip: t("Set clipping. Only non-clipped part will be visible")
}).nullable();

const transform = hidden(z.string().nullable()); // a raw layer transform, not a style choice

const percentage = meta(z.string().regex(FORMATS.percentage), { control: "percent" });

const dashGroup = {
  "stroke-width": variant(strokeWidth, { group: t("Stroke") }),
  "stroke-dasharray": variant(strokeDasharray, { group: t("Stroke") }),
  "stroke-linecap": variant(strokeLinecap, { group: t("Stroke") })
};

const strokeGroup = {
  stroke: variant(stroke, { group: t("Stroke") }),
  "stroke-opacity": variant(strokeOpacity, { group: t("Stroke") }),
  "stroke-width": variant(strokeWidth, { group: t("Stroke") }),
  "stroke-dasharray": variant(strokeDasharray, { group: t("Stroke") }),
  "stroke-linecap": variant(strokeLinecap, { group: t("Stroke") }),
  "stroke-linejoin": variant(strokeLinejoin, { group: t("Stroke") })
};

const fillGroup = {
  fill: variant(fill, { group: t("Fill") }),
  "fill-opacity": variant(fillOpacity, { group: t("Fill") })
};

// x/y shifts, in the unit of their element; a slider each: a dragged offset beats a typed one
const shift = (axis: "x" | "y", reach: number, step: number, tip: string) =>
  number({ label: axis === "x" ? t("Shift x") : t("Shift y"), range: [-reach, reach], step, tip });

// --- feature parts ----------------------------------------------------------------------------------
const borders = z.strictObject({
  attrs: z.strictObject({
    stroke,
    opacity,
    "stroke-width": strokeWidth,
    "stroke-dasharray": strokeDasharray,
    "stroke-linecap": strokeLinecap,
    filter
  })
});

const lake = z.strictObject({
  attrs: z.strictObject({ opacity, ...fillGroup, ...strokeGroup, filter }),
  options: meta(
    z.strictObject({
      embellishment: choice(LAKE_EMBELLISHMENTS, {
        tip: t("Fine ripples along the banks, fading into open water and scaled down for small lakes")
      }),
      density: range(0.1, 4, { label: t("Density"), tip: t("How closely ripple rows are spaced") }),
      length: range(0.2, 4, { label: t("Length"), tip: t("Ripple length, fitted to the available water width") }),
      halo: range(0, 2, {
        label: t("Shore gap"),
        step: 0.05,
        tip: t("Clear water along the shoreline, relative to lake ripple scale")
      }),
      color: solidColor({ group: t("Stroke"), label: t("Color") }),
      width: range(0.05, 2, {
        group: t("Stroke"),
        label: t("Width"),
        step: 0.05,
        tip: t("Ripple stroke width in map pixels")
      }),
      opacity: range(0, 1, {
        group: t("Stroke"),
        label: t("Opacity"),
        step: 0.05,
        tip: t("Opacity of the lake ripples")
      })
    }),
    { gate: "embellishment", label: t("Embellishment") }
  ).default({ embellishment: "none", density: 1, length: 1, halo: 0.2, color: "#000000", width: 0.3, opacity: 0.6 })
});

const contours = meta(
  z.strictObject({
    mode: choice(CONTOUR_MODES, {
      tip: t("Draw smooth elevation contours over the heightmap colors, or show only contour lines")
    }),
    interval: count(1, 20, {
      label: t("Spacing"),
      tip: t("Elevation spacing between contours. Lower values show more detail; every fifth contour is heavier")
    }),
    color: solidColor({ label: t("Color"), tip: t("Color of the contour lines") }),
    width: range(0.1, 2, {
      label: t("Width"),
      step: 0.05,
      tip: t("Width of minor contours. Every fifth contour is twice as wide")
    }),
    opacity: range(0, 1, { label: t("Opacity"), step: 0.05, tip: t("Opacity of the contour lines") })
  }),
  { gate: "mode", label: t("Contours") }
).default({ mode: "off", interval: 5, color: "#5c513e", width: 0.35, opacity: 0.5 });

// downhill pen strokes, denser and longer on steeper slopes
const hachures = meta(
  z.strictObject({
    mode: choice(HACHURE_MODES, {
      tip: t("Draw downhill pen strokes over the heightmap colors, or show only the strokes")
    }),
    density: range(0.1, 4, {
      label: t("Density"),
      tip: t("How closely the strokes are packed, relative to the default. Steep ground packs them tighter")
    }),
    length: range(0.2, 4, {
      label: t("Length"),
      tip: sentences(t("Stroke length, relative to the default"), t("Strokes stop early where the slope levels off"))
    }),
    width: range(0.2, 4, {
      group: t("Stroke"),
      label: t("Width"),
      tip: t("Stroke width at its root, relative to the default. Gentler ground draws lighter strokes")
    }),
    color: solidColor({ group: t("Stroke"), label: t("Color"), tip: t("Color of the hachure strokes") }),
    opacity: range(0, 1, { label: t("Opacity"), step: 0.05, tip: t("Opacity of the hachure strokes") })
  }),
  { gate: "mode", label: t("Hachures") }
).default({ mode: "off", density: 1, length: 1, width: 1, color: "#5c513e", opacity: 0.65 });

const heightOptions = z.strictObject({
  scheme: text({ control: "scheme", label: t("Color scheme"), tip: t("Select color scheme for the element") }),
  terracing: range(0, 20, { label: t("Terracing"), step: 1, tip: t("Terracing power. Set to 0 to toggle off") }),
  skip: range(0, 10, {
    label: t("Reduce layers"),
    step: 1,
    tip: t("Layers reduction rate. Increase to improve performance")
  }),
  relax: range(0, 10, {
    label: t("Simplify"),
    step: 1,
    tip: t("Line simplification rate. Increase to slightly improve performance")
  }),
  curve: choice(HEIGHTMAP_CURVES, { label: t("Line style"), tip: t("Select line interpolation type") }),
  contours,
  hachures
});
const landHeights = meta(z.strictObject({ attrs: z.strictObject({ opacity, filter, mask }), options: heightOptions }), {
  label: t("Land heights")
});
const oceanHeights = meta(
  z.strictObject({
    attrs: landHeights.shape.attrs,
    options: heightOptions.extend({
      render: flag({ label: t("Render ocean heights"), tip: t("Draw heights of water cells") })
    })
  }),
  { gate: "options.render", label: t("Ocean heights") }
);

const coastlineBands = meta(
  z.strictObject({
    render: flag({ label: t("Coastline bands"), tip: t("Draw concentric bands that follow the coastline") }),
    count: count(1, 8, { label: t("Count"), tip: t("Number of bands around the coast") }),
    spacing: range(0.2, 5, {
      label: t("Spacing"),
      tip: t("Band spacing in map units; bands widen farther from shore")
    }),
    width: range(0.05, 1, {
      group: t("Outline"),
      label: t("Width"),
      step: 0.05,
      tip: t("Width of the dark lines separating bands")
    }),
    color: solidColor({ group: t("Outline"), label: t("Color") }),
    shore: solidColor({ label: t("Shore tint"), tip: t("Tint over the existing ocean, strongest near the shore") }),
    shade: range(0, 1, {
      label: t("Shading"),
      step: 0.05,
      tip: t("Strength of the nearshore tint; zero leaves only outlines over the ocean texture")
    }).default(0.35),
    opacity: range(0, 1, { label: t("Opacity"), step: 0.05 })
  }),
  { gate: "render", label: t("Coastline bands") }
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
    // the renderer bakes the stroke into the drawing
    attrs: meta(
      z.strictObject({
        opacity,
        stroke: strokeGroup.stroke,
        "stroke-width": variant(strokeGroup["stroke-width"], { range: [0.05, 2], step: 0.05 }),
        "stroke-dasharray": strokeGroup["stroke-dasharray"],
        filter
      }),
      { effect: "draw" }
    ),
    options: z.strictObject({
      render: flag({
        label: t("Ocean embellishment"),
        tip: t("Decorate coastal and distant water around a clear offshore band")
      }),
      type: choice(WAVE_TYPES, { label: t("Type"), tip: t("Choose the shape of the ocean embellishments") }).default(
        "waves"
      ),
      density: range(0.1, 4, {
        label: t("Density"),
        tip: t("How closely embellishments are spaced, relative to the default")
      }),
      length: range(0.2, 4, { label: t("Length"), tip: t("Stroke length, relative to the default") }),
      reach: range(1, 12, {
        label: t("Reach"),
        step: 0.5,
        tip: t("Distance into the sea over which embellishments fade, in cell spacings")
      }),
      halo: range(0, 2, {
        label: t("Coastal gap"),
        step: 0.05,
        tip: t("Clear water beyond the coastline bands (or shore), in cell spacings")
      })
    })
  }),
  { gate: "options.render", label: t("Ocean embellishment") }
).default({
  attrs: { opacity: 0.5, stroke: "#1f3846", "stroke-width": 0.5, "stroke-dasharray": null, filter: null },
  options: { render: false, type: "waves", density: 1, length: 1, reach: 4, halo: 0.25 }
});

const burgGroup = z.strictObject({
  attrs: z.strictObject({
    opacity,
    ...fillGroup,
    ...strokeGroup,
    filter
  }),
  options: z.strictObject({
    size: number({ label: t("Icon size"), range: [0.01, 100], step: 0.01 }),
    icon: text({ control: "icon", label: t("Icon"), tip: t("Select icon") })
  })
});

// a port group takes the burg group and adds the shift of its own
const anchorGroup = burgGroup.extend({
  options: burgGroup.shape.options.extend({
    dx: meta(z.number().optional(), {
      label: t("Shift x"),
      range: [-5, 5],
      step: 0.05,
      nullAs: 0,
      tip: t("Horizontal shift in icon-size units (positive moves right)")
    }),
    dy: meta(z.number().optional(), {
      label: t("Shift y"),
      range: [-5, 5],
      step: 0.05,
      nullAs: 0,
      tip: t("Vertical shift in icon-size units (positive moves down)")
    })
  })
});

const coastline = z.strictObject({
  attrs: z.strictObject({ opacity, stroke: stroke, "stroke-width": strokeWidth, filter })
});

const emblemGroup = z.strictObject({
  options: z.strictObject({
    size: number({ label: t("Size"), range: [0, 5], step: 0.01, tip: t("Set emblems size multiplier") })
  })
});

const padding = (side: string) =>
  number({
    group: t("Padding"),
    label: side,
    range: [0, 50],
    step: 0.5,
    tip: t("Background element padding in pixels")
  });

// --- the record -------------------------------------------------------------------------------------
// on change run scripts/convert-style-presets.mjs to automatically update style presets
export const stylesSchema = z.strictObject({
  biomes: z.strictObject({ attrs: z.strictObject({ opacity, filter }) }),
  borders: z.strictObject({
    groups: z.strictObject({
      stateBorders: variant(borders, { label: t("State borders") }),
      provinceBorders: variant(borders, { label: t("Province borders") })
    })
  }),
  burgIcons: z.strictObject({
    groups: z
      .record(
        z.string(),
        z.strictObject({
          groups: z.strictObject({
            icons: meta(burgGroup, { label: t("Icons") }),
            anchors: meta(anchorGroup, { label: t("Anchors") })
          })
        })
      )
      .refine(groups => Object.keys(groups).length > 0)
  }),
  cells: z.strictObject({ attrs: z.strictObject({ ...strokeGroup, filter, mask: clip }) }),
  coastline: z.strictObject({
    groups: z.strictObject({
      sea_island: variant(coastline, { label: t("Sea island") }),
      lake_island: variant(coastline, { label: t("Lake island") })
    })
  }),
  compass: z.strictObject({
    attrs: z.strictObject({ opacity, transform, filter, mask: clip }),
    groups: z.strictObject({
      compassRose: meta(
        z.strictObject({
          attrs: z.strictObject({
            transform: meta(z.string().regex(FORMATS.compassTransform), {
              control: "transform",
              label: t("Placement"),
              tip: t("Set wind (compass) rose shift and size")
            }).nullable()
          })
        }),
        { label: t("Compass rose") }
      )
    })
  }),
  coordinates: z.strictObject({
    attrs: z.strictObject({
      stroke,
      opacity,
      "stroke-width": strokeWidth,
      "stroke-dasharray": strokeDasharray,
      "stroke-linecap": strokeLinecap,
      "font-size": variant(fontSizePx, { effect: "draw" }), // the renderer derives the drawn size from it
      filter,
      mask: clip
    })
  }),
  cultures: z.strictObject({ attrs: z.strictObject({ opacity, ...strokeGroup, filter }) }),
  emblems: z.strictObject({
    attrs: z.strictObject({ opacity, "stroke-width": variant(strokeWidth, { label: t("Stroke width") }), filter }),
    groups: z.strictObject({
      stateEmblems: variant(emblemGroup, { label: t("State emblems") }),
      provinceEmblems: variant(emblemGroup, { label: t("Province emblems") }),
      burgEmblems: variant(emblemGroup, { label: t("Burg emblems") })
    })
  }),
  fogging: z.strictObject({ attrs: z.strictObject({ opacity, fill, mask, filter }) }),
  goods: z.strictObject({
    groups: z.strictObject({
      goodsCells: meta(z.strictObject({ attrs: z.strictObject({ opacity, filter }) }), { label: t("Goods cells") }),
      goodsIcons: meta(
        z.strictObject({
          attrs: z.strictObject({
            opacity,
            stroke: variant(stroke, { label: t("Icon Lines"), tip: t("Color of the icon lines") }),
            "stroke-width": variant(strokeWidth, {
              label: t("Stroke width"),
              tip: t("Width of the circle outline; the icon lines are drawn at 40% of it")
            }),
            filter
          }),
          options: z.strictObject({
            size: number({
              label: t("Marker size"),
              range: [1, 20],
              step: 0.5,
              tip: t("Set good marker (icon and circle) size in pixels")
            }),
            circle: flag({ label: t("Show circle") })
          })
        }),
        { label: t("Goods icons") }
      ),
      goodsBurgs: meta(
        z.strictObject({
          attrs: z.strictObject({
            opacity,
            stroke: strokeGroup.stroke,
            "stroke-width": strokeGroup["stroke-width"],
            filter
          }),
          options: z.strictObject({
            size: number({
              label: t("Plate size"),
              range: [1, 12],
              step: 0.5,
              tip: t("Set burg production plate icon size in pixels. Plate and font scale together with it")
            })
          })
        }),
        { label: t("Goods burgs") }
      )
    })
  }),
  grid: z.strictObject({
    attrs: meta(
      z.strictObject({
        stroke,
        opacity,
        "stroke-width": strokeWidth,
        "stroke-dasharray": strokeDasharray,
        "stroke-linecap": strokeLinecap,
        transform,
        filter,
        mask: clip
      }),
      { effect: "draw" }
    ),
    options: z.strictObject({
      type: choice(GRID_TYPES, { label: t("Type"), tip: t("Select grid overlay type") }),
      scale: number({ label: t("Scale"), range: [0.1, 10], step: 0.01, tip: t("Set grid cells scale multiplier") }),
      dx: shift("x", 100, 1, t("Shift by x axis in pixels")),
      dy: shift("y", 100, 1, t("Shift by y axis in pixels"))
    })
  }),
  heightmap: z.strictObject({ groups: z.strictObject({ landHeights, oceanHeights }) }),
  ice: z.strictObject({ attrs: z.strictObject({ opacity, fill, ...strokeGroup, filter }) }),
  journeys: z.strictObject({ attrs: z.strictObject({ opacity, ...dashGroup, filter, mask: clip }) }),
  labels: z.strictObject({
    groups: z.record(
      z.string(),
      z.strictObject({
        attrs: z.strictObject({
          opacity,
          ...fillGroup,
          ...strokeGroup,
          "stroke-width": meta(z.number().min(0), {
            group: t("Stroke"),
            label: t("Width"),
            range: [0, 2],
            step: 0.01,
            tip: t("Set stroke width")
          }).default(0),
          "font-family": variant(fontFamily, { group: t("Font"), effect: "draw" }),
          "font-size": meta(z.string().regex(FORMATS.fontSizePercent), {
            control: "percent",
            group: t("Font"),
            label: t("Size"),
            range: [1, 40],
            effect: "draw",
            tip: t("Set font size, relative to the labels layer")
          }),
          "font-style": choice(FONT_STYLES, {
            label: t("Style"),
            group: t("Font")
          })
            .nullable()
            .default(null),
          "font-weight": meta(z.literal(FONT_WEIGHTS), {
            control: "select",
            label: t("Weight", { context: "font" }),
            group: t("Font")
          })
            .nullable()
            .default(null),
          "letter-spacing": number({
            label: t("Spacing"),
            group: t("Font"),
            nullAs: 0,
            range: [-2, 10],
            step: 0.01,
            effect: "draw"
          }).nullable(),
          style: meta(z.string().refine(isLabelStyle), {
            control: "labelStyle",
            label: t("Style"),
            tip: t("Set text shadow, case and shift")
          }).nullable(),
          filter
        })
      })
    )
  }),
  lakes: z.strictObject({ groups: z.record(z.string(), lake) }), // stock groups plus user-created ones
  landmass: z.strictObject({ attrs: z.strictObject({ opacity, fill, filter }) }),
  legend: z.strictObject({
    attrs: z.strictObject({
      ...strokeGroup,
      "font-family": variant(fontFamily, { effect: "draw" }),
      "font-size": variant(fontSizePx, { effect: "draw" })
    }),
    options: z.strictObject({
      columns: number({
        label: t("Column items"),
        range: [1, 30],
        step: 1,
        tip: t("Set maximum number of items in one column")
      })
    }),
    groups: z.strictObject({
      box: meta(z.strictObject({ attrs: z.strictObject(fillGroup) }), {
        label: t("Background"),
        effect: "draw"
      })
    })
  }),
  map: z.strictObject({
    attrs: z.strictObject({
      filter: choice(MAP_FILTERS, {
        label: t("Filter"),
        tip: t("Set a filter to be applied to the map in general")
      }).nullable()
    })
  }),
  markers: z.strictObject({ attrs: z.strictObject({ opacity, filter }) }),
  markets: z.strictObject({
    attrs: z.strictObject({
      "fill-opacity": fillGroup["fill-opacity"],
      "stroke-opacity": variant(strokeOpacity, { group: t("Stroke") }),
      "stroke-width": variant(strokeWidth, { group: t("Stroke") }),
      "stroke-dasharray": variant(strokeDasharray, { group: t("Stroke") }),
      "stroke-linecap": variant(strokeLinecap, { group: t("Stroke") }),
      filter
    }),
    options: z.strictObject({
      size: number({
        label: t("Marker size"),
        range: [1, 12],
        step: 0.5,
        tip: t("Set market marker (circle) size in pixels")
      }),
      iconSize: number({
        label: t("Icon size"),
        range: [1, 20],
        step: 0.5,
        tip: t("Set market marker icon size in pixels")
      }),
      icon: text({ control: "icon", label: t("Marker icon"), tip: t("Set the icon shown inside the market marker") })
    })
  }),
  military: z.strictObject({
    attrs: z.strictObject({ opacity, "fill-opacity": fillGroup["fill-opacity"], ...strokeGroup, filter }),
    options: z.strictObject({
      boxSize: number({
        label: t("Box size"),
        range: [0, 10],
        step: 0.1,
        tip: t("Set regiment box size. All regiments will be redrawn on change (position will defaulted)")
      })
    })
  }),
  ocean: z.strictObject({
    options: z.strictObject({ bands: coastlineBands }),
    groups: z.strictObject({
      base: meta(
        z.strictObject({
          attrs: z.strictObject({ fill })
        }),
        { label: t("Base") }
      ),
      pattern: meta(
        z.strictObject({
          attrs: z.strictObject({
            href: choice(OCEAN_PATTERNS, { label: t("Image"), tip: t("Select ocean pattern") }),
            opacity
          })
        }),
        { label: t("Pattern") }
      ),
      oceanLayers: meta(
        z.strictObject({
          attrs: z.strictObject({ filter }),
          options: z.strictObject({
            outline: choice(OCEAN_OUTLINES, {
              label: t("Ocean layers"),
              tip: t("Define the coast outline contours scheme")
            })
          })
        }),
        { label: t("Ocean layers") }
      ),
      oceanWaves
    })
  }),
  population: z.strictObject({
    attrs: z.strictObject({ opacity, ...dashGroup, filter, mask: clip }),
    options: z
      .strictObject({
        type: choice(POPULATION_TYPES, {
          label: t("Type"),
          tip: t("Draw population as bars or as cells shaded by density")
        })
      })
      .default({ type: "bars" }),
    groups: z.strictObject({
      rural: meta(
        z.strictObject({
          attrs: z.strictObject({ stroke })
        }),
        { label: t("Rural") }
      ),
      urban: meta(
        z.strictObject({
          attrs: z.strictObject({ stroke })
        }),
        { label: t("Urban") }
      )
    })
  }),
  precipitation: z.strictObject({
    attrs: z.strictObject({ opacity, fill, ...strokeGroup, filter, mask: clip })
  }),
  provinces: z.strictObject({ attrs: z.strictObject({ opacity, filter }) }),
  relief: z.strictObject({
    attrs: z.strictObject({
      opacity,
      stroke: variant(color, { label: t("Color"), tip: t("Set stroke color") }).default("#23343f"),
      filter,
      mask: clip
    }),
    options: z.strictObject({
      set: meta(z.enum(RELIEF_SETS), {
        choices: RELIEF_SET_LABELS,
        label: t("Style"),
        effect: "draw",
        tip: t("Select set of relief icons. Existing icons are restyled, not regenerated")
      }),
      size: number({
        label: t("Size"),
        range: [0.2, 4],
        step: 0.01,
        effect: "draw",
        tip: t("Define the size of relief icons. A render multiplier: the map data is not changed")
      }),
      density: number({
        label: t("Density"),
        range: [0.3, 0.8],
        step: 0.01,
        effect: "regenerateRelief",
        tip: t(
          "Define the density of relief icons. All relief icons are regenerated, discarding manual edits. Highly affects performance!"
        )
      })
    })
  }),
  religions: z.strictObject({ attrs: z.strictObject({ opacity, ...strokeGroup, filter }) }),
  rivers: z.strictObject({ attrs: z.strictObject({ opacity, fill, filter }) }),
  routes: z.strictObject({
    groups: z.record(
      z.string(),
      z.strictObject({ attrs: z.strictObject({ opacity, ...strokeGroup, filter, mask: clip }) })
    )
  }),
  rulers: z.strictObject({
    attrs: meta(
      z.strictObject({ opacity, ...dashGroup, "font-size": variant(fontSizePx, { group: t("Label") }), filter }),
      { effect: "draw" }
    )
  }),
  scaleBar: meta(
    z.strictObject({
      attrs: z.strictObject({ opacity, fill, "font-size": fontSizePx }),
      options: z.strictObject({
        barSize: number({ label: t("Bar size"), range: [0.5, 5], step: 0.1 }),
        label: text({ label: t("Label"), tip: t("Type scale bar label, leave blank to hide label") }),
        x: number({
          group: t("Position"),
          label: "X",
          range: [0, 100],
          step: 0.1,
          tip: t("Scale bar right edge, in percents")
        }),
        y: number({
          group: t("Position"),
          label: "Y",
          range: [0, 100],
          step: 0.1,
          tip: t("Scale bar bottom edge, in percents")
        })
      }),
      groups: z.strictObject({
        back: meta(
          z.strictObject({
            attrs: z.strictObject({
              opacity,
              ...fillGroup,
              stroke: strokeGroup.stroke,
              "stroke-width": strokeGroup["stroke-width"],
              filter
            }),
            options: z.strictObject({
              top: padding(t("Top")),
              right: padding(t("Right")),
              bottom: padding(t("Bottom")),
              left: padding(t("Left"))
            })
          }),
          { label: t("Background") }
        )
      })
    }),
    { effect: "draw" }
  ),
  states: z.strictObject({
    groups: z.strictObject({
      statesBody: meta(z.strictObject({ attrs: z.strictObject({ opacity, filter }) }), { label: t("States body") }),
      // rendered only when performance is set to best quality; the zoom scales the width it writes
      statesHalo: meta(
        z.strictObject({
          attrs: z.strictObject({
            opacity,
            "stroke-width": variant(strokeWidth, { range: [0, 30], step: 0.1, effect: "zoom" }),
            filter: blurFilter
          })
        }),
        { label: t("States halo") }
      )
    })
  }),
  temperature: z.strictObject({
    attrs: z.strictObject({
      fill: variant(fill, { group: t("Label") }),
      "fill-opacity": fillGroup["fill-opacity"],
      "font-size": variant(fontSizePx, { group: t("Label") }),
      ...strokeGroup,
      filter,
      mask: clip
    })
  }),
  texture: z.strictObject({
    attrs: z.strictObject({ opacity, filter, mask: clip }),
    options: z.strictObject({
      href: text({
        control: "texture",
        label: t("Image"),
        tip: t("Select texture image. Big textures can highly affect performance")
      }),
      x: shift("x", 500, 1, t("Shift by x axis in pixels")),
      y: shift("y", 500, 1, t("Shift by y axis in pixels"))
    })
  }),
  trade: z.strictObject({ attrs: z.strictObject({ opacity, filter }) }),
  vignette: z.strictObject({
    attrs: z.strictObject({ opacity, fill, mask, filter }),
    options: meta(
      z.strictObject({
        x: variant(percentage, {
          label: t("Position x"),
          range: [0, 100],
          step: 0.1,
          tip: t("Vignette rectangle x, in percents")
        }),
        y: variant(percentage, {
          label: t("Position y"),
          range: [0, 100],
          step: 0.1,
          tip: t("Vignette rectangle y, in percents")
        }),
        width: variant(percentage, {
          label: t("Width"),
          range: [0, 100],
          step: 0.1,
          tip: t("Vignette rectangle width, in percents")
        }),
        height: variant(percentage, {
          label: t("Height"),
          range: [0, 100],
          step: 0.1,
          tip: t("Vignette rectangle height, in percents")
        }),
        rx: variant(percentage, {
          label: t("Radius x"),
          range: [0, 50],
          step: 0.1,
          tip: t("Vignette X radius, in percents")
        }),
        ry: variant(percentage, {
          label: t("Radius y"),
          range: [0, 50],
          step: 0.1,
          tip: t("Vignette Y radius, in percents")
        }),
        filter: variant(blurFilter, { range: [0, 400], step: 1, tip: t("Set vignette blur propagation, in pixels") })
      }),
      { effect: "draw" }
    )
  }),
  zones: z.strictObject({ attrs: z.strictObject({ opacity, ...strokeGroup, filter, mask: clip }) })
});
