/**
 * panels/rail.ts — the right-hand rail: turn state above, inspection below.
 *
 * Phase A's version of the overlay's floating panels (A.6). The shape is
 * deliberately plain and collapsible, and it never covers the map by default:
 * the map is the product, FMG's own panels stay exactly where they were, and this
 * rail sits beside them rather than over them.
 *
 * What it shows today:
 *   - turn state — the live campaign's faction, turn and command count, or "no
 *     campaign attached" until one is started;
 *   - inspection of the current selection, from the live world data: a region with
 *     its owner beside its name, its population and its settlements — and any
 *     settlement's own stats one click deeper.
 */

import { onContentChange } from "../../content/store";
import { ageLabel } from "../../store/mirror";
import { currentSession, dispatchCommand, mirrorStatus, onSession, startCampaign } from "../../store/session";
import { formatMen } from "../color";
import { escapeHtml } from "../fmg";
import { getSelection, getSource, onSelection, selectedRegion } from "../session";

const RAIL_ID = "tw-rail";

/** A region row, as the rail renders it. Pure: unit-tested without a DOM. */
interface RegionSummary {
  id: number;
  name: string;
  /** the owning state, shown beside the name — null when the map leaves it unclaimed */
  owner: string | null;
  population: number;
  capital: { id: number; name: string } | null;
  /** the region's minor settlements, the ones that are not its capital */
  minors: Array<{ id: number; name: string }>;
  color: string;
}

/** A settlement row — what the inspector drills into. */
interface SettlementSummary {
  id: number;
  name: string;
  capital: boolean;
  population: number;
  walls: number;
  citadel: boolean;
  port: boolean;
  culture: string | null;
  feature: string | null;
}

/** An army row, likewise. */
interface ArmySummary {
  name: string;
  troops: number;
  regiments: number;
  fleet: boolean;
  color: string;
  cell: number;
}

/** Summarize the selected region for display. */
function summarizeRegion(source: ReturnType<typeof getSource>, regionId: number): RegionSummary | null {
  const region = source.regionById(regionId);
  if (!region) return null;
  const inRegion = source.settlements().filter(settlement => settlement.regionId === region.id);
  const capital = inRegion.find(settlement => settlement.id === region.capitalId);
  return {
    id: region.id,
    name: region.name,
    owner: region.ownerName,
    population: region.population,
    capital: capital ? { id: capital.id, name: capital.name } : null,
    minors: inRegion
      .filter(settlement => settlement !== capital)
      .map(settlement => ({ id: settlement.id, name: settlement.name })),
    color: region.color
  };
}

/** Summarize one settlement, or null when the region no longer holds it. */
function summarizeSettlement(
  source: ReturnType<typeof getSource>,
  regionId: number,
  settlementId: number
): SettlementSummary | null {
  const settlement = source
    .settlements()
    .find(candidate => candidate.regionId === regionId && candidate.id === settlementId);
  if (!settlement) return null;
  return {
    id: settlement.id,
    name: settlement.name,
    capital: settlement.capital,
    population: settlement.population,
    walls: settlement.walls,
    citadel: settlement.citadel,
    port: settlement.port,
    culture: settlement.cultureName,
    feature: settlement.featureName
  };
}

/** Summarize the selected army for display. */
function summarizeArmy(source: ReturnType<typeof getSource>, armyId: string): ArmySummary | null {
  const army = source.armies().find(candidate => candidate.id === armyId);
  if (!army) return null;
  return {
    name: army.name,
    troops: army.troops,
    regiments: army.regiments,
    fleet: army.fleet,
    color: army.color,
    cell: army.cell
  };
}

function row(label: string, value: string): string {
  return `<div class="tw-row"><span>${label}</span><span>${value}</span></div>`;
}

/** FMG's walls are a tier, not a boolean; say what the tier means. */
const WALL_LABELS = ["None", "Ditch", "Palisade", "Stone wall"];

function wallLabel(tier: number): string {
  return WALL_LABELS[tier] ?? `Tier ${tier}`;
}

