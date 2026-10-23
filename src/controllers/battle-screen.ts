import { select, sum } from "d3";
import { closeDialogs, refreshEditors } from "@/components/dialog/dialog-helpers";
import { applySortingByHeader } from "@/components/dialog/sorting";
import { Icons } from "@/components/icons";
import { Layers } from "@/components/layers";
import { tip } from "@/components/tooltips";
import { moveRegiment } from "@/renderers/draw-military";
import type { Marker } from "../generators/markers-generator";
import {
  type Regiment,
  Military,
  reconcileRegimentBlocks,
  syncRegimentTotals,
  getCategoryForUnit
} from "../generators/military-generator";
import type { State } from "../generators/states-generator";
import {
  initBattleSession,
  stepBattleRound,
  finalizeBattle,
  estimateOdds,
  type BattleSession,
  type BattleSide as ConquestBattleSide,
  type BattleModifiers,
  type BattleTacticalOrder,
  type BattleOutcome
} from "@/conquest/engine/game/battle";
import type { UnitType } from "@/conquest/engine/common/content";
import { currentContent } from "@/conquest/content/store";
import { capitalize, ensureEl, escapeHtml, last, wiki } from "../utils";

interface RegimentEntry {
  regiment: Regiment;
  state: State;
  distance: number;
  startingUnits: { type: string; count: number; exp: number }[];
  currentUnits: { type: string; count: number; exp: number }[];
  roundCasualties: number;
}

interface ActiveBattle {
  attackers: RegimentEntry[];
  defenders: RegimentEntry[];
  attackerOrder: BattleTacticalOrder;
  defenderOrder: BattleTacticalOrder;
  session: BattleSession;
  modifiers: BattleModifiers;
  x: number;
  y: number;
  cell: number;
  place: string;
  name: string;
  unitTypes: Record<string, UnitType>;
  finalOutcome?: BattleOutcome;
}

let activeBattle: ActiveBattle | null = null;

function open(attacker: Regiment, defender: Regiment): void {
  if (customization) return;
  closeDialogs(".stable");
  customization = 13; // Enter edit mode to prevent colliding dialogs

  const x = defender.x;
  const y = defender.y;
  const cell = Pack.findCell(x, y) ?? 0;
  const burgId = pack.cells.burg[cell];
  const burg = burgId ? pack.burgs[burgId] : undefined;

  const unitTypes = Military.getUnitTypes();
  const content = currentContent();
  const config = content.config;

  const place = definePlace(cell);
  const name = defineBattleName(place, Boolean(burg));

  const modifiers: BattleModifiers = {
    walls: burg?.walls ? burg.walls : 0,
    defenderEncamped: false,
    defenderAmbushed: false,
    attackerCrossedRiver: Boolean(pack.cells.r[cell]),
    labels: []
  };

  const attackers = [createRegimentEntry(attacker, x, y, unitTypes)];
  const defenders = [createRegimentEntry(defender, x, y, unitTypes)];

  const attackerSide: ConquestBattleSide = {
    factionId: attacker.state,
    armyId: `fm-${attacker.state}-${attacker.i}`,
    units: attackers.flatMap(r => r.currentUnits)
  };

  const defenderSide: ConquestBattleSide = {
    factionId: defender.state,
    armyId: `fm-${defender.state}-${defender.i}`,
    units: defenders.flatMap(r => r.currentUnits)
  };

  const session = initBattleSession({
    config,
    unitTypes,
    attacker: attackerSide,
    defender: defenderSide,
    cell,
    regionId: cell,
    assault: Boolean(burg?.walls),
    modifiers
  });

  // Move attacker onto battlefield position
  attacker.px ??= attacker.x;
  attacker.py ??= attacker.y;
  defender.px ??= defender.x;
  defender.py ??= defender.y;
  moveRegiment(attacker, x, y);

  activeBattle = {
    attackers,
    defenders,
    attackerOrder: "balanced",
    defenderOrder: "balanced",
    session,
    modifiers,
    x,
    y,
    cell,
    place,
    name,
    unitTypes
  };

  renderDialog();
  updateOddsAndMorale();
  renderRosters();
  renderHistory();

  $("#battleScreen").dialog({
    title: activeBattle.name,
    resizable: false,
    width: "fit-content",
    position: { my: "center", at: "center", of: "#map" },
    close: cancelResults
  });
}

function createRegimentEntry(r: Regiment, bx: number, by: number, unitTypes: Record<string, UnitType>): RegimentEntry {
  r.px ??= r.x;
  r.py ??= r.y;
  if (!r.units || r.units.length === 0) {
    reconcileRegimentBlocks(r, unitTypes);
  }
  const startingUnits = (r.units ?? [])
    .filter(u => u.count > 0)
    .map(u => ({ type: u.type, count: u.count, exp: u.exp ?? 0 }));
  const currentUnits = (r.units ?? [])
    .filter(u => u.count > 0)
    .map(u => ({ type: u.type, count: u.count, exp: u.exp ?? 0 }));
  const state = pack.states[r.state];
  const distance = Math.round(Math.hypot(by - r.by, bx - r.bx) * options.map.units.distance.scale);

  return {
    regiment: r,
    state,
    distance,
    startingUnits,
    currentUnits,
    roundCasualties: 0
  };
}

