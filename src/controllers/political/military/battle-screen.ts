import { select, sum } from "d3";
import { BATTLE_ORDER_LABELS, BATTLE_TACTIC_LABELS, BATTLE_TYPE_LABELS } from "@/data/id-labels";
import { Pack } from "@/model/graph/pack-generator";
import { Icons } from "@/model/icons";
import {
  applyDue,
  type Battle,
  type BattleRegiment,
  type Block,
  createBattle,
  getCaptured,
  getFortune,
  getLosses,
  getResult,
  getTroops,
  getUnitsPower,
  type Intervention,
  intervene,
  isWithdrawn,
  type LogEntry,
  plan,
  prepare,
  ROUND_TICKS,
  tick
} from "@/model/political/battle/battle";
import {
  BATTLE_TYPES,
  type BattleType,
  COMMANDS,
  type Command,
  getBattleName,
  getRegimentStatus,
  getTypeName,
  SIDES,
  type Side
} from "@/model/political/battle/battle-rules";
import { formatClock } from "@/model/political/battle/battle-scale";
import { createEmptyBattlefield, createMapField, type WorkKind } from "@/model/political/battle/battlefield";
import { getOrder, isDugIn } from "@/model/political/battle/general";
import { mayBuild } from "@/model/political/battle/works";
import type { Regiment } from "@/model/political/military-generator";
import { Military } from "@/model/political/military-generator";
import { getUnitPower } from "@/model/political/military-units";
import { Stability } from "@/model/political/stability";
import { Names } from "@/model/society/names-generator";
import type { Marker } from "@/model/story/markers-generator";
import { formatLength, getLengthUnit } from "@/model/units";
import {
  drawBattlefield,
  drawBlocks,
  type Positions,
  SIDE_COLORS,
  snapshot,
  updateBlocks
} from "@/renderers/draw-battle-scene";
import { moveRegiment } from "@/renderers/draw-military";
import { EmblemRenderer } from "@/renderers/emblems/renderer";
import { Layers } from "@/renderers/layers";
import { viewport } from "@/renderers/viewport/viewport";
import { Dialog } from "@/ui/dialog/dialog";
import { applySorting, applySortingByHeader } from "@/ui/dialog/sorting";
import { tip } from "@/ui/tooltips";
import { last } from "@/utils/array-utils";
import { wiki } from "@/utils/common-utils";
import { createFileInput, downloadFile, uploadFile } from "@/utils/file-utils";
import { sentences, t } from "@/utils/i18n";
import { getAdjective, list } from "@/utils/language-utils";
import { ensureEl, findEl } from "@/utils/node-utils";
import { rn, si } from "@/utils/number-utils";
import { capitalize, escapeHtml } from "@/utils/string-utils";
import { BattleAnimation, type BattleStart, getPlayback, SPEEDS } from "./battle-animation";

const TICK_MS = 160; // a tick at normal speed: fifty times as fast as the battle
const LOG_VERSION = 2;

interface BattleLogFile {
  version: number;
  name: string;
  type: BattleType;
  attackers: { state: number; i: number }[];
  defenders: { state: number; i: number }[];
  interventions: Intervention[];
  log: string[];
  result: string | null;
}

let battle: Battle | null = null;
let regiments = new Map<string, Regiment>(); // the map's regiments in the battle, by state and id
let script: Intervention[] = []; // changes of a loaded log still to come
let fileInput: HTMLInputElement | null = null;

const player = { playing: false, speed: 1, frame: 0, tickStart: 0, previous: null as Positions | null };
let planning = 0; // timer of the generals' thinking the battle through

const regimentKey = (regiment: { state: number; i: number }): string => `${regiment.state}-${regiment.i}`;
const scene = (): SVGSVGElement => document.getElementById("battleScene") as unknown as SVGSVGElement;

function open(attacker: Regiment, defender: Regiment): void {
  if (options.app.mode) return;
  Dialog.closeAll(".stable");
  options.app.mode = "battle"; // an edit mode keeps other dialogs from opening

  renderDialog();
  regiments = new Map([attacker, defender].map(regiment => [regimentKey(regiment), regiment]));
  script = [];
  setup([attacker], [defender]);

  Dialog.open("battleScreen", {
    title: battle!.name,
    width: viewport.width * SCREEN_SHARE * 0.6, // a guess: fitDialog sets the size
    height: viewport.height * SCREEN_SHARE,
    minWidth: 320,
    minHeight: 320,
    position: POSITION,
    resizable: true,
    onClose: cancelResults
  });
  fitDialog();
  tip(
    t("Drag troops to change the deployment, double-click one to turn it, then start the battle"),
    true,
    "info",
    8000
  );
}

const SCREEN_SHARE = 0.92; // of the viewport the window may take
const SPARE = 2; // em left under the army sheets
const FIELD_WIDTH = 77; // em the battlefield opens at, at most: the window can be dragged larger
const POSITION = { my: "center", at: "center", of: "svg" };

/** Size the window by what really stands around the battlefield: as large a plan as the screen has room for */
function fitDialog(): void {
  const frame = ensureEl("battleScreen").closest<HTMLElement>(".dialog-window")!;
  const layout = ensureEl("battleLayout");
  const stage = ensureEl("battleStage");
  const { width, height } = frame.getBoundingClientRect();
  const style = getComputedStyle(layout);
  const content =
    layout.lastElementChild!.getBoundingClientRect().bottom - layout.firstElementChild!.getBoundingClientRect().top;
  const em = parseFloat(style.fontSize) || 12;
  const aroundX = width - stage.offsetWidth;
  const aroundY = height - layout.clientHeight + content - stage.offsetHeight + SPARE * em;
  const maxHeight = viewport.height * SCREEN_SHARE;
  const room = Math.min(viewport.width * SCREEN_SHARE - aroundX, (maxHeight - aroundY) * (5 / 3), FIELD_WIDTH * em);
  const field = Math.max(Math.floor(room / 5) * 5, 300); // a whole number of pixels both ways
  Dialog.update("battleScreen", {
    width: field + aroundX - (width - frame.clientWidth),
    height: Math.min(field * 0.6 + aroundY, maxHeight),
    position: POSITION
  });
}

/** A new battle of the regiments; `from` carries over the settings of a loaded log */
function setup(
  attackers: Regiment[],
  defenders: Regiment[],
  from?: Partial<Pick<BattleLogFile, "type" | "name">>
): void {
  const defender = defenders[0];
  const attacker = attackers[0];
  const { x, y } = battle ?? defender;
  const cell = Pack.findCell(x, y) ?? 0;
  const type = from?.type ?? defineType(attacker, defender, cell);
  const place = definePlace(cell);
  const point = { x, y };

  battle = createBattle({
    type,
    name: from?.name ?? battle?.name ?? getBattleName(type, place),
    place,
    x,
    y,
    cell,
    axis: Math.atan2(y - (attacker.py ?? attacker.y), x - (attacker.px ?? attacker.x)),
    field: buildField(x, y, type),
    units: options.map.military.units,
    populationScale: options.map.units.population.scale,
    attackers: attackers.map(regiment => toBattleRegiment(regiment, point)),
    defenders: defenders.map(regiment => toBattleRegiment(regiment, point))
  });

  player.previous = null;
  drawBattlefield(scene(), battle.field);
  drawScene();
  ensureEl("battleLogList").innerHTML = "";
  refresh();
}

function buildField(x: number, y: number, type: BattleType) {
  if (type === "naval") return createEmptyBattlefield("sea");
  if (type === "air") return createEmptyBattlefield("sky");
  return createMapField(x, y); // built to the scale of the battalions
}

function toBattleRegiment(regiment: Regiment, point: { x: number; y: number }): BattleRegiment {
  const distance = Math.hypot(point.y - regiment.by, point.x - regiment.bx) * options.map.units.distance.scale;
  return {
    state: regiment.state,
    i: regiment.i,
    name: regiment.name,
    icon: regiment.icon ?? "",
    troops: Object.fromEntries(Object.entries(regiment.u).map(([unit, points]) => [unit, Military.getTroops(points)])),
    upkeep: Military.getBattleUpkeep(regiment.state), // ill-kept troops fight weaker
    stability: Stability.get(regiment.state)?.stability ?? 0.5,
    distance: distance | 0
  };
}

const AMBUSH_ODDS = 0.75; // defenders weaker than that lie in ambush where the ground hides them

function defineType(attacker: Regiment, defender: Regiment, cell: number): BattleType {
  const types = (regiment: Regiment): (string | undefined)[] =>
    Object.keys(regiment.u).map(name => options.map.military.units.find(u => u.name === name)?.type);
  const typesA = types(attacker);
  const burg = pack.burgs[pack.cells.burg[cell]];

  if (attacker.n && defender.n) return "naval";
  if (typesA.every(type => type === "aviation") && types(defender).every(type => type === "aviation")) return "air";
  if (attacker.n && !defender.n && typesA.some(type => type !== "naval")) return "landing";
  if (!defender.n && (burg?.walls || burg?.citadel)) return "siege";
  // as the ribbon above the plan counts it
  const power = (regiment: Regiment): number =>
    sum(options.map.military.units, unit => (regiment.u[unit.name] ?? 0) * getUnitPower(unit)) *
    Military.getBattleUpkeep(regiment.state);
  const hidden = [5, 6, 7, 8, 9, 12].includes(pack.cells.biome[cell]); // forest or marsh
  if (hidden && power(defender) < power(attacker) * AMBUSH_ODDS) return "ambush";
  return "field";
}

