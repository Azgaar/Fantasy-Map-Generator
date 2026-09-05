// What a right-click on the map is about, and what can be done with it.
//
// A single point on the map belongs to many things at once — a burg sits in a province, in a
// state, in a market's catchment, in a culture, in a religion, in a biome, in a cell. The wheel
// can only have one subject at a time, so the ranking below decides which one, and the rest stay
// one hop away behind the hub.
//
// Subjects are ranked on three terms, in strict order of authority:
//
//  1. HIT      — how the point was matched. Clicking a burg icon is a statement of intent;
//                containing the point inside a state is an accident of geography.
//  2. VISIBLE  — whether the subject's layer is currently drawn. On the religions map a
//                right-click is about religion, even though the province is the smaller area.
//  3. EXTENT   — how tightly the subject bounds the point, measured in cells it actually covers.
//                A duchy beats the empire containing it; a two-cell theocracy beats the duchy.
//                Measured rather than assumed, so it stays right on maps with odd geography.
//
// Within a subject, actions are ordered by VERB (open the thing, look at it, add to it, change
// it), never by convenience. The verb order is fixed across every subject so the first sector is
// always "the thing you meant" and the ring's shape is learnable.
import { type LayerId, Layers } from "@/components/layers";
import { Controllers } from "@/controllers";
import { getPointer } from "@/utils";

export const VERBS = ["open", "inspect", "create", "modify"] as const;
export type Verb = (typeof VERBS)[number];

export interface WheelAction {
  label: string;
  icon: string; // icon-* class from public/icons.css
  verb: Verb;
  run: () => void;
}

export interface WheelSubject {
  kind: string; // "Burg", "Province", "Cell"…
  name: string;
  detail: string; // one line of identifying context, shown in the hub
  icon: string;
  rank: number;
  actions: WheelAction[];
}

export interface WheelContext {
  screen: [number, number]; // client coords: where the wheel opens
  map: [number, number]; // map coords under the cursor
  cellId: number;
  subjects: WheelSubject[]; // best first
}

type Hit = "direct" | "point" | "area" | "fallback";

// The three terms are scaled so each strictly outranks the next: no amount of specificity can
// promote an area over a direct hit, and no extent difference can outweigh a visible layer.
const HIT_WEIGHT: Record<Hit, number> = { direct: 30000, point: 20000, area: 10000, fallback: 0 };
const VISIBLE_BONUS = 5000;
const MAX_SPECIFICITY = 4999;

/** Everything the click could be about, best subject first */
export function resolveContext(event: MouseEvent): WheelContext | null {
  const viewbox = document.getElementById("viewbox");
  if (!viewbox || !pack.cells?.p) return null;

  const map = getPointer(event, viewbox);
  const cellId = Pack.findCell(map[0], map[1]);
  if (cellId === undefined) return null;

  const extents = measureExtents();
  const subjects = [
    ...directSubjects(event.target as SVGElement | null),
    ...pointSubjects(cellId),
    ...areaSubjects(cellId, extents),
    cellSubject(cellId, map)
  ];
  subjects.sort((a, b) => b.rank - a.rank);

  for (const subject of subjects) subject.actions.sort(byVerb);
  return { screen: [event.clientX, event.clientY], map, cellId, subjects };
}

const byVerb = (a: WheelAction, b: WheelAction): number => VERBS.indexOf(a.verb) - VERBS.indexOf(b.verb);

function rank(hit: Hit, layer: LayerId | null, specificity = MAX_SPECIFICITY): number {
  const visible = layer && Layers.isOn(layer) ? VISIBLE_BONUS : 0;
  return HIT_WEIGHT[hit] + visible + specificity;
}

// -- extent ------------------------------------------------------------------------------------
// Counted per open rather than cached: one pass over the cells is far cheaper than the risk of
// ranking a map by counts that an editor invalidated three actions ago.

interface Extents {
  land: number;
  state: Uint32Array;
  province: Uint32Array;
  culture: Uint32Array;
  religion: Uint32Array;
  biome: Uint32Array;
  market: Uint32Array;
}

