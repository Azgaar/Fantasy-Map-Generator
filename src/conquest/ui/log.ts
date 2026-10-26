/**
 * log.ts — the campaign's running action log, in an FMG-native dialog.
 *
 * What it reads is `campaign.log`: the event stream the engine appends to as the
 * game runs — battles, sieges, captures, treaties, characters, the economy tick.
 * Deliberately *not* `store.log`, which is the command log (that is the save
 * format, replayed to rebuild state). The player wants to read what happened, not
 * what they issued; the command log has no turn, no names and no prose.
 *
 * Every event is rendered as one sentence with the world's own names resolved —
 * `Khanate` rather than faction 3, `Northmarch` rather than region 12 — because a
 * log of ids is not a log. A name that cannot be resolved falls back to the id
 * rather than to a guess.
 *
 * The dialog is opened from the ⚔ menu and the omnibar, the same two places as
 * every other modal here — the rebase report, About, the rule editors. It is
 * deliberately *not* a layer: a layer is the visibility of something drawn on the
 * map, and this is neither. It was tried, and a layer bought three workarounds
 * (a MutationObserver to catch closes, a preset exception, a close→state sync)
 * plus one latent bug — a `.map` saved with the log open restores as "on" with
 * nothing on screen, and the next `Layers.drawAll()` popped the log open unasked.
 */
import { currentContent } from "../content/store";
import type { BattleSummary, CapturePolicy, GameEvent, TreatyType } from "../engine/game/events";
import { BRIGAND_FACTION, type Campaign } from "../engine/game/state";
import { currentSession, onSession } from "../store/session";
import { openTwDialog } from "./content/dialog";
import { escapeHtml, fmg, twWarn } from "./fmg";
import { getSource } from "./session";

const HEAD_ID = "tw-log-head";
const BODY_ID = "tw-log-body";

/**
 * How many rows are rendered at once.
 *
 * A long campaign runs to thousands of events and the dialog is a scrollback, not
 * a ledger: rendering everything makes each repaint slower for entries nobody will
 * read. The count of what is *not* shown is stated in the header, so the panel
 * never quietly looks complete when it is not.
 */
const MAX_ROWS = 400;

interface LogRow {
  turn: number;
  /** a turn/season heading, emitted only when the turn changes */
  heading: string | null;
  text: string;
  /** a coarse class for colouring: battle, war, economy, character, world */
  kind: "lifecycle" | "war" | "army" | "battle" | "diplomacy" | "character" | "economy" | "world";
}

// ---------------------------------------------------------------------------
// Names — the difference between a log and a dump
// ---------------------------------------------------------------------------

const num = (value: number): string => Math.round(value).toLocaleString("en-US");

function factionName(id: number): string {
  if (id === BRIGAND_FACTION) return "Brigands";
  return currentSession()?.factionNames.find(faction => faction.id === id)?.name ?? `Faction ${id}`;
}

function regionName(id: number): string {
  return getSource().regionById(id)?.name ?? `Region ${id}`;
}

function armyName(campaign: Campaign, id: string): string {
  return campaign.armies[id]?.name ?? `Army ${id}`;
}

function unitName(id: string): string {
  return currentContent().content.unitTypes[id]?.name ?? id;
}

function settlementName(id: number): string {
  return (
    getSource()
      .settlements()
      .find(s => s.id === id)?.name ?? `Settlement ${id}`
  );
}

function buildingName(id: string): string {
  return currentContent().content.buildings.find(building => building.id === id)?.name ?? id;
}

function techName(id: string): string {
  return currentContent().content.tech.find(tech => tech.id === id)?.name ?? id;
}

function policyLabel(policy: CapturePolicy): string {
  return { occupy: "occupied", sack: "sacked", loot: "looted", raze: "razed" }[policy];
}

const TREATY_LABELS: Record<TreatyType, string> = {
  peace: "peace",
  nonAggression: "a non-aggression pact",
  trade: "a trade treaty",
  defensiveAlliance: "a defensive alliance",
  alliance: "an alliance",
  militaryAccess: "military access"
};

// ---------------------------------------------------------------------------
// One event → one sentence
// ---------------------------------------------------------------------------