function syncSessionToEntries(side: "attackers" | "defenders"): void {
  if (!activeBattle) return;
  const entries = activeBattle[side];
  const sessionUnits = side === "attackers" ? activeBattle.session.attackerUnits : activeBattle.session.defenderUnits;
  let unitIdx = 0;
  for (const entry of entries) {
    let entryRoundLosses = 0;
    for (const u of entry.currentUnits) {
      if (unitIdx < sessionUnits.length) {
        const newCount = sessionUnits[unitIdx].count;
        const loss = u.count - newCount;
        if (loss > 0) entryRoundLosses += loss;
        u.count = newCount;
        unitIdx++;
      }
    }
    entry.roundCasualties = entryRoundLosses;
  }
}

function disablePreBattleControls(): void {
  const addBtn = document.getElementById("battleAddRegiment") as HTMLButtonElement | null;
  if (addBtn) addBtn.disabled = true;
  for (const id of ["modWalls", "modRiver", "modEncamped", "modAmbush"]) {
    const el = document.getElementById(id) as HTMLButtonElement | null;
    if (el) el.disabled = true;
  }
}

function rebuildSession(): void {
  if (!activeBattle) return;
  const b = activeBattle;
  const config = currentContent().config;

  const attackerSide: ConquestBattleSide = {
    factionId: b.attackers[0]?.state.i ?? 1,
    armyId: b.attackers[0] ? `fm-${b.attackers[0].state.i}-${b.attackers[0].regiment.i}` : null,
    units: b.attackers.flatMap(r => r.currentUnits)
  };
  const defenderSide: ConquestBattleSide = {
    factionId: b.defenders[0]?.state.i ?? 1,
    armyId: b.defenders[0] ? `fm-${b.defenders[0].state.i}-${b.defenders[0].regiment.i}` : null,
    units: b.defenders.flatMap(r => r.currentUnits)
  };

  b.session = initBattleSession({
    config,
    unitTypes: b.unitTypes,
    attacker: attackerSide,
    defender: defenderSide,
    cell: b.cell,
    regionId: b.cell,
    assault: Boolean(b.modifiers.walls),
    modifiers: b.modifiers
  });

  updateOddsAndMorale();
  renderRosters();
  renderHistory();
}