function definePlace(cell: number): string | null {
  const { cells } = pack;
  if (cells.burg[cell]) return pack.burgs[cells.burg[cell]].name ?? null;
  const river = cells.r[cell] && pack.rivers.find(river => river.i === cells.r[cell]);
  if (river) return `${river.name} ${river.type}`;
  return Names.getCulture(cells.culture[cell]);
}

const STYLE = /* css */ `
  #battleScreen { overflow: hidden; container: battle / size; }
  /* top to bottom: who fights whom, the battlefield, the controls, the armies; scrolls when the armies outgrow the window */
  #battleLayout { --line: #ccc; --muted: #666; --loss: #c5221f; display: flex; flex-direction: column; gap: 0.5em; box-sizing: border-box; width: auto; height: 100%; overflow-y: auto; }
  #battleLayout > * { flex: none; }
  #battleLayout [hidden] { display: none !important; }
  #battleLayout .attackers { --side: ${SIDE_COLORS.attackers}; }
  #battleLayout .defenders { --side: ${SIDE_COLORS.defenders}; }
  #battleLayout button { white-space: nowrap; }
  .battleGroup { display: inline-flex; }

  /* a button that opens a list of named choices, upward: the pickers stand low in the window */
  .battlePicker { position: relative; display: inline-block; }
  .battlePicker > button::before, .battleMenu > button::before { margin-right: 0.3em; }
  .battlePicker > button:not(:disabled)::after { content: "▾"; margin-left: 0.4em; }
  .battleMenu { position: absolute; bottom: 100%; left: 0; z-index: 5; display: flex; flex-direction: column; min-width: 100%; border: 1px solid #999; background: #fff; }
  #battleLayout .battleMenu > button { padding: 0.3em 0.9em 0.3em 0.5em; border: 0; border-radius: 0; background: none; text-align: left; }
  #battleLayout .battleMenu > button:hover { background: #eee; }
  #battleLayout .battleMenu > button.current { font-weight: bold; }

  /* who fights whom, and how the scales stand */
  #battleHeader { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 0.3em 0.8em; margin-bottom: -0.5em; padding: 0.3em 0.6em; background: linear-gradient(150deg, transparent, ${SIDE_COLORS.attackers}30 20%, transparent 45%, transparent 55%, ${SIDE_COLORS.defenders}30 80%, transparent); }
  .battleBanner { display: flex; align-items: center; gap: 0.7em; width: 100%; max-width: 30em; min-width: 0; }
  .battleBanner.defenders { justify-self: end; }
  .battleBanner.defenders, .battleBanner.defenders .battleBannerText > span { flex-direction: row-reverse; }
  .battleBanner.defenders .battleStates { text-align: right; }
  .battleEmblems { display: flex; flex-shrink: 0; }
  .battleEmblems > svg { width: 3.2em; height: 3.2em; }
  .battleEmblems > svg + svg { margin-left: -1.9em; }
  .battleBannerText { display: flex; flex: 1; flex-direction: column; gap: 0.2em; min-width: 0; }
  .battleBannerText > span { display: flex; align-items: center; gap: 0.6em; }
  .battleBannerText .battleBar { flex: 1; }
  .battleStates { flex: 1; min-width: 0; overflow: hidden; font-size: 1.2em; text-overflow: ellipsis; white-space: nowrap; }
  .battleTroops { display: inline-flex; align-items: baseline; gap: 0.4em; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .battleCount > b { font-size: 1.2em; }
  .battleCount > span { color: var(--muted); }
  .battleLost { color: var(--loss); font-style: italic; }
  .battleCaptured { color: var(--muted); font-style: italic; white-space: nowrap; }
  .battleCaptured:empty::before { display: none; }
  .battleBar { height: 0.5em; border: 1px solid #999; border-radius: 0.3em; overflow: hidden; }
  .battleBar > i { display: block; height: 100%; background: #3f9b3f; transition: width 0.15s linear; }
  .battleBar.mid > i { background: #e0a920; }
  .battleBar.low > i { background: var(--loss); }
  /* the side's order, or its tactic before the start: a chip in the side's colour */
  #battleLayout .battleOrdersButton { flex: none; max-width: 14em; padding: 0.1em 0.6em; border: 1px solid color-mix(in srgb, var(--side) 45%, transparent); border-radius: 1em; background: color-mix(in srgb, var(--side) 10%, #fff); color: #333; cursor: pointer; }
  #battleLayout .battleOrdersButton:hover { border-color: var(--side); background: color-mix(in srgb, var(--side) 20%, #fff); }
  .battleOrder { display: block; overflow: hidden; text-overflow: ellipsis; }
  #battleTitle { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.7em; min-width: 0; }
  #battleTitle > div { display: flex; flex-direction: column; align-items: center; gap: 0.25em; min-width: 0; }
  /* the die of the round, in the side's colour: a click turns it to the next face */
  .battleDie { width: 3em; height: 3em; cursor: pointer; }
  .battleDie > rect { fill: var(--side); }
  .battleDie > circle { fill: #fff; }
  .battleDie:hover > rect { stroke: #333; }
  #battleName { position: relative; width: 16em; max-width: 100%; }
  #battleNameFull { width: 100%; padding: 0 0.4em; border-color: transparent; background: none; font-size: 1.15em; font-weight: bold; text-align: center; text-overflow: ellipsis; }
  #battleNameFull:hover, #battleNameFull:focus { border-color: #abadb3; background: #fff; }
  #battleNameTools { position: absolute; top: 0; right: 0; bottom: 0; display: none; background: #fff; }
  #battleName:hover > #battleNameTools, #battleName:focus-within > #battleNameTools { display: flex; }

  /* the scales: the power of each side, as its share of the ribbon */
  #battleBalance { position: relative; display: flex; width: clamp(11em, 22cqw, 16em); height: 1.6em; color: #fff; font-weight: bold; font-variant-numeric: tabular-nums; }
  #battleBalance > i { display: flex; align-items: center; min-width: 4.2em; padding: 0 0.7em 0 1.2em; box-sizing: border-box; background: ${SIDE_COLORS.attackers}; font-style: normal; clip-path: polygon(0.7em 0, 100% 0, 100% 100%, 0.7em 100%, 0 50%); transition: width 0.25s ease-out; }
  #battleBalance > i + i { flex: 1; justify-content: flex-end; padding: 0 1.2em 0 0.7em; background: ${SIDE_COLORS.defenders}; clip-path: polygon(0 0, calc(100% - 0.7em) 0, 100% 50%, calc(100% - 0.7em) 100%, 0 100%); }
  #battleBalance > b { position: absolute; top: 50%; left: var(--at, 50%); width: 0.75em; height: 0.75em; border: 1px solid #333; background: #fff; transform: translate(-50%, -50%) rotate(45deg); transition: left 0.25s ease-out; }

  /* the battlefield: as wide as the window, in the plan's shape */
  #battleStage { position: relative; aspect-ratio: 5 / 3; margin: 1px; outline: 1px solid #999; overflow: hidden; }
  #battleScene { display: block; width: 100%; height: 100%; font-family: var(--serif); }
  #battleScene.battleEditable .battleBlock { cursor: grab; }
  #battleScene.battlePlanning .battleBlocks { display: none; }
  #battleScene.battleFocus .battleBlock:not(.battleFocused) { opacity: 0.3; }
  #battleLog { position: absolute; top: 0; right: 0; bottom: 0; display: flex; flex-direction: column; width: 21em; max-width: 100%; border-left: 1px solid #999; background: #fffffff0; }
  #battleLog > header { display: flex; align-items: center; gap: 0.2em; padding: 0.3em 0.3em 0.3em 0.6em; border-bottom: 1px solid var(--line); }
  #battleLog > header > b { flex: 1; }
  #battleLogList { flex: 1; padding: 0.3em 0.6em; overflow-y: auto; line-height: 1.4; user-select: text; }
  #battleLogList > div { display: grid; grid-template-columns: 2.6em 0.6em minmax(0, 1fr); gap: 0.4em; align-items: baseline; }
  #battleLogList > div > i { color: var(--muted); font-style: normal; font-variant-numeric: tabular-nums; text-align: right; }
  #battleLogList > div > u { width: 0.6em; height: 0.6em; background: var(--side, transparent); }
  #battleLogList > div.order { color: var(--muted); }
  #battleLogList > div.start, #battleLogList > div.end { font-weight: bold; }

  /* the end of the battle, over the field: who won and at what cost */
  #battleSummary { position: absolute; inset: 0; z-index: 3; display: flex; padding: 0.8em; overflow-y: auto; background: #000000a0; animation: battleSummaryFade 0.3s ease-out; }
  #battleSummary > div { --side: #666; position: relative; display: flex; flex-direction: column; gap: 0.6em; width: min(44em, 100%); margin: auto; padding: 0.8em 1em 1em; box-sizing: border-box; border-top: 4px solid var(--side); background: #fff; box-shadow: 0 0.4em 2em #000a; animation: battleSummaryRise 0.35s ease-out; }
  #battleSummary > div > header { text-align: center; }
  #battleSummary h2 { margin: 0.1em 0; color: var(--side); font-family: var(--serif); font-size: 2.2em; letter-spacing: 0.08em; text-transform: uppercase; }
  #battleSummary h2 + span, .battleSummaryKicker { color: var(--muted); }
  .battleSummaryKicker { font-family: var(--serif); font-size: 1.1em; }
  .battleSummaryClose { position: absolute; top: 0.4em; right: 0.4em; }
  .battleSummarySides { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0.8em; }
  .battleSummarySide { display: flex; flex-direction: column; gap: 0.4em; min-width: 0; padding: 0.5em 0.6em; border: 1px solid var(--line); border-top: 3px solid var(--side); }
  .battleSummarySide.won { background: color-mix(in srgb, var(--side) 8%, #fff); }
  .battleSummarySide > header { display: flex; align-items: center; gap: 0.6em; min-width: 0; }
  .battleSummarySide > header > span:last-child { display: flex; flex-direction: column; min-width: 0; }
  .battleSummarySide > header b { overflow: hidden; font-size: 1.15em; text-overflow: ellipsis; white-space: nowrap; }
  .battleSummarySide > header i { color: var(--side); font-style: normal; font-weight: bold; }
  .battleSummaryStats { display: grid; grid-auto-flow: column; grid-template-rows: auto auto; gap: 0 0.6em; text-align: center; font-variant-numeric: tabular-nums; }
  .battleSummaryStats > span { color: var(--muted); font-size: 0.9em; }
  .battleSummaryStats > b { font-size: 1.3em; }
  .battleSummaryUnits { display: grid; grid-template-columns: 1.3em minmax(0, 1fr) auto auto; gap: 0.1em 0.6em; align-items: center; padding-top: 0.3em; border-top: 1px solid var(--line); font-variant-numeric: tabular-nums; }
  .battleSummaryUnits.withCaptured { grid-template-columns: 1.3em minmax(0, 1fr) auto auto auto; }
  .battleSummaryUnits > .n { text-align: right; }
  .battleSummaryUnits > .head { color: var(--muted); font-size: 0.9em; }
  #battleSummary > div > footer { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.4em; }
  #battleSummary > div > footer > button { min-width: 10em; height: 2em; }
  @keyframes battleSummaryFade { from { opacity: 0; } }
  @keyframes battleSummaryRise { from { opacity: 0; transform: translateY(1.5em) scale(0.96); } }

  #battleFooter { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.4em 1em; }
  #battleFooter > div { display: flex; align-items: center; gap: 0.3em; min-width: 0; }
  #battleFooter button { height: 2em; box-sizing: border-box; } /* one height, whatever the icon */
  #battleRun, #battleResultRestart { min-width: 10em; }
  #battleRun.battlePause::before { content: "❚❚"; margin-right: 0.5em; font-size: 0.7em; vertical-align: 0.15em; }
  #battleSpeed { margin: 0 0.5em; }
  #battleClock { font-variant-numeric: tabular-nums; white-space: nowrap; }
  #battleFieldSize { color: var(--muted); white-space: nowrap; }

  /* army sheets: the orders of each side and its regiments */
  #battleSides { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; gap: 0.8em; }
  .battleSide { display: flex; flex-direction: column; gap: 0.3em; min-width: 0; padding: 0.4em 0.6em; border: 1px solid var(--line); border-top: 3px solid var(--side); }
  .battleSectionHead { display: flex; align-items: center; justify-content: space-between; }
  .battleRegiment.battleFocused { background: #eee; }
  .battleRegiment.battleLeaving { opacity: 0.5; }
  #battleLayout .battleWithdraw { width: 1.6em; height: 1.5em; padding: 0; }
  .battleRegiment > summary { display: grid; grid-template-columns: 1.3em minmax(0, 1fr) 4em 3.6em auto 1.6em; align-items: center; gap: 0.5em; padding: 0.2em 0; cursor: pointer; font-variant-numeric: tabular-nums; list-style: none; }
  .battleRegiment > summary::-webkit-details-marker { display: none; }
  .battleRegiment > summary:hover { background: #eee; }
  .battleRegiment > summary > svg { width: 1.3em; height: 1.3em; }
  .battleRegiment .battleLeft, .battleRegiment .battleLost, .battleRegiment .battleCaptured { text-align: right; }
  .battleRegimentName { overflow: hidden; font-weight: bold; text-overflow: ellipsis; white-space: nowrap; }
  .battleUnits { display: grid; grid-template-columns: 1.3em minmax(0, 1fr) 4em 3.6em auto 1.6em; gap: 0.1em 0.5em; align-items: center; padding: 0 0 0.2em 1.8em; font-variant-numeric: tabular-nums; }
  .battleUnits > div { display: contents; }
  .battleUnits .battleLeft { color: #2e7d32; font-style: italic; }
  .battleRegimentInfo { padding: 0 0 0.4em 1.8em; font-style: italic; }

  /* a narrow window: the name and the scales above the sides, then one sheet a row */
  @container battle (width < 52em) {
    #battleHeader { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
    #battleTitle { grid-column: 1 / -1; grid-row: 1; }
    #battleFooter { justify-content: center; }
  }
  @container battle (width < 42em) {
    #battleSides, .battleSummarySides { grid-template-columns: minmax(0, 1fr); }
    #battleSummary h2 { font-size: 1.6em; }
    .battleEmblems > svg { width: 2.4em; height: 2.4em; }
  }
`;