const yesNo = (value: boolean): string => (value ? "Yes" : "No");

/**
 * A settlement name, rendered as the control that opens that settlement's stats.
 * The id is ours (it came out of the read model), so it is interpolated as-is.
 */
function settlementLink(id: number, name: string): string {
  return `<button class="tw-link" data-tw-action="settlement" data-tw-id="${id}">${escapeHtml(name)}</button>`;
}

/** The turn panel: campaign state, or an honest "none attached". */
function renderTurnPanel(): string {
  const session = currentSession();
  if (!session) {
    return /* html */ `
      <div class="tw-panel">
        <div class="tw-panel-head"><span>Turn</span></div>
        <div class="tw-rail-body">
          <div class="tw-empty">Compiling this world…</div>
        </div>
      </div>`;
  }

  const store = session.store;
  const campaign = store.state;
  if (!campaign) {
    const factions = session.factionNames;
    return /* html */ `
      <div class="tw-panel">
        <div class="tw-panel-head"><span>Turn</span></div>
        <div class="tw-rail-body">
          <div class="tw-empty">No campaign attached.<br />${factions.length} factions on this map.</div>
          <button class="tw-endturn" data-tw-action="start" ${factions.length ? "" : "disabled"}>Start campaign</button>
        </div>
      </div>`;
  }

  const playerFactions = session.factionNames.filter(entry => {
    return campaign.playerFactionIds?.includes(entry.id) ?? (campaign.factionId > 0 && entry.id === campaign.factionId);
  });
  const titleText =
    playerFactions.length === 0
      ? "Spectator (All AI)"
      : playerFactions.length === 1
        ? (playerFactions[0]?.name ?? `Faction ${campaign.factionId}`)
        : `${playerFactions.length} Player Factions`;
  const subText =
    playerFactions.length > 1
      ? `<div class="tw-sub">${escapeHtml(playerFactions.map(f => f.name).join(", "))}</div>`
      : "";

  return /* html */ `
    <div class="tw-panel">
      <div class="tw-panel-head"><span>Turn</span></div>
      <div class="tw-rail-body">
        <p class="tw-title">${escapeHtml(titleText)}</p>
        ${subText}
        ${row("Turn", String(campaign.turn))}
        ${
          playerFactions.length === 1 && playerFactions[0]?.id && campaign.factions[String(playerFactions[0].id)]
            ? row("Treasure", String(campaign.factions[String(playerFactions[0].id)]?.treasure ?? 0)) +
              row("Atrocity", String(campaign.factions[String(playerFactions[0].id)]?.atrocity ?? 0))
            : ""
        }
        ${row("Commands", String(store.log.length))}
        ${row("Factions left", String(Object.values(campaign.factions).filter(f => f.alive).length))}
        <button class="tw-endturn" data-tw-action="endturn">End turn</button>
      </div>
    </div>`;
}

/** The mirror line: when this campaign was last written outside the .map file. */
let mirrorLabelText = "not yet";
let mirrorTimer: ReturnType<typeof setInterval> | null = null;

/** Refresh the mirror's timestamp, and keep "2m ago" true without repainting often. */
async function updateMirrorLabel(): Promise<void> {
  const status = await mirrorStatus();
  mirrorLabelText = status ? `saved ${ageLabel(status.savedAt)}` : "not yet";
}

function startMirrorClock(): void {
  if (mirrorTimer !== null || typeof setInterval !== "function") return;
  mirrorTimer = setInterval(() => {
    const before = mirrorLabelText;
    void updateMirrorLabel().then(() => {
      // Repaint only when "just now" became "2m ago" — a tick with no news
      // must not re-render the rail.
      if (mirrorLabelText !== before) refreshRail();
    });
  }, 15000);
}

/**
 * Which settlement the inspector is drilled into, if any. This is *view* state,
 * not selection: clicking a settlement's name does not change what is selected on
 * the map, so a region re-selection is the only thing that leaves the drill — and
 * leaving it re-opens the region view.
 */
let drilledSettlementId: number | null = null;