function renderDialog(): void {
  document.getElementById("battleScreen")?.remove();
  document.getElementById("regimentSelectorScreen")?.remove();

  const b = activeBattle!;
  const editorHtml = /* html */ `<div id="battleScreen" class="dialog stable" style="min-width: 680px; max-width: 820px;">
    <div id="battleHeader" style="margin-bottom: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span id="battleNameDisplay" style="font-weight: bold; font-size: 1.15em;">${escapeHtml(b.name)}</span>
          <input id="battleNameEdit" type="text" style="display: none; width: 14em;" value="${escapeHtml(b.name)}" />
          <i id="battleNameToggle" class="icon-pencil pointer" data-tip="Click to rename battle"></i>
        </div>
        <div id="battleRoundDisplay" style="font-size: 1em; font-weight: bold; opacity: 0.9;">
          Round: <span id="battleRoundNum">${b.session.round}</span> / ${b.session.config.battle.maxRounds}
        </div>
      </div>

      <!-- Modifiers & Context Bar -->
      <div id="battleModifiersBar" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; font-size: 0.85em;">
        <span style="opacity: 0.8;">Modifiers:</span>
        <button id="modWalls" class="btn" style="padding: 2px 7px;" data-tip="Settlement Fortifications. Click to cycle wall tier">Walls: Tier ${b.modifiers.walls}</button>
        <button id="modRiver" class="btn ${b.modifiers.attackerCrossedRiver ? "active" : ""}" style="padding: 2px 7px;" data-tip="Attacker crossed river into battle (+25% Defender Bonus)">River Crossing</button>
        <button id="modEncamped" class="btn ${b.modifiers.defenderEncamped ? "active" : ""}" style="padding: 2px 7px;" data-tip="Defenders fortified in encampment (+20% Defense)">Encamped</button>
        <button id="modAmbush" class="btn ${b.modifiers.defenderAmbushed ? "active" : ""}" style="padding: 2px 7px;" data-tip="Surprise Ambush (+30% Attacker Bonus)">Ambush</button>
      </div>

      <!-- Odds & Win Ratio Bar -->
      <div id="battleOddsContainer" style="padding: 6px 10px; background: rgba(0,0,0,0.15); border-radius: 4px; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; font-size: 0.85em; margin-bottom: 4px;">
          <span><b>Attackers:</b> <span id="oddsAttackerPct">50%</span> (<span id="oddsAttackerPower">0</span> pwr)</span>
          <span id="oddsPrediction" style="font-style: italic; opacity: 0.85;">Balanced Odds</span>
          <span><b>Defenders:</b> <span id="oddsDefenderPct">50%</span> (<span id="oddsDefenderPower">0</span> pwr)</span>
        </div>
        <div style="display: flex; height: 14px; border-radius: 3px; overflow: hidden; background: #444;">
          <div id="oddsAttackerBar" style="width: 50%; background: #3498db; transition: width 0.3s ease;"></div>
          <div id="oddsDefenderBar" style="width: 50%; background: #e74c3c; transition: width 0.3s ease;"></div>
        </div>
      </div>

      <!-- Tactical Stance Selectors -->
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px; padding: 6px 8px; background: rgba(0,0,0,0.08); border-radius: 4px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-weight: 500; font-size: 0.9em;">Attacker Order:</span>
          <select id="battleOrderAttackers" style="padding: 2px 4px; font-size: 0.85em;">
            <option value="balanced" ${b.attackerOrder === "balanced" ? "selected" : ""}>⚔️ Balanced (Standard)</option>
            <option value="skirmish" ${b.attackerOrder === "skirmish" ? "selected" : ""}>🏹 Skirmish (Screen & Missile)</option>
            <option value="press" ${b.attackerOrder === "press" ? "selected" : ""}>🛡️ Melee Press (Infantry Push)</option>
            <option value="charge" ${b.attackerOrder === "charge" ? "selected" : ""}>🐴 Shock Charge (Cavalry Assault)</option>
            <option value="brace" ${b.attackerOrder === "brace" ? "selected" : ""}>🛡️ Brace / Hold (Anti-Charge)</option>
            <option value="withdraw" ${b.attackerOrder === "withdraw" ? "selected" : ""}>🏳️ Withdraw (Ordered Retreat)</option>
          </select>
        </div>
        <button id="battleAiPickBtn" data-tip="AI evaluates compositions and chooses stances" style="padding: 2px 8px; font-size: 0.85em;" class="icon-retweet">AI Stance</button>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-weight: 500; font-size: 0.9em;">Defender Order:</span>
          <select id="battleOrderDefenders" style="padding: 2px 4px; font-size: 0.85em;">
            <option value="balanced" ${b.defenderOrder === "balanced" ? "selected" : ""}>⚔️ Balanced (Standard)</option>
            <option value="skirmish" ${b.defenderOrder === "skirmish" ? "selected" : ""}>🏹 Skirmish (Screen & Missile)</option>
            <option value="press" ${b.defenderOrder === "press" ? "selected" : ""}>🛡️ Melee Press (Infantry Push)</option>
            <option value="charge" ${b.defenderOrder === "charge" ? "selected" : ""}>🐴 Shock Charge (Cavalry Assault)</option>
            <option value="brace" ${b.defenderOrder === "brace" ? "selected" : ""}>🛡️ Brace / Hold (Anti-Charge)</option>
            <option value="withdraw" ${b.defenderOrder === "withdraw" ? "selected" : ""}>🏳️ Withdraw (Ordered Retreat)</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Battle Rosters View -->
    <div id="battleBody" style="max-height: 480px; overflow-y: auto; padding-right: 4px;">
      <!-- Attackers Section -->
      <div style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: bold; color: #3498db;">Attackers</span>
            <span id="attackersTotalMen" style="font-size: 0.9em; opacity: 0.85;"></span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px; font-size: 0.85em;">
            <span>Cohesion:</span>
            <meter id="battleMorale_attackers" min="0" max="100" low="25" high="60" optimum="80" value="100" style="width: 8em;"></meter>
            <span id="attackersCohesionPct">100%</span>
          </div>
        </div>
        <div id="battleAttackersTable" class="table" style="background: rgba(0,0,0,0.05); border-radius: 4px; padding: 4px;"></div>
      </div>

      <!-- Defenders Section -->
      <div style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: bold; color: #e74c3c;">Defenders</span>
            <span id="defendersTotalMen" style="font-size: 0.9em; opacity: 0.85;"></span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px; font-size: 0.85em;">
            <span>Cohesion:</span>
            <meter id="battleMorale_defenders" min="0" max="100" low="25" high="60" optimum="80" value="100" style="width: 8em;"></meter>
            <span id="defendersCohesionPct">100%</span>
          </div>
        </div>
        <div id="battleDefendersTable" class="table" style="background: rgba(0,0,0,0.05); border-radius: 4px; padding: 4px;"></div>
      </div>

      <!-- Battle Outcome Banner (Hidden while active) -->
      <div id="battleOutcomeBanner" style="display: none; padding: 10px; text-align: center; border-radius: 4px; font-weight: bold; margin-bottom: 10px;"></div>

      <!-- Engagement History Log -->
      <div id="battleHistoryContainer" style="margin-top: 8px;">
        <div style="font-size: 0.85em; font-weight: bold; margin-bottom: 4px; opacity: 0.8;">Engagement Chronicle:</div>
        <div id="battleHistoryLog" style="font-size: 0.82em; max-height: 90px; overflow-y: auto; background: rgba(0,0,0,0.1); padding: 4px 8px; border-radius: 3px; font-family: monospace;"></div>
      </div>
    </div>

    <!-- Bottom Controls -->
    <div id="battleBottom" style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; border-top: 1px solid rgba(0,0,0,0.1); padding-top: 8px;">
      <div style="display: flex; gap: 6px;">
        <button id="battleAddRegiment" data-tip="Add another regiment to this battle" class="icon-user-plus"></button>
        <button id="battleWiki" data-tip="Open Battle Simulation Tutorial" class="icon-info"></button>
      </div>
      <div style="display: flex; gap: 8px;">
        <button id="battleStepRound" data-tip="Fight next turn-by-turn round" class="btn" style="padding: 4px 12px; font-weight: bold;">
          ⚔️ Next Round
        </button>
        <button id="battleAutoResolve" data-tip="Auto-resolve remaining rounds to completion" class="btn" style="padding: 4px 12px;">
          ⏩ Auto-Resolve
        </button>
        <button id="battleApply" data-tip="Apply battle casualties to regiments and record battlefield" class="btn" style="padding: 4px 14px; background: #27ae60; color: white;">
          ✓ Apply Results
        </button>
        <button id="battleCancel" data-tip="Cancel battle and restore regiment positions" class="btn" style="padding: 4px 10px;">
          ✕ Cancel
        </button>
      </div>
    </div>
  </div>

  <div id="regimentSelectorScreen" class="dialog">
    <div id="regimentSelectorHeader" class="header" style="grid-template-columns: 9em 13em 4em 6em">
      <div data-tip="Click to sort by state name" class="sortable alphabetically" data-sortby="state">State&nbsp;</div>
      <div data-tip="Click to sort by regiment name" class="sortable alphabetically" data-sortby="regiment">Regiment&nbsp;</div>
      <div data-tip="Click to sort by total military forces" class="sortable" data-sortby="total">Total&nbsp;</div>
      <div data-tip="Click to sort by distance to the battlefield" class="sortable icon-sort-number-up" data-sortby="distance">Distance&nbsp;</div>
    </div>
    <div id="regimentSelectorBody" class="table"></div>
  </div>`;

  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  applySortingByHeader("battleScreen", "regimentSelectorHeader");

  // Wiring event listeners
  ensureEl("battleStepRound").addEventListener("click", () => stepRound());
  ensureEl("battleAutoResolve").addEventListener("click", () => autoResolve());
  ensureEl("battleApply").addEventListener("click", () => applyResults());
  ensureEl("battleCancel").addEventListener("click", () => cancelResults());
  ensureEl("battleAddRegiment").addEventListener("click", () => openRegimentSelector());
  ensureEl("battleWiki").addEventListener("click", () => wiki("Battle-Simulator"));
  ensureEl("battleAiPickBtn").addEventListener("click", () => pickAiOrders());

  ensureEl("battleOrderAttackers").addEventListener("change", (e: Event) => {
    if (activeBattle) activeBattle.attackerOrder = (e.target as HTMLSelectElement).value as BattleTacticalOrder;
  });
  ensureEl("battleOrderDefenders").addEventListener("change", (e: Event) => {
    if (activeBattle) activeBattle.defenderOrder = (e.target as HTMLSelectElement).value as BattleTacticalOrder;
  });

  // Rename controls
  const toggleBtn = ensureEl("battleNameToggle");
  const displayEl = ensureEl("battleNameDisplay");
  const editInput = ensureEl<HTMLInputElement>("battleNameEdit");
  toggleBtn.addEventListener("click", () => {
    if (editInput.style.display === "none") {
      editInput.style.display = "inline-block";
      displayEl.style.display = "none";
      editInput.focus();
    } else {
      editInput.style.display = "none";
      displayEl.style.display = "inline-block";
    }
  });
  editInput.addEventListener("change", () => {
    if (activeBattle) {
      activeBattle.name = editInput.value.trim() || activeBattle.name;
      displayEl.textContent = activeBattle.name;
      $("#battleScreen").dialog({ title: activeBattle.name });
    }
  });

  // Modifiers controls
  ensureEl("modWalls").addEventListener("click", () => {
    if (!activeBattle) return;
    activeBattle.modifiers.walls = (activeBattle.modifiers.walls + 1) % 4;
    ensureEl("modWalls").textContent = `Walls: Tier ${activeBattle.modifiers.walls}`;
    rebuildSession();
  });
  ensureEl("modRiver").addEventListener("click", () => {
    if (!activeBattle) return;
    activeBattle.modifiers.attackerCrossedRiver = !activeBattle.modifiers.attackerCrossedRiver;
    ensureEl("modRiver").classList.toggle("active", activeBattle.modifiers.attackerCrossedRiver);
    rebuildSession();
  });
  ensureEl("modEncamped").addEventListener("click", () => {
    if (!activeBattle) return;
    activeBattle.modifiers.defenderEncamped = !activeBattle.modifiers.defenderEncamped;
    ensureEl("modEncamped").classList.toggle("active", activeBattle.modifiers.defenderEncamped);
    rebuildSession();
  });
  ensureEl("modAmbush").addEventListener("click", () => {
    if (!activeBattle) return;
    activeBattle.modifiers.defenderAmbushed = !activeBattle.modifiers.defenderAmbushed;
    ensureEl("modAmbush").classList.toggle("active", activeBattle.modifiers.defenderAmbushed);
    rebuildSession();
  });
}

