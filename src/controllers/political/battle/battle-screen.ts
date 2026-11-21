import { select, sum } from "d3";
import { BATTLE_SPEEDS, PAUSE_EVENTS, type PauseEvent } from "@/data/battle-options";
import {
  BATTLE_ORDER_LABELS,
  BATTLE_TACTIC_LABELS,
  BATTLE_TYPE_LABELS,
  CONDITION_LABELS,
  getOutcomeLabel,
  PERIOD_LABELS,
  WEATHER_LABELS
} from "@/data/id-labels";
import { Pack } from "@/model/graph/pack-generator";
import { Icons } from "@/model/icons";
import { Options } from "@/model/options/options-model";
import { Battalions } from "@/model/political/battle/battalion";
import {
  type Battalion,
  type Battle,
  type BattleRegiment,
  Battles,
  type Intervention,
  type LogEntry,
  type LogEvent,
  ROUND_TICKS,
  type TaskKind
} from "@/model/political/battle/battle";
import {
  BATTLE_TYPES,
  BattleRules,
  type BattleType,
  COMMANDS,
  type Command,
  SIDES,
  type Side
} from "@/model/political/battle/battle-rules";
import { SCENE, VIEW_ASPECT } from "@/model/political/battle/battle-scale";
import { BattleSite } from "@/model/political/battle/battle-site";
import { Battlefields, type WorkKind } from "@/model/political/battle/battlefield";
import type { TacticName } from "@/model/political/battle/formations";
import { Generals } from "@/model/political/battle/general";
import { Movement } from "@/model/political/battle/movement";
import { Pathfinding } from "@/model/political/battle/pathfinding";
import { BattleReplays, type BattleStart } from "@/model/political/battle/replay";
import { BattleTime, type Period } from "@/model/political/battle/time";
import { BattleWeather, CONDITIONS, type Condition, WEATHERS, type Weather } from "@/model/political/battle/weather";
import { Works } from "@/model/political/battle/works";
import type { Regiment } from "@/model/political/military-generator";
import { Military } from "@/model/political/military-generator";
import { Stability } from "@/model/political/stability";
import type { State } from "@/model/political/states-generator";
import { Names } from "@/model/society/names-generator";
import { Dates } from "@/model/story/dates";
import type { BattleEvent } from "@/model/story/events";
import { Events } from "@/model/story/events";
import { BattleCamera, type Camera, type CameraMode } from "@/renderers/battle/battle-camera";
import { BattleOverlayView } from "@/renderers/battle/draw-battle-overlay";
import {
  BattleSceneView,
  type Positions,
  type Selection,
  SIDE_COLORS,
  type SideColors,
  type StateColors,
  type Trails
} from "@/renderers/battle/draw-battle-scene";
import { BattleWeatherView } from "@/renderers/battle/draw-battle-weather";
import { getRegimentStep, moveRegiment } from "@/renderers/draw-military";
import { EmblemRenderer } from "@/renderers/emblems/renderer";
import { viewport } from "@/renderers/viewport/viewport";
import { VERSION } from "@/services/versioning";
import type { Point } from "@/types/global";
import { Dialog } from "@/ui/dialog/dialog";
import { refreshEditors } from "@/ui/dialog/dialog-helpers";
import { applySorting, applySortingByHeader } from "@/ui/dialog/sorting";
import { clearMainTip, showElementTip, showMainTip, tip } from "@/ui/tooltips";
import { getColorDistance } from "@/utils/color-utils";
import { getLatitude, wiki } from "@/utils/common-utils";
import { sentences, t } from "@/utils/i18n";
import { list } from "@/utils/language-utils";
import { ensureEl, findEl } from "@/utils/node-utils";
import { rn, si } from "@/utils/number-utils";
import { capitalize, escapeHtml } from "@/utils/string-utils";
import { BattleAnimation, type BattleSource } from "./battle-animation";
import { BattleConfigure } from "./battle-configure";
import type { ReportText } from "./battle-report";

const TICK_MS = 160; // a tick at normal speed: fifty times as fast as the battle
const MORALE_STEP = 5; // a click on the morale bar adds or takes away
const SCREEN_SHARE = 0.92; // of the viewport the window may take
const FIELD_WIDTH = 77; // em the battlefield opens at, at most: the window can be dragged larger
const POSITION = { my: "center", at: "center", of: "svg" };

const AMBUSH_ODDS = 0.75; // defenders weaker than that lie in ambush where the ground hides them

/** The summary of a battle: over the field at its end, and atop a battle report */
const SUMMARY_STYLE = /* css */ `
  .battleEmblems { display: flex; flex-shrink: 0; }
  .battleEmblems > svg { width: 3.2em; height: 3.2em; }
  .battleEmblems > svg + svg { margin-left: -1.9em; }
  .battleLost { color: var(--loss); font-style: italic; }
  .battleCaptured { color: var(--muted); font-style: italic; white-space: nowrap; }
  .battleCaptured:empty::before { display: none; }
  /* the end of the battle, over the field: who won and at what cost */
  #battleSummary { position: absolute; inset: 0; z-index: 3; display: flex; padding: 0.8em; overflow-y: auto; background: #000000a0; animation: battleSummaryFade 0.3s ease-out; }
  #battleSummary > div { --side: #666; position: relative; display: flex; flex-direction: column; gap: 0.6em; width: min(44em, 100%); margin: auto; padding: 0.8em 1em 1em; box-sizing: border-box; border-top: 4px solid var(--side); background: #fff; box-shadow: 0 0.4em 2em #000a; animation: battleSummaryRise 0.35s ease-out; }
  #battleSummary > div > header { text-align: center; }
  #battleSummary h2 { margin: 0.1em 0; color: var(--side); font-family: var(--serif); font-size: 2.2em; letter-spacing: 0.08em; text-transform: uppercase; }
  .battleSummaryKicker { color: var(--muted); font-family: var(--serif); font-size: 1.1em; }
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
`;

const RECORD_DIFFERS = () =>
  t(
    "The battle no longer plays out as it was recorded: the ground, the units or the rules have changed. The record stands"
  );

/** A past battle's summary in a window of its own */
const RECORD_STYLE = /* css */ `
  .battleRecord #battleSummary { --line: #ccc; --muted: #666; --loss: #c5221f; position: static; display: block; padding: 0; background: none; overflow: visible; animation: none; }
  .battleRecord #battleSummary > div { width: auto; box-shadow: none; animation: none; }
  .battleRecord #battleSummary .attackers { --side: var(--attackers); }
  .battleRecord #battleSummary .defenders { --side: var(--defenders); }
  .battleRecord :is(.battleSummaryClose, #battleSummary footer) { display: none !important; }
  .battleRecordDiffers { margin: 0 0 0.6em; color: #c5221f; }
`;