/** The settlement view: one burg's stats, with a way back to its region. */
function renderSettlement(summary: SettlementSummary, region: RegionSummary): string {
  const session = currentSession();
  const campaign = session?.store?.state;
  const rs = campaign?.regions[String(region.id)];
  const isOccupied = rs?.occupiedSettlements?.includes(summary.id);
  const statusHtml = isOccupied ? row("Status", `<span style="color:#e06c75; font-weight:bold;">Occupied by Enemy</span>`) : "";
  return /* html */ `
    <button class="tw-link tw-back" data-tw-action="region">‹ ${escapeHtml(region.name)}</button>
    <p class="tw-title">${escapeHtml(summary.name)}</p>
    <div class="tw-sub">${summary.capital ? "Capital" : "Settlement"} of ${escapeHtml(region.name)}${
      region.owner ? ` (${escapeHtml(region.owner)})` : ""
    }</div>
    ${statusHtml}
    ${row("Type", summary.capital ? "Capital" : "Settlement")}
    ${row("Population", summary.population.toLocaleString("en-US"))}
    ${row("Walls", wallLabel(summary.walls))}
    ${row("Citadel", yesNo(summary.citadel))}
    ${row("Port", yesNo(summary.port))}
    ${row("Culture", summary.culture ? escapeHtml(summary.culture) : "—")}
    ${row("Feature", summary.feature ? escapeHtml(summary.feature) : "—")}`;
}

/** The region view: who holds it, how big it is, and what stands on it. */
function renderRegion(summary: RegionSummary): string {
  const owner = summary.owner ? `<span class="tw-owner">(${escapeHtml(summary.owner)})</span>` : "";
  const session = currentSession();
  const campaign = session?.store?.state;
  const rs = campaign?.regions[String(summary.id)];
  let campaignHtml = "";
  if (campaign && rs) {
    campaignHtml += row("Public Order", `${rs.order} / 100`);
    if (rs.construction) {
      const c = rs.construction;
      const checksText = c.checks
        ? `M:${c.checks.m ? "✓" : "…"} W:${c.checks.w ? "✓" : "…"} S:${c.checks.s ? "✓" : "…"}${c.pityBonus ? ` (-${c.pityBonus})` : ""}`
        : `${c.turnsLeft} turns`;
      campaignHtml += row("Building", `${escapeHtml(c.buildingId)} (${checksText})`);
    }
    if (rs.buildings.length) {
      campaignHtml += row("Buildings", escapeHtml(rs.buildings.join(", ")));
    }
  }

  return /* html */ `
    <p class="tw-title"><span class="tw-chip" style="background:${summary.color}"></span>${escapeHtml(summary.name)}${owner}</p>
    ${row("Population", summary.population.toLocaleString("en-US"))}
    ${row("Capital", summary.capital ? settlementLink(summary.capital.id, summary.capital.name) : "—")}
    ${row(
      "Settlements",
      summary.minors.length
        ? summary.minors
            .map(settlement => {
              const occ = rs?.occupiedSettlements?.includes(settlement.id);
              return `${settlementLink(settlement.id, settlement.name)}${occ ? ' <span style="color:#e06c75; font-size:11px;">[Occupied]</span>' : ""}`;
            })
            .join(", ")
        : "—"
    )}
    ${campaignHtml}`;
}

function renderInspection(): string {
  const source = getSource();
  const selection = getSelection();

  if (selection.kind === "army") {
    const army = summarizeArmy(source, selection.armyId);
    if (army) {
      return /* html */ `
        <p class="tw-title"><span class="tw-chip" style="background:${army.color}"></span>${escapeHtml(army.name)}</p>
        ${row("Men", formatMen(army.troops))}
        ${row("Regiments", String(army.regiments))}
        ${row("Type", army.fleet ? "Fleet" : "Army")}
        ${row("Cell", String(army.cell))}`;
    }
  }

  if (selection.kind === "region") {
    const region = selectedRegion();
    const summary = region ? summarizeRegion(source, region.id) : null;
    if (region && summary) {
      const drilled = drilledSettlementId == null ? null : summarizeSettlement(source, region.id, drilledSettlementId);
      // A drill that no longer resolves (the burg was deleted, the map was
      // reloaded) falls back to the region rather than showing nothing.
      return drilled ? renderSettlement(drilled, summary) : renderRegion(summary);
    }
  }

  if (source.empty) return `<div class="tw-empty">Generate or load a map.</div>`;
  return `<div class="tw-empty">Click a region or an army to inspect it.<br />FMG's own tools keep working.</div>`;
}