function measureExtents(): Extents {
  const { cells, states, provinces, cultures, religions, biomes, markets } = pack;
  const extents: Extents = {
    land: 0,
    state: new Uint32Array(states.length),
    province: new Uint32Array(provinces.length),
    culture: new Uint32Array(cultures.length),
    religion: new Uint32Array(religions.length),
    biome: new Uint32Array(biomes.length),
    market: new Uint32Array(markets?.length || 0)
  };

  for (const i of cells.i) {
    if (cells.h[i] < 20) continue;
    extents.land++;
    extents.state[cells.state[i]]++;
    extents.province[cells.province[i]]++;
    extents.culture[cells.culture[i]]++;
    extents.religion[cells.religion[i]]++;
    extents.biome[cells.biome[i]]++;
    const marketId = cells.market?.[i];
    if (marketId) extents.market[marketId]++;
  }

  return extents;
}

/** Near-max for a subject covering a single cell, 0 for one covering the whole landmass */
function specificity(covered: number, land: number): number {
  if (!land) return 0;
  return Math.round((1 - Math.min(covered, land) / land) * MAX_SPECIFICITY);
}

// -- direct hits -------------------------------------------------------------------------------
// The user pointed at drawn geometry. Matched by selector against the layer groups so the rules
// stay readable next to the DOM they describe.

function directSubjects(target: SVGElement | null): WheelSubject[] {
  if (!target) return [];

  for (const match of DIRECT_MATCHERS) {
    const el = target.closest<SVGElement>(match.selector);
    if (el) {
      const subject = match.build(el, target);
      if (subject) return [subject];
    }
  }

  return [];
}

interface DirectMatcher {
  selector: string;
  build: (el: SVGElement, clicked: SVGElement) => WheelSubject | null;
}

