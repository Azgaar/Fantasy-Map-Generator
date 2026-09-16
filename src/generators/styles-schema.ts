import { z } from "zod";
import type { LayerId } from "@/components/layers";

// One shared type per recurring attribute; attrs written to the DOM, null = attribute not set
const opacity = z.number().nullable();
const color = z.string().nullable();
const strokeWidth = z.number().nullable();
const strokeDasharray = z.string().nullable().default(null);
const strokeLinecap = z.string().nullable();
const strokeLinejoin = z.string().nullable();
const letterSpacing = z.number().nullable();
const fontFamily = z.string();
const fontWeight = z.number().int().min(100).max(950).nullable().default(null);
const filter = z.string().nullable();
const mask = z.string().nullable();
const transform = z.string().nullable();
const percentage = z.string().regex(/^-?\d+(\.\d+)?%$/);
const fontSize = z.string(); // font sizes carry legacy dialects ("6%", "12px", "18"), so no format validator
const styleAttr = z.string().nullable(); // CSSStyleDeclaration.cssText: text-shadow, text-transform and label shift transform live here

const strokeAttrs = {
  stroke: color,
  "stroke-width": strokeWidth,
  "stroke-dasharray": strokeDasharray,
  "stroke-linecap": strokeLinecap
};
const fillAttrs = { fill: color, "fill-opacity": opacity };

const lake = z.strictObject({
  attrs: z.strictObject({ opacity, ...fillAttrs, ...strokeAttrs, filter }),
  options: z
    .strictObject({
      embellishment: z.enum(["none", "ripples", "lines"]),
      density: z.number().min(0.1).max(4),
      length: z.number().min(0.2).max(4),
      halo: z.number().min(0).max(2),
      color: z.string(),
      width: z.number().min(0.05).max(2),
      opacity: z.number().min(0).max(1)
    })
    .default({ embellishment: "none", density: 1, length: 1, halo: 0.2, color: "#000000", width: 0.3, opacity: 0.6 })
});
const heights = z.strictObject({
  attrs: z.strictObject({ opacity, filter, mask }),
  options: z.strictObject({
    scheme: z.string(),
    terracing: z.number(),
    skip: z.number(),
    relax: z.number(),
    curve: z.string(),
    render: z.boolean(),
    contours: z
      .strictObject({
        mode: z.enum(["off", "overlay", "only"]),
        interval: z.number().int().min(1).max(20),
        color: z.string(),
        width: z.number().min(0.1).max(2),
        opacity: z.number().min(0).max(1)
      })
      .default({ mode: "off", interval: 5, color: "#5c513e", width: 0.35, opacity: 0.5 }),
    // downhill pen strokes, denser and longer on steeper slopes
    hachures: z
      .strictObject({
        mode: z.enum(["off", "overlay", "only"]),
        density: z.number().min(0.1).max(4),
        length: z.number().min(0.2).max(4),
        width: z.number().min(0.2).max(4),
        color: z.string(),
        opacity: z.number().min(0).max(1)
      })
      .default({ mode: "off", density: 1, length: 1, width: 1, color: "#5c513e", opacity: 0.65 })
  })
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
  options: z.strictObject({ size: z.number(), icon: z.string(), dx: z.number().optional(), dy: z.number().optional() })
});
// anchors ignored icon before ports became stylable, so older records carry the burg default: keep drawing the anchor
const anchorIcon = z.string().transform(icon => (icon === "#icon-circle" ? "#icon-anchor" : icon));
const anchorGroup = z.strictObject({
  attrs: burgGroupAttrs,
  options: burgGroup.shape.options.extend({ icon: anchorIcon })
});
const emblemGroup = z.strictObject({ options: z.strictObject({ size: z.number() }) });

