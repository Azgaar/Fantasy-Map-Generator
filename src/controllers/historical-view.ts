// The historical view: the map scrubbed to a past epoch. The states renderer reads
// pack.cells.state and pack.states, so a past is shown by swapping those two for the epoch's
// snapshot (lineage ids, remapped to compact state ids) and polity records, redrawing the
// political layers, and restoring the live pack exactly on the way back. The swap is wrapped:
// leave through goToPresent() whatever happened. See docs/plans/history-epochs.md (slice 4)

import { Layers } from "@/components/layers";
import { twLayerIds } from "@/conquest/ui/layers/index";
import type { State } from "@/generators/states-generator";
import { clearLegend, drawLegend, getLegendData, hasLegend, type LegendItem } from "@/renderers/draw-legend";
import type { Point } from "@/types/global";
import type { EpochPolity, HistoryEpoch } from "@/types/history";
import type { TypedArray } from "@/types/PackedGraph";
import { getAdjective } from "@/utils";

// a past is a read-only world: the truthy guard every editor opens with. Tools own 1-18
const PAST_VIEW = 100;
const PRESENT_LEGEND = "States";

interface Installation {
  states: State[];
  cellState: TypedArray;
  hadLegend: boolean;
  legendItems?: LegendItem[];
  pastLegend?: string;
  hidden: string[];
  world: string;
}

let installation: Installation | null = null;
let shownEpoch: number | null = null;

/** the map is currently showing a past epoch */
export const isInPast = (): boolean => Boolean(installation);

/** the epoch the map shows, or null in the present */
export const viewedEpoch = (): HistoryEpoch | null =>
  isInPast() ? (pack.history.epochs?.[shownEpoch ?? -1] ?? null) : null;

/** the years the slider spans: the first epoch's start through the present year */
export function scrubRange(): { min: number; max: number } | null {
  const { epochs } = pack.history;
  if (!epochs?.length || !pack.history.snapshots?.length) return null;
  return { min: epochs[0].from, max: options.map.lore.calendar.year };
}

/** move the map to the epoch the year belongs to; a year in the present returns the present */
export function scrubToYear(year: number): void {
  const epochs = pack.history.epochs;
  if (!epochs?.length) {
    goToPresent();
    return;
  }

  if (year >= options.map.lore.calendar.year) {
    goToPresent();
    return;
  }

  let index = 0;
  for (let i = 0; i < epochs.length; i++) if (epochs[i].from <= year) index = i;
  showEpoch(index);
}

/** show a past epoch (or move between epochs); refuses when the epoch has no snapshot */
export function showEpoch(index: number): void {
  const epoch = pack.history.epochs?.[index];
  if (!epoch || shownEpoch === index) return;

  const past = buildEpochPack(epoch);
  if (!past) {
    goToPresent();
    return;
  }

  try {
    if (!installation) installation = capturePresent();
    if (installation.pastLegend) clearLegend(installation.pastLegend);

    pack.cells.state = past.cellState;
    pack.states = past.states;
    customization = PAST_VIEW;
    hidePresentOnlyLayers();
    drawPastLegend(epoch);
    shownEpoch = index;
    Layers.draw("states", "borders", "labels");
  } catch (error) {
    restorePresent();
    throw error;
  }
}

/** leave the historical view; the live pack is restored exactly, whatever happened */
export function goToPresent(): void {
  const wasShown = Boolean(installation);
  restorePresent();
  if (wasShown) Layers.draw("states", "borders", "labels");
}

/** everything present-day politics puts on the map that a past must not wear */
function hidePresentOnlyLayers(): void {
  const candidates = ["emblems", "military", ...twLayerIds()];
  for (const id of candidates) {
    if (!Layers.has(id) || !Layers.isOn(id)) continue;
    installation!.hidden.push(id);
    Layers.hide(id);
  }
}

function capturePresent(): Installation {
  const hadLegend = hasLegend(PRESENT_LEGEND);
  return {
    states: pack.states,
    cellState: pack.cells.state,
    hadLegend,
    legendItems: hadLegend ? getLegendData(PRESENT_LEGEND) : undefined,
    hidden: [],
    world: worldToken()
  };
}

