// PROTOTYPE — shared context resolution for the Map Wheel. Data, not layout:
// every variant is free to present this however it likes.
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import { getPointer } from "@/utils";

export interface WheelAction {
  label: string;
  icon: string; // icon-* class from public/icons.css
  hint?: string;
  danger?: boolean;
  run: () => void;
}

export interface WheelTarget {
  kind: string; // "Burg", "State", "Cell"…
  id: number;
  name: string;
  subtitle: string;
  icon: string;
  actions: WheelAction[];
}

export interface WheelContext {
  screen: [number, number]; // client coords, where the menu opens
  map: [number, number]; // map coords under the cursor
  cellId: number;
  targets: WheelTarget[]; // most specific first; targets[0] is the primary
}

const stub =
  (what: string): (() => void) =>
  () =>
    tip(`PROTOTYPE: ${what} would run here`, true, "warn", 2500);

/** Resolve everything the click could plausibly be about, ordered most-specific first */
export function resolveContext(event: MouseEvent): WheelContext | null {
  const viewbox = document.getElementById("viewbox");
  if (!viewbox || !pack.cells?.p) return null;

  const map = getPointer(event, viewbox);
  const cellId = Pack.findCell(map[0], map[1]);
  if (cellId === undefined) return null;

  const targets: WheelTarget[] = [];
  const push = (target: WheelTarget | null) => target && targets.push(target);

  push(elementTarget(event.target as SVGElement | null));
  push(burgTarget(cellId));
  push(provinceTarget(cellId));
  push(stateTarget(cellId));
  push(marketTarget(cellId));
  push(riverTarget(cellId));
  push(cultureTarget(cellId));
  push(religionTarget(cellId));
  targets.push(cellTarget(cellId, map));

  return { screen: [event.clientX, event.clientY], map, cellId, targets };
}

/** Targets that only exist because a specific SVG element was hit (route, marker, label…) */
function elementTarget(target: SVGElement | null): WheelTarget | null {
  if (!target) return null;

  const label = target.closest<SVGTextElement>("#labels text[data-label-type]");
  if (label) {
    const id = Number(label.dataset.id);
    const type = String(label.dataset.labelType);
    return {
      kind: "Label",
      id,
      name: label.textContent || "Label",
      subtitle: `${type} label`,
      icon: "icon-font",
      actions: [
        { label: "Edit label", icon: "icon-edit", run: () => void Controllers.LabelsEditor.open(type as never, id) },
        { label: "Label groups", icon: "icon-list", run: () => void Controllers.LabelGroupsConfigurator.open() },
        { label: "All labels", icon: "icon-docs", run: () => void Controllers.LabelsOverview.open() },
        { label: "Remove label", icon: "icon-trash", danger: true, run: stub("remove label") }
      ]
    };
  }

  const parent = target.parentElement as SVGElement | null;
  const grand = parent?.parentElement as SVGElement | null;

  if (parent?.id === "rivers" || grand?.id === "rivers") {
    const id = Number(target.id.replace("river", ""));
    return {
      kind: "River",
      id,
      name: pack.rivers?.find(river => river.i === id)?.name || `River ${id}`,
      subtitle: "watercourse",
      icon: "icon-water",
      actions: [
        { label: "Edit river", icon: "icon-edit", run: () => void Controllers.RiverEditor.open(target.id) },
        { label: "All rivers", icon: "icon-docs", run: () => void Controllers.RiversOverview.open() },
        { label: "Elevation profile", icon: "icon-chart-line", run: stub("elevation profile") },
        { label: "Remove river", icon: "icon-trash", danger: true, run: stub("remove river") }
      ]
    };
  }

  if (grand?.id === "routes") {
    return {
      kind: "Route",
      id: 0,
      name: target.id || "Route",
      subtitle: parent?.id || "route",
      icon: "icon-route",
      actions: [
        { label: "Edit route", icon: "icon-edit", run: () => void Controllers.RouteEditor.open(target.id) },
        { label: "All routes", icon: "icon-docs", run: () => void Controllers.RoutesOverview.open() },
        { label: "Route groups", icon: "icon-list", run: () => void Controllers.RouteGroupsEditor.open() },
        { label: "Remove route", icon: "icon-trash", danger: true, run: stub("remove route") }
      ]
    };
  }

  if (grand?.id === "markers" || parent?.id === "markers") {
    return {
      kind: "Marker",
      id: 0,
      name: target.id || "Marker",
      subtitle: "map marker",
      icon: "icon-map-pin",
      actions: [
        { label: "Edit marker", icon: "icon-edit", run: () => void Controllers.MarkersEditor.open(undefined, target) },
        { label: "All markers", icon: "icon-docs", run: () => void Controllers.MarkersOverview.open() },
        { label: "In radius", icon: "icon-target", run: stub("markers in radius") },
        { label: "Remove marker", icon: "icon-trash", danger: true, run: stub("remove marker") }
      ]
    };
  }

  return null;
}

function burgTarget(cellId: number): WheelTarget | null {
  const id = pack.cells.burg[cellId];
  if (!id) return null;
  const burg = pack.burgs[id];

  return {
    kind: "Burg",
    id,
    name: burg.name || `Burg ${id}`,
    subtitle: `${burg.capital ? "capital" : burg.port ? "port" : "town"} · pop ${Math.round((burg.population || 0) * 1000)}`,
    icon: "icon-star",
    actions: [
      { label: "Edit burg", icon: "icon-edit", run: () => void Controllers.BurgEditor.open(id) },
      { label: "Production", icon: "icon-hammer", run: () => void Controllers.ProductionOverview.open(id) },
      { label: "Emblem", icon: "icon-coa", run: () => void Controllers.EmblemsEditor.open() },
      { label: "Compare prices", icon: "icon-balance-scale", run: () => void Controllers.ComparePrices.open() },
      { label: "All burgs", icon: "icon-docs", run: () => void Controllers.BurgsOverview.open() },
      { label: "Remove burg", icon: "icon-trash", danger: true, run: stub("remove burg") }
    ]
  };
}