function renderDialog(): void {
  findEl("battleScreen")?.remove();
  findEl("regimentSelectorScreen")?.remove();

  const banner = (side: Side): string => /* html */ `<div id="battleBanner_${side}" class="battleBanner ${side}">
      <span class="battleEmblems"></span>
      <span class="battleBannerText">
        <span>
          <b class="battleStates"></b>
          <button class="battleOrdersButton" data-tip="${t("Give an order, add power or morale. Each change is made once and written to the battle log")}"><span class="battleOrder"></span></button>
        </span>
        <span>
          <div class="battleBar battleMorale"><i></i></div>
          <span class="battleTroops">
            <span class="battleCount" data-tip="${t("Troops left")}"><b></b><span></span></span>
            <span class="battleLost" data-tip="${t("Casualties")}"></span>
            <span class="battleCaptured icon-flag-empty" data-tip="${t("Captured")}"></span>
          </span>
        </span>
      </span>
    </div>`;

  const sheet = (side: Side): string => /* html */ `<section id="battleSide_${side}" class="battleSide ${side}">
      <div class="battleSectionHead">
        <b>${t("Regiments")}</b>
        <button class="battleAddRegiment icon-user-plus" data-tip="${t("Add regiment to the battle")}"></button>
      </div>
      <div class="battleRegimentList"></div>
    </section>`;

  const editorHtml = /* html */ `<div id="battleScreen" class="dialog stable">
      <style>${STYLE}</style>
      <div id="battleLayout">
        <div id="battleHeader">
          ${banner("attackers")}
          <div id="battleTitle">
            <svg id="battleDie_attackers" class="battleDie attackers" viewBox="0 0 20 20"></svg>
            <div>
            <div id="battleName">
              <input id="battleNameFull" data-tip="${t("Type full battle name")}" />
              <span id="battleNameTools">
                <button id="battleNameCulture" data-tip="${t("Generate culture-specific name")}" class="icon-book"></button>
                <button id="battleNameRandom" data-tip="${t("Generate random name")}" class="icon-globe"></button>
              </span>
            </div>
            <div id="battleBalance" data-tip="${t("Military power as the forces fight: units number multiplied by unit power and by upkeep")}">
              <i class="icon-button-power"></i><i class="icon-button-power"></i><b></b>
            </div>
            </div>
            <svg id="battleDie_defenders" class="battleDie defenders" viewBox="0 0 20 20"></svg>
          </div>
          ${banner("defenders")}
        </div>
        <div id="battleStage">
          <svg id="battleScene" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet"></svg>
          <div id="battleLog" hidden>
            <header>
              <b>${t("Battle log")}</b>
              <button id="battleLogDownload" data-tip="${t("Download the battle log: it can be loaded to replay the battle or to repeat its setup in another one")}" class="icon-download"></button>
              <button id="battleLogUpload" data-tip="${t("Load a battle log")}" class="icon-upload"></button>
              <button id="battleLogClose" data-tip="${t("Close")}" class="icon-cancel"></button>
            </header>
            <div id="battleLogList"></div>
          </div>
          <div id="battleSummary" hidden></div>
        </div>
        <div id="battleFooter">
          <div>
            <button id="battleRun" data-tip="${t("Start or pause the battle")}"></button>
            <button id="battleResultRestart" class="icon-ccw" data-tip="${t("Play the same battle again from the start")}" hidden> ${t("Play again")}</button>
            <button id="battleStep" data-tip="${t("Advance the battle by a single step")}" class="icon-right-open"></button>
            <button id="battleRestart" data-tip="${t("Play the same battle again from the start")}" class="icon-ccw"></button>
            <div id="battleSpeed" class="battleGroup" data-tip="${t("Battle speed")}">
              ${SPEEDS.map(speed => `<button data-speed="${speed}" class="${speed === 1 ? "pressed" : ""}">×${getPlayback(TICK_MS, speed)}</button>`).join("")}
            </div>
            <span id="battleClock"></span>
            <span id="battleFieldSize" data-tip="${t("Field size")}"></span>
          </div>
          <div>
            <span class="battlePicker">
              <button id="battleType"></button>
              <div class="battleMenu battleTypes" hidden>
                ${BATTLE_TYPES.map(type => `<button data-tip="${typeTip(type)}" data-type="${type}" class="icon-button-${type}">${BATTLE_TYPE_LABELS[type]}</button>`).join("")}
              </div>
            </span>
            <button id="battleRoll" data-tip="${t("Draw the troops up anew. Only before the battle starts")}" class="icon-arrows-cw"></button>
            <button id="battleAnimate" data-tip="${t("Save the battle as an animation, played from the start to the end")}" class="icon-button-screenshot"></button>
            <button id="battleLogToggle" data-tip="${t("Show the battle log")}" class="icon-list-bullet"></button>
            <button id="battleWiki" data-tip="${t("Open Battle Simulation Tutorial")}" class="icon-info"></button>
            <button id="battleApply" data-tip="${t("End battle: apply current results and close the screen")}" class="icon-check"></button>
            <button id="battleCancel" data-tip="${t("Cancel battle: roll back results and close the screen")}" class="icon-cancel"></button>
          </div>
        </div>
        <div id="battleSides">
          ${sheet("attackers")}
          ${sheet("defenders")}
        </div>
      </div>
    </div>
    <div id="regimentSelectorScreen" class="dialog">
      <div id="regimentSelectorHeader" class="header">
        <div data-tip="${t("Click to sort")}" class="sortable alphabetically" data-sortby="state">${t("State")}&nbsp;</div>
        <div data-tip="${t("Click to sort")}" class="sortable alphabetically" data-sortby="regiment">${t("Regiment")}&nbsp;</div>
        <div data-tip="${t("Click to sort")}" class="sortable" data-sortby="total">${t("Total")}&nbsp;</div>
        <div data-tip="${t("Click to sort")}" class="sortable icon-sort-number-up" data-sortby="distance">${t("Distance")}&nbsp;</div>
      </div>
      <div id="regimentSelectorBody" class="table"></div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  applySortingByHeader("battleScreen", "regimentSelectorHeader");

  ensureEl("battleRun").addEventListener("click", () => (player.playing ? pause() : play()));
  ensureEl("battleStep").addEventListener("click", () => step());
  ensureEl("battleRestart").addEventListener("click", () => restart());
  ensureEl("battleResultRestart").addEventListener("click", () => restart());
  ensureEl("battleSpeed").addEventListener("click", event => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("button");
    if (!button) return;
    player.speed = +button.dataset.speed!;
    for (const other of ensureEl("battleSpeed").children) other.classList.toggle("pressed", other === button);
  });
  ensureEl("battleType").addEventListener("click", event => togglePicker(event));
  ensureEl("battleType").nextElementSibling!.addEventListener("click", event => changeType(event));
  ensureEl("battleRoll").addEventListener("click", () => redeploy());
  ensureEl("battleAnimate").addEventListener("click", () => saveAnimation());
  ensureEl("battleLogToggle").addEventListener("click", () => toggleLog());
  ensureEl("battleLogClose").addEventListener("click", () => toggleLog(false));
  ensureEl("battleLogDownload").addEventListener("click", () => downloadLog());
  ensureEl("battleLogUpload").addEventListener("click", () => fileInput?.click());
  ensureEl<HTMLInputElement>("battleNameFull").addEventListener("change", event => {
    setName((event.target as HTMLInputElement).value);
  });
  ensureEl("battleNameCulture").addEventListener("click", () => generateBattleName("culture"));
  ensureEl("battleNameRandom").addEventListener("click", () => generateBattleName("random"));
  ensureEl("battleApply").addEventListener("click", () => applyResults());
  ensureEl("battleCancel").addEventListener("click", () => cancelResults());
  ensureEl("battleWiki").addEventListener("click", () => wiki("Battle-Simulator"));
  ensureEl("battleSummary").addEventListener("click", event => {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
    if (action === "restart") restart();
    else if (action === "apply") applyResults();
    else if (action === "close" || target.id === "battleSummary") ensureEl("battleSummary").hidden = true;
  });

  // a block under the pointer shows its regiment in the sheet
  scene().addEventListener("pointerover", event => {
    const el = (event.target as Element).closest(".battleBlock");
    const block = el && select<Element, Block>(el).datum();
    focusRegiment(block ? `${block.state}-${block.regiment}` : null, false);
  });
  scene().addEventListener("pointerleave", () => focusRegiment(null));

  for (const side of SIDES) {
    const el = ensureEl(`battleSide_${side}`);
    el.querySelector(".battleAddRegiment")!.addEventListener("click", () => addSide(side));
    ensureEl(`battleDie_${side}`).addEventListener("click", () => turnDie(side));
    ensureEl(`battleBanner_${side}`)
      .querySelector(".battleOrdersButton")!
      .addEventListener("click", () => openOrders(side));

    // a regiment under the pointer stands out on the battlefield
    const list = el.querySelector<HTMLElement>(".battleRegimentList")!;
    list.addEventListener("pointerover", event => {
      focusRegiment((event.target as Element).closest<HTMLElement>(".battleRegiment")?.dataset.key ?? null);
    });
    list.addEventListener("pointerleave", () => focusRegiment(null));
    list.addEventListener("click", event => {
      const button = (event.target as Element).closest(".battleWithdraw");
      if (!button) return;
      event.preventDefault(); // the row stays as it is
      withdrawRegiment(button.closest<HTMLElement>(".battleRegiment")!.dataset.key!);
    });
  }

  fileInput = createFileInput(".json");
  fileInput.onchange = () => uploadFile(fileInput!, loadLog);
}

function toggleLog(show = ensureEl("battleLog").hidden): void {
  ensureEl("battleLog").hidden = !show;
  ensureEl("battleLogToggle").classList.toggle("pressed", show);
  if (show) ensureEl("battleLogList").scrollTop = ensureEl("battleLogList").scrollHeight;
}

/** Mark a regiment in its sheet and, unless the pointer is on the field already, its troops on the field */
function focusRegiment(key: string | null, onField = true): void {
  for (const row of ensureEl("battleLayout").querySelectorAll<HTMLElement>(".battleRegiment")) {
    row.classList.toggle("battleFocused", row.dataset.key === key);
  }
  scene().classList.toggle("battleFocus", onField && key !== null);
  select(scene())
    .selectAll<SVGGElement, Block>(".battleBlock")
    .classed("battleFocused", block => `${block.state}-${block.regiment}` === key);
}

// the player

/** The generals have not thought the battle through yet: it cannot start */
const isPlanning = (): boolean => Boolean(battle && !battle.tick && !battle.planned);

/** Let the generals think once the screen has shown that they do: it takes up to a second */
function schedulePlan(): void {
  const b = battle!;
  if (planning || !isPlanning()) return;
  planning = window.setTimeout(() => {
    planning = 0;
    if (battle !== b) return;
    plan(b);
    updateBlocks(scene(), b, null, 1);
    refresh();
  }, 30);
}

function play(): void {
  const b = battle!;
  if (b.result || isPlanning()) return;
  player.playing = true;
  player.tickStart = performance.now();
  if (!player.previous) advance();
  setEditable();
  cancelAnimationFrame(player.frame);
  player.frame = requestAnimationFrame(animate);
}

function pause(): void {
  player.playing = false;
  cancelAnimationFrame(player.frame);
  player.previous = null;
  if (battle) updateBlocks(scene(), battle, null, 1);
  setEditable();
}

function step(): void {
  if (!battle || battle.result || isPlanning()) return;
  pause();
  advance();
  player.previous = null;
  updateBlocks(scene(), battle, null, 1);
}

function animate(now: number): void {
  const b = battle;
  if (!b || !player.playing) return;
  let progress = (now - player.tickStart) / (TICK_MS / player.speed);
  // a throttled tab catches up a few ticks a frame
  for (let ticks = 0; progress >= 1 && ticks < 4; ticks++) {
    if (b.result) {
      pause();
      return;
    }
    advance();
    progress -= 1;
  }
  if (progress >= 1) progress = 0;
  player.tickStart = now - progress * (TICK_MS / player.speed);
  updateBlocks(scene(), b, player.previous, progress);
  player.frame = requestAnimationFrame(animate);
}

function advance(): void {
  const b = battle!;
  player.previous = snapshot(b);
  const blocks = b.blocks.length;
  applyDue(b, script);
  if (b.blocks.length !== blocks) drawScene(); // a recorded reinforcement
  tick(b);
  refresh();
  if (b.result) showSummary();
}

function drawScene(): void {
  drawBlocks(scene(), battle!, dropBlock, turnBlock);
  setEditable();
}

function dropBlock(block: Block, x: number, y: number): void {
  const b = battle!;
  intervene(b, { tick: b.tick, kind: "move", block: block.key, x, y });
  updateBlocks(scene(), b, null, 1);
  refresh();
}

function turnBlock(block: Block, facing: number): void {
  const b = battle!;
  intervene(b, { tick: b.tick, kind: "turn", block: block.key, facing });
  updateBlocks(scene(), b, null, 1);
  refresh();
}

/** Troops can be dragged while the battle stands still */
function setEditable(): void {
  scene().classList.toggle("battleEditable", !player.playing && !battle?.result);
  scene().classList.toggle("battlePlanning", isPlanning()); // no troops till they are drawn up
  const run = ensureEl<HTMLButtonElement>("battleRun");
  run.disabled = isPlanning(); // the label stays, so the controls do not jump
  run.dataset.tip = isPlanning() ? t("Generals are planning") : t("Start or pause the battle");
  run.className = player.playing ? "battlePause" : "icon-play";
  run.textContent = player.playing ? t("Pause") : ` ${battle?.tick ? t("Continue") : t("Start battle")}`;
}

// the panels

const DIE_PIPS = [[4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]]; // cells of a 3x3 grid

const dieFace = (die: number): string =>
  `<rect x="1" y="1" width="18" height="18" rx="3.5"/>${(DIE_PIPS[die - 1] ?? [])
    .map(cell => `<circle cx="${5 + (cell % 3) * 5}" cy="${5 + Math.floor(cell / 3) * 5}" r="1.7"/>`)
    .join("")}`;

const stateColor = (state: number): string => {
  const color = pack.states[state]?.color;
  return color?.[0] === "#" ? color : "#999";
};

const put = (root: Element, selector: string, text: string | number): void => {
  const el = root.querySelector(selector)!;
  if (el.textContent !== String(text)) el.textContent = String(text);
};

function refresh(): void {
  const b = battle!;
  schedulePlan();
  for (const side of SIDES) refreshSide(side);

  // the scales: the power of the troops each side still has in order, as the military screens count it
  const power = SIDES.map(side => getUnitsPower(b, side));
  const share = power[0] + power[1] ? (power[0] / (power[0] + power[1])) * 100 : 50;
  const balance = ensureEl("battleBalance");
  put(balance, "i", si(power[0]));
  put(balance, "i + i", si(power[1]));
  (balance.firstElementChild as HTMLElement).style.width = `${share}%`;
  balance.style.setProperty("--at", `clamp(4.2em, ${share}%, 100% - 4.2em)`);

  const started = b.tick > 0;
  const over = Boolean(b.result);
  const type = ensureEl<HTMLButtonElement>("battleType");
  type.className = `icon-button-${b.type}`;
  type.textContent = BATTLE_TYPE_LABELS[b.type];
  type.disabled = started; // the ground is of the type the battle began as
  type.dataset.tip = started ? t("Battle type") : sentences(t("Battle type"), t("Click to change"));
  for (const button of type.nextElementSibling!.children) {
    button.classList.toggle("current", (button as HTMLElement).dataset.type === b.type);
  }
  const name = ensureEl<HTMLInputElement>("battleNameFull");
  if (document.activeElement !== name) name.value = b.name;

  const footer = ensureEl("battleFooter");
  put(footer, "#battleClock", formatClock(b.tick));
  ensureEl("battleClock").dataset.tip = t("Round {{round}}", { round: Math.floor(b.tick / ROUND_TICKS) + 1 });
  const unit = getLengthUnit(b.field.width); // both lengths in one unit
  put(footer, "#battleFieldSize", `${formatLength(b.field.width, unit)} × ${formatLength(b.field.height, unit)}`);
  if (!over) ensureEl("battleSummary").hidden = true;

  // setup only; nothing is hidden, so the controls never jump
  ensureEl<HTMLButtonElement>("battleRoll").disabled = started;
  ensureEl<HTMLButtonElement>("battleStep").disabled = over || isPlanning();
  ensureEl<HTMLButtonElement>("battleRestart").disabled = !started;
  ensureEl("battleRun").hidden = over;
  ensureEl("battleResultRestart").hidden = !over;
  setEditable();

  const list = ensureEl("battleLogList");
  if (list.childElementCount > b.log.length) list.innerHTML = "";
  for (const entry of b.log.slice(list.childElementCount)) {
    list.insertAdjacentHTML(
      "beforeend",
      `<div class="${entry.event} ${entry.side ?? ""}"><i>${formatClock(entry.tick)}</i><u></u><span>${escapeHtml(logText(entry))}</span></div>`
    );
    list.scrollTop = list.scrollHeight;
  }
}

function refreshSide(side: Side): void {
  const b = battle!;
  const banner = ensureEl(`battleBanner_${side}`);
  const data = b[side];
  const troops = getTroops(b, side);
  const morale = data.morale | 0;

  put(banner, ".battleCount > b", troops.left);
  put(banner, ".battleCount > span", ` / ${troops.initial}`);
  const fallen = troops.initial - troops.left - troops.captured;
  put(banner, ".battleTroops > .battleLost", fallen ? `−${fallen}` : "");
  put(banner, ".battleTroops > .battleCaptured", troops.captured ? String(troops.captured) : "");
  const moraleBar = banner.querySelector<HTMLElement>(".battleMorale")!;
  moraleBar.className = `battleBar battleMorale ${morale < 33 ? "low" : morale < 66 ? "mid" : ""}`;
  moraleBar.dataset.tip = `${side === "attackers" ? t("Attackers morale") : t("Defenders morale")}: ${morale}`;
  (moraleBar.firstElementChild as HTMLElement).style.width = `${morale}%`;

  const die = ensureEl<SVGElement & HTMLElement>(`battleDie_${side}`);
  if (die.dataset.die !== String(data.die)) {
    const factor = side === "attackers" ? t("Attackers fortune") : t("Defenders fortune");
    die.dataset.die = String(data.die);
    die.dataset.tip = sentences(`${factor}: ×${+getFortune(data.die).toFixed(3)}`, t("Click to change"));
    die.innerHTML = dieFace(data.die);
  }

  const label = banner.querySelector<HTMLElement>(".battleOrder")!;
  if (!b.tick && !data.plan.order) {
    const tactic = isPlanning() ? "" : BATTLE_TACTIC_LABELS[data.plan.tactic];
    label.className = "battleOrder icon-button-tactic";
    label.dataset.tip = tactic ? `${t("Tactic")}: ${tactic}` : t("Generals are planning");
    put(banner, ".battleOrder", tactic || "…");
  } else {
    const order = getOrder(b, side);
    label.className = `battleOrder icon-button-${order}`;
    label.dataset.tip = orderTip(order);
    put(banner, ".battleOrder", BATTLE_ORDER_LABELS[order]);
  }

  refreshRegiments(side);
}

/** The sheet's regiments: built when their set changes, then only the numbers move */
function refreshRegiments(side: Side): void {
  const b = battle!;
  const el = ensureEl(`battleSide_${side}`);
  const { regiments } = b[side];
  const container = el.querySelector<HTMLElement>(".battleRegimentList")!;
  const keys = regiments.map(regimentKey).join();
  if (container.dataset.keys !== keys) {
    container.dataset.keys = keys;
    renderRegiments(side);
  }

  const fighting = regiments.filter(regiment => !isWithdrawn(b, regiment)).length;
  for (const regiment of regiments) {
    const row = ensureEl(`battleRegiment_${regimentKey(regiment)}`);
    const leaving = isWithdrawn(b, regiment);
    const withdraw = row.querySelector<HTMLButtonElement>(".battleWithdraw")!;
    row.classList.toggle("battleLeaving", leaving);
    row.dataset.tip = leaving ? t("The regiment is withdrawn and leaves the field") : "";
    withdraw.hidden = leaving;
    withdraw.disabled = Boolean(b.result) || fighting < 2; // a side keeps a regiment
    const losses = getLosses(b, regiment);
    const captured = getCaptured(b, regiment);
    const initial = sum(Object.values(regiment.troops));
    const lost = sum(Object.values(losses));
    const taken = sum(Object.values(captured));
    put(row, ".battleLeft", initial - lost - taken);
    put(row, "summary > .battleLost", lost ? `−${lost}` : "");
    put(row, "summary > .battleCaptured", taken ? String(taken) : "");
    for (const unit of row.querySelectorAll<HTMLElement>("[data-unit]")) {
      const name = unit.dataset.unit!;
      put(unit, ".battleLeft", regiment.troops[name] - (losses[name] ?? 0) - (captured[name] ?? 0));
      put(unit, ".battleLost", losses[name] ? `−${losses[name]}` : "");
      put(unit, ".battleCaptured", captured[name] ? captured[name] : "");
    }
  }
}

function renderRegiments(side: Side): void {
  const b = battle!;
  const el = ensureEl(`battleSide_${side}`);
  const { regiments } = b[side];

  const states = [...new Set(regiments.map(regiment => regiment.state))];
  const banner = ensureEl(`battleBanner_${side}`);
  banner.querySelector(".battleEmblems")!.innerHTML = emblems(states);
  const title = banner.querySelector<HTMLElement>(".battleStates")!;
  title.textContent = list(states.map(state => pack.states[state].name));
  title.dataset.tip = list(states.map(state => pack.states[state].fullName ?? pack.states[state].name));

  const container = el.querySelector<HTMLElement>(".battleRegimentList")!;
  const opened = new Set([...container.querySelectorAll("details[open]")].map(details => details.id));
  container.innerHTML = regiments
    .map(regiment => {
      const state = pack.states[regiment.state];
      const upkeep = rn(regiment.upkeep * 100);
      const units = b.units
        .filter(unit => regiment.troops[unit.name])
        .map(
          unit => /* html */ `<div data-unit="${escapeHtml(unit.name)}">
            <span>${Icons.html(unit.icon)}</span><span>${escapeHtml(capitalize(unit.name.replace(/_/g, " ")))}</span>
            <span class="battleLeft"></span><span class="battleLost"></span><span class="battleCaptured icon-flag-empty"></span><span></span>
          </div>`
        )
        .join("");
      const id = `battleRegiment_${regimentKey(regiment)}`;
      return /* html */ `<details id="${id}" class="battleRegiment" data-key="${regimentKey(regiment)}" ${opened.has(id) ? "open" : ""}>
          <summary>
            <svg viewBox="0 0 20 20"><rect width="20" height="20" fill="${stateColor(regiment.state)}" stroke="#333"></rect>
              <use href="${escapeHtml(Icons.href(regiment.icon))}" x="2" y="2" width="16" height="16"></use></svg>
            <span class="battleRegimentName" data-tip="${escapeHtml(regiment.name)}">${escapeHtml(regiment.name)}</span>
            <span class="battleLeft" data-tip="${t("Survivors")}"></span>
            <span class="battleLost" data-tip="${t("Casualties")}"></span>
            <span class="battleCaptured icon-flag-empty" data-tip="${t("Captured")}"></span>
            <button class="battleWithdraw icon-user-times" data-tip="${t("Withdraw the regiment: before the start it leaves the battle, after it marches off the field")}"></button>
          </summary>
          <div class="battleUnits">${units}</div>
          <div class="battleRegimentInfo">${escapeHtml(state.fullName ?? "")} <span class="${upkeep < 100 ? "negative" : ""}" data-tip="${t("Troops fight with this share of their power")}">(${t("upkeep {{upkeep}}%", { upkeep })})</span><br>
            <span data-tip="${t("Supply line length, affects morale")}">${t("Distance to base")}: ${regiment.distance} ${options.map.units.distance.unit}</span></div>
        </details>`;
    })
    .join("");
}

function emblems(states: number[]): string {
  return states
    .slice(0, 4)
    .map(state => {
      void EmblemRenderer.trigger(`stateCOA${state}`, pack.states[state].coa);
      return `<svg data-tip="${escapeHtml(pack.states[state].fullName ?? "")}" viewBox="0 0 200 200"><use href="#stateCOA${state}"></use></svg>`;
    })
    .join("");
}

/** The end of the battle over the field, as games show it: who won and at what cost */
function showSummary(): void {
  const b = battle!;
  if (!b.result) return;
  const { winner, status } = b.result;
  const headline = winner ? (winner === "attackers" ? t("Attackers win") : t("Defenders win")) : t("No victor");

  const el = ensureEl("battleSummary");
  el.innerHTML = /* html */ `<div class="${winner ?? ""}">
      <button class="battleSummaryClose icon-cancel" data-action="close" data-tip="${t("Close the summary to look at the battlefield")}"></button>
      <header>
        <span class="battleSummaryKicker">${escapeHtml(b.name)}</span>
        <h2>${headline}</h2>
        <span>${escapeHtml(resultText(b))}</span>
      </header>
      <div class="battleSummarySides">${SIDES.map((side, i) => summarySide(b, side, status[i])).join("")}</div>
      <footer>
        <button data-action="restart" class="icon-ccw" data-tip="${t("Play the same battle again from the start")}"> ${t("Play again")}</button>
        <button data-action="apply" class="icon-check" data-tip="${t("End battle: apply current results and close the screen")}"> ${t("Apply results")}</button>
      </footer>
    </div>`;
  el.hidden = false;
}

function summarySide(b: Battle, side: Side, status: string): string {
  const { regiments } = b[side];
  const states = [...new Set(regiments.map(regiment => regiment.state))];
  const { initial, left, captured } = getTroops(b, side);
  const share = rn(b[side].casualties * 100);

  const had: Record<string, number> = {};
  const lost: Record<string, number> = {};
  const taken: Record<string, number> = {};
  for (const regiment of regiments) {
    const losses = getLosses(b, regiment);
    const prisoners = getCaptured(b, regiment);
    for (const unit in regiment.troops) {
      had[unit] = (had[unit] ?? 0) + regiment.troops[unit];
      lost[unit] = (lost[unit] ?? 0) + (losses[unit] ?? 0);
      taken[unit] = (taken[unit] ?? 0) + (prisoners[unit] ?? 0);
    }
  }
  const units = b.units
    .filter(unit => had[unit.name])
    .map(({ name, icon }) => {
      const prisoners = captured ? `<span class="n battleCaptured">${taken[name] || ""}</span>` : "";
      return /* html */ `<span>${Icons.html(icon)}</span><span>${escapeHtml(capitalize(name.replace(/_/g, " ")))}</span>
        <span class="n">${had[name] - lost[name] - taken[name]}</span><span class="n battleLost">${lost[name] ? `−${lost[name]}` : ""}</span>${prisoners}`;
    })
    .join("");

  return /* html */ `<section class="battleSummarySide ${side} ${b.result?.winner === side ? "won" : ""}">
      <header>
        <span class="battleEmblems">${emblems(states)}</span>
        <span>
          <b>${escapeHtml(list(states.map(state => pack.states[state].name)))}</b>
          <i>${escapeHtml(capitalize(status.replace(/^(attackers|defenders) | of (attackers|defenders)$/, "")))}</i>
        </span>
      </header>
      <div class="battleSummaryStats">
        <span>${t("Troops left")}</span><b>${left} <small>/ ${initial}</small></b>
        <span>${t("Casualties")}</span><b class="battleLost">${share}%</b>
        ${captured ? `<span>${t("Captured")}</span><b class="battleCaptured">${captured}</b>` : ""}
        <span>${t("Morale")}</span><b>${b[side].morale | 0}</b>
      </div>
      <div class="battleSummaryUnits ${captured ? "withCaptured" : ""}">
        <span class="head"></span><span class="head">${t("Unit")}</span><span class="head n">${t("Survivors")}</span><span class="head n">${t("Casualties")}</span>
        ${captured ? `<span class="head n">${t("Captured")}</span>` : ""}
        ${units}
      </div>
    </section>`;
}

/** The next face of the side's die: it stands to the end of the battle */
function turnDie(side: Side): void {
  const b = battle!;
  if (b.result) return;
  const die = (b[side].die % 6) + 1;
  const previous = b.interventions.at(-1);
  if (previous?.kind === "die" && previous.side === side && previous.tick === b.tick) {
    b.interventions.pop(); // clicks through the faces leave one line in the log
    b.log.pop();
    ensureEl("battleLogList").lastElementChild?.remove();
  }
  intervene(b, { tick: b.tick, kind: "die", side, die });
  refresh();
}

/** What the user may do to a side by hand: each change is made once and goes to the log */
function openOrders(side: Side): void {
  const b = battle!;
  if (b.result) return;
  findEl("battleOrdersScreen")?.remove();
  const amount = t("Amount to add; a negative one is taken away");
  const current = getOrder(b, side);
  // before the start a side that may build can stand behind works prepared the night before
  const digs = !b.tick && mayBuild(b, side);
  const dug = isDugIn(b, side);
  const digTip = t("Start the battle behind finished works: a ditch, or stakes against a foe strong in riders");
  const orders = (Object.keys(COMMANDS[b.type][side]) as Command[])
    .map(
      order => `<option value="${order}" ${order === current ? "selected" : ""}>${BATTLE_ORDER_LABELS[order]}</option>`
    )
    .join("");
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="battleOrdersScreen" class="dialog">
      <div style="display: grid; grid-template-columns: auto 8em; align-items: center; gap: 0.5em 1em; width: auto">
        <label for="battleOrdersOrder">${t("Orders")}</label>
        <select id="battleOrdersOrder">${orders}</select>
        <label for="battleOrdersPower" data-tip="${amount}">${t("Power")}</label>
        <input id="battleOrdersPower" data-tip="${amount}" type="number" step="10" value="0" />
        <label for="battleOrdersMorale" data-tip="${amount}">${t("Morale")}</label>
        <input id="battleOrdersMorale" data-tip="${amount}" type="number" step="5" min="-100" max="100" value="0" />
        ${digs ? `<label for="battleOrdersDig" data-tip="${digTip}">${t("Dug in")}</label><input id="battleOrdersDig" data-tip="${digTip}" type="checkbox" class="native" ${dug ? "checked" : ""} />` : ""}
      </div>
    </div>`
  );

  const apply = (): void => {
    const order = ensureEl<HTMLSelectElement>("battleOrdersOrder").value as Command;
    const power = +ensureEl<HTMLInputElement>("battleOrdersPower").value || 0;
    const morale = +ensureEl<HTMLInputElement>("battleOrdersMorale").value || 0;
    const dig = digs && ensureEl<HTMLInputElement>("battleOrdersDig").checked;
    if (digs && dig !== dug) intervene(b, { tick: b.tick, kind: "dig", side, on: dig });
    if (order !== current) intervene(b, { tick: b.tick, kind: "order", side, order });
    if (power) intervene(b, { tick: b.tick, kind: "power", side, value: power });
    if (morale) intervene(b, { tick: b.tick, kind: "morale", side, value: morale });
    Dialog.close("battleOrdersScreen");
    refresh();
  };

  Dialog.open("battleOrdersScreen", {
    title: sideLabel(side),
    position: { my: "center", at: "center", of: "#battleScreen" },
    buttons: [
      { label: t("Apply"), onClick: apply },
      { label: t("Cancel"), onClick: () => Dialog.close("battleOrdersScreen") }
    ]
  });
}