function updateOddsAndMorale(): void {
  if (!activeBattle) return;
  const b = activeBattle;
  const config = currentContent().config;

  const odds = estimateOdds(
    config,
    { factionId: 1, armyId: null, units: b.attackers.flatMap(r => r.currentUnits) },
    { factionId: 2, armyId: null, units: b.defenders.flatMap(r => r.currentUnits) },
    b.modifiers,
    b.unitTypes
  );

  ensureEl("oddsAttackerPct").textContent = `${odds.attackerWinPct}%`;
  ensureEl("oddsDefenderPct").textContent = `${100 - odds.attackerWinPct}%`;
  ensureEl("oddsAttackerPower").textContent = String(odds.attackerPower);
  ensureEl("oddsDefenderPower").textContent = String(odds.defenderPower);

  ensureEl("oddsAttackerBar").style.width = `${odds.attackerWinPct}%`;
  ensureEl("oddsDefenderBar").style.width = `${100 - odds.attackerWinPct}%`;

  const predEl = ensureEl("oddsPrediction");
  if (odds.attackerWinPct >= 70) predEl.textContent = "Attacker Favored";
  else if (odds.attackerWinPct <= 30) predEl.textContent = "Defender Favored";
  else predEl.textContent = "Contested Engagement";

  // Morale / Power fractions
  const lastLog = b.session.history.at(-1);
  const aFrac = lastLog ? lastLog.attackerPowerFrac : 1;
  const dFrac = lastLog ? lastLog.defenderPowerFrac : 1;

  const aPct = Math.max(0, Math.round(aFrac * 100));
  const dPct = Math.max(0, Math.round(dFrac * 100));

  ensureEl<HTMLInputElement>("battleMorale_attackers").value = String(aPct);
  ensureEl<HTMLInputElement>("battleMorale_defenders").value = String(dPct);
  ensureEl("attackersCohesionPct").textContent = `${aPct}%`;
  ensureEl("defendersCohesionPct").textContent = `${dPct}%`;

  ensureEl("battleRoundNum").textContent = String(b.session.round);
}