function describeBattle(battle: BattleSummary): string {
  const attacker = factionName(battle.attacker.factionId);
  const defender = factionName(battle.defender.factionId);
  const winner = battle.winner === "attacker" ? attacker : defender;
  const loser = battle.winner === "attacker" ? defender : attacker;
  const where = regionName(battle.regionId);
  const what = battle.assault ? `assault on ${where}` : `field battle for ${where}`;
  const modifiers = battle.modifiers.length ? ` [${battle.modifiers.join(", ")}]` : "";
  const taken = battle.regionCaptured ? `; ${where} changed hands` : "";
  return `${winner} won the ${what} against ${loser}${modifiers}${taken}`;
}

/**
 * The catalog. Anything not listed falls through to `event.type` plus its scalar
 * fields, which is honest and greppable — better than dropping the entry, worse
 * than a sentence.
 *
 * Returns null for the one event that is structure rather than narrative
 * (`TurnBegan`): it becomes a heading in the scrollback, never a row.
 */
function describe(event: GameEvent, campaign: Campaign): string | null {
  switch (event.type) {
    // -- lifecycle
    case "CampaignCreated":
      return `Campaign begun as ${factionName(event.factionId)} (seed ${event.seed}).`;
    case "TurnBegan":
      return null;
    case "TurnEnded":
      return `Turn ${event.turn} closed.`;
    case "VictoryAchieved":
      return `${factionName(event.factionId)} wins the campaign — ${num(event.regions)} regions (${event.reason}).`;
    case "FactionEliminated":
      return `${factionName(event.factionId)} was eliminated.`;

    // -- war
    case "WarDeclared":
      return `${factionName(event.from)} declared war on ${factionName(event.on)}.`;
    case "AllyJoinedWar":
      return `${factionName(event.ally)} joined ${factionName(event.forFaction)} against ${factionName(event.against)}.`;

    // -- armies
    case "ArmyMoved":
      return `${armyName(campaign, event.armyId)} moved ${Math.round(event.distance)} cells (${event.from} → ${event.to}).`;
    case "MovementBlocked":
      return `${armyName(campaign, event.armyId)} was blocked at cell ${event.at}: ${event.reason}.`;
    case "StanceSet":
      return `${armyName(campaign, event.armyId)} took the ${event.stance} stance.`;
    case "UnitRecruited":
      return `${armyName(campaign, event.armyId)} recruited ${unitName(event.unitType)} for ${num(event.cost)} gold.`;
    case "ArmyDisbanded":
      return `${armyName(campaign, event.armyId)} was disbanded — ${event.reason}.`;
    case "RegionRaided":
      return `${factionName(event.byFaction)} raided ${regionName(event.regionId)} for ${num(event.gold)} gold.`;

    // -- battles + sieges
    case "BattleResolved":
      return describeBattle(event.battle);
    case "SiegeStarted":
      return `${factionName(event.byFaction)} laid siege to ${regionName(event.regionId)}.`;
    case "SiegeLifted":
      return `The siege of ${regionName(event.regionId)} was lifted — ${event.reason}.`;
    case "RegionCaptured":
      return `${factionName(event.to)} took ${regionName(event.regionId)} from ${factionName(event.from)} and ${policyLabel(event.policy)} it (${num(event.gold)} gold).`;

    // -- diplomacy
    case "TreatyOffered":
      return `${factionName(event.from)} offered ${TREATY_LABELS[event.treaty]} to ${factionName(event.to)}${
        event.gold ? ` for ${num(event.gold)} gold` : ""
      }.`;
    case "TreatyAccepted":
      return `${factionName(event.from)} and ${factionName(event.to)} signed ${TREATY_LABELS[event.treaty]}.`;
    case "TreatyRejected":
      return `${factionName(event.from)} rejected ${TREATY_LABELS[event.treaty]} from ${factionName(event.to)}.`;
    case "TreatyBroken":
      return `${factionName(event.from)} broke ${TREATY_LABELS[event.treaty]} with ${factionName(event.on)}.`;
    case "GiftSent":
      return `${factionName(event.from)} sent ${num(event.amount)} gold to ${factionName(event.to)}.`;
    case "ConfederationDone":
      return `${factionName(event.byFaction)} absorbed ${factionName(event.absorbed)} (${num(event.regions)} regions).`;

    // -- characters
    case "CharacterRecruited":
      return `${event.name} the ${event.kind} joined ${factionName(event.factionId)} for ${num(event.cost)} gold.`;
    case "CharacterMoved":
      return `${campaign.characters[event.characterId]?.name ?? event.characterId} travelled ${regionName(event.to)}.`;
    case "CharacterLevelUp":
      return `${campaign.characters[event.characterId]?.name ?? event.characterId} reached level ${event.level}.`;
    case "SkillLearned":
      return `${campaign.characters[event.characterId]?.name ?? event.characterId} learned ${event.branch} ${event.level}.`;
    case "TraitGained":
      return `${campaign.characters[event.characterId]?.name ?? event.characterId} gained the ${event.trait} trait.`;
    case "CharacterDied":
      return `${campaign.characters[event.characterId]?.name ?? event.characterId} died — ${event.cause}.`;
    case "AgentAction":
      return `${campaign.characters[event.characterId]?.name ?? event.characterId}: ${event.action} — ${
        event.success ? "succeeded" : "failed"
      } (${event.detail}).`;

    // -- economy
    case "TreasuryTicked":
      return `${factionName(event.factionId)}: +${num(event.income)} income, −${num(event.expenses)} upkeep, ${Math.round(
        event.corruption * 100
      )}% corruption → ${num(event.treasury)} gold (net ${num(event.net)}).`;
    case "BuildingQueued":
      return `${factionName(campaign.regions[event.regionId]?.owner ?? 0)} began building ${buildingName(event.buildingId)} in ${regionName(
        event.regionId
      )} (${num(event.cost)} gold, ${event.turns} turn${event.turns === 1 ? "" : "s"}).`;
    case "BuildingCompleted":
      return `${buildingName(event.buildingId)} finished in ${regionName(event.regionId)}.`;
    case "BuildingDisbanded":
      return `${buildingName(event.buildingId)} in ${regionName(event.regionId)} was disbanded.`;
    case "AssetCheckRolled":
      return `${buildingName(event.buildingId)} in ${regionName(event.regionId)} rolled ${event.pool.toUpperCase()} check: d20 ${event.roll} +${event.modifier} = ${event.roll + event.modifier} vs DC ${event.dc} — ${event.success ? "passed" : "failed"}.`;
    case "DevelopmentQueued":
      return `${factionName(campaign.regions[event.regionId]?.owner ?? 0)} began developing ${settlementName(
        event.settlementId
      )} in ${regionName(event.regionId)} (${event.turns} turns).`;
    case "SettlementDeveloped":
      return `${settlementName(event.settlementId)} in ${regionName(event.regionId)} grew to tier ${event.tier}.`;
    case "TreasureWithdrawn":
      return `${factionName(event.factionId)} withdrew ${num(event.wealth)} Wealth into ${num(
        event.gold
      )} purse gold (purse ${num(event.purse)}).`;
    case "TreasureAccumulated":
      return `${factionName(event.factionId)} attempted to accumulate treasure in ${regionName(event.regionId)}: roll ${event.roll} +${event.modifier} vs DC ${event.dc} — ${event.success ? `success (+${event.gain} treasure, total ${event.newTreasure})` : "failed"}.`;
    case "AtrocityPunished":
      return `${factionName(event.factionId)} punished atrocity via ${buildingName(event.sacrificedAssetId)} in ${regionName(event.regionId)}: -${event.reduction} atrocity (current ${event.newAtrocity}).`;
    case "AtrocityChanged":
      return `${factionName(event.factionId)} atrocity ${event.delta > 0 ? `+${event.delta}` : event.delta} (${event.reason}): current ${event.newAtrocity}.`;
    case "TechResearched":
      return `${factionName(event.factionId)} researched ${techName(event.techId)} for ${num(event.cost)} gold.`;

    // -- world
    case "RebellionSpawned":
      return `Brigands rose in ${regionName(event.regionId)}.`;
    case "DomainSave":
      return `${regionName(event.regionId)} rolled a ${event.save} save${event.activity ? ` (${event.activity})` : ""}: d20 ${
        event.roll
      } +${event.modifier} = ${event.roll + event.modifier} vs DC ${event.dc} — ${event.success ? "held" : "failed"}.`;
    case "PoiDiscovered":
      return `${factionName(event.factionId)} discovered ${event.name} (${event.poiType}) for ${num(event.gold)} gold.`;
    case "DilemmaFired":
      return `Dilemma for ${factionName(event.factionId)}: ${event.title}.`;
    case "DilemmaResolved":
      // The dilemma's title is not carried on the resolution (it lives in
      // `pendingEvents`, which the answer removes), so the choice speaks for it.
      return `${factionName(event.factionId)} answered the dilemma “${event.eventId}” with “${event.choiceText}”.`;
    case "AiRationale":
      return `${factionName(event.factionId)} ${event.decision}: ${event.detail}`;

    default:
      return fallback(event);
  }
}