const DIRECT_MATCHERS: DirectMatcher[] = [
  {
    selector: "#labels text[data-label-type]",
    build: el => {
      const id = Number(el.dataset.id);
      const type = String(el.dataset.labelType);
      return {
        kind: "Label",
        name: el.textContent?.replace(/\s+/g, " ").trim() || "Label",
        detail: `${type} label`,
        icon: "icon-font",
        rank: rank("direct", "labels"),
        actions: [
          {
            label: "Edit label",
            icon: "icon-edit",
            verb: "open",
            run: () => void Controllers.LabelsEditor.open(type as never, id)
          },
          {
            label: "All labels",
            icon: "icon-docs",
            verb: "inspect",
            run: () => void Controllers.LabelsOverview.open()
          },
          {
            label: "Label groups",
            icon: "icon-list",
            verb: "modify",
            run: () => void Controllers.LabelGroupsConfigurator.open()
          }
        ]
      };
    }
  },
  {
    selector: "#burgIcons use[data-id]",
    build: el => burgSubject(Number(el.dataset.id), "direct")
  },
  {
    selector: "#markers > svg",
    build: (el, clicked) => ({
      kind: "Marker",
      name: el.id || "Marker",
      detail: "map marker",
      icon: "icon-map-pin",
      rank: rank("direct", "markers"),
      actions: [
        {
          label: "Edit marker",
          icon: "icon-edit",
          verb: "open",
          run: () => void Controllers.MarkersEditor.open(undefined, clicked)
        },
        {
          label: "All markers",
          icon: "icon-docs",
          verb: "inspect",
          run: () => void Controllers.MarkersOverview.open()
        },
        { label: "Add marker", icon: "icon-plus", verb: "create", run: () => void Controllers.MarkerCreator.toggle() },
        {
          label: "Marker settings",
          icon: "icon-cog",
          verb: "modify",
          run: () => void Controllers.MarkersSettings.open()
        }
      ]
    })
  },
  {
    selector: "#routes path[id^=route]",
    build: el => ({
      kind: "Route",
      name: el.parentElement?.id ? `${el.parentElement.id} route` : "Route",
      detail: el.id,
      icon: "icon-route",
      rank: rank("direct", "routes"),
      actions: [
        { label: "Edit route", icon: "icon-edit", verb: "open", run: () => void Controllers.RouteEditor.open(el.id) },
        { label: "All routes", icon: "icon-docs", verb: "inspect", run: () => void Controllers.RoutesOverview.open() },
        { label: "Add route", icon: "icon-plus", verb: "create", run: () => void Controllers.RouteCreator.open() },
        {
          label: "Route groups",
          icon: "icon-list",
          verb: "modify",
          run: () => void Controllers.RouteGroupsEditor.open()
        }
      ]
    })
  },
  {
    selector: "#rivers path[id^=river]",
    build: el => riverSubject(Number(el.id.replace("river", "")), "direct")
  },
  {
    selector: "#armies g[id^=regiment]",
    build: el => ({
      kind: "Regiment",
      name: el.dataset.name || el.id,
      detail: `regiment of state ${el.dataset.state}`,
      icon: "icon-shield",
      rank: rank("direct", "military"),
      actions: [
        {
          label: "Edit regiment",
          icon: "icon-edit",
          verb: "open",
          run: () => void Controllers.RegimentEditor.open(`#${el.id}`)
        },
        { label: "Military", icon: "icon-docs", verb: "inspect", run: () => void Controllers.MilitaryOverview.open() }
      ]
    })
  },
  {
    selector: "#journeys g[id^=journey]",
    build: el => ({
      kind: "Journey",
      name: el.dataset.name || el.id,
      detail: "journey route",
      icon: "icon-drafting-compass",
      rank: rank("direct", "journeys"),
      actions: [
        {
          label: "Edit journey",
          icon: "icon-edit",
          verb: "open",
          run: () => void Controllers.JourneyEditor.open(Number(el.id.replace("journey", "")))
        },
        {
          label: "All journeys",
          icon: "icon-docs",
          verb: "inspect",
          run: () => void Controllers.JourneysOverview.open()
        }
      ]
    })
  },
  {
    selector: "#lakes > g > *",
    build: el => ({
      kind: "Lake",
      name: el.dataset.name || "Lake",
      detail: `${el.parentElement?.id || "lake"} water body`,
      icon: "icon-water",
      rank: rank("direct", "lakes"),
      actions: [
        { label: "Edit lake", icon: "icon-edit", verb: "open", run: () => void Controllers.LakesEditor.open(el) },
        {
          label: "Cell details",
          icon: "icon-info-circled",
          verb: "inspect",
          run: () => void Controllers.CellInfo.open()
        }
      ]
    })
  },
  {
    selector: "#coastline > g > *",
    build: el => ({
      kind: "Coastline",
      name: el.parentElement?.id === "lake_island" ? "Lake island" : "Coast",
      detail: "coastline vertex",
      icon: "icon-anchor",
      rank: rank("direct", "coastline"),
      actions: [
        {
          label: "Edit coastline",
          icon: "icon-edit",
          verb: "open",
          run: () => void Controllers.CoastlineVertexEditor.open(el)
        },
        {
          label: "Coastline settings",
          icon: "icon-cog",
          verb: "modify",
          run: () => void Controllers.CoastlineEditor.open()
        }
      ]
    })
  }
];

// -- point subjects ----------------------------------------------------------------------------

function pointSubjects(cellId: number): WheelSubject[] {
  const burg = burgSubject(pack.cells.burg[cellId], "point");
  return burg ? [burg] : [];
}

function burgSubject(id: number, hit: Hit): WheelSubject | null {
  if (!id) return null;
  const burg = pack.burgs[id];
  if (!burg || burg.removed) return null;

  const kind = burg.capital ? "capital" : burg.port ? "port" : "town";
  return {
    kind: "Burg",
    name: burg.name || `Burg ${id}`,
    detail: `${kind} · ${Math.round((burg.population || 0) * 1000).toLocaleString()} people`,
    icon: "icon-star",
    rank: rank(hit, "burgIcons"),
    actions: [
      { label: "Edit burg", icon: "icon-edit", verb: "open", run: () => void Controllers.BurgEditor.open(id) },
      {
        label: "Production",
        icon: "icon-hammer",
        verb: "inspect",
        run: () => void Controllers.ProductionOverview.open(id)
      },
      {
        label: "Compare prices",
        icon: "icon-balance-scale",
        verb: "inspect",
        run: () => void Controllers.ComparePrices.open()
      },
      { label: "All burgs", icon: "icon-docs", verb: "inspect", run: () => void Controllers.BurgsOverview.open() },
      {
        label: "Emblem",
        icon: "icon-coa",
        verb: "modify",
        run: () => void Controllers.EmblemsEditor.open("burg", `burgCoA${id}`)
      }
    ]
  };
}