function stateTarget(cellId: number): WheelTarget | null {
  const id = pack.cells.state[cellId];
  if (!id) return null;
  const state = pack.states[id];

  return {
    kind: "State",
    id,
    name: state.fullName || state.name,
    subtitle: `${state.form || "state"} · ${state.burgs || 0} burgs`,
    icon: "icon-flag",
    actions: [
      { label: "Edit states", icon: "icon-edit", run: () => void Controllers.StatesEditor.open() },
      { label: "Diplomacy", icon: "icon-handshake-o", run: () => void Controllers.DiplomacyEditor.open() },
      { label: "Military", icon: "icon-shield", run: () => void Controllers.MilitaryOverview.open() },
      { label: "Emblem", icon: "icon-coa", run: () => void Controllers.EmblemsEditor.open() },
      { label: "Charts", icon: "icon-chart-pie", run: () => void Controllers.ChartsOverview.open() },
      { label: "Recolor", icon: "icon-paint-bucket", run: stub("recolor state") }
    ]
  };
}

function provinceTarget(cellId: number): WheelTarget | null {
  const id = pack.cells.province[cellId];
  if (!id) return null;
  const province = pack.provinces[id];

  return {
    kind: "Province",
    id,
    name: province.fullName || province.name,
    subtitle: province.formName || "province",
    icon: "icon-map-o",
    actions: [
      { label: "Edit provinces", icon: "icon-edit", run: () => void Controllers.ProvincesEditor.open() },
      { label: "Emblem", icon: "icon-coa", run: () => void Controllers.EmblemsEditor.open() },
      { label: "Recolor", icon: "icon-paint-bucket", run: stub("recolor province") },
      { label: "Remove province", icon: "icon-trash", danger: true, run: stub("remove province") }
    ]
  };
}

function marketTarget(cellId: number): WheelTarget | null {
  const id = pack.cells.market?.[cellId];
  if (!id) return null;
  const market = pack.markets?.[id];
  const center = market && pack.burgs[market.centerBurgId];

  return {
    kind: "Market",
    id,
    name: center ? `${center.name} market` : `Market ${id}`,
    subtitle: "trade area",
    icon: "icon-exchange",
    actions: [
      { label: "Market overview", icon: "icon-eye", run: () => void Controllers.MarketOverview.open(id) },
      { label: "Deals", icon: "icon-list", run: () => void Controllers.MarketDealsOverview.open(id) },
      { label: "All markets", icon: "icon-docs", run: () => void Controllers.MarketsOverview.open() },
      { label: "Trade animation", icon: "icon-play", run: () => void Controllers.TradeAnimationEditor.open() }
    ]
  };
}

function riverTarget(cellId: number): WheelTarget | null {
  const id = pack.cells.r[cellId];
  if (!id) return null;

  return {
    kind: "River",
    id,
    name: pack.rivers?.find(river => river.i === id)?.name || `River ${id}`,
    subtitle: "flows through this cell",
    icon: "icon-water",
    actions: [
      { label: "Edit river", icon: "icon-edit", run: () => void Controllers.RiverEditor.open(`river${id}`) },
      { label: "All rivers", icon: "icon-docs", run: () => void Controllers.RiversOverview.open() }
    ]
  };
}

function cultureTarget(cellId: number): WheelTarget | null {
  const id = pack.cells.culture[cellId];
  if (!id) return null;

  return {
    kind: "Culture",
    id,
    name: pack.cultures[id]?.name || `Culture ${id}`,
    subtitle: "cultural area",
    icon: "icon-users",
    actions: [
      { label: "Edit cultures", icon: "icon-edit", run: () => void Controllers.CulturesEditor.open() },
      { label: "Namesbase", icon: "icon-font", run: () => void Controllers.NamesbaseEditor.open() },
      { label: "Recolor", icon: "icon-paint-bucket", run: stub("recolor culture") }
    ]
  };
}

function religionTarget(cellId: number): WheelTarget | null {
  const id = pack.cells.religion[cellId];
  if (!id) return null;

  return {
    kind: "Religion",
    id,
    name: pack.religions[id]?.name || `Religion ${id}`,
    subtitle: "religious area",
    icon: "icon-book",
    actions: [
      { label: "Edit religions", icon: "icon-edit", run: () => void Controllers.ReligionsEditor.open() },
      { label: "Recolor", icon: "icon-paint-bucket", run: stub("recolor religion") }
    ]
  };
}

function cellTarget(cellId: number, [x, y]: [number, number]): WheelTarget {
  const biome = pack.biomes[pack.cells.biome[cellId]]?.name || "unknown";
  const height = pack.cells.h[cellId];

  return {
    kind: "Cell",
    id: cellId,
    name: `Cell ${cellId}`,
    subtitle: `${biome} · h${height} · ${Math.round(x)},${Math.round(y)}`,
    icon: "icon-target",
    actions: [
      { label: "Cell details", icon: "icon-info-circled", run: () => void Controllers.CellInfo.open() },
      { label: "Add burg here", icon: "icon-star", run: stub("add burg here") },
      { label: "Add marker", icon: "icon-map-pin", run: stub("add marker here") },
      { label: "Add label", icon: "icon-font", run: stub("add label here") },
      { label: "Measure from here", icon: "icon-drafting-compass", run: () => void Controllers.MeasurersEditor.open() },
      { label: "Zoom to cell", icon: "icon-search", run: stub("zoom to cell") }
    ]
  };
}