/** An unlisted event type, rendered as its own name and its scalar fields. */
function fallback(event: GameEvent): string {
  const details = Object.entries(event as unknown as Record<string, unknown>)
    .filter(([key]) => key !== "type")
    .filter(([, value]) => typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    .map(([key, value]) => `${key} ${String(value)}`);
  return details.length ? `${event.type} — ${details.join(", ")}` : event.type;
}

const KIND: Record<GameEvent["type"], LogRow["kind"]> = {
  CampaignCreated: "lifecycle",
  TurnBegan: "lifecycle",
  TurnEnded: "lifecycle",
  VictoryAchieved: "lifecycle",
  FactionEliminated: "lifecycle",
  WarDeclared: "war",
  AllyJoinedWar: "war",
  ArmyMoved: "army",
  MovementBlocked: "army",
  StanceSet: "army",
  UnitRecruited: "army",
  ArmyDisbanded: "army",
  RegionRaided: "war",
  BattleResolved: "battle",
  SiegeStarted: "battle",
  SiegeLifted: "battle",
  RegionCaptured: "battle",
  TreatyOffered: "diplomacy",
  TreatyAccepted: "diplomacy",
  TreatyRejected: "diplomacy",
  TreatyBroken: "diplomacy",
  GiftSent: "diplomacy",
  ConfederationDone: "diplomacy",
  CharacterRecruited: "character",
  CharacterMoved: "character",
  CharacterLevelUp: "character",
  SkillLearned: "character",
  TraitGained: "character",
  CharacterDied: "character",
  AgentAction: "character",
  TreasuryTicked: "economy",
  BuildingQueued: "economy",
  BuildingCompleted: "economy",
  BuildingDisbanded: "economy",
  AssetCheckRolled: "economy",
  DevelopmentQueued: "economy",
  SettlementDeveloped: "economy",
  TreasureWithdrawn: "economy",
  TreasureAccumulated: "economy",
  AtrocityPunished: "economy",
  AtrocityChanged: "economy",
  TechResearched: "economy",
  RebellionSpawned: "world",
  DomainSave: "world",
  PoiDiscovered: "world",
  DilemmaFired: "world",
  DilemmaResolved: "world",
  AiRationale: "world"
};

// ---------------------------------------------------------------------------
// The log, as rows
// ---------------------------------------------------------------------------

/**
 * The event stream as display rows.
 *
 * Events carry no timestamps (determinism — events.ts), so the turn is tracked by
 * following `TurnBegan`: every row belongs to the last turn announced. That is why
 * the heading is derived here rather than read off the event.
 *
 * `AiRationale` is the campaign's own opt-in (`campaign.aiRationale`) and would
 * otherwise bury everything else, so it is honoured rather than second-guessed.
 */
export function logRows(campaign: Campaign): LogRow[] {
  const rows: LogRow[] = [];
  let turn = 1;
  let heading: string | null = null;
  for (const event of campaign.log) {
    if (event.type === "TurnBegan") {
      turn = event.turn;
      heading = `Turn ${event.turn} · ${event.season} ${event.year}`;
      continue;
    }
    if (event.type === "AiRationale" && !campaign.aiRationale) continue;
    const text = describe(event, campaign);
    if (text === null) continue;
    rows.push({ turn, heading, text, kind: KIND[event.type] });
    // Only the first row after a turn change carries the heading.
    heading = null;
  }
  return rows;
}

function headHtml(campaign: Campaign | null, total: number, shown: number): string {
  if (!campaign) {
    return `<div class="tw-log-empty">No campaign attached. Start one from the ⚔ menu and this fills with what happens.</div>`;
  }
  // `total` counts *rows*, not events: turn headings are events too, and counting
  // them as hidden rows would claim entries were dropped that are on screen.
  const hidden = Math.max(0, total - shown);
  return (
    `<div class="tw-log-head-row">` +
    `<span class="tw-log-turn">Turn ${campaign.turn}</span>` +
    `<span class="tw-log-id">${escapeHtml(campaign.id)}</span>` +
    `</div>` +
    `<div class="tw-log-sub">${num(campaign.log.length)} event${campaign.log.length === 1 ? "" : "s"} recorded` +
    (hidden ? ` · showing the last ${num(shown)}` : "") +
    `</div>`
  );
}

function rowsHtml(rows: LogRow[]): string {
  return rows
    .map(
      row =>
        (row.heading ? `<div class="tw-log-turnhead">${escapeHtml(row.heading)}</div>` : "") +
        `<div class="tw-log-row" data-kind="${row.kind}"><span class="tw-log-n">${row.turn}</span>` +
        `<span class="tw-log-text">${escapeHtml(row.text)}</span></div>`
    )
    .join("");
}

// ---------------------------------------------------------------------------
// The dialog
// ---------------------------------------------------------------------------

let unsubscribe: (() => void) | null = null;
/** Watches the dialog wrapper so a close by any route releases the listener. */
let watcher: MutationObserver | null = null;
/** What is on screen, so a repaint that changes nothing costs no DOM work. */
let painted = "";
let open = false;

/** Stop listening: the session subscription and the wrapper watcher, both. */
function releaseSubscription(): void {
  unsubscribe?.();
  unsubscribe = null;
  watcher?.disconnect();
  watcher = null;
}

/** Forget the dialog is open and let go of its listener. Touches no DOM. */
function markClosed(): void {
  open = false;
  painted = "";
  releaseSubscription();
}

/**
 * Repaint in place, keeping the scroll pinned to the newest entry.
 *
 * In place, because re-running `openTwDialog` would replace `#alertMessage` and
 * throw away the scroll position on every command — which is exactly when someone
 * is reading it.
 */
function repaint(): void {
  const body = document.getElementById(BODY_ID);
  if (!body || !open) return;
  const campaign = currentSession()?.store.state ?? null;
  const rows = campaign ? logRows(campaign) : [];
  const shown = rows.slice(-MAX_ROWS);
  const head = document.getElementById(HEAD_ID);
  const fingerprint = `${campaign?.id ?? ""}:${campaign?.turn ?? 0}:${campaign?.log.length ?? 0}:${shown.length}`;
  if (fingerprint === painted) return;
  // Follow the newest entry only when the reader is already at the bottom: a
  // scrollback someone has wound back must not be yanked forward.
  const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 24;
  painted = fingerprint;
  if (head) head.innerHTML = headHtml(campaign, rows.length, shown.length);
  body.innerHTML = rowsHtml(shown);
  if (atBottom) body.scrollTop = body.scrollHeight;
}

/**
 * Close the dialog.
 *
 * Public because closing is not only ours: the ✕, Escape and FMG's own
 * `closeDialogs()` all close it too, and the watcher below routes those through
 * here so the session subscription is released either way.
 */
export function closeLogDialog(): void {
  if (!open) return;
  markClosed();
  const jq = fmg()?.$;
  const alert = document.getElementById("alert");
  if (jq && alert) jq(alert).dialog("close");
}

/** Open the dialog. Idempotent: opening an open log just repaints it. */
export function showLogDialog(): void {
  const host = fmg()?.$;
  const alert = document.getElementById("alert");
  if (!host || !alert) {
    twWarn("FMG's dialog widget is unavailable — the log cannot open");
    return;
  }
  if (open) {
    repaint();
    return;
  }
  try {
    openTwDialog("OpenConquest Log", `<div id="${HEAD_ID}"></div><div id="${BODY_ID}" class="tw-log"></div>`, {
      width: 560,
      height: 460
    });
  } catch (error) {
    twWarn("the log dialog failed to open", error);
    open = false;
    return;
  }
  open = true;

  // Stop listening the moment the dialog is gone, however it went: our Close
  // button, the ✕, Escape and FMG's `closeDialogs()` all just hide the wrapper
  // jQuery UI built around `#alert`, and none of them reliably fire a `close`
  // event we could bind (measured: the button closes the dialog, no event fires).
  // Watching the wrapper's own visibility is the one signal all four share.
  const wrapper = alert.closest(".ui-dialog") as HTMLElement | null;
  if (wrapper && typeof MutationObserver === "function") {
    watcher = new MutationObserver(() => {
      if (!open || window.getComputedStyle(wrapper).display !== "none") return;
      markClosed();
    });
    watcher.observe(wrapper, { attributes: true, attributeFilter: ["style", "class"] });
  }

  painted = "";
  repaint();
  // The session is what makes this a *running* log: a command, a turn resolution,
  // an AI move — every one of them ends here.
  unsubscribe = onSession(repaint);
}