/** the pack pieces a past renders from: the remapped snapshot and the polity records */
function buildEpochPack(epoch: HistoryEpoch): { states: State[]; cellState: Uint16Array } | null {
  const snapshot = pack.history.snapshots?.[epoch.snapshot];
  if (!snapshot || snapshot.length !== pack.cells.i.length) return null;

  // the snapshot holds lineage ids; the renderers need compact state ids
  const remap = new Map<number, number>(epoch.polities.map((polity, index) => [polity.id, index + 1]));
  const cellState = new Uint16Array(snapshot.length);
  for (let i = 0; i < snapshot.length; i++) cellState[i] = remap.get(snapshot[i]) ?? 0;

  return { states: [neutral(), ...epoch.polities.map(toState)], cellState };
}

function neutral(): State {
  if (pack.states[0]) return { ...pack.states[0], i: 0 };
  return {
    i: 0,
    name: "Neutrals",
    expansionism: 0,
    capital: 0,
    type: "Generic",
    center: 0,
    culture: 0,
    coa: {} as State["coa"],
    salesTax: 0,
    pollTax: 0,
    treasury: 0
  };
}

function toState(polity: EpochPolity, index: number): State {
  const burg = pack.burgs[polity.capital];
  const center = burg?.cell ?? 0;
  const culture = burg?.culture ?? pack.cells.culture[center] ?? 0;
  const anchor = burg?.x !== undefined ? ([burg.x, burg.y] as Point) : pack.cells.p[center];
  return {
    i: index + 1,
    name: polity.name,
    formName: polity.form,
    fullName: fullNameOf(polity.name, polity.form),
    color: polity.color,
    capital: polity.capital,
    center,
    culture,
    pole: anchor ? ([anchor[0], anchor[1]] as Point) : undefined,
    cells: polity.cells,
    type: pack.cultures[culture]?.type ?? "Generic",
    expansionism: 1,
    coa: {} as State["coa"],
    salesTax: 0,
    pollTax: 0,
    treasury: 0
  };
}

// mirrors States.getFullName: adjective forms read "Nom Empire", the rest "Form of Nom"
const ADJECTIVAL_FORMS = new Set([
  "Empire",
  "Sultanate",
  "Khaganate",
  "Shogunate",
  "Caliphate",
  "Despotate",
  "Theocracy",
  "Oligarchy",
  "Union",
  "Confederation",
  "Trade Company",
  "League",
  "Tetrarchy",
  "Triumvirate",
  "Diarchy",
  "Horde",
  "Marches"
]);

function fullNameOf(name: string, formName: string): string {
  if (!formName) return name;
  if (!name) return `The ${formName}`;
  const adjectival = ADJECTIVAL_FORMS.has(formName) && !/[- ]/.test(name);
  return adjectival ? `${getAdjective(name)} ${formName}` : `${formName} of ${name}`;
}

/** the present States legend, if shown, is replaced by the epoch's polities */
function drawPastLegend(epoch: HistoryEpoch): void {
  const saved = installation!;
  if (saved.hadLegend && !saved.pastLegend) clearLegend(PRESENT_LEGEND);
  const items: LegendItem[] = epoch.polities
    .filter(polity => polity.cells > 0)
    .sort((a, b) => b.cells - a.cells)
    .map(polity => [polity.id, polity.color, polity.name]);
  if (!items.length) return;

  const name = `${PRESENT_LEGEND} · ${epoch.era}`;
  drawLegend(name, items);
  installation!.pastLegend = name;
}

function restorePresent(): void {
  const saved = installation;
  installation = null;
  shownEpoch = null;
  if (!saved) return;

  // a new world owns its own arrays: a stale restore would overwrite it
  if (saved.world === worldToken()) {
    pack.cells.state = saved.cellState;
    pack.states = saved.states;
  }
  for (const id of saved.hidden) Layers.show(id);
  if (saved.pastLegend) clearLegend(saved.pastLegend);
  if (saved.hadLegend && saved.legendItems) drawLegend(PRESENT_LEGEND, saved.legendItems);
  customization = 0;
}

/** which map the installation belongs to; a load or a generation changes it */
function worldToken(): string {
  const last = mapHistory.at(-1);
  return `${options.map.seed}:${last ? last.registeredAt : 0}`;
}