/** Repaint just the inspection panel. Safe before installation (no-op). */
function refreshInspection(): void {
  const body = document.querySelector<HTMLElement>(".tw-rail-body--inspect");
  if (body) body.innerHTML = renderInspection();
}

/** Repaint both panels from current state. Safe before installation (no-op). */
function refreshRail(): void {
  const rail = document.getElementById(RAIL_ID);
  if (!rail) return;
  // Replace the whole turn panel. Its body carries the `--turn` hook class, and a
  // replacement that dropped that class would leave the rail unable to update
  // itself ever again — which is exactly what happened when this hook was added
  // by patching the initial HTML instead of at the source.
  const turn = rail.querySelector<HTMLElement>(".tw-panel:has(.tw-rail-body--turn)") ?? rail.firstElementChild;
  if (turn) {
    const fresh = document.createElement("div");
    fresh.innerHTML = renderTurnPanel();
    const replacement = fresh.firstElementChild;
    if (replacement) turn.replaceWith(replacement);
  }
  refreshInspection();
}

/** Install the rail. Idempotent; safe to call before a map exists. */
export function installRail(): void {
  if (document.getElementById(RAIL_ID)) return;

  const rail = document.createElement("div");
  rail.id = RAIL_ID;
  rail.innerHTML =
    renderTurnPanel() +
    `<div class="tw-panel tw-inspect">` +
    `<div class="tw-panel-head"><span>Inspect</span>` +
    `<button class="tw-rail-toggle" title="Collapse the rail">›</button></div>` +
    `<div class="tw-rail-body tw-rail-body--inspect">${renderInspection()}</div></div>`;
  rail.style.display = "none";
  rail.hidden = true;
  document.body.append(rail);

  const toggle = rail.querySelector<HTMLButtonElement>(".tw-rail-toggle");
  toggle?.addEventListener("click", () => {
    const collapsed = rail.classList.toggle("is-collapsed");
    if (toggle) toggle.textContent = collapsed ? "‹" : "›";
    if (toggle) toggle.title = collapsed ? "Expand the rail" : "Collapse the rail";
  });

  // One delegated listener, so re-rendering panels never orphans a button.
  rail.addEventListener("click", event => {
    const trigger = (event.target as Element | null)?.closest<HTMLElement>("[data-tw-action]");
    const action = trigger?.dataset.twAction;
    if (action === "start") startCampaign();
    else if (action === "endturn") dispatchCommand({ type: "EndTurn" });
    else if (action === "settlement") {
      // Guard the id: the markup is ours, but a click must never put a NaN in the
      // drill state and leave the inspector on a view that renders nothing.
      const id = Number(trigger?.dataset.twId);
      drilledSettlementId = Number.isFinite(id) ? id : null;
      refreshInspection();
    } else if (action === "region") {
      drilledSettlementId = null;
      refreshInspection();
    }
  });

  onSelection(() => {
    // A new selection is a new subject: never inherit the previous drill.
    drilledSettlementId = null;
    refreshInspection();
  });

  // The rail is told when the session changes rather than refreshing itself at
  // each call site: starting a campaign from the menu, from the console or from
  // the API all repaint the same way, and none of them can forget to.
  onSession(() => {
    void updateMirrorLabel().then(() => refreshRail());
  });
  // Rules are page state now (Phase D), so they change without any campaign
  // happening — the rail must not be the last thing to learn about it.
  onContentChange(() => refreshRail());
  startMirrorClock();
}