function closePickers(): void {
  for (const menu of findEl("battleLayout")?.querySelectorAll<HTMLElement>(".battleMenu") ?? []) menu.hidden = true;
}

function togglePicker(event: Event): void {
  event.stopPropagation();
  const menu = (event.currentTarget as HTMLElement).nextElementSibling as HTMLElement;
  const show = menu.hidden;
  closePickers();
  if (!show) return;
  menu.hidden = false;
  document.addEventListener("click", closePickers, { once: true });
}

function changeType(event: Event): void {
  const target = event.target as HTMLElement;
  const b = battle!;
  if (target.tagName !== "BUTTON" || target.dataset.type === b.type || b.tick) return;
  const type = target.dataset.type as BattleType;
  const named = b.name === getBattleName(b.type, b.place);

  intervene(b, { tick: b.tick, kind: "type", type });
  if (!b.tick) {
    // the ground follows the type until the battle starts
    b.field = buildField(b.x, b.y, type);
    prepare(b);
    drawBattlefield(scene(), b.field);
    drawScene();
  }
  if (named) setName(getBattleName(type, b.place));
  refresh();
}

/** Draw the troops up anew: the moves made by hand are dropped */
function redeploy(): void {
  const b = battle!;
  if (b.tick) return;
  const sides = SIDES.map(side => b[side].regiments.map(regiment => regiments.get(regimentKey(regiment))!));
  setup(sides[0], sides[1], { type: b.type, name: b.name });
  // what was done to the sides by hand stays done
  for (const change of b.interventions) {
    if (change.kind === "power" || change.kind === "morale") intervene(battle!, change);
  }
  refresh();
}