function riverSubject(id: number, hit: Hit): WheelSubject | null {
  if (!id) return null;
  const river = pack.rivers?.find(candidate => candidate.i === id);

  return {
    kind: "River",
    name: river?.name || `River ${id}`,
    detail: river?.type || "watercourse",
    icon: "icon-water",
    rank: rank(hit, "rivers"),
    actions: [
      {
        label: "Edit river",
        icon: "icon-edit",
        verb: "open",
        run: () => void Controllers.RiverEditor.open(`river${id}`)
      },
      { label: "All rivers", icon: "icon-docs", verb: "inspect", run: () => void Controllers.RiversOverview.open() },
      { label: "Add river", icon: "icon-plus", verb: "create", run: () => void Controllers.RiverAutoCreator.toggle() }
    ]
  };
}

// -- area subjects -----------------------------------------------------------------------------

function areaSubjects(cellId: number, extents: Extents): WheelSubject[] {
  const { cells } = pack;
  const subjects: WheelSubject[] = [];
  const add = (subject: WheelSubject | null) => subject && subjects.push(subject);

  const provinceId = cells.province[cellId];
  if (provinceId) {
    const province = pack.provinces[provinceId];
    add({
      kind: "Province",
      name: province.fullName || province.name,
      detail: `${province.formName || "province"} · ${extents.province[provinceId]} cells`,
      icon: "icon-map-o",
      rank: rank("area", "provinces", specificity(extents.province[provinceId], extents.land)),
      actions: [
        {
          label: "Edit provinces",
          icon: "icon-edit",
          verb: "open",
          run: () => void Controllers.ProvincesEditor.open()
        },
        { label: "Charts", icon: "icon-chart-pie", verb: "inspect", run: () => void Controllers.ChartsOverview.open() },
        {
          label: "Emblem",
          icon: "icon-coa",
          verb: "modify",
          run: () => void Controllers.EmblemsEditor.open("province", `provinceCoA${provinceId}`)
        }
      ]
    });
  }

  const stateId = cells.state[cellId];
  if (stateId) {
    const state = pack.states[stateId];
    add({
      kind: "State",
      name: state.fullName || state.name,
      detail: `${state.form || "state"} · ${extents.state[stateId]} cells`,
      icon: "icon-flag",
      rank: rank("area", "states", specificity(extents.state[stateId], extents.land)),
      actions: [
        { label: "Edit states", icon: "icon-edit", verb: "open", run: () => void Controllers.StatesEditor.open() },
        {
          label: "Diplomacy",
          icon: "icon-handshake-o",
          verb: "inspect",
          run: () => void Controllers.DiplomacyEditor.open()
        },
        {
          label: "Military",
          icon: "icon-shield",
          verb: "inspect",
          run: () => void Controllers.MilitaryOverview.open()
        },
        { label: "Charts", icon: "icon-chart-pie", verb: "inspect", run: () => void Controllers.ChartsOverview.open() },
        {
          label: "Emblem",
          icon: "icon-coa",
          verb: "modify",
          run: () => void Controllers.EmblemsEditor.open("state", `stateCoA${stateId}`)
        }
      ]
    });
  }

  const marketId = cells.market?.[cellId];
  if (marketId) {
    const market = pack.markets?.[marketId];
    const centre = market && pack.burgs[market.centerBurgId];
    add({
      kind: "Market",
      name: centre ? `${centre.name} market` : `Market ${marketId}`,
      detail: "trade catchment",
      icon: "icon-exchange",
      rank: rank("area", "markets", specificity(extents.market[marketId] || 0, extents.land)),
      actions: [
        { label: "Market", icon: "icon-eye", verb: "open", run: () => void Controllers.MarketOverview.open(marketId) },
        {
          label: "Deals",
          icon: "icon-list",
          verb: "inspect",
          run: () => void Controllers.MarketDealsOverview.open(marketId)
        },
        {
          label: "All markets",
          icon: "icon-docs",
          verb: "inspect",
          run: () => void Controllers.MarketsOverview.open()
        },
        {
          label: "Trade animation",
          icon: "icon-play",
          verb: "modify",
          run: () => void Controllers.TradeAnimationEditor.open()
        }
      ]
    });
  }

  const cultureId = cells.culture[cellId];
  if (cultureId) {
    add({
      kind: "Culture",
      name: pack.cultures[cultureId]?.name || `Culture ${cultureId}`,
      detail: `${extents.culture[cultureId]} cells`,
      icon: "icon-users",
      rank: rank("area", "cultures", specificity(extents.culture[cultureId], extents.land)),
      actions: [
        { label: "Edit cultures", icon: "icon-edit", verb: "open", run: () => void Controllers.CulturesEditor.open() },
        { label: "Charts", icon: "icon-chart-pie", verb: "inspect", run: () => void Controllers.ChartsOverview.open() },
        { label: "Namesbase", icon: "icon-font", verb: "modify", run: () => void Controllers.NamesbaseEditor.open() }
      ]
    });
  }

  const religionId = cells.religion[cellId];
  if (religionId) {
    add({
      kind: "Religion",
      name: pack.religions[religionId]?.name || `Religion ${religionId}`,
      detail: `${extents.religion[religionId]} cells`,
      icon: "icon-book",
      rank: rank("area", "religions", specificity(extents.religion[religionId], extents.land)),
      actions: [
        {
          label: "Edit religions",
          icon: "icon-edit",
          verb: "open",
          run: () => void Controllers.ReligionsEditor.open()
        },
        { label: "Charts", icon: "icon-chart-pie", verb: "inspect", run: () => void Controllers.ChartsOverview.open() }
      ]
    });
  }

  const biomeId = cells.biome[cellId];
  if (biomeId) {
    add({
      kind: "Biome",
      name: pack.biomes[biomeId]?.name || `Biome ${biomeId}`,
      detail: `${extents.biome[biomeId]} cells`,
      icon: "icon-tree",
      rank: rank("area", "biomes", specificity(extents.biome[biomeId], extents.land)),
      actions: [
        { label: "Edit biomes", icon: "icon-edit", verb: "open", run: () => void Controllers.BiomesEditor.open() },
        { label: "Charts", icon: "icon-chart-pie", verb: "inspect", run: () => void Controllers.ChartsOverview.open() }
      ]
    });
  }

  const riverId = cells.r[cellId];
  add(riverSubject(riverId, "area"));

  return subjects;
}