function renderRosters(): void {
  if (!activeBattle) return;
  const b = activeBattle;

  renderSideTable("battleAttackersTable", b.attackers, b.unitTypes);
  renderSideTable("battleDefendersTable", b.defenders, b.unitTypes);

  const aMen = sum(b.attackers.map(r => sum(r.currentUnits.map(u => u.count))));
  const dMen = sum(b.defenders.map(r => sum(r.currentUnits.map(u => u.count))));
  ensureEl("attackersTotalMen").textContent = `(${aMen} men)`;
  ensureEl("defendersTotalMen").textContent = `(${dMen} men)`;
}

function renderSideTable(containerId: string, side: RegimentEntry[], unitTypes: Record<string, UnitType>): void {
  const container = ensureEl(containerId);
  let html = "";

  for (const entry of side) {
    const reg = entry.regiment;
    const clr = entry.state.color || "#777";
    const href = escapeHtml(Icons.href(reg.icon ?? ""));
    const regIcon = `<svg width="1.1em" height="1.1em" style="margin-bottom:-2px;"><rect width="100%" height="100%" fill="${clr}"></rect><use href="${href}" width="100%" height="100%"></use></svg>`;
    const entryStart = sum(entry.startingUnits.map(u => u.count));
    const entryCurrent = sum(entry.currentUnits.map(u => u.count));
    const entryLoss = entryStart - entryCurrent;

    html += `<div style="margin-bottom:6px; border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom:4px;">
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.88em; font-weight:600; margin-bottom:3px;">
        <div style="display:flex; align-items:center; gap:5px;">
          ${regIcon}
          <span>${escapeHtml(reg.name)}</span>
          <span style="font-size:0.85em; opacity:0.8; font-weight:normal;">(${escapeHtml(entry.state.fullName || entry.state.name)})</span>
        </div>
        <div style="font-size:0.8em; opacity:0.8;">${entryCurrent}/${entryStart} men ${entryLoss > 0 ? `(-${entryLoss})` : ""} · Base: ${entry.distance} ${options.map.units.distance.unit}</div>
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:0.82em;">
        <thead>
          <tr style="opacity:0.75; border-bottom:1px solid rgba(0,0,0,0.06);">
            <th style="text-align:left; width:22%;">Unit</th>
            <th style="text-align:center; width:12%;">Category</th>
            <th style="text-align:center; width:10%;">Exp</th>
            <th style="text-align:right; width:16%;">Start</th>
            <th style="text-align:right; width:16%;">Casualties</th>
            <th style="text-align:right; width:24%;">Survivors</th>
          </tr>
        </thead>
        <tbody>`;

    for (let i = 0; i < entry.currentUnits.length; i++) {
      const u = entry.currentUnits[i];
      const start = entry.startingUnits[i]?.count ?? u.count;
      const dead = start - u.count;
      const ut = unitTypes[u.type];
      const cat = ut?.category ?? getCategoryForUnit(u.type, unitTypes);
      const name = ut?.name ?? capitalize(u.type);
      const expStars = u.exp > 0 ? "★".repeat(Math.min(3, u.exp)) : "—";
      const pct = start > 0 ? Math.round((u.count / start) * 100) : 0;

      html += `<tr style="border-bottom:1px solid rgba(0,0,0,0.03);">
        <td style="font-weight:500;">${name}</td>
        <td style="text-align:center;"><span style="font-size:0.75em; padding:1px 4px; border-radius:3px; background:#444; color:#fff;">${cat}</span></td>
        <td style="text-align:center; color:#f39c12;">${expStars}</td>
        <td style="text-align:right; opacity:0.85;">${start}</td>
        <td style="text-align:right; color:#e74c3c; font-weight:500;">${dead > 0 ? `-${dead}` : "0"}</td>
        <td style="text-align:right;">
          <span style="color:${u.count > 0 ? "#27ae60" : "#e74c3c"}; font-weight:bold;">${u.count}</span>
          <span style="font-size:0.8em; opacity:0.75;">(${pct}%)</span>
        </td>
      </tr>`;
    }

    html += `</tbody>
        <tfoot>
          <tr style="border-top:1px solid rgba(0,0,0,0.12); font-weight:600; opacity:0.9;">
            <td colspan="3">Total</td>
            <td style="text-align:right;">${entryStart}</td>
            <td style="text-align:right; color:#e74c3c;">${entryLoss > 0 ? `-${entryLoss}` : "0"}</td>
            <td style="text-align:right; color:${entryCurrent > 0 ? "#27ae60" : "#e74c3c"};">${entryCurrent}</td>
          </tr>
        </tfoot>
      </table></div>`;
  }

  container.innerHTML = html || "<div style='font-size:0.85em; opacity:0.6; padding:4px;'>No units</div>";
}