function setName(name: string): void {
  battle!.name = name;
  ensureEl<HTMLInputElement>("battleNameFull").value = name;
  Dialog.update("battleScreen", { title: name });
}

function generateBattleName(type: "culture" | "random"): void {
  const b = battle!;
  b.place =
    type === "culture"
      ? Names.getCulture(pack.cells.culture[b.cell], undefined, undefined, "")
      : Names.getBase(Math.floor(Math.random() * Names.nameBases.length));
  setName(getBattleName(b.type, b.place));
}

function addSide(side: Side): void {
  if (Dialog.isOpen("regimentSelectorScreen")) return; // its row listener is bound once
  const b = battle!;
  const body = ensureEl("regimentSelectorBody");
  const all = pack.states.filter(s => s.military && !s.removed).flatMap(s => s.military!);
  const distance = (reg: Regiment): number =>
    rn(Math.hypot(b.y - reg.y, b.x - reg.x) * options.map.units.distance.scale);

  body.innerHTML = all
    .map(r => {
      const s = pack.states[r.state];
      const added = regiments.has(regimentKey(r));
      const dist = added ? 0 : distance(r);
      return /* html */ `<div ${added ? "class='inactive'" : ""} data-s=${s.i} data-i=${r.i} data-state="${escapeHtml(s.name)}"
        data-regiment="${escapeHtml(r.name)}" data-total=${Military.getTroops(r.a)} data-distance="${dist}" data-tip="${t("Click to select regiment")}">
        <span><svg viewBox="0 0 10 10"><rect width="10" height="10" fill="${s.color}" stroke="#333"/></svg>${escapeHtml(s.name)}</span>
        <span>${Icons.html(r.icon ?? "")} ${escapeHtml(r.name)}</span>
        <span>${Military.getTroops(r.a)}</span>
        <span>${dist} ${options.map.units.distance.unit}</span>
      </div>`;
    })
    .join("");

  Dialog.open("regimentSelectorScreen", {
    width: "fit-content",
    minWidth: 360,
    title: t("Add regiment to the battle"),
    position: { my: "center", at: "center", of: "#battleScreen" },
    persistent: true, // markup is built with the battle screen, so it must survive closing
    onClose: addSideClosed,
    buttons: [
      {
        label: side === "attackers" ? t("Add to attackers") : t("Add to defenders"),
        onClick: () => addSideClicked()
      },
      { label: t("Cancel"), onClick: () => Dialog.close("regimentSelectorScreen") }
    ]
  });

  applySorting(ensureEl("regimentSelectorHeader"));
  body.addEventListener("click", selectLine);

  function selectLine(event: Event): void {
    const row = (event.target as HTMLElement).closest<HTMLElement>("#regimentSelectorBody > div");
    if (!row) return;
    if (row.classList.contains("inactive")) {
      tip(t("Regiment is already in the battle"), false, "error");
      return;
    }
    row.classList.toggle("selected");
  }

  function addSideClicked(): void {
    const selected = body.querySelectorAll<HTMLElement>(".selected");
    if (!selected.length) {
      tip(t("Please select a regiment first"), false, "error");
      return;
    }

    Dialog.close("regimentSelectorScreen");
    const { field } = b;
    selected.forEach(line => {
      const regiment = pack.states[+line.dataset.s!].military!.find(r => r.i === +line.dataset.i!)!;
      joinBattle(regiment, side);
      intervene(b, { tick: b.tick, kind: "add", side, regiment: toBattleRegiment(regiment, b) });
    });
    if (b.field !== field) drawBattlefield(scene(), b.field); // more troops, a larger field
    drawScene();
    refresh();
  }

  function addSideClosed(): void {
    body.innerHTML = "";
    body.removeEventListener("click", selectLine);
  }
}

