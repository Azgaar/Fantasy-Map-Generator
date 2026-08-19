// Style store, round 3 — the whole library in one sketch.
// One runtime table is the single source: per-layer allowed attrs (strict, layer-specific)
// and typed options. TS types derive from it; validation walks it; no schema library.

// every attribute's value type, declared once
interface AttrTypes {
  opacity: number;
  fill: string;
  "fill-opacity": number;
  stroke: string;
  "stroke-width": number;
  "stroke-dasharray": string;
  "stroke-linecap": string;
  "stroke-linejoin": string;
  "stroke-opacity": number;
  filter: string;
  mask: string;
  "font-size": number;
  "font-family": string;
  "letter-spacing": number;
  transform: string;
  "shape-rendering": string;
  "background-color": string;
}

// shared key sets — composition happens here, not in the type system
const paint = ["opacity", "filter", "mask"] as const;
const stroke = ["stroke", "stroke-width", "stroke-dasharray", "stroke-linecap"] as const;
const fill = ["fill", "fill-opacity"] as const;
const text = ["font-size", "font-family", "letter-spacing"] as const;

// the table: what each layer and child may carry. This IS the strict typing —
// routes children take stroke attrs and nothing else; fogging takes paint+fill and nothing else.
const LAYERS = defineLayers({
  routes: { attrs: paint, children: { roads: [...stroke, ...paint], trails: stroke, searoutes: stroke } },
  rivers: { attrs: [...paint, ...fill] },
  coordinates: { attrs: [...paint, ...stroke], options: {} as { fontSize?: number } },
  markers: { attrs: paint, options: {} as { rescale?: number } },
  heightmap: {
    attrs: paint,
    children: { landHeights: paint, oceanHeights: paint },
    childOptions: {} as { scheme?: string; terracing?: number; skip?: number; relax?: number; curve?: string; render?: boolean },
  },
  states: { attrs: paint, children: { statesBody: paint, statesHalo: [...paint, "stroke-width"] } },
  labels: { attrs: [...paint, ...text], groups: [...paint, ...fill, ...stroke, ...text], groupOptions: {} as { fontSize?: number; dx?: number; dy?: number } },
  burgIcons: { groups: [...paint, ...fill, ...stroke], groupOptions: {} as { size?: number; icon?: string } },
  anchors: { groups: [...paint, ...fill, ...stroke], groupOptions: {} as { size?: number } },
  fogging: { attrs: [...paint, ...fill] },
  // ...one line per remaining layer; ~35 lines total when complete
});

// derived types — the only type-level machinery in the library
type Layers = typeof LAYERS;
type LayerId = keyof Layers;
type AttrsOf<Keys extends readonly (keyof AttrTypes)[]> = { [K in Keys[number]]?: AttrTypes[K] | null }; // null = remove
type ChildId<Id extends LayerId> = Layers[Id] extends { children: infer C } ? keyof C & string : never;

// the serialized shape: plain nested objects, exactly what a preset file contains
type StyleData = {
  [Id in LayerId]?: {
    attrs?: Record<string, unknown>;
    options?: Record<string, unknown>;
    children?: Record<string, { attrs?: Record<string, unknown>; options?: Record<string, unknown> }>;
  };
};

class Style {
  private data: StyleData;

  // new format only. Legacy presets are someone else's problem: see legacy.ts, used solely by
  // migration call sites. Unknown layers/attrs/options are dropped with one console.warn each.
  static fromJSON(json: unknown): Style {
    return new Style(validate(json)); // validate: ~30 lines, walks LAYERS, checks typeof against AttrTypes
  }

  toJSON(): StyleData {
    return structuredClone(this.data);
  }

  // write attrs onto layer.getEl() and its children; null removes; never creates elements.
  // The two dom quirks live here and nowhere else: label groups are id="labels-<name>",
  // burg/anchor groups live inside #icons > #burgIcons / #anchors.
  applyTo(layer: Layer): void { /* ~30 lines */ }

  options<Id extends LayerId>(id: Id): OptionsOf<Id> { /* one lookup */ }
  attrs<Id extends LayerId>(id: Id, child?: ChildId<Id>): AttrsFor<Id> { /* one lookup */ }

  setAttr<Id extends LayerId, K extends AttrKeyFor<Id>>(id: Id, name: K, value: AttrTypes[K] | null): void;
  setAttr<Id extends LayerId, C extends ChildId<Id>, K extends AttrKeyFor<Id, C>>(id: Id, child: C, name: K, value: AttrTypes[K] | null): void;
  setAttr(...args: unknown[]): void { /* write + schedule(id) */ }

  setOptions<Id extends LayerId>(id: Id, patch: Partial<OptionsOf<Id>>): void { /* merge + schedule(id) */ }
}

// redraw scheduling: a Set and one rAF. Nothing more.
const pending = new Set<LayerId>();
function schedule(id: LayerId) {
  if (pending.size === 0 && typeof requestAnimationFrame !== "undefined")
    requestAnimationFrame(() => { const ids = [...pending]; pending.clear(); Layers.draw(...ids); });
  pending.add(id);
}

// module state: the active instance. Named for what it is; replaces the legacy `style` global
// when that retires.
let active: Style | undefined;
export const activeStyle = () => active;
export const setActiveStyle = (s: Style) => { active = s; };