// -- the cell itself ---------------------------------------------------------------------------
// Always present, always last: the one subject that exists for every point on the map, and the
// only place actions that are about the *location* rather than about a thing belong.

function cellSubject(cellId: number, [x, y]: [number, number]): WheelSubject {
  const biome = pack.biomes[pack.cells.biome[cellId]]?.name || "unknown";

  return {
    kind: "Cell",
    name: `Cell ${cellId}`,
    detail: `${biome} · ${Math.round(x)}, ${Math.round(y)}`,
    icon: "icon-target",
    rank: rank("fallback", null, 0),
    actions: [
      { label: "Cell details", icon: "icon-info-circled", verb: "open", run: () => void Controllers.CellInfo.open() },
      { label: "Zoom here", icon: "icon-search", verb: "inspect", run: () => zoomTo(x, y, 8, 800) },
      { label: "Add burg", icon: "icon-star", verb: "create", run: () => void Controllers.BurgCreator.toggle() },
      { label: "Add marker", icon: "icon-map-pin", verb: "create", run: () => void Controllers.MarkerCreator.toggle() },
      { label: "Add label", icon: "icon-font", verb: "create", run: () => void Controllers.LabelCreator.toggle() },
      {
        label: "Measure",
        icon: "icon-drafting-compass",
        verb: "create",
        run: () => void Controllers.MeasurersEditor.open()
      },
      { label: "Zones", icon: "icon-map-o", verb: "modify", run: () => void Controllers.ZonesEditor.open() }
    ]
  };
}