/** Take a regiment out: before the start it goes back to where it stood on the map, after it it marches off the field */
function withdrawRegiment(key: string): void {
  const b = battle!;
  const data = SIDES.flatMap(side => b[side].regiments).find(regiment => regimentKey(regiment) === key);
  if (!data || b.result) return;
  const { field, tick } = b;
  intervene(b, { tick, kind: "withdraw", state: data.state, regiment: data.i });
  if (!tick) {
    const regiment = regiments.get(key);
    if (regiment) leaveBattle(regiment);
    regiments.delete(key);
    if (b.field !== field) drawBattlefield(scene(), b.field); // fewer troops, a smaller field
    drawScene();
  }
  refresh();
}

/** Bring a regiment to the battle on the map */
function joinBattle(regiment: Regiment, side: Side): void {
  const b = battle!;
  regiments.set(regimentKey(regiment), regiment);
  const shift = side === "attackers" ? (b.attackers.regiments.length + 1) * -8 : b.defenders.regiments.length * 8;
  regiment.px = regiment.x;
  regiment.py = regiment.y;
  moveRegiment(regiment, b.x, b.y + shift);
}

// the log

/** A line of the log; whose it is the mark beside it shows */
function logText({ event, side, params }: LogEntry): string {
  if (event === "start") return t("The battle begins");
  if (event === "order") return `${t("Orders")}: ${BATTLE_ORDER_LABELS[params!.order as Command]}`;
  if (event === "ordered")
    return t("Ordered to {{order}}", { order: BATTLE_ORDER_LABELS[params!.order as Command].toLowerCase() });
  if (event === "tactic") return `${t("Tactic")}: ${BATTLE_TACTIC_LABELS[params!.tactic]}`;
  if (event === "die") return `${t("Fortune")}: ${params!.die}`;
  if (event === "power") return `${t("Power")}: ${params!.value}`;
  if (event === "morale") return `${t("Morale")}: ${params!.value}`;
  if (event === "join") return t("{{regiment}} joins the battle", params);
  if (event === "withdraw") return t("{{regiment}} is withdrawn", params);
  if (event === "breach") return t("The walls of {{burg}} are breached", params);
  if (event === "cut") return t("{{burg}} is cut off", params);
  if (event === "supplied") return t("Supplies reach {{burg}}", params);
  if (event === "dig") return params!.on === "true" ? t("Dug in") : t("Not dug in");
  if (event === "fortified") return `${t("Works stand")}: ${WORK_LABELS[params!.kind as WorkKind]}`;
  if (event === "gap") return t("The wagons are broken through");
  if (event === "end") return side ? t("Hold the field") : t("The battle dies down");

  const block = { block: capitalize(params!.block) };
  if (event === "move") return t("{{block}} are moved", block);
  if (event === "turn") return t("{{block}} are turned", block);
  if (event === "rout") return t("{{block}} break and run", block);
  if (event === "rally") return t("{{block}} rally", block);
  if (event === "surrender") return t("{{block}} surrender", block);
  if (event === "destroyed") return t("{{block}} are destroyed", block);
  return t("{{block}} leave the field", block);
}