// One schema per layer; attrs go to the DOM; options are renderer inputs and never do
export const stylesSchema = z.strictObject({
  map: z.strictObject({
    attrs: z.strictObject({ filter }),
    options: z.strictObject({ dataFilter: z.string().nullable() })
  }),
  ocean: z.strictObject({
    // pattern/patternOpacity style #oceanicPattern, a defs resource the renderer owns
    options: z.strictObject({
      pattern: z.string(),
      patternOpacity: z.number(),
      bands: z
        .strictObject({
          render: z.boolean(),
          count: z.number().int().min(1).max(8),
          spacing: z.number().min(0.2).max(5),
          width: z.number().min(0.05).max(1),
          color: z.string(),
          shore: z.string(),
          shade: z.number().min(0).max(1).default(0.35),
          opacity: z.number().min(0).max(1)
        })
        .default({
          render: false,
          count: 5,
          spacing: 1.1,
          width: 0.25,
          color: "#575448",
          shore: "#b9b6a1",
          shade: 0.35,
          opacity: 1
        })
    }),
    base: z.strictObject({ attrs: z.strictObject({ fill: color }) }),
    oceanLayers: z.strictObject({
      attrs: z.strictObject({ filter }),
      options: z.strictObject({ outline: z.string() })
    }),
    // Ocean embellishments share the coastal and distant-sea placement.
    oceanWaves: z
      .strictObject({
        attrs: z.strictObject({
          opacity,
          stroke: color,
          "stroke-width": strokeWidth,
          "stroke-dasharray": strokeDasharray,
          filter
        }),
        options: z.strictObject({
          render: z.boolean(),
          type: z.enum(["waves", "lines"]).default("waves"),
          density: z.number().min(0.1).max(4),
          length: z.number().min(0.2).max(4),
          reach: z.number().min(1).max(12), // cells from the shore the dashes fade out over
          halo: z.number().min(0).max(2) // blank water along the shore, in cell spacings
        })
      })
      .default({
        attrs: { opacity: 0.5, stroke: "#1f3846", "stroke-width": 0.5, "stroke-dasharray": null, filter: null },
        options: { render: false, type: "waves", density: 1, length: 1, reach: 4, halo: 0.25 }
      })
  }),
  landmass: z.strictObject({ attrs: z.strictObject({ opacity, fill: color, filter }) }),
  texture: z.strictObject({
    attrs: z.strictObject({ opacity, filter, mask }),
    options: z.strictObject({ href: z.string(), x: z.number(), y: z.number() })
  }),
  heightmap: z.strictObject({ landHeights: heights, oceanHeights: heights }),
  biomes: z.strictObject({ attrs: z.strictObject({ opacity, filter, mask }) }),
  cells: z.strictObject({ attrs: z.strictObject({ opacity, ...strokeAttrs, filter, mask }) }),
  grid: z.strictObject({
    attrs: z.strictObject({ opacity, ...strokeAttrs, transform, filter, mask }),
    options: z.strictObject({ type: z.string(), scale: z.number(), dx: z.number(), dy: z.number() })
  }),
  coordinates: z.strictObject({
    attrs: z.strictObject({ opacity, ...strokeAttrs, filter, mask }),
    options: z.strictObject({ fontSize: z.number() })
  }),
  compass: z.strictObject({
    attrs: z.strictObject({ opacity, transform, filter, mask, "shape-rendering": z.string().nullable() }),
    compassRose: z.strictObject({ attrs: z.strictObject({ transform }) })
  }),
  rivers: z.strictObject({ attrs: z.strictObject({ opacity, fill: color, filter }) }),
  lakes: z.strictObject({ groups: z.record(z.string(), lake) }), // stock groups plus user-created ones
  coastline: z.strictObject({
    // autoFilter is FMG's own zoom-driven filter pick, not a stored attribute
    sea_island: z.strictObject({
      attrs: z.strictObject({ opacity, ...strokeAttrs, filter }),
      options: z.strictObject({ autoFilter: z.number() })
    }),
    lake_island: z.strictObject({ attrs: z.strictObject({ opacity, ...strokeAttrs, filter }) })
  }),
  // density defines icon placement: changing it regenerates the icons, not just restyles them
  relief: z.strictObject({
    attrs: z.strictObject({ opacity, filter, mask }),
    options: z.strictObject({ set: z.string(), size: z.number(), density: z.number() })
  }),
  religions: z.strictObject({ attrs: z.strictObject({ opacity, ...strokeAttrs, filter }) }),
  cultures: z.strictObject({ attrs: z.strictObject({ opacity, ...strokeAttrs, filter }) }),
  states: z.strictObject({
    statesBody: z.strictObject({ attrs: z.strictObject({ opacity, filter }) }),
    statesHalo: z.strictObject({
      attrs: z.strictObject({ opacity, "stroke-width": strokeWidth, filter }),
      options: z.strictObject({ width: z.number() })
    })
  }),
  provinces: z.strictObject({ attrs: z.strictObject({ opacity, filter }) }),
  zones: z.strictObject({ attrs: z.strictObject({ opacity, ...strokeAttrs, filter, mask }) }),
  borders: z.strictObject({
    stateBorders: z.strictObject({ attrs: z.strictObject({ opacity, ...strokeAttrs, filter }) }),
    provinceBorders: z.strictObject({ attrs: z.strictObject({ opacity, ...strokeAttrs, filter }) })
  }),
  routes: z.strictObject({
    groups: z.record(z.string(), z.strictObject({ attrs: z.strictObject({ opacity, ...strokeAttrs, filter, mask }) }))
  }),
  journeys: z.strictObject({
    attrs: z.strictObject({
      opacity,
      "stroke-width": strokeWidth,
      "stroke-dasharray": strokeDasharray,
      "stroke-linecap": strokeLinecap,
      filter,
      mask
    })
  }),
  temperature: z.strictObject({
    attrs: z.strictObject({ opacity, ...fillAttrs, ...strokeAttrs, "font-size": fontSize, filter, mask })
  }),
  ice: z.strictObject({ attrs: z.strictObject({ opacity, fill: color, ...strokeAttrs, filter }) }),
  precipitation: z.strictObject({ attrs: z.strictObject({ opacity, fill: color, ...strokeAttrs, filter, mask }) }),
  population: z.strictObject({
    attrs: z.strictObject({
      opacity,
      "stroke-width": strokeWidth,
      "stroke-dasharray": strokeDasharray,
      "stroke-linecap": strokeLinecap,
      filter,
      mask
    }),
    rural: z.strictObject({ attrs: z.strictObject({ stroke: color }) }),
    urban: z.strictObject({ attrs: z.strictObject({ stroke: color }) })
  }),
  emblems: z.strictObject({
    attrs: z.strictObject({ opacity, "stroke-width": strokeWidth, filter }),
    stateEmblems: emblemGroup,
    provinceEmblems: emblemGroup,
    burgEmblems: emblemGroup
  }),
  labels: z.strictObject({
    attrs: z.strictObject({ "font-size": fontSize }),
    groups: z.record(
      z.string(),
      z.strictObject({
        attrs: z.strictObject({
          opacity,
          ...fillAttrs,
          ...strokeAttrs,
          "letter-spacing": letterSpacing,
          "font-size": fontSize,
          "font-family": fontFamily,
          "font-style": z.string().nullable().default(null),
          "font-weight": fontWeight,
          style: styleAttr,
          filter
        })
      })
    )
  }),
  burgIcons: z.strictObject({
    burgIcons: z.strictObject({
      groups: z.record(z.string(), burgGroup).refine(groups => Object.keys(groups).length > 0)
    }),
    anchors: z.strictObject({
      groups: z.record(z.string(), anchorGroup).refine(groups => Object.keys(groups).length > 0)
    })
  }),
  goods: z.strictObject({
    goodsCells: z.strictObject({ attrs: z.strictObject({ opacity, filter }) }),
    goodsIcons: z.strictObject({
      attrs: z.strictObject({ opacity, "stroke-width": strokeWidth, filter }),
      options: z.strictObject({ size: z.number(), circle: z.boolean() })
    }),
    goodsBurgs: z.strictObject({
      attrs: z.strictObject({ opacity, stroke: color, "stroke-width": strokeWidth, filter }),
      options: z.strictObject({ size: z.number() })
    })
  }),
  markets: z.strictObject({
    attrs: z.strictObject({ opacity, ...fillAttrs, "stroke-width": strokeWidth, "stroke-opacity": opacity, filter }),
    options: z.strictObject({ size: z.number(), fontSize: z.number(), icon: z.string() })
  }),
  trade: z.strictObject({ attrs: z.strictObject({ opacity, filter }) }),
  markers: z.strictObject({
    attrs: z.strictObject({ opacity, filter }),
    options: z.strictObject({ rescale: z.number() }) // TODO: move to global options.markers.resizeOnZoom
  }),
  military: z.strictObject({
    attrs: z.strictObject({ opacity, ...strokeAttrs, "fill-opacity": opacity, filter }),
    options: z.strictObject({ fontSize: z.number(), boxSize: z.number() })
  }),
  rulers: z.strictObject({
    attrs: z.strictObject({
      opacity,
      "stroke-width": strokeWidth,
      "stroke-dasharray": strokeDasharray,
      "stroke-linecap": strokeLinecap,
      filter
    }),
    options: z.strictObject({ fontSize: z.number() })
  }),
  scaleBar: z.strictObject({
    attrs: z.strictObject({ opacity, fill: color, "font-size": z.number().nullable() }),
    // `label` names the unit under the bar; `x`/`y` place it, as percentages of the map extent
    options: z.strictObject({ barSize: z.number(), label: z.string(), x: z.number(), y: z.number() }),
    back: z.strictObject({
      attrs: z.strictObject({ opacity, ...fillAttrs, stroke: color, "stroke-width": strokeWidth, filter }),
      options: z.strictObject({ top: z.number(), right: z.number(), bottom: z.number(), left: z.number() })
    })
  }),
  legend: z.strictObject({
    attrs: z.strictObject({ ...strokeAttrs, "font-family": fontFamily }),
    options: z.strictObject({ fontSize: z.number(), x: z.number(), y: z.number(), columns: z.number() }),
    box: z.strictObject({ attrs: z.strictObject({ ...fillAttrs }) })
  }),
  fogging: z.strictObject({ attrs: z.strictObject({ opacity, fill: color, mask, filter }) }),
  // the geometry options shape #vignette-rect, the mask rect in defs the renderer owns
  vignette: z.strictObject({
    attrs: z.strictObject({ opacity, fill: color, mask, filter }),
    options: z.strictObject({
      x: percentage,
      y: percentage,
      width: percentage,
      height: percentage,
      rx: percentage,
      ry: percentage,
      filter
    })
  })
});

export type Styles = z.infer<typeof stylesSchema>;
export type StyleLayerId = keyof Styles & (LayerId | "map");