function renderHistory(): void {
  if (!activeBattle) return;
  const logContainer = ensureEl("battleHistoryLog");
  const b = activeBattle;

  if (b.session.history.length === 0) {
    logContainer.innerHTML = "<div style='opacity:0.6; font-style:italic;'>Round 0: Armies formed lines and evaluated terrain.</div>";
    return;
  }

  let html = "";
  for (const log of b.session.history) {
    html += `<div style="margin-bottom:2px;">
      <b>Round ${log.round}:</b> Attackers [${log.attackerOrder}] lost ${log.attackerLossMen} men; Defenders [${log.defenderOrder}] lost ${log.defenderLossMen} men.
    </div>`;
  }
  logContainer.innerHTML = html;
  logContainer.scrollTop = logContainer.scrollHeight;
}

function stepRound(): void {
  if (!activeBattle) return;
  const b = activeBattle;
  if (b.session.status !== "active") return;

  stepBattleRound(b.session, Math.random, {
    attacker: b.attackerOrder,
    defender: b.defenderOrder
  });

  disablePreBattleControls();
  syncSessionToEntries("attackers");
  syncSessionToEntries("defenders");

  updateOddsAndMorale();
  renderRosters();
  renderHistory();

  if (b.session.status !== "active") {
    handleBattleEnded();
  }
}

function autoResolve(): void {
  if (!activeBattle) return;
  const b = activeBattle;
  const config = currentContent().config;

  disablePreBattleControls();

  while (b.session.status === "active" && b.session.round < config.battle.maxRounds) {
    stepBattleRound(b.session, Math.random, {
      attacker: b.attackerOrder,
      defender: b.defenderOrder
    });
  }

  syncSessionToEntries("attackers");
  syncSessionToEntries("defenders");

  updateOddsAndMorale();
  renderRosters();
  renderHistory();
  handleBattleEnded();
}

function handleBattleEnded(): void {
  if (!activeBattle) return;
  const b = activeBattle;
  b.finalOutcome = finalizeBattle(b.session, Math.random);

  syncSessionToEntries("attackers");
  syncSessionToEntries("defenders");
  updateOddsAndMorale();
  renderRosters();

  // Disable round action buttons
  ensureEl<HTMLButtonElement>("battleStepRound").disabled = true;
  ensureEl<HTMLButtonElement>("battleAutoResolve").disabled = true;

  const banner = ensureEl("battleOutcomeBanner");
  banner.style.display = "block";

  if (b.finalOutcome.winner === "attacker") {
    banner.style.background = "rgba(46, 204, 113, 0.25)";
    banner.style.border = "1px solid #2ecc71";
    banner.style.color = "#27ae60";
    banner.innerHTML = `⚔️ Decisive Victory for the Attackers! ${b.session.withdrawnSide === "defender" ? "(Defenders Withdrew)" : "(Defenders Routed)"}`;
  } else {
    banner.style.background = "rgba(231, 76, 60, 0.25)";
    banner.style.border = "1px solid #e74c3c";
    banner.style.color = "#c0392b";
    banner.innerHTML = `🛡️ Stalwart Victory for the Defenders! ${b.session.withdrawnSide === "attacker" ? "(Attackers Withdrew)" : "(Attackers Routed)"}`;
  }
}

function pickAiOrders(): void {
  if (!activeBattle) return;
  const b = activeBattle;
  const lastLog = b.session.history.at(-1);

  b.attackerOrder = pickTacticalOrderForSide(
    b.attackers.flatMap(r => r.currentUnits),
    b.defenders.flatMap(r => r.currentUnits),
    b.unitTypes,
    lastLog?.attackerPowerFrac ?? 1
  );

  b.defenderOrder = pickTacticalOrderForSide(
    b.defenders.flatMap(r => r.currentUnits),
    b.attackers.flatMap(r => r.currentUnits),
    b.unitTypes,
    lastLog?.defenderPowerFrac ?? 1
  );

  ensureEl<HTMLSelectElement>("battleOrderAttackers").value = b.attackerOrder;
  ensureEl<HTMLSelectElement>("battleOrderDefenders").value = b.defenderOrder;
}