const sideLabel = (side: Side): string => (side === "attackers" ? t("Attackers") : t("Defenders"));

/** How the battle ended, where no mark shows the side */
function resultText(b: Battle): string {
  const winner = b.result?.winner;
  if (!winner) return t("The battle dies down");
  return winner === "attackers" ? t("The attackers hold the field") : t("The defenders hold the field");
}

function outcome(b: Battle): string {
  const [attackers, defenders] = getResult(b).status;
  return attackers === defenders ? capitalize(attackers) : `${capitalize(attackers)}, ${defenders}`;
}

/** The regiments the battle began with: latecomers are in the interventions */
function getInitialRegiments(b: Battle, side: Side): BattleRegiment[] {
  const late = new Set(
    b.interventions.flatMap(change => (change.kind === "add" ? [regimentKey(change.regiment)] : []))
  );
  return b[side].regiments.filter(regiment => !late.has(regimentKey(regiment)));
}

const getFileName = (name: string): string => name.replace(/[^\p{L}\p{N}]+/gu, "-");

function buildLog(): BattleLogFile {
  const b = battle!;
  const ids = (side: Side): { state: number; i: number }[] =>
    getInitialRegiments(b, side).map(({ state, i }) => ({ state, i }));
  return {
    version: LOG_VERSION,
    name: b.name,
    type: b.type,
    attackers: ids("attackers"),
    defenders: ids("defenders"),
    interventions: [...b.interventions],
    log: b.log.map(entry => {
      const whose = entry.side ? `${sideLabel(entry.side)}: ` : "";
      return `${formatClock(entry.tick)} ${whose}${logText(entry)}`;
    }),
    result: b.result ? outcome(b) : null
  };
}

function downloadLog(): void {
  downloadFile(JSON.stringify(buildLog(), null, 2), `${getFileName(battle!.name)}-log.json`, "application/json");
}

/** The battle from its start, untouched by the one on screen: every change made, and those of a loaded log to come */
function startAnew(b: Battle): BattleStart {
  const battle = createBattle({
    type: b.type,
    name: b.name,
    place: b.place,
    x: b.x,
    y: b.y,
    cell: b.cell,
    axis: b.approach,
    field: buildField(b.x, b.y, b.type),
    units: b.units,
    populationScale: b.populationScale,
    attackers: structuredClone(getInitialRegiments(b, "attackers")),
    defenders: structuredClone(getInitialRegiments(b, "defenders"))
  });
  return { battle, script: structuredClone([...b.interventions, ...script]) };
}