const STYLE = /* css */ `
  /* a past battle watched again: it plays, nothing in it is changed */
  #battleLayout.watching :is(#battleScene, #battleOverlay, .battleDie) { pointer-events: none; }
  #battleLayout.watching .battleDie { opacity: 0.5; }
  #battleLayout.watching :is(#battleRoll, #battleApply, #battleNameTools, .battleOrdersButton, .battleMoraleStep, .battleAddRegiment, .battleWithdraw) { display: none; }
  #battleScreen { padding: 0.5em; overflow: hidden; container: battle / size; }
  #battleLayout { --line: #ccc; --muted: #666; --loss: #c5221f; display: flex; flex-direction: column; gap: 0.5em; box-sizing: border-box; width: auto; height: 100%; overflow-y: auto; }
  #battleLayout > * { flex: none; }
  #battleLayout [hidden] { display: none !important; }
  #battleLayout .attackers { --side: var(--attackers); }
  #battleLayout .defenders { --side: var(--defenders); }
  #battleLayout button { white-space: nowrap; }

  /* a button that opens a list of named choices, upward: the pickers stand low in the window */
  .battlePicker { position: relative; display: inline-block; }
  .battlePicker > button::before, .battleMenu > button::before { margin-right: 0.3em; }
  .battlePicker > button:not(:disabled)::after { content: "▾"; margin-left: 0.4em; }
  .battleMenu { position: absolute; bottom: 100%; left: 0; z-index: 5; display: flex; flex-direction: column; min-width: 100%; border: 1px solid #999; background: #fff; }
  #battleLayout .battleMenu > button { padding: 0.3em 0.9em 0.3em 0.5em; border: 0; border-radius: 0; background: none; text-align: left; }
  #battleLayout .battleMenu > button:hover { background: #eee; }
  #battleLayout .battleMenu > button.current { font-weight: bold; }

  /* who fights whom, and how the scales stand */
  #battleHeader { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 0.3em 0.8em; margin-bottom: -0.5em; padding: 0.3em 0.6em; background: linear-gradient(150deg, transparent, color-mix(in srgb, var(--attackers) 19%, transparent) 20%, transparent 45%, transparent 55%, color-mix(in srgb, var(--defenders) 19%, transparent) 80%, transparent); }
  .battleBanner { display: flex; align-items: center; gap: 0.7em; width: 100%; max-width: 30em; min-width: 0; }
  .battleBanner.defenders { justify-self: end; }
  .battleBanner.defenders, .battleBanner.defenders .battleBannerText > span { flex-direction: row-reverse; }
  .battleBanner.defenders .battleStates { text-align: right; }
  .battleBannerText { display: flex; flex: 1; flex-direction: column; gap: 0.2em; min-width: 0; }
  .battleBannerText > span { display: flex; align-items: center; gap: 0.6em; }
  .battleMoraleBox { position: relative; display: flex; flex: 1; align-items: center; }
  .battleMoraleBox > .battleBar { flex: 1; }
  /* morale steps show over the ends of the bar under the pointer */
  #battleLayout .battleMoraleStep { position: absolute; top: 50%; width: 1.5em; height: 1.5em; padding: 0; border: 1px solid #fff; border-radius: 50%; background: var(--side); color: #fff; font-size: 0.85em; line-height: 1; opacity: 0; cursor: pointer; transform: translateY(-50%); transition: opacity 0.1s; }
  #battleLayout .battleMoraleStep::before { margin: 0; }
  #battleLayout .battleMoraleStep:hover { background: color-mix(in srgb, var(--side) 75%, #000); }
  .battleMoraleStep.icon-minus { left: -0.3em; }
  .battleMoraleStep.icon-plus { right: -0.3em; }
  #battleLayout .battleMoraleBox:hover > .battleMoraleStep { opacity: 1; }
  .battleStates { flex: 1; min-width: 0; overflow: hidden; font-size: 1.2em; text-overflow: ellipsis; white-space: nowrap; }
  .battleTroops { display: inline-flex; align-items: baseline; gap: 0.4em; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .battleCount > b { font-size: 1.2em; }
  .battleCount > span { color: var(--muted); }
  .battleBar { height: 0.5em; border: 1px solid #999; border-radius: 0.3em; overflow: hidden; }
  .battleBar > i { display: block; height: 100%; background: #3f9b3f; transition: width 0.15s linear; }
  .battleBar.mid > i { background: #e0a920; }
  .battleBar.low > i { background: var(--loss); }
  /* the side's order, or its tactic before the start: a chip in the side's colour */
  #battleLayout .battleOrdersButton { max-width: 100%; padding: 0.1em 0.6em; border: 1px solid color-mix(in srgb, var(--side) 45%, transparent); border-radius: 0.5em; background: color-mix(in srgb, var(--side) 10%, #fff); color: #333; cursor: pointer; }
  #battleLayout .battleOrdersButton:hover { border-color: var(--side); background: color-mix(in srgb, var(--side) 20%, #fff); }
  .battleOrder { display: block; overflow: hidden; text-overflow: ellipsis; }
  .battleBanner .battlePicker { flex: none; max-width: 14em; }
  .battleBanner .battlePicker > button::after { content: none; }
  .battleMenu.battleOrders { top: 100%; bottom: auto; min-width: 12em; }
  #battleTaskMenu { bottom: auto; min-width: 8em; box-shadow: 0.1em 0.2em 0.6em #0004; }
  .defenders .battleMenu.battleOrders { right: 0; left: auto; }
  #battleLayout .battleMenu > button.battleMenuBreak { border-top: 1px solid var(--line); }
  #battleTitle { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.7em; min-width: 0; }
  #battleTitle > div { display: flex; flex-direction: column; align-items: center; gap: 0.25em; min-width: 0; }
  /* the die of the round, in the side's colour: a click turns it to the next face */
  .battleDie { width: 3em; height: 3em; cursor: pointer; }
  .battleDie > rect { fill: var(--side); }
  .battleDie > circle { fill: #fff; }
  .battleDie:hover > rect { stroke: #333; }
  #battleName { position: relative; width: 16em; max-width: 100%; }
  #battleNameFull { width: 100%; padding: 0 0.4em; border-color: transparent; background: none; font-size: 1.15em; font-weight: bold; text-align: center; text-overflow: ellipsis; }
  #battleNameFull:not(:disabled):is(:hover, :focus) { border-color: #abadb3; background: #fff; }
  #battleNameTools { position: absolute; top: 0; right: 0; bottom: 0; display: none; background: #fff; }
  #battleName:hover > #battleNameTools, #battleName:focus-within > #battleNameTools { display: flex; }

  /* the scales: the power of each side, as its share of the ribbon */
  #battleBalance { position: relative; display: flex; width: clamp(11em, 22cqw, 16em); height: 1.6em; color: #fff; font-weight: bold; font-variant-numeric: tabular-nums; }
  #battleBalance > i { display: flex; align-items: center; min-width: 4.2em; padding: 0 0.7em 0 1.2em; box-sizing: border-box; background: var(--attackers); font-style: normal; clip-path: polygon(0.7em 0, 100% 0, 100% 100%, 0.7em 100%, 0 50%); transition: width 0.25s ease-out; }
  #battleBalance > i + i { flex: 1; justify-content: flex-end; padding: 0 1.2em 0 0.7em; background: var(--defenders); clip-path: polygon(0 0, calc(100% - 0.7em) 0, 100% 50%, calc(100% - 0.7em) 100%, 0 100%); }
  #battleBalance > b { position: absolute; top: 50%; left: var(--at, 50%); width: 0.75em; height: 0.75em; border: 1px solid #333; background: #fff; transform: translate(-50%, -50%) rotate(45deg); transition: left 0.25s ease-out; }

  /* the battlefield: as wide as the window, in the scene's shape; the scene under the weather, the overlay and the summary */
  #battleStage { position: relative; aspect-ratio: ${SCENE[0]} / ${SCENE[1]}; margin: 1px; outline: 1px solid #999; overflow: hidden; }
  #battleWeatherLayer, #battleOverlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  #battleScene { display: block; width: 100%; height: 100%; font-family: var(--serif); touch-action: none; }
  #battleScene.battlePanning { cursor: grabbing; }
  #battleScene.battleMuddy #battleMud, #battleScene.battleIcy #battleFrost { display: inline; }
  #battleScene.battleIcy .battleRiver { stroke: #e3edf3; }
  #battleScene.battleEditable .battleBattalion { cursor: grab; }
  #battleScene .battleSelected > .battleHalo, #battleScene.battleFocus .battleFocused > .battleHalo { display: inline; }
  #battleScene .battleTurnHandle { cursor: grab; }
  #battleScene.battlePlanning #battleBattalions { display: none; }
  #battleLog { --line: #ccc; --muted: #666; height: 100%; }
  #battleLog .attackers { --side: var(--attackers); }
  #battleLog .defenders { --side: var(--defenders); }
  #battleLogList { box-sizing: border-box; height: 100%; padding: 0.3em 0.6em; overflow-y: auto; line-height: 1.4; user-select: text; }
  #battleLogList > div { display: grid; grid-template-columns: max-content 0.6em minmax(0, 1fr); gap: 0.4em; align-items: baseline; }
  #battleLogList > div > i { color: var(--muted); font-style: normal; font-variant-numeric: tabular-nums; text-align: right; }
  #battleLogList > div > u { width: 0.6em; height: 0.6em; background: var(--side, transparent); }
  #battleLogList > div.order { color: var(--muted); }
  #battleLogList > div.end { font-weight: bold; }

  ${SUMMARY_STYLE}
  #battleFooter { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.4em 1em; }
  #battleFooter > div { display: flex; align-items: center; gap: 0.3em; min-width: 0; }
  #battleFooter button { height: 2em; box-sizing: border-box; } /* one height, whatever the icon */
  #battleRun, #battleResultRestart { min-width: 8em; }
  #battleRun.battlePause::before { content: "❚❚"; margin-right: 0.5em; font-size: 0.7em; vertical-align: 0.15em; }
  #battleSpeed { display: inline-flex; align-items: center; gap: 0.5em; margin: 0 0.6em; }
  #battleSpeed > input {
    --thumb: 0.9em;
    width: 12em; height: 2em; margin: 0; padding: 0; border: 0; appearance: none; cursor: pointer;
    background: linear-gradient(to right, #999 1px, transparent 1px) calc(var(--thumb) / 2) calc(50% + 0.55em) / calc((100% - var(--thumb)) / var(--steps)) 0.3em repeat-x;
  }
  #battleSpeed > input::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: linear-gradient(to right, var(--header) calc(var(--thumb) / 2 + (100% - var(--thumb)) * var(--fill)), #ddd 0); }
  #battleSpeed > input::-moz-range-track { height: 4px; border-radius: 2px; background: linear-gradient(to right, var(--header) calc(var(--thumb) / 2 + (100% - var(--thumb)) * var(--fill)), #ddd 0); }
  #battleSpeed > input::-webkit-slider-thumb { appearance: none; box-sizing: border-box; width: var(--thumb); height: var(--thumb); margin-top: calc(2px - var(--thumb) / 2); border: 1px solid var(--dark-solid); border-radius: 15%; background: var(--light-solid); box-shadow: 0.5px 0.5px 0 var(--dark-solid); }
  #battleSpeed > input::-moz-range-thumb { box-sizing: border-box; width: var(--thumb); height: var(--thumb); border: 1px solid var(--dark-solid); border-radius: 15%; background: var(--light-solid); box-shadow: 0.5px 0.5px 0 var(--dark-solid); }
  #battleSpeed > input:hover::-webkit-slider-thumb { background: var(--header); }
  #battleSpeed > input:hover::-moz-range-thumb { background: var(--header); }
  #battleSpeedLabel { min-width: 2.8em; font-weight: bold; font-variant-numeric: tabular-nums; }
  #battleClock { font-variant-numeric: tabular-nums; white-space: nowrap; }
  #battleLayout .battleMenu.battleHours { display: grid; grid-template-columns: repeat(4, auto); }
  #battleLayout .battleHours > button { padding: 0.3em 0.6em; font-variant-numeric: tabular-nums; }

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

// the camera

/** What a press on the field turns into once the pointer moves: a look round, a box picking battalions, or a drag of them */
type Gesture = "pan" | "box" | "move" | "turn";

/** The middle of the picked battalions, the way they mostly face, and how far before the middle their front is */
interface Pivot {
  x: number;
  y: number;
  facing: number;
  ahead: number;
}

interface Press {
  id: number;
  button: number;
  shift: boolean;
  touch: boolean;
  field: Point; // where it was pressed
  client: Point; // and on the screen
  battalion: Battalion | null; // under the pointer
  handle: boolean; // the turning handle
  dragged: number; // pixels: a click is no drag
  gesture: Gesture | null;
}

const MIN_CONTRAST = 25; // colours closer than that in Lab do not tell the sides apart

// the panels

const DIE_PIPS = [[4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]]; // cells of a 3x3 grid

const CONDITION_TIPS: Record<Condition, string> = {
  mud: t("Soaked ground slows troops off the roads, on open ground the most, and weakens their footing"),
  ice: t("Frozen ground slows troops, and they may cross the frozen rivers anywhere, as at a ford"),
  heat: t("Troops tire twice as fast in the heat")
};
const CONDITION_WORDS: Record<Condition, string> = { mud: t("mud"), ice: t("ice"), heat: t("heat") };
const CONDITION_LOG: Record<Condition, [off: string, on: string]> = {
  mud: [t("The ground dries"), t("The ground is soaked")],
  ice: [t("The ice thaws"), t("The rivers freeze over")],
  heat: [t("The heat breaks"), t("The heat sets in")]
};

const WORK_LABELS: Record<WorkKind, string> = { stakes: t("Stakes"), ditch: t("Ditch"), wagons: t("Wagons") };

class BattleScreenController {
  private readonly player = {
    playing: false,
    speed: 1,
    frame: 0,
    tickStart: 0,
    lastFrame: 0,
    previous: null as Positions | null
  };
  private battle: Battle | null = null;
  private regiments = new Map<string, Regiment>(); // the map's regiments in the battle, by state and id
  private script: Intervention[] = []; // changes still to come after a step back
  private planning = 0; // timer of the generals' thinking the battle through
  private camera: Camera | null = null;
  private cameraMode: CameraMode = "follow"; // manual while the user looks round by hand
  private trails: Trails = new Map(); // where each battalion stood at each round since the last key moment
  private colors: SideColors = SIDE_COLORS;

  // selection: battalions are picked by a click or a box; before the start they are dragged and turned together,
  // in the battle they take orders by a right click, or from the menu a click on a picked one opens

  private selected: string[] = []; // keys of the battalions picked
  private box: [Point, Point] | null = null; // dragged out to pick battalions, kept while the battle plays on
  private tasked: { keys: string[]; at: Point } | null = null; // the battalions the task menu is for, and where it opened
  private pointer: { x: number; y: number } | null = null; // over the battle screen
  private shownTip: string | null = null;
  private shownLog: LogEntry[] = []; // the entries the log window shows, to redraw from the first that changed
  private watching: BattleEvent | null = null; // a past battle played from its replay: nothing on the map moves
  private recording = false; // a past battle is being played out for its summary

  private readonly regimentKey = (regiment: { state: number; i: number }): string => `${regiment.state}-${regiment.i}`;

  private scene(): SVGSVGElement {
    return document.getElementById("battleScene") as unknown as SVGSVGElement;
  }

  private overlay(): SVGSVGElement {
    return document.getElementById("battleOverlay") as unknown as SVGSVGElement;
  }

  private battleOptions() {
    return options.app.battle;
  }

  open(attacker: Regiment, defender: Regiment): void {
    if (options.app.mode) return;
    Dialog.closeAll(".stable");
    options.app.mode = "battle"; // an edit mode keeps other dialogs from opening
    this.player.speed = this.battleOptions().view.speed;
    this.cameraMode = this.battleOptions().view.camera;

    try {
      this.renderDialog();
      this.regiments = new Map([attacker, defender].map(regiment => [this.regimentKey(regiment), regiment]));
      this.script = [];
      this.selected = [];
      this.setup([attacker], [defender]);
      this.openScreen();
    } catch (error) {
      this.closeBattleScreen(); // not left in the battle mode, which blocks the map
      throw error;
    }
    tip(
      t("Drag a box to pick troops, drag them to move, turn them by the handle, then start the battle"),
      true,
      "info",
      8000
    );
  }

  /** Watch a past battle again from its replay: no orders and no apply, nothing on the map moves */
  watch(eventId: number): void {
    const event = Events.get(eventId);
    if (options.app.mode || event?.type !== "battle" || !event.replay) return;
    Dialog.destroy("battleRecord"); // its summary has the screen's ids
    Dialog.closeAll(".stable");
    options.app.mode = "battle";
    this.player.speed = this.battleOptions().view.speed;
    this.cameraMode = this.battleOptions().view.camera;
    this.watching = event;
    try {
      this.renderDialog();
      this.regiments = new Map();
      this.selected = [];
      this.startWatching();
      this.openScreen();
      ensureEl("battleLayout").classList.add("watching");
    } catch (error) {
      this.closeBattleScreen(); // not left in the battle mode, which blocks the map
      throw error;
    }
  }

  /** The summary of a past battle, played out undrawn from its replay */
  async showRecord(eventId: number): Promise<void> {
    const event = Events.get(eventId);
    if (event?.type !== "battle" || !event.replay || this.recording) return;
    const label = t("Playing the battle out");
    tip(label, true, "info");
    this.recording = true;
    const battle = await BattleReplays.play(event.replay, share =>
      tip(`${label}: ${Math.round(share * 100)}%`, true, "info")
    ).finally(() => {
      this.recording = false;
    });
    clearMainTip();
    if (options.app.mode || Events.get(eventId) !== event) return; // the map changed, or a battle opened, while it played out
    const content = document.createElement("div");
    content.className = "battleRecord"; // its style is kept to it
    content.innerHTML = /* html */ `<style>${SUMMARY_STYLE} ${RECORD_STYLE}
        .battleRecord #battleSummary { --attackers: ${SIDE_COLORS.attackers}; --defenders: ${SIDE_COLORS.defenders}; }</style>
      ${BattleReplays.matches(battle, event) ? "" : `<p class="battleRecordDiffers">${RECORD_DIFFERS()}</p>`}
      <div id="battleSummary">${this.getSummary(battle, false, event)}</div>`;
    Dialog.message({
      id: "battleRecord",
      title: event.name,
      message: content,
      width: "46em",
      buttons: [{ label: t("Watch again"), onClick: () => this.watch(eventId) }, { label: t("Close") }]
    });
  }

  private startWatching(): void {
    const { battle, script, settled } = BattleReplays.start(this.watching!.replay!);
    Battles.applyDue(battle, script);
    Battles.plan(battle, settled);
    this.battle = battle;
    this.script = script;
    this.player.previous = null;
    this.resetTrails();
    this.drawField();
    this.drawScene();
    this.refresh();
  }

  /** Played to its end, or a past battle to the moment it was applied */
  private isOver(b: Battle): boolean {
    return Boolean(b.result) || (this.watching !== null && b.tick >= this.watching.replay!.tick);
  }

  private openScreen(): void {
    Dialog.open("battleScreen", {
      title: this.battle!.name,
      width: viewport.width * SCREEN_SHARE * 0.6, // a guess: fitDialog sets the size
      height: viewport.height * SCREEN_SHARE,
      minWidth: 320,
      minHeight: 320,
      position: POSITION,
      resizable: true,
      closeOnEscape: false, // Escape closes a menu or drops the pick: the battle is cancelled by its button only
      onClose: this.cancelResults
    });
    ensureEl("battleScreen")
      .closest<HTMLElement>(".dialog-window")!
      .addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        const menus = ensureEl("battleLayout").querySelectorAll<HTMLElement>(".battleMenu:not([hidden])");
        if (menus.length) this.closePickers();
        else this.setSelected([]);
      });
    this.fitDialog();
    this.toggleLog(this.battleOptions().view.log, false);
    this.player.lastFrame = 0;
    this.player.frame = requestAnimationFrame(this.loop);
  }

  /** Size the window by what really stands around the battlefield: as large a plan as the screen has room for */
  private fitDialog(): void {
    this.fitDialogOnce();
    this.fitDialogOnce(); // the guessed width stacks the sheets and the header: measure again at the fitted one
  }

  private fitDialogOnce(): void {
    const frame = ensureEl("battleScreen").closest<HTMLElement>(".dialog-window")!;
    const layout = ensureEl("battleLayout");
    const stage = ensureEl("battleStage");
    const { width, height } = frame.getBoundingClientRect();
    const style = getComputedStyle(layout);
    const content =
      layout.lastElementChild!.getBoundingClientRect().bottom - layout.firstElementChild!.getBoundingClientRect().top;
    const em = parseFloat(style.fontSize) || 12;
    const aroundX = width - stage.offsetWidth;
    const aroundY = height - layout.clientHeight + content - stage.offsetHeight;
    const maxHeight = viewport.height * SCREEN_SHARE;
    const room = Math.min(
      viewport.width * SCREEN_SHARE - aroundX,
      (maxHeight - aroundY) * VIEW_ASPECT,
      FIELD_WIDTH * em
    );
    const field = Math.max(Math.floor(room), 300);
    Dialog.update("battleScreen", {
      width: field + aroundX - (width - frame.clientWidth),
      height: Math.min(Math.round(field / VIEW_ASPECT) + aroundY, maxHeight),
      position: POSITION
    });
  }

  /** A new battle of the regiments; `from` carries over the settings of a battle played again */
  private setup(
    attackers: Regiment[],
    defenders: Regiment[],
    from?: Pick<Battle, "type" | "name" | "settings" | "seed" | "hour"> & { axis: number }
  ): void {
    const defender = defenders[0];
    const attacker = attackers[0];
    const { x, y } = this.battle ?? defender;
    const cell = Pack.findCell(x, y) ?? 0;
    const type = from?.type ?? this.defineType(attacker, defender, cell);
    const place = this.battle ? this.battle.place : BattleSite.getPlaceName(cell); // kept, as the name is
    const point = { x, y };
    const seed = from?.seed ?? Math.floor(Math.random() * 2 ** 31);

    this.battle = Battles.create({
      type,
      name: from?.name ?? this.battle?.name ?? BattleRules.getName(type, place),
      place,
      x,
      y,
      cell,
      axis: from?.axis ?? Math.atan2(y - (attacker.py ?? attacker.y), x - (attacker.px ?? attacker.x)),
      field: this.buildField(x, y, type),
      units: options.map.military.units,
      populationScale: options.map.units.population.scale,
      attackers: attackers.map(regiment => this.toBattleRegiment(regiment, point)),
      defenders: defenders.map(regiment => this.toBattleRegiment(regiment, point)),
      settings: from?.settings ?? this.battleOptions().simulation,
      seed,
      hour: from?.hour ?? BattleTime.getHour(seed),
      latitude: this.getLatitude(y),
      ...this.getClimate(cell)
    });

    this.player.previous = null;
    this.resetTrails();
    this.drawField();
    this.drawScene();
    this.refresh();
  }

  private getLatitude(y: number): number {
    return getLatitude(y, options.map.geography.coordinates, options.map.graph.height);
  }

  /** The weather the place's climate is likely to give, the same every time for the same cell */
  private getClimate(cell: number): ReturnType<typeof BattleWeather.getClimate> {
    const gridCell = pack.cells.g[cell];
    return BattleWeather.getClimate(grid.cells.prec[gridCell] ?? 0, grid.cells.temp[gridCell] ?? 15, cell);
  }

  private buildField(x: number, y: number, type: BattleType) {
    if (type === "naval") return Battlefields.createEmpty("sea");
    if (type === "air") return Battlefields.createEmpty("sky");
    return Battlefields.createMapField(x, y); // built to the scale of the battalions
  }

  private toBattleRegiment(regiment: Regiment, point: { x: number; y: number }): BattleRegiment {
    const distance = Math.hypot(point.y - regiment.by, point.x - regiment.bx) * options.map.units.distance.scale;
    return {
      state: regiment.state,
      i: regiment.i,
      name: regiment.name,
      icon: regiment.icon ?? "",
      troops: Object.fromEntries(
        Object.entries(regiment.u).map(([unit, points]) => [unit, Military.getTroops(points)])
      ),
      upkeep: Military.getBattleUpkeep(regiment.state), // ill-kept troops fight weaker
      stability: Stability.get(regiment.state)?.stability ?? 0.5,
      distance: distance | 0
    };
  }

  private defineType(attacker: Regiment, defender: Regiment, cell: number): BattleType {
    const typesA = Military.getUnitTypes(attacker);
    const flying = (types: (string | undefined)[]): boolean => types.every(type => type === "aviation");
    const burg = pack.cells.burg[cell];

    if (attacker.n && defender.n) return "naval";
    if (flying(typesA) && flying(Military.getUnitTypes(defender))) return "air";
    if (attacker.n && !defender.n && typesA.some(type => type !== "naval")) return "landing";
    if (pack.burgs[burg]?.walls && (!attacker.n || pack.burgs[burg].port)) return "siege"; // ships besiege a port only
    if (attacker.n && !defender.n) return "bombardment"; // ships alone cannot land
    const hidden = !burg && Battlefields.hidesTroops(pack.cells.biome[cell]) && BattleSite.hasRoad(cell); // a column is caught on a road
    if (hidden && Military.getRegimentPower(defender) < Military.getRegimentPower(attacker) * AMBUSH_ODDS)
      return "ambush";
    return "field";
  }

  private renderDialog(): void {
    findEl("battleScreen")?.remove();
    findEl("regimentSelectorScreen")?.remove();
    Dialog.destroy("battleLog");

    const banner = (side: Side): string => /* html */ `<div id="battleBanner_${side}" class="battleBanner ${side}">
        <span class="battleEmblems"></span>
        <span class="battleBannerText">
          <span>
            <b class="battleStates"></b>
            <span class="battlePicker">
              <button class="battleOrdersButton" data-tip="${t("Click to give the side an order. Each order is written to the battle log")}"><span class="battleOrder"></span></button>
              <div class="battleMenu battleOrders" hidden></div>
            </span>
          </span>
          <span>
            <span class="battleMoraleBox">
              <div class="battleBar battleMorale"><i></i></div>
              <button class="battleMoraleStep icon-minus" data-step="-${MORALE_STEP}" data-tip="${t("Lower the side's morale by {{value}}", { value: MORALE_STEP })}"></button>
              <button class="battleMoraleStep icon-plus" data-step="${MORALE_STEP}" data-tip="${t("Raise the side's morale by {{value}}", { value: MORALE_STEP })}"></button>
            </span>
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
            <svg id="battleScene" preserveAspectRatio="xMidYMid meet"></svg>
            <canvas id="battleWeatherLayer" hidden></canvas>
            <svg id="battleOverlay" preserveAspectRatio="xMidYMid meet" font-family="Georgia, serif"></svg>
            <div id="battleSummary" hidden></div>
            <div id="battleTaskMenu" class="battleMenu" hidden></div>
          </div>
          <div id="battleFooter">
            <div>
              <button id="battleRun" data-tip="${t("Start or pause the battle")}"></button>
              <button id="battleResultRestart" class="icon-ccw" data-tip="${t("Play the same battle again from the start")}" hidden> ${t("Play again")}</button>
              <button id="battleStepBack" data-tip="${t("Take the battle back by a single step")}" class="icon-left-open"></button>
              <button id="battleStep" data-tip="${t("Advance the battle by a single step")}" class="icon-right-open"></button>
              <button id="battleRestart" data-tip="${t("Play the same battle again from the start")}" class="icon-ccw"></button>
              <label id="battleSpeed" data-tip="${t("Battle speed")}">
                <input type="range" min="0" max="${BATTLE_SPEEDS.length - 1}" step="1" value="${BATTLE_SPEEDS.indexOf(this.player.speed)}" style="--steps: ${BATTLE_SPEEDS.length - 1}; --fill: ${BATTLE_SPEEDS.indexOf(this.player.speed) / (BATTLE_SPEEDS.length - 1)}" />
                <span id="battleSpeedLabel">×${BattleAnimation.getPlayback(TICK_MS, this.player.speed)}</span>
              </label>
              <span class="battlePicker">
                <button id="battleClock"></button>
                <div class="battleMenu battleHours" hidden>
                  ${Array.from({ length: 24 }, (_, hour) => `<button data-hour="${hour}" data-tip="${PERIOD_LABELS[BattleTime.getPeriod(hour)]}">${BattleTime.formatClock(hour, 0).slice(0, 5)}</button>`).join("")}
                </div>
              </span>
            </div>
            <div>
              <span class="battlePicker">
                <button id="battleType"></button>
                <div class="battleMenu battleTypes" hidden>
                  ${BATTLE_TYPES.map(type => `<button data-tip="${this.typeTip(type)}" data-type="${type}" class="icon-button-${type}">${BATTLE_TYPE_LABELS[type]}</button>`).join("")}
                </div>
              </span>
              <span class="battlePicker">
                <button id="battleWeather"></button>
                <div class="battleMenu battleWeathers" hidden>
                  ${WEATHERS.map(weather => `<button data-weather="${weather}" class="icon-button-${weather}">${WEATHER_LABELS[weather]}</button>`).join("")}
                  ${CONDITIONS.map(condition => `<button data-condition="${condition}" class="icon-button-${condition}" data-tip="${CONDITION_TIPS[condition]}">${CONDITION_LABELS[condition]}</button>`).join("")}
                </div>
              </span>
              <button id="battleRoll" data-tip="${t("Draw the troops up anew. Only before the battle starts")}" class="icon-arrows-cw"></button>
              <button id="battleConfigureOpen" data-tip="${t("Configure Battle: view, rendering, playback, simulation and export")}" class="icon-cog"></button>
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
      <div id="battleLog" class="dialog"><div id="battleLogList"></div></div>
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

    ensureEl("battleRun").addEventListener("click", () => (this.player.playing ? this.pause() : this.play()));
    ensureEl("battleStepBack").addEventListener("click", () => this.stepBack());
    ensureEl("battleStep").addEventListener("click", () => this.step());
    ensureEl("battleRestart").addEventListener("click", () => this.restart());
    ensureEl("battleResultRestart").addEventListener("click", () => this.restart());
    ensureEl("battleSpeed").addEventListener("input", event => {
      const input = event.target as HTMLInputElement;
      input.style.setProperty("--fill", String(+input.value / (BATTLE_SPEEDS.length - 1)));
      this.setSpeed(BATTLE_SPEEDS[+input.value]);
    });
    // dragged by the mouse, the slider lets the focus go: Space starts and stops the battle again
    ensureEl("battleSpeed").addEventListener("pointerup", event => (event.target as HTMLElement).blur());
    ensureEl("battleType").addEventListener("click", event => this.togglePicker(event));
    ensureEl("battleType").nextElementSibling!.addEventListener("click", event => this.changeType(event));
    ensureEl("battleWeather").addEventListener("click", event => this.togglePicker(event));
    ensureEl("battleWeather").nextElementSibling!.addEventListener("click", event => this.changeWeather(event));
    ensureEl("battleClock").addEventListener("click", event => this.togglePicker(event));
    ensureEl("battleClock").nextElementSibling!.addEventListener("click", event => this.changeHour(event));
    ensureEl("battleRoll").addEventListener("click", () => this.redeploy());
    ensureEl("battleConfigureOpen").addEventListener("click", () =>
      BattleConfigure.open({
        tickMs: TICK_MS,
        onChange: group => this.applyOptions(group),
        getSource: () => this.getSource(),
        pause: () => this.pause(),
        toggleLog: () => this.toggleLog(),
        watching: this.watching !== null
      })
    );
    ensureEl<HTMLInputElement>("battleNameFull").addEventListener("change", event => {
      this.setName((event.target as HTMLInputElement).value);
    });
    ensureEl("battleNameCulture").addEventListener("click", () => this.generateBattleName("culture"));
    ensureEl("battleNameRandom").addEventListener("click", () => this.generateBattleName("random"));
    ensureEl("battleApply").addEventListener("click", () => this.applyResults());
    ensureEl("battleCancel").addEventListener("click", () => this.cancelResults());
    ensureEl("battleWiki").addEventListener("click", () => wiki("Battle-Simulator"));
    ensureEl("battleSummary").addEventListener("click", event => {
      const target = event.target as HTMLElement;
      const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
      if (action === "restart") this.restart();
      else if (action === "apply") this.applyResults();
      else if (action === "close" || target.id === "battleSummary") ensureEl("battleSummary").hidden = true;
    });

    // a battalion under the pointer shows its regiment in the sheet
    this.scene().addEventListener("pointerover", event => {
      const el = (event.target as Element).closest(".battleBattalion");
      const battalion = el && select<Element, Battalion>(el).datum();
      this.focusRegiment(battalion ? `${battalion.state}-${battalion.regiment}` : null, false);
      if (this.battle) BattleSceneView.hoverBattalion(this.scene(), this.battle, battalion ? battalion.id : null);
    });
    this.scene().addEventListener("pointerleave", () => {
      this.focusRegiment(null);
      if (this.battle) BattleSceneView.hoverBattalion(this.scene(), this.battle, null);
    });
    this.bindCamera();
    const screen = ensureEl("battleScreen");
    screen.addEventListener("pointermove", event => {
      this.pointer = { x: event.clientX, y: event.clientY };
      this.shownTip = null; // the hover tips of the app may have shown another
      this.retip();
    });
    screen.addEventListener("pointerleave", () => {
      this.pointer = null;
      showMainTip();
    });

    for (const side of SIDES) {
      const el = ensureEl(`battleSide_${side}`);
      el.querySelector(".battleAddRegiment")!.addEventListener("click", () => this.addSide(side));
      ensureEl(`battleDie_${side}`).addEventListener("click", () => this.turnDie(side));
      const banner = ensureEl(`battleBanner_${side}`);
      banner.querySelector(".battleOrdersButton")!.addEventListener("click", event => this.openOrders(event, side));
      banner.querySelector(".battleOrders")!.addEventListener("click", event => this.giveOrder(event, side));
      for (const button of banner.querySelectorAll<HTMLElement>(".battleMoraleStep"))
        button.addEventListener("click", () => this.changeMorale(side, +button.dataset.step!));

      // a regiment under the pointer stands out on the battlefield
      const list = el.querySelector<HTMLElement>(".battleRegimentList")!;
      list.addEventListener("pointerover", event => {
        this.focusRegiment((event.target as Element).closest<HTMLElement>(".battleRegiment")?.dataset.key ?? null);
      });
      list.addEventListener("pointerleave", () => this.focusRegiment(null));
      list.addEventListener("click", event => {
        const button = (event.target as Element).closest(".battleWithdraw");
        if (!button) return;
        event.preventDefault(); // the row stays as it is
        this.withdrawRegiment(button.closest<HTMLElement>(".battleRegiment")!.dataset.key!);
      });
    }
  }

  /** The battle log, a window of its own beside the battle screen */
  private toggleLog(show = !Dialog.isOpen("battleLog"), keep = true): void {
    if (keep) Options.set(o => (o.app.battle.view.log = show));
    BattleConfigure.setLogShown(show);
    if (!show) Dialog.close("battleLog");
    if (!show || Dialog.isOpen("battleLog")) return;
    Dialog.open("battleLog", {
      title: t("Battle log"),
      width: "22em",
      height: Math.min(viewport.height * 0.6, 520),
      minWidth: 200,
      minHeight: 120,
      resizable: true,
      persistent: true, // its markup is the battle screen's
      position: { my: "left top", at: "right+8 top", of: "#battleScreen" },
      onClose: () => {
        BattleConfigure.setLogShown(false);
        Options.set(o => (o.app.battle.view.log = false));
      }
    });
    const list = ensureEl("battleLogList");
    list.scrollTop = list.scrollHeight;
  }

  /** Zoom with the wheel or a pinch at the pointer, pan by dragging empty ground: the camera stops following */
  private bindCamera(): void {
    const svg = this.scene();
    const pointers = new Map<number, [number, number]>();
    let press: Press | null = null;
    const toField = (x: number, y: number): Point => {
      const rect = svg.getBoundingClientRect();
      const { view } = this.camera!;
      return [
        view.x + ((x - rect.left) / rect.width) * view.width,
        view.y + ((y - rect.top) / rect.height) * view.height
      ];
    };
    const look = (view: Camera["view"]): void => {
      this.cameraMode = "manual";
      this.camera = { view, target: view };
      this.updateCamera(0);
    };
    const getGesture = ({ touch, button, handle, battalion }: Press): Gesture => {
      if (touch || button !== 0) return "pan";
      if (handle && this.isEditable()) return "turn";
      return battalion && this.isEditable() ? "move" : "box";
    };

    svg.addEventListener(
      "wheel",
      event => {
        if (!this.camera || !this.battle) return;
        event.preventDefault();
        look(
          BattleCamera.zoomView(
            this.battle.field,
            this.camera.view,
            Math.exp(-event.deltaY * 0.0015),
            toField(event.clientX, event.clientY)
          )
        );
      },
      { passive: false }
    );
    svg.addEventListener("contextmenu", event => event.preventDefault()); // a right click gives an order
    ensureEl("battleTaskMenu").addEventListener("click", event => this.giveSpotTask(event));
    svg.addEventListener("pointerdown", event => {
      pointers.set(event.pointerId, [event.clientX, event.clientY]);
      if (!this.camera || !this.battle) return;
      if (pointers.size > 1) {
        if (press) this.cancelPress(press);
        press = null; // two fingers zoom
        return;
      }
      const target = event.target as Element;
      const el = target.closest(".battleBattalion");
      press = {
        id: event.pointerId,
        button: event.button,
        shift: event.shiftKey,
        touch: event.pointerType === "touch",
        field: toField(event.clientX, event.clientY),
        client: [event.clientX, event.clientY],
        battalion: el ? select<Element, Battalion>(el).datum() : null,
        handle: Boolean(target.closest(".battleTurnHandle")),
        dragged: 0,
        gesture: null
      };
    });
    svg.addEventListener("pointermove", event => {
      const was = pointers.get(event.pointerId);
      if (!was || !this.camera || !this.battle) return;
      const now: [number, number] = [event.clientX, event.clientY];
      pointers.set(event.pointerId, now);
      const { field } = this.battle;
      if (pointers.size === 2) {
        const other = [...pointers].find(([id]) => id !== event.pointerId)![1];
        const factor =
          Math.hypot(now[0] - other[0], now[1] - other[1]) / (Math.hypot(was[0] - other[0], was[1] - other[1]) || 1);
        look(
          BattleCamera.zoomView(
            field,
            this.camera.view,
            factor,
            toField((now[0] + other[0]) / 2, (now[1] + other[1]) / 2)
          )
        );
        return;
      }
      if (press?.id !== event.pointerId) return;
      press.dragged += Math.hypot(now[0] - was[0], now[1] - was[1]);
      if (!press.gesture) {
        if (press.dragged < 4) return;
        press.gesture = getGesture(press);
        svg.setPointerCapture(event.pointerId);
        if (press.gesture === "pan") svg.classList.add("battlePanning");
        if (press.gesture === "move" && !this.selected.includes(press.battalion!.key))
          this.setSelected([press.battalion!.key]);
      }
      if (press.gesture === "pan") {
        const scale = this.camera.view.width / svg.getBoundingClientRect().width;
        look(BattleCamera.panView(field, this.camera.view, (was[0] - now[0]) * scale, (was[1] - now[1]) * scale));
      } else this.dragTo(press, toField(...now), false);
    });
    const release = (event: PointerEvent, done: boolean): void => {
      pointers.delete(event.pointerId);
      if (!pointers.size) svg.classList.remove("battlePanning");
      if (press?.id !== event.pointerId || !this.battle || !this.camera) return;
      const ended = press;
      press = null;
      if (!done) this.cancelPress(ended);
      else if (ended.gesture) this.dragTo(ended, toField(event.clientX, event.clientY), true);
      else this.clickField(ended);
    };
    svg.addEventListener("pointerup", event => release(event, true));
    svg.addEventListener("pointercancel", event => release(event, false));
    svg.addEventListener("dblclick", event => {
      if ((event.target as Element).closest(".battleBattalion")) return; // a battalion is turned
      this.cameraMode = this.battleOptions().view.camera;
    });
  }

  /** Troops are placed by hand only before the start, while it stands still */
  private isEditable(): boolean {
    return this.scene().classList.contains("battleEditable");
  }

  private getSelected(): Battalion[] {
    return this.battle?.battalions.filter(battalion => this.selected.includes(battalion.key)) ?? [];
  }

  private setSelected(keys: string[]): void {
    this.selected = keys;
    this.showSelection();
  }

  private showSelection(): void {
    const b = this.battle;
    if (!b) return;
    const battalions = this.getSelected();
    BattleSceneView.selectBattalions(
      this.scene(),
      b,
      battalions.map(battalion => battalion.id)
    );
    const pivot = this.isEditable() && battalions.length ? this.getPivot(battalions) : null;
    BattleSceneView.drawSelection(this.scene(), b, { box: this.box, handle: pivot && this.getHandle(pivot, 0) });
  }

  /** The middle of the picked battalions, the way they mostly face, and how far before the middle their front is */
  private getPivot(battalions: Battalion[]): Pivot {
    const x = sum(battalions, battalion => battalion.x) / battalions.length;
    const y = sum(battalions, battalion => battalion.y) / battalions.length;
    const facing = Math.atan2(
      sum(battalions, battalion => Math.sin(battalion.facing)),
      sum(battalions, battalion => Math.cos(battalion.facing))
    );
    const [cos, sin] = [Math.cos(facing), Math.sin(facing)];
    const ahead = Math.max(
      ...battalions.map(battalion => (battalion.x - x) * cos + (battalion.y - y) * sin + battalion.depth / 2)
    );
    return { x, y, facing, ahead };
  }

  /** The turning handle a little before the front of the picked battalions, turned with them by `turn` */
  private getHandle({ x, y, facing, ahead }: Pivot, turn: number): Selection["handle"] {
    const way = facing + turn;
    const off = ahead + this.battle!.field.front * 0.6;
    return { at: [x + Math.cos(way) * off, y + Math.sin(way) * off], facing: way };
  }

  /** Where a drag puts the picked battalions: moved by the drag, or turned round their middle */
  private getPlaces(press: Press, to: Point): Positions {
    const battalions = this.getSelected();
    const places: Positions = new Map();
    if (press.gesture === "move") {
      const [dx, dy] = [to[0] - press.field[0], to[1] - press.field[1]];
      for (const battalion of battalions)
        places.set(battalion.id, { x: battalion.x + dx, y: battalion.y + dy, facing: battalion.facing });
      return places;
    }
    const pivot = this.getPivot(battalions);
    const turn =
      Math.atan2(to[1] - pivot.y, to[0] - pivot.x) - Math.atan2(press.field[1] - pivot.y, press.field[0] - pivot.x);
    const [cos, sin] = [Math.cos(turn), Math.sin(turn)];
    for (const { id, x, y, facing } of battalions) {
      const [ox, oy] = [x - pivot.x, y - pivot.y];
      places.set(id, { x: pivot.x + ox * cos - oy * sin, y: pivot.y + ox * sin + oy * cos, facing: facing + turn });
    }
    return places;
  }

  /** A box or a drag followed by the pointer; done, it picks the battalions in the box or puts them where they were dragged */
  private dragTo(press: Press, to: Point, done: boolean): void {
    const b = this.battle!;
    if (press.gesture === "box") {
      this.box = done ? null : [press.field, to];
      if (!done) {
        BattleSceneView.drawSelection(this.scene(), b, { box: this.box, handle: null });
        return;
      }
      const [x0, x1] = [Math.min(press.field[0], to[0]), Math.max(press.field[0], to[0])];
      const [y0, y1] = [Math.min(press.field[1], to[1]), Math.max(press.field[1], to[1])];
      const inBox = b.battalions.filter(
        battalion =>
          battalion.x >= x0 && battalion.x <= x1 && battalion.y >= y0 && battalion.y <= y1 && this.isPickable(battalion)
      );
      // in the battle the orders go to one side: the one with more battalions in the box
      const side =
        b.tick && inBox.filter(battalion => battalion.side === "attackers").length * 2 < inBox.length
          ? "defenders"
          : "attackers";
      this.setSelected(inBox.filter(battalion => !b.tick || battalion.side === side).map(battalion => battalion.key));
      return;
    }

    const places = this.getPlaces(press, to);
    if (!done) {
      BattleSceneView.previewBattalions(this.scene(), places);
      // the turning handle goes with the battalions, moved or turned
      const placed = this.getSelected().map(battalion => ({ ...battalion, ...places.get(battalion.id)! }));
      BattleSceneView.drawSelection(this.scene(), b, { box: null, handle: this.getHandle(this.getPivot(placed), 0) });
      return;
    }
    if (b.tick) {
      this.cancelPress(press); // the battle began under the drag: troops are placed only before the start
      return;
    }
    for (const battalion of this.getSelected()) {
      const place = places.get(battalion.id)!;
      if (place.x !== battalion.x || place.y !== battalion.y)
        Battles.intervene(b, { tick: b.tick, kind: "move", battalion: battalion.key, x: place.x, y: place.y });
      if (place.facing !== battalion.facing)
        Battles.intervene(b, { tick: b.tick, kind: "turn", battalion: battalion.key, facing: place.facing });
    }
    BattleSceneView.updateBattalions(this.scene(), b, null, 1);
    this.refresh();
  }

  /** A drag let go of as if it had not been */
  private cancelPress(press: Press): void {
    this.box = null;
    if (!press.gesture || press.gesture === "pan" || !this.battle) return;
    BattleSceneView.updateBattalions(this.scene(), this.battle, null, 1);
    this.showSelection();
  }

  /**
   * A click picks a battalion or drops the pick; in the battle a right or a shift click gives the picked an order, and a
   * click on a picked one opens the orders they take on their own spots
   */
  private clickField(press: Press): void {
    const b = this.battle!;
    if (press.handle) return;
    const live = b.tick && !b.result;
    const picked = press.battalion && this.selected.includes(press.battalion.key) && this.isPickable(press.battalion);
    if (live && (press.button === 2 || (press.button === 0 && press.shift))) this.giveTask(press);
    else if (live && press.button === 0 && picked) this.openTasks(press);
    else if (press.button === 0)
      this.setSelected(press.battalion && this.isPickable(press.battalion) ? [press.battalion.key] : []);
  }

  /** The orders the picked battalions of the clicked one's side take on their own spots, at the click */
  private openTasks(press: Press): void {
    const b = this.battle!;
    const clicked = press.battalion!;
    const battalions = this.getSelected().filter(
      battalion => battalion.side === clicked.side && this.isPickable(battalion)
    );
    const tasks = new Set(battalions.flatMap(battalion => Battalions.getTasks(b, battalion)));
    const shown = (Object.keys(BATTLE_ORDER_LABELS) as Command[]).filter(task => tasks.has(task as TaskKind));
    const menu = ensureEl("battleTaskMenu");
    menu.innerHTML = shown
      .map(
        task =>
          `<button data-task="${task}" data-tip="${this.taskTip(task)}" class="icon-button-${task} ${task === clicked.byHand.task?.kind ? "current" : ""}">${BATTLE_ORDER_LABELS[task]}</button>`
      )
      .join("");
    this.tasked = { keys: battalions.map(battalion => battalion.key), at: press.field };
    this.closePickers();
    menu.hidden = false;
    // at the click, within the plan
    const stage = ensureEl("battleStage").getBoundingClientRect();
    const left = Math.min(press.client[0] - stage.left, stage.width - menu.offsetWidth);
    const top = Math.min(press.client[1] - stage.top, stage.height - menu.offsetHeight);
    Object.assign(menu.style, { left: `${Math.max(left, 0)}px`, top: `${Math.max(top, 0)}px` });
    setTimeout(() => document.addEventListener("click", this.closePickers, { once: true })); // after this click
  }

  private giveSpotTask(event: Event): void {
    const b = this.battle!;
    const task = (event.target as HTMLElement).closest<HTMLElement>("[data-task]")?.dataset.task as TaskKind;
    if (!task || !this.tasked || !b.tick || b.result) return;
    const [x, y] = this.tasked.at;
    Battles.intervene(b, { tick: b.tick, kind: "task", battalions: this.tasked.keys, task, x, y, target: null });
    this.refresh();
  }

  /** In the battle only battalions that take orders are picked */
  private readonly isPickable = (battalion: Battalion): boolean =>
    !this.battle!.tick || (battalion.status === "ready" && !battalion.leaving);

  /** The picked battalions of a side go where the user points, attack the foe pointed at, pursue it broken, or protect the friend */
  private giveTask(press: Press): void {
    const b = this.battle!;
    const own = this.getSelected().filter(this.isPickable);
    if (!own.length) return;
    const side = own[0].side;
    const battalions = own.filter(battalion => battalion.side === side);
    const pointed = press.battalion && !battalions.includes(press.battalion) ? press.battalion : null;
    const broken = pointed?.status === "routed" && pointed.side !== side;
    const target = pointed?.status === "ready" || broken ? pointed : null;
    const task = !target ? "move" : broken ? "pursue" : target.side === side ? "protect" : "attack";
    const [x, y] = target ? [target.x, target.y] : press.field;
    const keys = battalions.map(battalion => battalion.key);
    Battles.intervene(b, { tick: b.tick, kind: "task", battalions: keys, task, x, y, target: target?.key ?? null });
    this.refresh();
  }

  /** The camera `elapsed` seconds of screen time later, and the overlay that stays put over the view */
  private updateCamera(elapsed: number): void {
    const b = this.battle;
    if (!b || !this.camera) return;
    this.camera = BattleCamera.move(
      this.camera,
      b.field,
      BattleCamera.toCameraTroops(b.battalions),
      this.cameraMode,
      elapsed
    );
    BattleSceneView.setView(this.scene(), b.field, this.camera.view);
    this.drawLight();
    const look = this.battleOptions().rendering;
    BattleOverlayView.draw(this.overlay(), {
      title: b.name,
      clock: BattleTime.formatClock(b.hour, b.tick),
      viewWidth: this.camera.view.width,
      look
    });
  }

  /** The light of the hour and the weather; drawn anew only when it changed */
  private drawLight(): void {
    BattleSceneView.drawLight(this.scene(), this.battle!);
  }

  /** The ground drawn anew: the camera frames it at once, in its chosen mode */
  private drawField(): void {
    const b = this.battle!;
    BattleSceneView.drawField(this.scene(), b.field, b.scene);
    if (this.cameraMode === "manual") this.cameraMode = this.battleOptions().view.camera;
    this.camera = BattleCamera.create(b.field);
    this.updateCamera(Infinity);
  }

  /** The sides by the leading state of each, the one with the most troops; red and blue when those look alike */
  private getSideColors(b: Battle): SideColors {
    if (this.battleOptions().rendering.colors === "sides") return SIDE_COLORS;
    const leading = (side: Side): number => {
      const troops = new Map<number, number>();
      for (const regiment of b[side].regiments)
        troops.set(regiment.state, (troops.get(regiment.state) ?? 0) + sum(Object.values(regiment.troops)));
      return [...troops].sort((a, z) => z[1] - a[1])[0]?.[0] ?? 0;
    };
    const [attackers, defenders] = SIDES.map(side => {
      const color = this.stateOf(leading(side))?.color;
      return color && /^#[\da-f]{6}$/i.test(color) ? color : SIDE_COLORS[side];
    });
    return getColorDistance(attackers, defenders) < MIN_CONTRAST ? SIDE_COLORS : { attackers, defenders };
  }

  /** The colours allied states fly, by their ids in the battle on screen */
  private getFlags(): StateColors {
    const ids = this.watching?.replay
      ? Events.foughtStateIds(this.watching.replay)
      : pack.states.flatMap(({ i, removed }) => (i && !removed ? [i] : []));
    return Object.fromEntries(ids.map(id => [id, this.stateColor(id)]));
  }

  /** What the scene draws and in which colours, from the options */
  private applyLook(): void {
    this.colors = this.getSideColors(this.battle!);
    BattleSceneView.setLook(this.scene(), this.battleOptions().rendering, this.colors, this.getFlags());
    for (const id of ["battleLayout", "battleLog"])
      for (const side of SIDES) ensureEl(id).style.setProperty(`--${side}`, this.colors[side]);
  }

  /** Where each battalion went since the last key moment, shown while paused */
  private resetTrails(): void {
    this.trails = new Map(this.battle!.battalions.map(battalion => [battalion.id, [[battalion.x, battalion.y]]]));
  }

  private showArrows(): void {
    const b = this.battle!;
    BattleSceneView.drawArrows(this.scene(), b, !this.player.playing && b.tick ? this.trails : null);
  }

  /** The screen's options changed in Configure Battle */
  private applyOptions(group: keyof typeof options.app.battle): void {
    const b = this.battle;
    if (!b) return;
    if (group === "view") {
      this.cameraMode = this.battleOptions().view.camera;
      if (this.player.speed !== this.battleOptions().view.speed) this.setSpeed(this.battleOptions().view.speed);
      this.toggleLog(this.battleOptions().view.log, false);
      BattleSceneView.updateBattalions(this.scene(), b, null, 1); // the battle plan overlay
    } else if (group === "rendering") {
      this.drawScene();
      this.drawWeather();
      this.updateCamera(0);
    } else if (group === "simulation" && !b.tick) {
      // a battle under way never changes; before the start it is set up anew, as by a change of armies
      const { field } = b;
      b.settings = { ...this.battleOptions().simulation };
      Battles.rethink(b);
      Battles.prepare(b);
      if (b.field !== field) this.drawField();
      this.drawScene();
      this.refresh();
    }
  }

  /** Mark a regiment in its sheet and, unless the pointer is on the field already, its troops on the field */
  private focusRegiment(key: string | null, onField = true): void {
    for (const row of ensureEl("battleLayout").querySelectorAll<HTMLElement>(".battleRegiment")) {
      row.classList.toggle("battleFocused", row.dataset.key === key);
    }
    this.scene().classList.toggle("battleFocus", onField && key !== null);
    select(this.scene())
      .selectAll<SVGGElement, Battalion>(".battleBattalion")
      .classed("battleFocused", battalion => `${battalion.state}-${battalion.regiment}` === key);
  }

  // the player

  /** The generals have not thought the battle through yet: it cannot start */
  private isPlanning(): boolean {
    return Boolean(this.battle && !this.battle.tick && !this.battle.planned);
  }

  /** Let the generals think once the screen has shown that they do: it takes up to a second */
  private schedulePlan(): void {
    if (this.planning || !this.isPlanning()) return;
    this.planning = window.setTimeout(() => {
      this.planning = 0;
      const b = this.battle; // the one on screen by now
      if (!b) return;
      Battles.plan(b);
      BattleSceneView.updateBattalions(this.scene(), b, null, 1);
      this.refresh();
    }, 30);
  }

  private play(): void {
    const b = this.battle!;
    if (this.isOver(b) || this.isPlanning()) return;
    this.player.playing = true;
    this.player.tickStart = performance.now();
    this.resetTrails(); // the paused moment is the key moment the arrows start from
    this.showArrows();
    this.setEditable();
    if (!this.player.previous && this.advance()) this.pause();
  }

  private pause(): void {
    this.player.playing = false;
    this.player.previous = null;
    if (this.battle) {
      BattleSceneView.updateBattalions(this.scene(), this.battle, null, 1);
      this.showArrows();
    }
    this.setEditable();
  }

  /** A tick or a round on, as the step is set */
  private step(): void {
    const b = this.battle;
    if (!b || this.isOver(b) || this.isPlanning()) return;
    this.pause();
    const round = this.battleOptions().playback.step === "round";
    do this.advance();
    while (round && b.tick % ROUND_TICKS && !this.isOver(b));
    this.player.previous = null;
    BattleSceneView.updateBattalions(this.scene(), b, null, 1);
    this.showArrows();
  }

  /** A tick or a round back: the battle is played anew from its start up to there, every change made coming at its moment */
  private stepBack(): void {
    const b = this.battle;
    if (!b?.tick || this.isPlanning()) return;
    this.pause();
    const round = this.battleOptions().playback.step === "round";
    const target = round ? (Math.ceil(b.tick / ROUND_TICKS) - 1) * ROUND_TICKS : b.tick - 1;
    const start = this.startAnew(b);
    const anew = start.battle;
    Battles.applyDue(anew, start.script);
    Battles.plan(anew, start.settled);
    while (anew.tick < target && !anew.result) {
      Battles.applyDue(anew, start.script);
      Battles.tick(anew);
    }
    Battles.applyDue(anew, start.script); // the changes made while it stood there
    this.battle = anew;
    this.script = start.script;
    this.player.previous = null;
    this.resetTrails();
    this.drawScene();
    this.refresh();
  }

  private setSpeed(speed: number): void {
    if (!BATTLE_SPEEDS.includes(speed)) return;
    // keep the tick in progress where it is
    const now = performance.now();
    this.player.tickStart = now - ((now - this.player.tickStart) * this.player.speed) / speed;
    this.player.speed = speed;
    ensureEl("battleSpeedLabel").textContent = `×${BattleAnimation.getPlayback(TICK_MS, speed)}`;
    const input = ensureEl("battleSpeed").querySelector("input")!;
    input.value = String(BATTLE_SPEEDS.indexOf(speed));
    input.style.setProperty("--fill", String(BATTLE_SPEEDS.indexOf(speed) / (BATTLE_SPEEDS.length - 1)));
    if (this.battleOptions().view.speed !== speed) Options.set(o => (o.app.battle.view.speed = speed));
  }

  /** Every frame while the screen is open: the battle plays on, and the camera follows */
  private readonly loop = (now: number): void => {
    const b = this.battle;
    if (!b) return;
    const elapsed = this.player.lastFrame ? (now - this.player.lastFrame) / 1000 : 0;
    this.player.lastFrame = now;
    if (this.player.playing) {
      let progress = (now - this.player.tickStart) / (TICK_MS / this.player.speed);
      // a throttled tab catches up a few ticks a frame
      for (let ticks = 0; progress >= 1 && ticks < 4 && this.player.playing; ticks++) {
        if (this.isOver(b) || this.advance()) this.pause();
        progress -= 1;
      }
      if (progress >= 1) progress = 0;
      this.player.tickStart = now - progress * (TICK_MS / this.player.speed);
      if (this.player.playing) BattleSceneView.updateBattalions(this.scene(), b, this.player.previous, progress);
    }
    this.updateCamera(elapsed);
    this.retip();
    this.player.frame = requestAnimationFrame(this.loop);
  };

  /** The tip of what is under a pointer that stays still while the troops, the camera and the numbers move under it */
  private retip(): void {
    if (!this.pointer) return;
    const under = document.elementFromPoint(this.pointer.x, this.pointer.y);
    const text = under?.closest<HTMLElement | SVGElement>("[data-tip]")?.dataset.tip ?? "";
    if (text === this.shownTip) return;
    this.shownTip = text;
    showElementTip(under);
  }

  /** A tick on; true when it brought an event the battle pauses at */
  private advance(): boolean {
    const b = this.battle!;
    this.player.previous = BattleSceneView.snapshot(b);
    const battalions = b.battalions.length;
    Battles.applyDue(b, this.script);
    if (b.battalions.length !== battalions) this.drawScene(); // a recorded reinforcement
    const logged = b.log.length;
    Battles.tick(b);
    if (b.tick % ROUND_TICKS === 0) {
      for (const battalion of b.battalions)
        this.trails.set(battalion.id, [...(this.trails.get(battalion.id) ?? []), [battalion.x, battalion.y]]);
    }
    if (this.isOver(b) && !b.result) Battles.settleLosses(b); // a past battle applied before its end stops there
    this.refresh();
    if (this.isOver(b)) this.showSummary();
    const stops = this.getPauseEvents();
    const kind = (event: LogEntry["event"]): string => (event === "raised" ? "broken" : event); // the besiegers give up
    return b.log.slice(logged).some(entry => stops.includes(kind(entry.event) as PauseEvent));
  }

  private getPauseEvents(): PauseEvent[] {
    return PAUSE_EVENTS.filter(event => this.battleOptions().playback.pause[event]);
  }

  private drawScene(): void {
    this.applyLook();
    BattleSceneView.drawBattalions(this.scene(), this.battle!, this.turnBattalion);
    this.setEditable();
    this.showArrows();
  }

  private readonly turnBattalion = (battalion: Battalion, facing: number): void => {
    const b = this.battle!;
    Battles.intervene(b, { tick: b.tick, kind: "turn", battalion: battalion.key, facing });
    BattleSceneView.updateBattalions(this.scene(), b, null, 1);
    this.refresh();
  };

  /** Troops can be dragged while the battle stands still */
  private setEditable(): void {
    this.scene().classList.toggle("battleEditable", !this.player.playing && !this.battle?.result && !this.battle?.tick);
    this.scene().classList.toggle("battlePlanning", this.isPlanning()); // no troops till they are drawn up
    const run = ensureEl<HTMLButtonElement>("battleRun");
    run.disabled = this.isPlanning(); // the label stays, so the controls do not jump
    run.dataset.tip = this.isPlanning() ? t("Generals are planning") : t("Start or pause the battle");
    run.className = this.player.playing ? "battlePause" : "icon-play";
    run.textContent = this.player.playing ? t("Pause") : ` ${this.battle?.tick ? t("Continue") : t("Start battle")}`;
    this.showSelection(); // the turning handle is there only while troops can be placed
  }

  private dieFace(die: number | null): string {
    return `<rect x="1" y="1" width="18" height="18" rx="3.5"/>${(die ? DIE_PIPS[die - 1] : [])
      .map(cell => `<circle cx="${5 + (cell % 3) * 5}" cy="${5 + Math.floor(cell / 3) * 5}" r="1.7"/>`)
      .join("")}`;
  }

  private stateColor(state: number): string {
    const color = this.stateOf(state)?.color;
    return color?.[0] === "#" ? color : "#999";
  }

  private put(root: Element, selector: string, text: string | number): void {
    const el = root.querySelector(selector)!;
    if (el.textContent !== String(text)) el.textContent = String(text);
  }

  private refresh(): void {
    const b = this.battle!;
    this.schedulePlan();
    for (const side of SIDES) this.refreshSide(side);

    // the scales: the power of the troops each side still has in order, as the military screens count it
    const power = SIDES.map(side => Battles.getUnitsPower(b, side));
    const share = power[0] + power[1] ? (power[0] / (power[0] + power[1])) * 100 : 50;
    const balance = ensureEl("battleBalance");
    this.put(balance, "i", si(power[0]));
    this.put(balance, "i + i", si(power[1]));
    (balance.firstElementChild as HTMLElement).style.width = `${share}%`;
    balance.style.setProperty("--at", `clamp(4.2em, ${share}%, 100% - 4.2em)`);

    const started = b.tick > 0;
    const over = this.isOver(b);
    const watching = this.watching !== null; // a replay is watched as it was fought
    const type = ensureEl<HTMLButtonElement>("battleType");
    type.className = `icon-button-${b.type}`;
    type.textContent = BATTLE_TYPE_LABELS[b.type];
    type.disabled = started || watching; // the ground is of the type the battle began as
    type.dataset.tip = type.disabled ? t("Battle type") : sentences(t("Battle type"), t("Click to change"));
    for (const button of type.nextElementSibling!.children) {
      button.classList.toggle("current", (button as HTMLElement).dataset.type === b.type);
    }
    const weather = ensureEl<HTMLButtonElement>("battleWeather");
    weather.className = `icon-button-${b.weather}`;
    const conditions = CONDITIONS.filter(condition => b[condition]).map(condition => CONDITION_WORDS[condition]);
    weather.textContent = [WEATHER_LABELS[b.weather], ...conditions].join(", ");
    weather.disabled = watching;
    weather.dataset.tip = watching ? t("Weather and ground") : sentences(t("Weather and ground"), t("Click to change"));
    for (const button of weather.nextElementSibling!.children as HTMLCollectionOf<HTMLElement>) {
      const condition = button.dataset.condition as Condition | undefined;
      button.classList.toggle("current", condition ? b[condition] : button.dataset.weather === b.weather);
    }
    this.drawWeather();
    this.drawLight();
    const name = ensureEl<HTMLInputElement>("battleNameFull");
    if (document.activeElement !== name) name.value = b.name;
    name.disabled = watching;

    const footer = ensureEl("battleFooter");
    const clock = ensureEl<HTMLButtonElement>("battleClock");
    this.put(footer, "#battleClock", BattleTime.formatClock(b.hour, b.tick));
    clock.disabled = started || watching; // the battle began at its hour
    clock.dataset.tip = started
      ? t("Round {{round}}", { round: Math.floor(b.tick / ROUND_TICKS) + 1 })
      : watching
        ? t("Time of day the battle starts at")
        : sentences(t("Time of day the battle starts at"), t("Click to change"));
    for (const button of clock.nextElementSibling!.children as HTMLCollectionOf<HTMLElement>)
      button.classList.toggle("current", +button.dataset.hour! === b.hour);
    if (!over) ensureEl("battleSummary").hidden = true;

    // setup only; nothing is hidden, so the controls never jump
    ensureEl<HTMLButtonElement>("battleRoll").disabled = started;
    ensureEl<HTMLButtonElement>("battleStepBack").disabled = !started || this.isPlanning();
    ensureEl<HTMLButtonElement>("battleStep").disabled = over || this.isPlanning();
    ensureEl<HTMLButtonElement>("battleRestart").disabled = !started;
    ensureEl("battleRun").hidden = over;
    ensureEl("battleResultRestart").hidden = !over;
    this.setEditable();

    this.renderLog(b.log);
    this.retip(); // a number under the pointer changed
  }

  private renderLog(log: LogEntry[]): void {
    let same = 0;
    while (same < this.shownLog.length && this.shownLog[same] === log[same]) same++;
    if (same === this.shownLog.length && same === log.length) return;
    const list = ensureEl("battleLogList");
    while (list.childElementCount > same) list.lastElementChild!.remove();
    const line = (entry: LogEntry): string =>
      `<div class="${entry.event} ${entry.side ?? ""}"><i>${BattleTime.formatClock(this.battle!.hour, entry.tick)}</i><u></u><span>${escapeHtml(this.logText(entry))}</span></div>`;
    list.insertAdjacentHTML("beforeend", log.slice(same).map(line).join(""));
    list.scrollTop = list.scrollHeight;
    this.shownLog = [...log];
  }

  private refreshSide(side: Side): void {
    const b = this.battle!;
    const banner = ensureEl(`battleBanner_${side}`);
    const data = b[side];
    const troops = Battles.getTroops(b, side);
    const morale = data.morale | 0;

    this.put(banner, ".battleCount > b", troops.left);
    this.put(banner, ".battleCount > span", ` / ${troops.initial}`);
    const fallen = troops.initial - troops.left - troops.captured;
    this.put(banner, ".battleTroops > .battleLost", fallen ? `−${fallen}` : "");
    this.put(banner, ".battleTroops > .battleCaptured", troops.captured ? String(troops.captured) : "");
    const moraleBar = banner.querySelector<HTMLElement>(".battleMorale")!;
    moraleBar.className = `battleBar battleMorale ${morale < 33 ? "low" : morale < 66 ? "mid" : ""}`;
    moraleBar.dataset.tip = `${side === "attackers" ? t("Attackers morale") : t("Defenders morale")}: ${morale}`;
    (moraleBar.firstElementChild as HTMLElement).style.width = `${morale}%`;
    for (const step of banner.querySelectorAll<HTMLElement>(".battleMoraleStep")) step.hidden = Boolean(b.result);

    const die = ensureEl<SVGElement & HTMLElement>(`battleDie_${side}`);
    const fortune = Battles.getFortune(data.die, b.settings.fortune);
    die.style.display = data.die === null ? "none" : ""; // no fortune, no dice
    if (die.dataset.die !== String(data.die) || die.dataset.fortune !== String(fortune)) {
      const factor = side === "attackers" ? t("Attackers fortune") : t("Defenders fortune");
      Object.assign(die.dataset, { die: String(data.die), fortune: String(fortune) });
      die.dataset.tip = sentences(`${factor}: ×${+fortune.toFixed(3)}`, t("Click to change"));
      die.innerHTML = this.dieFace(data.die);
    }

    const label = banner.querySelector<HTMLElement>(".battleOrder")!;
    if (!b.tick && !data.plan.byHand.order) {
      const tactic = this.isPlanning() ? "" : BATTLE_TACTIC_LABELS[data.plan.tactic];
      label.className = "battleOrder icon-button-tactic";
      label.dataset.tip = tactic ? `${t("Tactic")}: ${tactic}` : t("Generals are planning");
      this.put(banner, ".battleOrder", tactic || "…");
    } else {
      const order = Generals.getOrder(b, side);
      label.className = `battleOrder icon-button-${order}`;
      label.dataset.tip = this.orderTip(order);
      this.put(banner, ".battleOrder", BATTLE_ORDER_LABELS[order]);
    }

    this.refreshRegiments(side);
  }

  /** The sheet's regiments: built when their set changes, then only the numbers move */
  private refreshRegiments(side: Side): void {
    const b = this.battle!;
    const el = ensureEl(`battleSide_${side}`);
    const { regiments } = b[side];
    const container = el.querySelector<HTMLElement>(".battleRegimentList")!;
    const keys = regiments.map(this.regimentKey).join();
    if (container.dataset.keys !== keys) {
      container.dataset.keys = keys;
      this.renderRegiments(side);
    }

    el.querySelector<HTMLButtonElement>(".battleAddRegiment")!.disabled = Boolean(b.result);
    const fighting = regiments.filter(regiment => !Battles.isWithdrawn(b, regiment)).length;
    for (const regiment of regiments) {
      const row = ensureEl(`battleRegiment_${this.regimentKey(regiment)}`);
      const leaving = Battles.isWithdrawn(b, regiment);
      const withdraw = row.querySelector<HTMLButtonElement>(".battleWithdraw")!;
      row.classList.toggle("battleLeaving", leaving);
      row.dataset.tip = leaving ? t("The regiment is withdrawn and leaves the field") : "";
      withdraw.hidden = leaving;
      withdraw.disabled = Boolean(b.result) || fighting < 2; // a side keeps a regiment
      const losses = Battles.getLosses(b, regiment);
      const captured = Battles.getCaptured(b, regiment);
      const initial = sum(Object.values(regiment.troops));
      const lost = sum(Object.values(losses));
      const taken = sum(Object.values(captured));
      this.put(row, ".battleLeft", initial - lost - taken);
      this.put(row, "summary > .battleLost", lost ? `−${lost}` : "");
      this.put(row, "summary > .battleCaptured", taken ? String(taken) : "");
      for (const unit of row.querySelectorAll<HTMLElement>("[data-unit]")) {
        const name = unit.dataset.unit!;
        this.put(unit, ".battleLeft", regiment.troops[name] - (losses[name] ?? 0) - (captured[name] ?? 0));
        this.put(unit, ".battleLost", losses[name] ? `−${losses[name]}` : "");
        this.put(unit, ".battleCaptured", captured[name] ? captured[name] : "");
      }
    }
  }

  private renderRegiments(side: Side): void {
    const b = this.battle!;
    const el = ensureEl(`battleSide_${side}`);
    const { regiments } = b[side];

    const states = [...new Set(regiments.map(regiment => regiment.state))];
    const banner = ensureEl(`battleBanner_${side}`);
    banner.querySelector(".battleEmblems")!.innerHTML = this.emblems(states);
    const title = banner.querySelector<HTMLElement>(".battleStates")!;
    title.textContent = list(states.map(state => this.stateName(state)));
    title.dataset.tip = list(states.map(state => this.stateOf(state)?.fullName ?? this.stateName(state)));

    const container = el.querySelector<HTMLElement>(".battleRegimentList")!;
    const opened = new Set([...container.querySelectorAll("details[open]")].map(details => details.id));
    container.innerHTML = regiments
      .map(regiment => {
        const state = this.stateOf(regiment.state);
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
        const id = `battleRegiment_${this.regimentKey(regiment)}`;
        return /* html */ `<details id="${id}" class="battleRegiment" data-key="${this.regimentKey(regiment)}" ${opened.has(id) ? "open" : ""}>
            <summary>
              <svg viewBox="0 0 20 20"><rect width="20" height="20" fill="${this.stateColor(regiment.state)}" stroke="#333"></rect>
                <use href="${escapeHtml(Icons.href(regiment.icon))}" x="2" y="2" width="16" height="16"></use></svg>
              <span class="battleRegimentName" data-tip="${escapeHtml(regiment.name)}">${escapeHtml(regiment.name)}</span>
              <span class="battleLeft" data-tip="${t("Survivors")}"></span>
              <span class="battleLost" data-tip="${t("Casualties")}"></span>
              <span class="battleCaptured icon-flag-empty" data-tip="${t("Captured")}"></span>
              <button class="battleWithdraw icon-user-times" data-tip="${t("Withdraw the regiment: before the start it leaves the battle, after it marches off the field")}"></button>
            </summary>
            <div class="battleUnits">${units}</div>
            <div class="battleRegimentInfo">${escapeHtml(state?.fullName ?? "")} <span class="${upkeep < 100 ? "negative" : ""}" data-tip="${t("Troops fight with this share of their power")}">(${t("upkeep {{upkeep}}%", { upkeep })})</span><br>
              <span data-tip="${t("Supply line length, affects morale")}">${t("Distance to base")}: ${regiment.distance} ${escapeHtml(options.map.units.distance.unit)}</span></div>
          </details>`;
      })
      .join("");
  }

  private emblems(states: number[], event = this.watching): string {
    return states
      .flatMap(id => this.stateOf(id, event) ?? [])
      .slice(0, 4)
      .map(({ i, coa, fullName }) => {
        void EmblemRenderer.trigger(`stateCOA${i}`, coa);
        return `<svg data-tip="${escapeHtml(fullName ?? "")}" viewBox="0 0 200 200"><use href="#stateCOA${i}"></use></svg>`;
      })
      .join("");
  }

  /** A state of the battle on screen as it is now: a replay's ids are as fought */
  private stateOf(id: number, event = this.watching): State | undefined {
    if (event) return Events.currentStateOf(event, id);
    const state = pack.states[id];
    return state && !state.removed ? state : undefined;
  }

  private stateName(id: number, event = this.watching): string {
    return this.stateOf(id, event)?.name ?? t("former state {{id}}", { id });
  }

  /** The end of the battle over the field, as games show it: who won and at what cost */
  private showSummary(): void {
    const b = this.battle!;
    if (!this.isOver(b)) return;
    const el = ensureEl("battleSummary");
    el.innerHTML = this.getSummary(b);
    el.hidden = false;
    if (this.watching && !BattleReplays.matches(b, this.watching)) tip(RECORD_DIFFERS(), true, "warn", 8000);
  }

  /** `appliable`: the battle on screen can still be applied */
  /** `event`: the past battle it is played from */
  private readonly getSummary = (b: Battle, appliable = !this.watching, event = this.watching): string => {
    const { winner, status } = Battles.getResult(b);
    const headline = winner ? (winner === "attackers" ? t("Attackers win") : t("Defenders win")) : t("No victor");
    return /* html */ `<div class="${winner ?? ""}">
        <button class="battleSummaryClose icon-cancel" data-action="close" data-tip="${t("Close the summary to look at the battlefield")}"></button>
        <header>
          <span class="battleSummaryKicker">${escapeHtml(b.name)}</span>
          <h2>${headline}</h2>
        </header>
        <div class="battleSummarySides">${SIDES.map((side, i) => this.summarySide(b, side, status[i], event)).join("")}</div>
        <footer>
          <button data-action="restart" class="icon-ccw" data-tip="${t("Play the same battle again from the start")}"> ${t("Play again")}</button>
          ${appliable ? `<button data-action="apply" class="icon-check" data-tip="${t("End battle: apply current results and close the screen")}"> ${t("Apply results")}</button>` : ""}
        </footer>
      </div>`;
  };

  private summarySide(b: Battle, side: Side, status: string, event: BattleEvent | null): string {
    const { regiments } = b[side];
    const states = [...new Set(regiments.map(regiment => regiment.state))];
    const { initial, left, captured } = Battles.getTroops(b, side);
    const share = rn(b[side].casualties * 100);

    const had: Record<string, number> = {};
    const lost: Record<string, number> = {};
    const taken: Record<string, number> = {};
    for (const regiment of regiments) {
      const losses = Battles.getLosses(b, regiment);
      const prisoners = Battles.getCaptured(b, regiment);
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
          <span class="battleEmblems">${this.emblems(states, event)}</span>
          <span>
            <b>${escapeHtml(list(states.map(state => this.stateName(state, event))))}</b>
            <i>${escapeHtml(getOutcomeLabel(status))}</i>
          </span>
        </header>
        <div class="battleSummaryStats">
          <span>${t("Troops left")}</span><b>${left} <small>/ ${initial}</small></b>
          <span>${t("Casualties")}</span><b class="battleLost">${share}%</b>
          ${captured ? `<span>${t("Captured")}</span><b class="battleCaptured">${rn(b[side].captured * 100)}%</b>` : ""}
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
  private turnDie(side: Side): void {
    const b = this.battle!;
    if (b.result) return;
    const die = ((b[side].die ?? 0) % 6) + 1;
    const previous = b.interventions.at(-1);
    if (previous?.kind === "die" && previous.side === side && previous.tick === b.tick && this.isLastLogged(b, "die")) {
      b.interventions.pop(); // clicks through the faces leave one line in the log
      b.log.pop();
    }
    Battles.intervene(b, { tick: b.tick, kind: "die", side, die });
    if (!b.tick) this.drawScene(); // the troops are lined up anew: a general may see the day lost
    this.refresh();
  }

  /** The orders the side may be given, and before the start whether it stands behind works prepared the night before */
  private openOrders(event: Event, side: Side): void {
    const b = this.battle!;
    if (b.result) return;
    const menu = (event.currentTarget as HTMLElement).nextElementSibling as HTMLElement;
    const current = Generals.getOrder(b, side);
    const items: string[] = [];
    // before the start the side may be drawn up in another tactic than its general's
    const tactics = b.tick ? [] : Generals.getTactics(b, side);
    if (tactics.length) {
      const chosen = Generals.getHandTactic(b, side);
      const tactic = (name: string, label: string, tip: string, on: boolean): string =>
        `<button data-tactic="${name}" data-tip="${tip}" class="icon-button-tactic ${on ? "current" : ""}">${label}</button>`;
      items.push(tactic("", t("General's choice"), t("The general draws the side up as he sees fit"), !chosen));
      for (const name of tactics)
        items.push(tactic(name, BATTLE_TACTIC_LABELS[name], t("Draw the side up in this tactic"), name === chosen));
    }
    const orders = (Object.keys(COMMANDS[b.type][side]) as Command[]).map(
      (order, i) =>
        `<button data-order="${order}" data-tip="${this.orderTip(order)}" class="icon-button-${order} ${order === current ? "current" : ""} ${tactics.length && !i ? "battleMenuBreak" : ""}">${BATTLE_ORDER_LABELS[order]}</button>`
    );
    items.push(...orders);
    if (!b.tick && Works.mayBuild(b, side)) {
      const tip = t(
        "Start the battle behind finished works: wagons against a foe strong in riders and shooters, else a ditch"
      );
      const icon = Generals.isDugIn(b, side) ? "icon-check" : "icon-check-empty";
      items.push(`<button data-dig data-tip="${tip}" class="battleMenuBreak ${icon}">${t("Dug in")}</button>`);
    }
    menu.innerHTML = items.join("");
    this.togglePicker(event);
  }

  private giveOrder(event: Event, side: Side): void {
    const b = this.battle!;
    const button = (event.target as HTMLElement).closest("button");
    if (!button || b.result) return;
    if (button.dataset.tactic !== undefined) {
      const tactic = (button.dataset.tactic || null) as TacticName | null;
      if (!b.tick && tactic !== Generals.getHandTactic(b, side))
        Battles.intervene(b, { tick: b.tick, kind: "tactic", side, tactic });
    } else if (button.dataset.dig !== undefined) {
      if (!b.tick) Battles.intervene(b, { tick: b.tick, kind: "dig", side, on: !Generals.isDugIn(b, side) });
    } else {
      const order = button.dataset.order as Command;
      if (order !== Generals.getOrder(b, side)) Battles.intervene(b, { tick: b.tick, kind: "order", side, order });
    }
    this.refresh();
  }

  /** Hearten or shake a side by hand: before the start clicks in a row make one change, with one line in the log */
  private changeMorale(side: Side, value: number): void {
    const b = this.battle!;
    if (b.result) return;
    const previous = b.interventions.at(-1);
    const logged = this.isLastLogged(b, "morale");
    Battles.intervene(b, { tick: b.tick, kind: "morale", side, value });
    // in the battle each click is applied at once and stands as it was made
    if (!b.tick && previous?.kind === "morale" && previous.side === side && logged) {
      b.interventions.pop();
      b.log.pop();
      previous.value += value;
      const entry = b.log.at(-1)!;
      const shown = previous.value > 0 ? `+${previous.value}` : `−${-previous.value}`;
      if (previous.value)
        b.log[b.log.length - 1] = { ...entry, params: { ...entry.params, value: shown } }; // a new line
      else {
        b.interventions.pop();
        b.log.pop();
      }
      Battles.prepare(b); // the troops are lined up anew with the morale as it now stands
    }
    if (!b.tick) this.drawScene();
    this.refresh();
  }

  private readonly closePickers = (): void => {
    for (const menu of findEl("battleLayout")?.querySelectorAll<HTMLElement>(".battleMenu") ?? []) menu.hidden = true;
  };

  private togglePicker(event: Event): void {
    event.stopPropagation();
    const menu = (event.currentTarget as HTMLElement).nextElementSibling as HTMLElement;
    const show = menu.hidden;
    this.closePickers();
    if (!show) return;
    menu.hidden = false;
    document.addEventListener("click", this.closePickers, { once: true });
  }

  /** Rain, snow, fog and heat over the plan; soaked and frozen ground on it */
  private drawWeather(): void {
    const b = this.battle!;
    const shown = this.battleOptions().rendering.weather;
    BattleWeatherView.draw(ensureEl<HTMLCanvasElement>("battleWeatherLayer"), b.weather, b.heat, shown);
    this.scene().classList.toggle("battleMuddy", shown && b.mud);
    this.scene().classList.toggle("battleIcy", shown && b.ice);
  }

  /** The weather and the conditions change at any moment; clicks in a row at a moment leave one line in the log */
  private changeWeather(event: Event): void {
    const target = event.target as HTMLElement;
    const b = this.battle!;
    if (target.tagName !== "BUTTON" || b.result) return;
    const condition = target.dataset.condition as Condition | undefined;
    const change: Intervention = condition
      ? { tick: b.tick, kind: "condition", condition, on: !b[condition] }
      : { tick: b.tick, kind: "weather", weather: target.dataset.weather as Weather };
    if (change.kind === "weather" && change.weather === b.weather) return;
    const last = b.interventions.at(-1);
    const repeated =
      last?.tick === b.tick &&
      last.kind === change.kind &&
      (last.kind !== "condition" || (change.kind === "condition" && last.condition === change.condition)) &&
      this.isLastLogged(b, change.kind);
    if (repeated) {
      b.interventions.pop();
      b.log.pop();
    }
    Battles.intervene(b, change);
    if (repeated && change.kind === "condition") {
      b.interventions.pop(); // clicked back: as it was, with nothing to log
      b.log.pop();
    }
    if (!b.tick) this.drawScene();
    this.refresh();
  }

  /** The hour the battle starts at: only before the start */
  private changeHour(event: Event): void {
    const target = event.target as HTMLElement;
    const b = this.battle!;
    if (target.tagName !== "BUTTON" || b.tick) return;
    Battles.setHour(b, +target.dataset.hour!);
    this.shownLog = []; // its lines are timed anew
    this.drawLight();
    this.drawScene();
    this.refresh();
  }

  private changeType(event: Event): void {
    const target = event.target as HTMLElement;
    const b = this.battle!;
    if (target.tagName !== "BUTTON" || target.dataset.type === b.type || b.tick) return;
    const type = target.dataset.type as BattleType;
    const named = b.name === BattleRules.getName(b.type, b.place);
    this.script = []; // stepped back to the start, another battle: what came after is not to come

    Battles.intervene(b, { tick: b.tick, kind: "type", type });
    if (!b.tick) {
      // the ground follows the type until the battle starts
      b.field = this.buildField(b.x, b.y, type);
      Battles.prepare(b);
      this.drawField();
      this.drawScene();
    }
    if (named) this.setName(BattleRules.getName(type, b.place));
    this.refresh();
  }

  /** Draw the troops up anew: the moves made by hand are dropped */
  private redeploy(): void {
    const b = this.battle!;
    if (b.tick) return;
    this.script = []; // stepped back to the start, the troops drawn up anew: what came after is not to come
    const sides = SIDES.map(side => b[side].regiments.map(regiment => this.regiments.get(this.regimentKey(regiment))!));
    this.setup(sides[0], sides[1], {
      type: b.type,
      name: b.name,
      settings: b.settings,
      seed: b.seed,
      axis: b.approach,
      hour: b.hour
    });
    // what was done to the sides by hand stays done: morale, dice, orders, the ground prepared and the tactics given
    for (const change of b.interventions) {
      if (["morale", "die", "order", "dig", "tactic", "weather", "condition"].includes(change.kind))
        Battles.intervene(this.battle!, change);
    }
    this.refresh();
  }

  private setName(name: string): void {
    this.battle!.name = name;
    ensureEl<HTMLInputElement>("battleNameFull").value = name;
    Dialog.update("battleScreen", { title: name });
  }

  private generateBattleName(type: "culture" | "random"): void {
    const b = this.battle!;
    b.place =
      type === "culture"
        ? Names.getCulture(pack.cells.culture[b.cell], undefined, undefined, "")
        : Names.getBase(Math.floor(Math.random() * Names.nameBases.length));
    this.setName(BattleRules.getName(b.type, b.place));
  }

  private addSide(side: Side): void {
    if (Dialog.isOpen("regimentSelectorScreen")) return; // its row listener is bound once
    const b = this.battle!;
    const body = ensureEl("regimentSelectorBody");
    const all = pack.states.filter(s => s.military && !s.removed).flatMap(s => s.military!);
    const distance = (reg: Regiment): number =>
      rn(Math.hypot(b.y - reg.y, b.x - reg.x) * options.map.units.distance.scale);

    const shipless = !Movement.hasShipWater(b.field);
    body.innerHTML = all
      .map(r => {
        const s = pack.states[r.state];
        const added = this.regiments.has(this.regimentKey(r));
        const dist = added ? 0 : distance(r);
        const why = added
          ? t("Regiment is already in the battle")
          : !Military.getTroops(r.a)
            ? t("Regiment has no troops to battle")
            : r.n && shipless
              ? t("Ships have no water to keep to on this field")
              : "";
        return /* html */ `<div ${why ? `class="inactive" data-why="${escapeHtml(why)}"` : ""} data-s=${s.i} data-i=${r.i} data-state="${escapeHtml(s.name)}"
          data-regiment="${escapeHtml(r.name)}" data-total=${Military.getTroops(r.a)} data-distance="${dist}" data-tip="${why || t("Click to select regiment")}">
          <span><svg viewBox="0 0 10 10"><rect width="10" height="10" fill="${s.color}" stroke="#333"/></svg>${escapeHtml(s.name)}</span>
          <span>${Icons.html(r.icon ?? "")} ${escapeHtml(r.name)}</span>
          <span>${Military.getTroops(r.a)}</span>
          <span>${dist} ${escapeHtml(options.map.units.distance.unit)}</span>
        </div>`;
      })
      .join("");

    const selectLine = (event: Event): void => {
      const row = (event.target as HTMLElement).closest<HTMLElement>("#regimentSelectorBody > div");
      if (!row) return;
      if (row.dataset.why) {
        tip(row.dataset.why, false, "error");
        return;
      }
      row.classList.toggle("selected");
    };

    const addSideClicked = (): void => {
      const selected = body.querySelectorAll<HTMLElement>(".selected");
      if (!selected.length) {
        tip(t("Please select a regiment first"), false, "error");
        return;
      }

      Dialog.close("regimentSelectorScreen");
      const battle = this.battle!; // the one on screen by now: it may be another, or over
      if (battle.result) return;
      const { field } = battle;
      selected.forEach(line => {
        const regiment = pack.states[+line.dataset.s!].military!.find(r => r.i === +line.dataset.i!)!;
        if (this.regiments.has(this.regimentKey(regiment))) return; // already in the battle
        this.joinBattle(regiment, side);
        const data = this.toBattleRegiment(regiment, battle);
        Battles.intervene(battle, { tick: battle.tick, kind: "add", side, regiment: data });
      });
      if (battle.field !== field) this.drawField(); // more troops, a larger field
      this.drawScene();
      this.refresh();
    };

    const addSideClosed = (): void => {
      body.innerHTML = "";
      body.removeEventListener("click", selectLine);
    };

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
  }

  /** Take a regiment out: before the start it goes back to where it stood on the map, after it it marches off the field */
  private withdrawRegiment(key: string): void {
    const b = this.battle!;
    const data = SIDES.flatMap(side => b[side].regiments).find(regiment => this.regimentKey(regiment) === key);
    if (!data || b.result) return;
    const { field, tick } = b;
    Battles.intervene(b, { tick, kind: "withdraw", state: data.state, regiment: data.i });
    if (!tick) {
      const regiment = this.regiments.get(key);
      if (regiment) this.leaveBattle(regiment);
      this.regiments.delete(key);
      if (b.field !== field) this.drawField(); // fewer troops, a smaller field
      this.drawScene();
    }
    this.refresh();
  }

  /** Bring a regiment to the battle on the map */
  private joinBattle(regiment: Regiment, side: Side): void {
    const b = this.battle!;
    this.regiments.set(this.regimentKey(regiment), regiment);
    const step = getRegimentStep();
    const shift =
      side === "attackers" ? (b.attackers.regiments.length + 1) * -step : b.defenders.regiments.length * step;
    regiment.px = regiment.x;
    regiment.py = regiment.y;
    moveRegiment(regiment, b.x, rn(b.y + shift, 2));
  }

  // the log

  /** A line of the log; whose it is the mark beside it shows */
  /** A log line as plain text: who renders it as markup escapes it */
  private readonly logText = ({ event, side, params }: LogEntry): string => {
    if (event === "order") return `${t("Orders")}: ${BATTLE_ORDER_LABELS[params!.order as Command]}`;
    if (event === "ordered")
      return t("Ordered to {{- order}}", { order: BATTLE_ORDER_LABELS[params!.order as Command].toLowerCase() });
    if (event === "tactic")
      return `${t("Tactic")}: ${params!.tactic ? BATTLE_TACTIC_LABELS[params!.tactic] : t("General's choice")}`;
    if (event === "die") return `${t("Fortune")}: ${params!.die}`;
    if (event === "morale") return `${t("Morale")}: ${params!.value}`;
    if (event === "join") return t("{{- regiment}} joins the battle", params);
    if (event === "withdraw") return t("{{- regiment}} is withdrawn", params);
    if (event === "breach") return t("The walls of {{- burg}} are breached", params);
    if (event === "cut") return t("{{- burg}} is cut off", params);
    if (event === "supplied") return t("Supplies reach {{- burg}}", params);
    if (event === "dig") return params!.on === "true" ? t("Dug in") : t("Not dug in");
    if (event === "weather") return `${t("Weather")}: ${WEATHER_LABELS[params!.weather as Weather]}`;
    if (event === "time") return `${t("Time of day")}: ${PERIOD_LABELS[params!.period as Period]}`;
    if (event === "condition") return CONDITION_LOG[params!.condition as Condition][+(params!.on === "true")];
    if (event === "fortified") return `${t("Works stand")}: ${WORK_LABELS[params!.kind as WorkKind]}`;
    if (event === "gap") return t("The wagons are broken through");
    if (event === "clash") return t("The armies clash");
    if (event === "feint") return t("The army feigns a retreat");
    if (event === "turned") return t("The army turns on its pursuers");
    if (event === "broken") return t("The army breaks");
    if (event === "raised") return t("The siege is raised");
    if (event === "end") return side ? t("Hold the field") : t("The battle dies down");

    if (event === "task") {
      const who =
        params!.count === "1" ? capitalize(params!.battalion) : t("{{- number}} battalions", { number: params!.count });
      if (params!.task === "attack")
        return t("{{- who}} ordered to attack {{- target}}", { who, target: params!.target });
      if (params!.task === "pursue")
        return t("{{- who}} ordered to pursue {{- target}}", { who, target: params!.target });
      if (params!.task === "protect")
        return t("{{- who}} ordered to protect {{- target}}", { who, target: params!.target });
      if (params!.task === "move") return t("{{- who}} ordered to move", { who });
      const order = BATTLE_ORDER_LABELS[params!.task as Command].toLowerCase();
      return t("{{- who}} ordered to {{- order}}", { who, order });
    }

    const battalion = { battalion: capitalize(params!.battalion) };
    if (event === "move") return t("{{- battalion}} are moved", battalion);
    if (event === "turn") return t("{{- battalion}} are turned", battalion);
    if (event === "rout") return t("{{- battalion}} break and run", battalion);
    if (event === "rally") return t("{{- battalion}} rally", battalion);
    if (event === "surrender") return t("{{- battalion}} surrender", battalion);
    if (event === "freed") return t("{{- battalion}} take up arms again", battalion);
    if (event === "destroyed") return t("{{- battalion}} are destroyed", battalion);
    return t("{{- battalion}} leave the field", battalion);
  };

  /** The log's last line is the last change's: a withdrawal before the start takes its change back and leaves its line */
  private isLastLogged(b: Battle, event: LogEvent): boolean {
    const entry = b.log.at(-1);
    return entry?.event === event && entry.tick === b.tick;
  }

  /** The regiments the battle began with: latecomers are in the interventions */
  private getInitialRegiments(b: Battle, side: Side): BattleRegiment[] {
    const late = new Set(
      b.interventions.flatMap(change => (change.kind === "add" ? [this.regimentKey(change.regiment)] : []))
    );
    return b[side].regiments.filter(regiment => !late.has(this.regimentKey(regiment)));
  }

  private getFileName(name: string): string {
    return name.replace(/[^\p{L}\p{N}]+/gu, "-");
  }

  /** The battle from its start, untouched by the one on screen: every change made, and those to come after a step back */
  private startAnew(b: Battle): BattleStart {
    if (this.watching) return BattleReplays.start(this.watching.replay!);
    const battle = Battles.create({
      type: b.type,
      name: b.name,
      place: b.place,
      x: b.x,
      y: b.y,
      cell: b.cell,
      axis: b.approach,
      field: this.buildField(b.x, b.y, b.type),
      units: b.units,
      populationScale: b.populationScale,
      attackers: structuredClone(this.getInitialRegiments(b, "attackers")),
      defenders: structuredClone(this.getInitialRegiments(b, "defenders")),
      settings: b.settings,
      seed: b.seed,
      hour: b.hour,
      latitude: b.latitude,
      ...this.getClimate(b.cell)
    });
    return { battle, script: structuredClone([...b.interventions, ...this.script]), settled: b.settled };
  }

  /** The battle for an export: from its start, drawn as on screen, and worded for a report */
  private getSource(): BattleSource & { report: ReportText } {
    const b = this.battle!;
    const { year, era } = options.map.lore.calendar;
    const shown = { ...this.colors };
    return {
      fileName: this.getFileName(b.name),
      title: b.name,
      start: () => this.startAnew(b),
      tickMs: TICK_MS,
      screenWidth: this.scene().getBoundingClientRect().width * devicePixelRatio,
      look: { ...this.battleOptions().rendering },
      colors: shown,
      flags: this.getFlags(),
      report: {
        heading: [this.watching ? Dates.format(this.watching.start, "long") : `${year} ${era}`, b.place] // a past battle by its own date
          .filter(Boolean)
          .join(" · "),
        summary: this.getSummary,
        style: `body { --line: #ccc; --muted: #666; --loss: #c5221f; --attackers: ${shown.attackers}; --defenders: ${shown.defenders}; }
          #battleSummary .attackers, .report .attackers { --side: var(--attackers); }
          #battleSummary .defenders, .report .defenders { --side: var(--defenders); } ${SUMMARY_STYLE}`,
        describe: this.logText,
        marks: entry => (entry.side ? `--side: ${shown[entry.side]}` : ""),
        kinds: this.getPauseEvents()
      }
    };
  }

  /** Back to the start, to play the same battle again: every change made on the way comes at its moment */
  private restart(): void {
    const b = this.battle!;
    this.pause();
    if (this.watching) {
      this.startWatching();
      ensureEl("battleSummary").hidden = true;
      return;
    }
    const find = (ref: { state: number; i: number }): Regiment | undefined =>
      pack.states[ref.state]?.military?.find(regiment => regiment.i === ref.i && regiment.a);
    const sides = SIDES.map(side => this.getInitialRegiments(b, side).map(find));
    const same = sides.every(side => side.length && side.every(Boolean));
    const interventions = [...b.interventions, ...this.script];

    // regiments leave the old battle and join the new one on the map
    const current = SIDES.map(side =>
      b[side].regiments.map(regiment => this.regiments.get(this.regimentKey(regiment))!)
    );
    const [attackers, defenders] = same ? (sides as Regiment[][]) : current.map(side => side.slice(0, 1));
    const staying = new Set([...attackers, ...defenders]);
    for (const regiment of this.regiments.values()) if (!staying.has(regiment)) this.leaveBattle(regiment);
    this.regiments = new Map();
    const { type, name, seed, hour, approach } = b;
    this.setup(attackers, defenders, { type, name, seed, hour, axis: approach, settings: { ...b.settings } });
    SIDES.forEach((side, i) => {
      for (const regiment of [attackers, defenders][i]) {
        if (regiment.px === undefined) this.joinBattle(regiment, side);
        else this.regiments.set(this.regimentKey(regiment), regiment);
      }
    });

    this.script = interventions
      .filter(change => {
        if (change.kind === "move" || change.kind === "turn" || change.kind === "task") return same;
        if (change.kind !== "add") return true;
        const regiment = same && find(change.regiment);
        if (regiment) this.joinBattle(regiment, change.side);
        return Boolean(regiment);
      })
      .sort((a, b) => a.tick - b.tick);
    const { field } = this.battle!;
    Battles.applyDue(this.battle!, this.script);
    if (this.battle!.field !== field) this.drawField(); // regiments added before the start, a larger field
    this.drawScene();
    this.setName(name);
    this.refresh();
  }

  // the end

  private applyResults(): void {
    const b = this.battle!;
    this.pause();
    if (!b.result) Battles.settleLosses(b); // ended by hand: the parts of men lost are counted as at the end
    const { winner, status } = Battles.getResult(b);
    BattleReplays.keep(b, this.getClimate(b.cell), VERSION);

    // counted in whole troops and turned back into points once, so no fraction of a man is left over
    const { scale } = options.map.units.population;
    for (const side of SIDES) {
      for (const data of b[side].regiments) {
        const regiment = this.regiments.get(this.regimentKey(data));
        if (!regiment) continue;
        const losses = Battles.getLosses(b, data);
        const captured = Battles.getCaptured(b, data);
        for (const unit in regiment.u) {
          const died = (losses[unit] ?? 0) + (captured[unit] ?? 0); // prisoners are lost to the regiment too
          regiment.u[unit] = Math.max(Military.getTroops(regiment.u[unit]) - died, 0) / scale;
        }
        regiment.a = sum(Object.values(regiment.u), points => Military.getTroops(points)) / scale;
        select<SVGGElement, unknown>("#armies")
          .select(`g#regiment${regiment.state}-${regiment.i} > text`)
          .text(Military.getTotal(regiment));
      }
    }

    const shown = status[winner === "defenders" ? 1 : 0]; // as the side that holds the field sees it
    const by = winner ? `${this.stateName(b[winner].regiments[0].state)}: ` : ""; // whose it is
    tip(
      t("{{battle}} is over. {{result}}", { battle: b.name, result: by + getOutcomeLabel(shown) }),
      true,
      "success",
      4000
    );
    this.closeBattleScreen();
    refreshEditors(); // the battle is in the history and the regiments lost troops
  }

  private readonly cancelResults = (): void => {
    if (!this.battle) return;
    this.closeBattleScreen();
  };

  private leaveBattle(regiment: Regiment): void {
    if (regiment.px !== undefined) moveRegiment(regiment, regiment.px, regiment.py!); // back to where it stood
    delete regiment.px;
    delete regiment.py;
  }

  private closeBattleScreen(): void {
    this.pause();
    cancelAnimationFrame(this.player.frame);
    BattleConfigure.close();
    this.camera = null;
    clearTimeout(this.planning);
    this.planning = 0;
    for (const regiment of this.regiments.values()) this.leaveBattle(regiment);
    this.battle = null;
    this.watching = null;
    this.regiments = new Map();
    this.script = [];
    this.selected = [];
    this.box = null;
    this.trails = new Map();
    this.pointer = null;
    this.shownTip = null;
    options.app.mode = null; // exit edit mode
    const weather = findEl<HTMLCanvasElement>("battleWeatherLayer");
    if (weather) BattleWeatherView.release(weather);
    Dialog.destroy("battleScreen");
    Dialog.destroy("regimentSelectorScreen");
    Dialog.destroy("battleLog");
    this.shownLog = [];
    Pathfinding.clear(); // the ways kept for the battles fought here
  }

  private typeTip(type: BattleType): string {
    if (type === "field") return t("Field Battle: a standard type of combat");
    if (type === "naval") return t("Naval Battle: naval units combat");
    if (type === "siege") return t("Siege: burg blockade and storming");
    if (type === "ambush") return t("Ambush: surprise attack");
    if (type === "landing") return t("Landing: amphibious attack");
    if (type === "bombardment") return t("Bombardment: a fleet shells troops ashore");
    return t("Air Battle: maneuring fight of avia units");
  }

  /** What a battalion does under an order on its own spot */
  private taskTip(task: Command): string {
    if (task === "hold") return t("Hold: keep the spot and shoot what comes within range");
    if (task === "fortify") return t("Fortify: build works before the spot and hold behind them");
    if (task === "skirmish")
      return t("Skirmish: come within shot of the enemy and shoot, stepping back from those who come at it");
    if (task === "defend") return t("Defend: keep the spot and charge what comes near it");
    if (task === "retreat") return t("Retreat: march off the field");
    return t("Surrender: lay down arms");
  }

  private orderTip(order: Command): string {
    if (order === "hold") return t("Hold: stand the ground and shoot what comes within range");
    if (order === "fortify") return t("Fortify: dig in before the first line and hold behind the works");
    if (order === "skirmish") return t("Skirmish: come within shot of the enemy and shoot");
    if (order === "attack") return t("Attack: close with the enemy");
    if (order === "defend") return t("Defend: stand the ground and fight what comes at it");
    if (order === "pursue") return t("Pursue: chase the broken enemy");
    if (order === "retreat") return t("Retreat: leave the field");
    return t("Surrender: lay down arms");
  }
}

export const BattleScreen = new BattleScreenController();