function pickTacticalOrderForSide(
  myUnits: { type: string; count: number }[],
  theirUnits: { type: string; count: number }[],
  unitTypes: Record<string, UnitType>,
  powerFrac: number
): BattleTacticalOrder {
  if (powerFrac < 0.25) return "withdraw";

  let totalMen = 0;
  const cats: Record<string, number> = { melee: 0, ranged: 0, cavalry: 0, artillery: 0 };
  for (const u of myUnits) {
    if (u.count <= 0) continue;
    const cat = unitTypes[u.type]?.category ?? getCategoryForUnit(u.type, unitTypes);
    cats[cat] = (cats[cat] || 0) + u.count;
    totalMen += u.count;
  }
  if (totalMen === 0) return "balanced";

  let theirTotal = 0;
  let theirCav = 0;
  for (const u of theirUnits) {
    if (u.count <= 0) continue;
    const cat = unitTypes[u.type]?.category ?? getCategoryForUnit(u.type, unitTypes);
    if (cat === "cavalry") theirCav += u.count;
    theirTotal += u.count;
  }
  const theirCavRatio = theirTotal > 0 ? theirCav / theirTotal : 0;

  const cavRatio = (cats.cavalry || 0) / totalMen;
  const rangedRatio = ((cats.ranged || 0) + (cats.artillery || 0)) / totalMen;
  const meleeRatio = (cats.melee || 0) / totalMen;

  if (theirCavRatio > 0.35 && meleeRatio > 0.3) return "brace";
  if (cavRatio > 0.35) return "charge";
  if (rangedRatio > 0.4) return "skirmish";
  if (meleeRatio > 0.5) return "press";
  return "balanced";
}

function applyResults(): void {
  if (!activeBattle) return;
  const b = activeBattle;
  if (!b.finalOutcome) {
    b.finalOutcome = finalizeBattle(b.session, Math.random);
    syncSessionToEntries("attackers");
    syncSessionToEntries("defenders");
  }

  const outcome = b.finalOutcome;
  const isAttackerWin = outcome.winner === "attacker";

  // Apply casualties to attacker regiments
  for (const entry of b.attackers) {
    applyEntryResults(entry, isAttackerWin, true, b);
  }

  // Apply casualties to defender regiments
  for (const entry of b.defenders) {
    applyEntryResults(entry, !isAttackerWin, false, b);
  }

  // Create Battlefield Marker on map
  const nextId = (last(pack.markers)?.i ?? -1) + 1;
  const marker: Marker = {
    i: nextId,
    x: b.x,
    y: b.y,
    cell: b.cell,
    icon: Icons.glyph("⚔️"),
    type: "battlefields",
    dy: 52,
    name: b.name
  };

  const year = options.map.lore.calendar.year;
  const era = options.map.lore.calendar.eraShort;
  const attackerLosses = outcome.summary.attacker.losses;
  const defenderLosses = outcome.summary.defender.losses;
  const attackerStateNames = [...new Set(b.attackers.map(r => r.state.name))].join(", ");
  const defenderStateNames = [...new Set(b.defenders.map(r => r.state.name))].join(", ");

  let narrative = `${b.name} (${year} ${era})<br>`;
  narrative += `Fought between forces of ${attackerStateNames} and ${defenderStateNames} across ${outcome.summary.rounds} rounds.<br>`;
  narrative += `<b>Result:</b> ${outcome.winner === "attacker" ? "Attacker Victory" : "Defender Victory"}.<br>`;
  narrative += `Casualties: Attackers lost ${attackerLosses} men; Defenders lost ${defenderLosses} men.`;

  if (b.session.history.length > 0) {
    narrative += `<br><br>Engagement Progression:<br>`;
    narrative += b.session.history
      .map(h => `Round ${h.round}: Attackers [${h.attackerOrder}] vs Defenders [${h.defenderOrder}] (-${h.attackerLossMen}/-${h.defenderLossMen})`)
      .join("<br>");
  }

  marker.note = narrative;
  pack.markers.push(marker);
  Layers.draw("markers");

  tip(`${b.name} concluded: ${outcome.winner === "attacker" ? "Attacker Victory" : "Defender Victory"}`, true, "success", 4000);
  refreshEditors();
  closeBattleScreen();
}

