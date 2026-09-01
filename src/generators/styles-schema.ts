import { z } from "zod";
import type { LayerId } from "@/components/layers";

// One shared type per recurring attribute; attrs written to the DOM, null = attribute not set
const opacity = z.number().nullable();
const color = z.string().nullable();
const strokeWidth = z.number().nullable();
const strokeDasharray = z.string().nullable();
const strokeLinecap = z.string().nullable();
const strokeLinejoin = z.string().nullable();
const letterSpacing = z.number().nullable();
const fontFamily = z.string();
const filter = z.string().nullable();
const mask = z.string().nullable();
const transform = z.string().nullable();
const percentage = z.string().regex(/^-?\d+(\.\d+)?%$/);
// font sizes carry legacy dialects ("6%", "12px", "18"), so no format validator
const fontSize = z.string();
const styleAttr = z.string().nullable(); // CSSStyleDeclaration.cssText: textShadow and transform

const strokeAttrs = {
  stroke: color,
  "stroke-width": strokeWidth,
  "stroke-dasharray": strokeDasharray,
  "stroke-linecap": strokeLinecap
};
const fillAttrs = { fill: color, "fill-opacity": opacity };

const lake = z.strictObject({ attrs: z.strictObject({ opacity, ...fillAttrs, ...strokeAttrs, filter }) });
const heights = z.strictObject({
  attrs: z.strictObject({ opacity, filter, mask }),
  options: z.strictObject({
    scheme: z.string(),
    terracing: z.number(),
    skip: z.number(),
    relax: z.number(),
    curve: z.string(),
    render: z.boolean()
  })
});
const burgGroup = z.strictObject({
  attrs: z.strictObject({ opacity, ...fillAttrs, ...strokeAttrs, "stroke-linejoin": strokeLinejoin, filter }),
  options: z.strictObject({ size: z.number(), icon: z.string() })
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
    options: z.strictObject({ pattern: z.string(), patternOpacity: z.number() }),
    base: z.strictObject({ attrs: z.strictObject({ fill: color }) }),
    oceanLayers: z.strictObject({
      attrs: z.strictObject({ filter }),
      options: z.strictObject({ outline: z.string() })
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
  lakes: z.strictObject({ freshwater: lake, salt: lake, sinkhole: lake, frozen: lake, lava: lake, dry: lake }),
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
  provinces: z.strictObject({
    attrs: z.strictObject({
      opacity,
      fill: color,
      "font-size": z.number().nullable(),
      "font-family": fontFamily,
      filter
    })
  }),
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
          style: styleAttr,
          filter
        })
      })
    )
  }),
  burgIcons: z.strictObject({
    burgIcons: z.strictObject({ groups: z.record(z.string(), burgGroup) }),
    anchors: z.strictObject({ groups: z.record(z.string(), burgGroup) })
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
    options: z.strictObject({ barSize: z.number(), x: z.number(), y: z.number(), label: z.string() }),
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