function saveAnimation(): void {
  const b = battle!;
  pause();
  BattleAnimation.open({
    fileName: getFileName(b.name),
    start: () => startAnew(b),
    tickMs: TICK_MS,
    speed: player.speed,
    screenWidth: scene().getBoundingClientRect().width * devicePixelRatio
  });
}

function loadLog(data: string): void {
  let file: BattleLogFile;
  try {
    file = JSON.parse(data);
    if (file.version !== LOG_VERSION || !Array.isArray(file.interventions)) throw new Error("Not a battle log");
  } catch {
    tip(t("The file is not a battle log"), false, "error");
    return;
  }

  const same = restore(file);
  tip(
    same
      ? t("Battle log is loaded. Start the battle to replay it")
      : t("Battle log is loaded: its settings are applied to this battle"),
    true,
    "success",
    4000
  );
}

/** Back to the start, to play the same battle again: every change made on the way comes at its moment */
function restart(): void {
  restore(buildLog());
}

/** Set a logged battle up to replay when its regiments are here, or else repeat its settings with the current ones */
function restore(file: BattleLogFile): boolean {
  const b = battle!;
  pause();
  const find = (ref: { state: number; i: number }): Regiment | undefined =>
    pack.states[ref.state]?.military?.find(regiment => regiment.i === ref.i && regiment.a);
  const sides = [file.attackers, file.defenders].map(side => side.map(find));
  const same = sides.every(side => side.length && side.every(Boolean));

  // regiments leave the old battle and join the new one on the map
  const current = SIDES.map(side => b[side].regiments.map(regiment => regiments.get(regimentKey(regiment))!));
  const [attackers, defenders] = same ? (sides as Regiment[][]) : current.map(side => side.slice(0, 1));
  const staying = new Set([...attackers, ...defenders]);
  for (const regiment of regiments.values()) if (!staying.has(regiment)) leaveBattle(regiment);
  regiments = new Map();
  setup(attackers, defenders, file); // at the same place
  SIDES.forEach((side, i) => {
    for (const regiment of [attackers, defenders][i]) {
      if (regiment.px === undefined) joinBattle(regiment, side);
      else regiments.set(regimentKey(regiment), regiment);
    }
  });

  script = file.interventions
    .filter(change => {
      if (change.kind === "move") return same;
      if (change.kind !== "add") return true;
      const regiment = same && find(change.regiment);
      if (regiment) joinBattle(regiment, change.side);
      return Boolean(regiment);
    })
    .sort((a, b) => a.tick - b.tick);
  applyDue(battle!, script);
  drawScene();
  setName(file.name);
  refresh();
  return same;
}

// the end

function applyResults(): void {
  const b = battle!;
  pause();
  const battleStatus = getResult(b).status;
  const { year, eraShort } = options.map.lore.calendar;
  const unitsText = (units: Record<string, number>): string =>
    list(Object.keys(units).flatMap(unit => (units[unit] ? [`${units[unit]} ${unit}`] : [])));

  const forcesLegend = (label: string, side: Side): string => {
    const initial: Record<string, number> = {};
    const casualties: Record<string, number> = {};
    const taken: Record<string, number> = {};
    for (const regiment of b[side].regiments) {
      const losses = getLosses(b, regiment);
      const captured = getCaptured(b, regiment);
      for (const unit in regiment.troops) {
        initial[unit] = (initial[unit] || 0) + regiment.troops[unit];
        casualties[unit] = (casualties[unit] || 0) + (losses[unit] ?? 0);
        taken[unit] = (taken[unit] || 0) + (captured[unit] ?? 0);
      }
    }
    let text = sum(Object.values(initial)) ? `<br>${label} initial forces: ${unitsText(initial)}.` : "";
    if (sum(Object.values(casualties))) text += ` Casualties: ${unitsText(casualties)}.`;
    if (sum(Object.values(taken))) text += ` Captured: ${unitsText(taken)}.`;
    return text;
  };

  SIDES.forEach((side, sideIndex) => {
    for (const data of b[side].regiments) {
      const regiment = regiments.get(regimentKey(data));
      if (!regiment) continue;
      const losses = getLosses(b, data);
      const captured = getCaptured(b, data);
      const initial = sum(Object.values(data.troops));

      if (regiment.note) {
        const share = initial ? sum(Object.values(losses)) / initial : 1;
        const initialText = initial ? ` Initial forces: ${unitsText(data.troops)}.` : "";
        const casualtiesText = sum(Object.values(losses)) ? ` Casualties: ${unitsText(losses)}.` : "";
        const capturedText = sum(Object.values(captured)) ? ` Captured: ${unitsText(captured)}.` : "";
        regiment.note += `<br><br>${b.name} (${year} ${eraShort}): ${battleStatus[sideIndex]}. The regiment ${getRegimentStatus(share)}.${initialText}${casualtiesText}${capturedText}`;
      }

      const { scale } = options.map.units.population;
      for (const unit in regiment.u) {
        const died = (losses[unit] ?? 0) + (captured[unit] ?? 0); // prisoners are lost to the regiment too
        regiment.u[unit] = (data.troops[unit] ?? 0) > died ? regiment.u[unit] - died / scale : 0;
      }
      regiment.a = sum(Object.values(regiment.u));
      select<SVGGElement, unknown>("#armies")
        .select(`g#regiment${regiment.state}-${regiment.i} > text`)
        .text(Military.getTotal(regiment));
    }
  });

  const marker: Marker = {
    i: (last(pack.markers)?.i ?? -1) + 1,
    x: b.x,
    y: b.y,
    cell: b.cell,
    icon: Icons.glyph("⚔️"),
    type: "battlefields",
    dy: 52,
    name: b.name,
    tags: []
  };
  pack.markers.push(marker);
  Layers.draw("markers");

  const getSide = (side: Side, n: number): string => {
    const regs = b[side].regiments;
    return regs.length > 1
      ? `${n ? "regiments" : "forces"} of ${list([...new Set(regs.map(r => pack.states[r.state].name))])}`
      : `${getAdjective(pack.states[regs[0].state].name)} ${regs[0].name}`;
  };
  const getLossesShare = (casualties: number): number => Math.min(rn(casualties * 100), 100);

  const status = battleStatus[getResult(b).winner === "defenders" ? 1 : 0]; // as the side that holds the field sees it
  const result = `The ${getTypeName(b.type)} ended in ${status}`;
  let legend = `${b.name} took place in ${year} ${eraShort}. It was fought between ${getSide("attackers", 1)} and ${getSide("defenders", 0)}. ${result}.
      <br>Attackers losses: ${getLossesShare(b.attackers.casualties)}%, defenders losses: ${getLossesShare(b.defenders.casualties)}%.`;
  if (b.attackers.captured || b.defenders.captured)
    legend += ` Captured: attackers ${getLossesShare(b.attackers.captured)}%, defenders ${getLossesShare(b.defenders.captured)}%.`;
  legend += forcesLegend("Attackers", "attackers");
  legend += forcesLegend("Defenders", "defenders");

  if (b.course.length) {
    const course = b.course.map(r => (r.count > 1 ? `${r.orders} (x${r.count})` : r.orders)).join("<br>");
    legend += `<br><br>${t("Engagement progression")}:<br>${course}`;
  }
  marker.note = legend;

  tip(t("{{battle}} is over. {{result}}", { battle: b.name, result }), true, "success", 4000);
  closeBattleScreen();
}

function cancelResults(): void {
  if (!battle) return;
  closeBattleScreen();
}

function leaveBattle(regiment: Regiment): void {
  if (regiment.px !== undefined) moveRegiment(regiment, regiment.px, regiment.py!); // back to where it stood
  delete regiment.px;
  delete regiment.py;
}

function closeBattleScreen(): void {
  pause();
  clearTimeout(planning);
  planning = 0;
  for (const regiment of regiments.values()) leaveBattle(regiment);
  battle = null;
  regiments = new Map();
  script = [];
  fileInput?.remove();
  fileInput = null;
  options.app.mode = null; // exit edit mode
  Dialog.destroy("battleOrdersScreen");
  Dialog.destroy("battleScreen");
  Dialog.destroy("regimentSelectorScreen");
}

function typeTip(type: BattleType): string {
  if (type === "field") return t("Field Battle: a standard type of combat");
  if (type === "naval") return t("Naval Battle: naval units combat");
  if (type === "siege") return t("Siege: burg blockade and storming");
  if (type === "ambush") return t("Ambush: surprise attack");
  if (type === "landing") return t("Landing: amphibious attack");
  return t("Air Battle: maneuring fight of avia units");
}

const WORK_LABELS: Record<WorkKind, string> = { stakes: t("Stakes"), ditch: t("Ditch"), wagons: t("Wagons") };

function orderTip(order: Command): string {
  if (order === "hold") return t("Hold: stand the ground and shoot what comes within range");
  if (order === "fortify") return t("Fortify: dig in before the first line and hold behind the works");
  if (order === "skirmish") return t("Skirmish: come within shot of the enemy and shoot");
  if (order === "attack") return t("Attack: close with the enemy");
  if (order === "defend") return t("Defend: stand the ground and fight what comes at it");
  if (order === "pursue") return t("Pursue: chase the broken enemy");
  if (order === "retreat") return t("Retreat: leave the field");
  return t("Surrender: lay down arms");
}

export const BattleScreen = { open };