function applyEntryResults(entry: RegimentEntry, isWinner: boolean, isAttacker: boolean, b: ActiveBattle): void {
  const reg = entry.regiment;
  reg.units = entry.currentUnits.map(u => ({ ...u })).filter(u => u.count > 0);
  syncRegimentTotals(reg, b.unitTypes);

  // If wiped out, remove regiment
  if (reg.a <= 0) {
    Military.remove(reg.state, reg.i);
    document.getElementById(`regiment${reg.state}-${reg.i}`)?.remove();
    return;
  }

  // Update box text on map SVG
  const regEl = document.getElementById(`regiment${reg.state}-${reg.i}`);
  if (regEl) {
    const textEl = regEl.querySelector("text");
    if (textEl) textEl.textContent = String(Military.getTotal(reg));
  }
  select<SVGGElement, unknown>("#armies")
    .select(`g#regiment${reg.state}-${reg.i} > text`)
    .text(Military.getTotal(reg));

  // If attacker won, take defender's spot; otherwise return to original base
  if (isAttacker && isWinner) {
    reg.x = b.x;
    reg.y = b.y;
    moveRegiment(reg, b.x, b.y);
  } else {
    moveRegiment(reg, reg.px!, reg.py!);
  }

  const initialTotal = sum(entry.startingUnits.map(u => u.count));
  const lossTotal = initialTotal - reg.a;
  const year = options.map.lore.calendar.year;
  const era = options.map.lore.calendar.eraShort;
  const note = `<br><br>${b.name} (${year} ${era}): ${isWinner ? "Victory" : "Defeat"}. Regiment took ${lossTotal} casualties (${reg.a} surviving).`;
  reg.note = reg.note ? `${reg.note}${note}` : note;
}

function cancelResults(): void {
  if (!activeBattle) return;
  const b = activeBattle;

  // Restore regiment coordinates
  for (const entry of b.attackers) {
    moveRegiment(entry.regiment, entry.regiment.px!, entry.regiment.py!);
  }
  for (const entry of b.defenders) {
    moveRegiment(entry.regiment, entry.regiment.px!, entry.regiment.py!);
  }

  closeBattleScreen();
}

function closeBattleScreen(): void {
  $("#battleScreen").dialog("destroy");
  document.getElementById("battleScreen")?.remove();
  const selector = document.getElementById("regimentSelectorScreen");
  if (selector?.classList.contains("ui-dialog-content")) $("#regimentSelectorScreen").dialog("destroy");
  selector?.remove();

  customization = 0; // Exit edit mode
  if (activeBattle) {
    for (const entry of [...activeBattle.attackers, ...activeBattle.defenders]) {
      delete entry.regiment.px;
      delete entry.regiment.py;
    }
  }
  activeBattle = null;
}

function openRegimentSelector(): void {
  if (!activeBattle) return;
  const b = activeBattle;
  const body = ensureEl("regimentSelectorBody");
  const allRegiments = pack.states.filter(s => s.military && !s.removed).flatMap(s => s.military!);

  const distance = (r: Regiment): number =>
    Math.round(Math.hypot(b.y - r.y, b.x - r.x) * options.map.units.distance.scale);
  const isIncluded = (r: Regiment): boolean =>
    b.attackers.some(e => e.regiment.i === r.i && e.regiment.state === r.state) ||
    b.defenders.some(e => e.regiment.i === r.i && e.regiment.state === r.state);

  body.innerHTML = allRegiments
    .filter(r => !isIncluded(r))
    .map(r => {
      const s = pack.states[r.state];
      const dist = distance(r);
      return `<div class="states" data-state="${s.i}" data-id="${r.i}">
        <div>${escapeHtml(s.name)}</div>
        <div>${escapeHtml(r.name)}</div>
        <div>${r.a}</div>
        <div>${dist} ${options.map.units.distance.unit}</div>
        <div style="display:flex; gap:4px;">
          <button class="addRegBtn" data-side="attackers" data-state="${s.i}" data-id="${r.i}" style="padding:1px 6px; font-size:0.8em;">+ Atk</button>
          <button class="addRegBtn" data-side="defenders" data-state="${s.i}" data-id="${r.i}" style="padding:1px 6px; font-size:0.8em;">+ Def</button>
        </div>
      </div>`;
    })
    .join("");

  body.querySelectorAll<HTMLButtonElement>(".addRegBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const side = btn.dataset.side as "attackers" | "defenders";
      const sId = +btn.dataset.state!;
      const rId = +btn.dataset.id!;
      const reg = pack.states[sId]?.military?.find(r => r.i === rId);
      if (reg && activeBattle) {
        reg.px ??= reg.x;
        reg.py ??= reg.y;
        moveRegiment(reg, activeBattle.x, activeBattle.y);
        activeBattle[side].push(createRegimentEntry(reg, activeBattle.x, activeBattle.y, activeBattle.unitTypes));
        rebuildSession();
        $("#regimentSelectorScreen").dialog("close");
      }
    });
  });

  $("#regimentSelectorScreen").dialog({
    title: "Select Reinforcements",
    resizable: false,
    width: "fit-content",
    position: { my: "left center", at: "right+10 center", of: "#battleScreen" }
  });
}

function definePlace(cell: number): string {
  const cells = pack.cells;
  const burg = cells.burg[cell] ? pack.burgs[cells.burg[cell]].name : null;
  const river = !burg && cells.r[cell] ? `${pack.rivers.find(r => r.i === cells.r[cell])?.name || "River"}` : null;
  return burg || river || "Field";
}

function defineBattleName(place: string, isBurg: boolean): string {
  return isBurg ? `Siege of ${place}` : `Battle of ${place}`;
}

export const BattleScreen = { open };
