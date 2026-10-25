/**
 * state-forces.ts — State Forces dialog.
 * Collapses Units & armies, Buildings, and Technology into one dialog.
 *
 * Left-hand directory:
 *   - Armies tab: States -> Armies underneath them
 *   - Buildings tab: States -> State Regions -> Capital and Settlements
 *   - Tech tab: States
 *
 * "The state is bound to use the faction roster for all of its forces of all types - no deviation"
 */
import { currentContent, rulesSummary } from "../../content/store";
import {
  type BuildingDef,
  inferRosterForCulture,
  type RawContentDocs,
  type ResolvedRoster,
  type TechDef,
  type UnitType
} from "../../engine/common/content";
import { maxMinorSettlementsForCells } from "../../engine/compiler/index";
import { regimentToUnits } from "../../engine/game/units";
import { currentSession, editContent, flushMirror } from "../../store/session";
import { escapeHtml, type FmgBurg, fmg } from "../fmg";
import { clearErrors, openTwDialog, showErrors } from "./dialog";
import { getActiveStates } from "./editors";
import { closeDialog, toasts } from "./shared";

export type StateForcesTab = "armies" | "buildings" | "tech";

interface WorkingUnit {
  type: string;
  count: number;
  exp: number;
}

interface WorkingArmy {
  id: string;
  stateId: number;
  name: string;
  cell: number;
  fleet: boolean;
  stance: string;
  units: WorkingUnit[];
}

interface WorkingSettlement {
  id: number;
  regionId: number;
  stateId: number;
  name: string;
  capital: boolean;
  port: boolean;
  walls: number;
  population: number;
}

interface WorkingRegion {
  id: number;
  stateId: number;
  name: string;
  order: number;
  buildings: string[];
  settlements: number[];
}

interface BoundRoster {
  id: string;
  name: string;
  units: Record<string, UnitType>;
  recruitable: string[];
  buildings: BuildingDef[];
  tech: TechDef[];
  rosterDraft: ResolvedRoster;
}

const draft = (): RawContentDocs => structuredClone(currentContent().docs);

type StateDef = Record<string, unknown> & {
  bind?: { stateId?: number };
  rosterId?: string;
  player?: string;
  aiType?: "balanced" | "aggressive" | "defensive" | "economic";
  mechanics?: { corruption?: boolean; confederation?: "cultureGroup" | "never" };
  traits?: string[];
  roster?: { include?: string[]; exclude?: string[]; units?: Record<string, Partial<UnitType>> };
  buildings?: { include?: string[]; exclude?: string[] };
  tech?: { include?: string[]; exclude?: string[] };
};

function stateDefsOf(docs: RawContentDocs): Map<number, StateDef> {
  const out = new Map<number, StateDef>();
  for (const { doc } of docs.factionDocs) {
    const root = (doc ?? {}) as Record<string, unknown>;
    const list: Record<string, unknown>[] = Array.isArray(root.factions)
      ? (root.factions as Record<string, unknown>[])
      : root.faction && typeof root.faction === "object"
        ? [root.faction as Record<string, unknown>]
        : [];
    for (const item of list) {
      const def = item as StateDef;
      const id = def.bind?.stateId;
      if (typeof id === "number" && id > 0) out.set(id, def);
    }
  }
  return out;
}

function upsertStateDef(docs: RawContentDocs, stateId: number, patch: Partial<StateDef>): void {
  const defined = Object.values(patch).some(value => value !== undefined);
  if (!defined) return;
  let file = docs.factionDocs.find(entry => {
    const root = (entry.doc ?? {}) as Record<string, unknown>;
    return Array.isArray(root.factions);
  });
  if (!file) {
    file = { file: "states.json", doc: { factions: [] } };
    docs.factionDocs.push(file);
  }
  const list = ((file.doc as Record<string, unknown>).factions ?? []) as StateDef[];
  const existing = list.find(def => def.bind?.stateId === stateId);
  if (existing) {
    Object.assign(existing, patch);
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete existing[key];
    }
  } else {
    list.push({ bind: { stateId }, ...patch } as StateDef);
  }
  (file.doc as Record<string, unknown>).factions = list;
}

function getBoundRoster(
  state: { id: number; cultureName: string; rosterId?: string },
  docs: RawContentDocs
): BoundRoster {
  const content = currentContent().content;
  const existingDefs = stateDefsOf(docs);
  const def = existingDefs.get(state.id);

  const rostersMap: Record<string, unknown> = {};
  for (const file of docs.rosterDocs) {
    const d = (file.doc ?? {}) as Record<string, unknown>;
    const r = (d.roster ?? {}) as Record<string, unknown>;
    const rId = (d.id as string) || (r.id as string) || "";
    if (rId) rostersMap[rId] = true;
  }

  const inferredId = inferRosterForCulture(
    state.cultureName,
    rostersMap,
    docs.meta.defaultRoster || Object.keys(content.rosters)[0] || "default"
  );
  const rosterId =
    (def?.rosterId && rostersMap[def.rosterId] ? def.rosterId : undefined) ??
    (state.rosterId && rostersMap[state.rosterId] ? state.rosterId : undefined) ??
    inferredId;

  const rosterObj =
    content.rosters[rosterId] ?? content.rosters[docs.meta.defaultRoster] ?? Object.values(content.rosters)[0]!;
  const rFile = docs.rosterDocs.find(f => {
    const d = (f.doc ?? {}) as Record<string, unknown>;
    const r = (d.roster ?? {}) as Record<string, unknown>;
    return d.id === rosterId || r.id === rosterId;
  });
  const rDoc = (rFile?.doc ?? {}) as Record<string, unknown>;
  const rName = (rDoc.name as string) || (rosterObj.name as string) || rosterId;

  // The state is bound to use the faction roster for all of its forces of all types - no deviation
  const availableBuildings = content.buildings.filter(b => !b.group || b.group === rosterId);
  const availableTech = content.tech.filter(t => !t.group || t.group === rosterId);

  return {
    id: rosterId,
    name: rName,
    units: rosterObj.units,
    recruitable: rosterObj.recruitable,
    buildings: availableBuildings,
    tech: availableTech,
    rosterDraft: rosterObj
  };
}

export function openStateForcesDialog(): void {
  const docs = draft();
  const session = currentSession();
  const campaign = session?.store?.state;
  const pack = session?.store?.pack;
  const states = getActiveStates();

  if (states.length === 0) {
    openTwDialog(
      "State Forces",
      `<div class="tw-editor-head"><h3>State Forces</h3></div><p class="tw-empty-note">No active states found on this map. Generate or load a map with states first.</p>`,
      { width: 500 }
    );
    return;
  }

  let tab: StateForcesTab = "armies";
  let activeStateId: number = states[0]!.id;
  let activeArmyId: string | null = null;
  let activeRegionId: number | null = null;
  let activeSettlementId: number | null = null;

  const expanded: Record<string, boolean> = {};
  for (const s of states) {
    expanded[`state-${s.id}`] = true;
  }

  // Working data collections
  const workingArmies = new Map<string, WorkingArmy>();
  const workingRegions = new Map<number, WorkingRegion>();
  const workingSettlements = new Map<number, WorkingSettlement>();
  const workingTech = new Map<number, Set<string>>();

  // 1. Armies initialization
  if (campaign?.armies && Object.keys(campaign.armies).length > 0) {
    for (const [id, a] of Object.entries(campaign.armies)) {
      workingArmies.set(id, {
        id,
        stateId: a.factionId,
        name: a.name || `Army ${id}`,
        cell: a.cell,
        fleet: a.fleet,
        stance: a.stance,
        units: a.units.map(u => ({ type: u.type, count: u.count, exp: u.exp ?? 0 }))
      });
    }
  } else if (pack?.armies && pack.armies.length > 0) {
    const unitTypes = currentContent().content.unitTypes;
    for (const reg of pack.armies) {
      const stateObj = states.find(s => s.id === reg.factionId) ?? states[0]!;
      const bound = getBoundRoster(stateObj, docs);
      const converted = regimentToUnits(bound.rosterDraft, unitTypes, reg.units, reg.strength, reg.fleet, 20);
      workingArmies.set(reg.id, {
        id: reg.id,
        stateId: reg.factionId,
        name: reg.name || `Army ${reg.id}`,
        cell: reg.cell,
        fleet: reg.fleet,
        stance: "normal",
        units: converted.units.map(u => ({ type: u.type, count: u.count, exp: u.exp ?? 0 }))
      });
    }
  } else {
    const f = fmg();
    for (const s of f?.pack?.states ?? []) {
      if (!s || s.removed) continue;
      const stateObj = states.find(st => st.id === s.i);
      if (!stateObj) continue;
      const bound = getBoundRoster(stateObj, docs);
      const unitTypes = currentContent().content.unitTypes;
      for (const reg of s.military ?? []) {
        const armyId = `fm-${s.i}-${reg.i}`;
        const strength = reg.a || reg.t || 0;
        let units: WorkingUnit[];
        if (reg.units && reg.units.length > 0) {
          units = reg.units.map(u => ({ type: u.type, count: u.count, exp: u.exp ?? 0 }));
        } else {
          const converted = regimentToUnits(bound.rosterDraft, unitTypes, reg.u ?? {}, strength, !!reg.n, 20);
          units = converted.units.map(u => ({ type: u.type, count: u.count, exp: u.exp ?? 0 }));
        }
        workingArmies.set(armyId, {
          id: armyId,
          stateId: s.i,
          name: reg.name || `${s.name || "State"} regiment ${reg.i}`,
          cell: reg.cell,
          fleet: !!reg.n,
          stance: "normal",
          units
        });
      }
    }
  }

  // 2. Regions & Settlements initialization
  if (pack?.regions && pack.regions.length > 0) {
    for (const r of pack.regions) {
      const owner = campaign?.regions[String(r.id)]?.owner ?? r.factionId;
      const buildings = campaign?.regions[String(r.id)]?.buildings ?? [];
      const order = campaign?.regions[String(r.id)]?.order ?? 80;
      workingRegions.set(r.id, {
        id: r.id,
        stateId: owner,
        name: r.name,
        order,
        buildings: [...buildings],
        settlements: [...(r.settlements ?? [])]
      });
    }
    for (const s of pack.settlements ?? []) {
      const reg = workingRegions.get(s.regionId);
      workingSettlements.set(s.id, {
        id: s.id,
        regionId: s.regionId,
        stateId: reg?.stateId ?? 0,
        name: s.name,
        capital: s.capital,
        port: s.port,
        walls: s.walls ?? 0,
        population: s.population ?? 0
      });
    }
  } else {
    const f = fmg();
    const rawProvinces = (f?.pack?.provinces ?? []).filter((p: any) => Boolean(p) && typeof p === "object" && p.i > 0);
    const rawBurgs = (f?.pack?.burgs ?? []).filter(
      (b: any): b is FmgBurg => Boolean(b) && typeof b === "object" && b.i > 0 && !b.removed
    );
    for (const p of rawProvinces) {
      workingRegions.set(p.i, {
        id: p.i,
        stateId: p.state ?? 0,
        name: p.fullName || p.name || `Province ${p.i}`,
        order: 80,
        buildings: [],
        settlements: []
      });
    }

    const cellCounts = new Map<number, number>();
    const provinceArray = f?.pack?.cells?.province;
    if (provinceArray) {
      for (let c = 0; c < provinceArray.length; c++) {
        const prov = provinceArray[c];
        if (prov) cellCounts.set(prov, (cellCounts.get(prov) ?? 0) + 1);
      }
    }

    const burgsByProvince = new Map<number, FmgBurg[]>();
    for (const b of rawBurgs) {
      const provId = provinceArray?.[b.cell] ?? 0;
      if (!provId) continue;
      let list = burgsByProvince.get(provId);
      if (!list) {
        list = [];
        burgsByProvince.set(provId, list);
      }
      list.push(b);
    }

    const rankBurg = (a: FmgBurg, b: FmgBurg): number =>
      (b.population ?? 0) - (a.population ?? 0) ||
      (b.walls ?? 0) + ((b as any).citadel ?? 0) - ((a.walls ?? 0) + ((a as any).citadel ?? 0)) ||
      (b.port ?? 0) - (a.port ?? 0) ||
      a.i - b.i;

    for (const p of rawProvinces) {
      const reg = workingRegions.get(p.i);
      if (!reg) continue;
      const burgs = (burgsByProvince.get(p.i) ?? []).slice().sort(rankBurg);
      if (burgs.length === 0) continue;

      const capitalBurg =
        burgs.find(b => b.i === p.burg) ??
        burgs.find(b => Boolean(b.capital)) ??
        (p.burg && p.burg > 0 ? burgs[0] : null);

      const cellCount = cellCounts.get(p.i) ?? 0;
      const maxMinors = maxMinorSettlementsForCells(cellCount);
      const minors = burgs.filter(b => b !== capitalBurg).slice(0, maxMinors);
      const selected = capitalBurg ? [capitalBurg, ...minors] : minors;

      for (const b of selected) {
        reg.settlements.push(b.i);
        workingSettlements.set(b.i, {
          id: b.i,
          regionId: p.i,
          stateId: b.state ?? 0,
          name: b.name || `Burg ${b.i}`,
          capital: b === capitalBurg,
          port: Boolean(b.port),
          walls: typeof (b as any).walls === "number" ? (b as any).walls : 0,
          population: typeof b.population === "number" ? b.population : 0
        });
      }
    }
  }

  // 3. Tech initialization
  for (const s of states) {
    if (campaign?.factions[String(s.id)]?.tech) {
      workingTech.set(s.id, new Set(campaign.factions[String(s.id)].tech));
    } else {
      workingTech.set(s.id, new Set<string>());
    }
  }

  // Set initial selections
  const firstArmies = [...workingArmies.values()].filter(a => a.stateId === activeStateId);
  if (firstArmies.length > 0) activeArmyId = firstArmies[0]!.id;

  const firstRegions = [...workingRegions.values()].filter(r => r.stateId === activeStateId);
  if (firstRegions.length > 0) {
    activeRegionId = firstRegions[0]!.id;
    expanded[`reg-${activeRegionId}`] = true;
    const firstSetts = firstRegions[0]!.settlements
      .map(id => workingSettlements.get(id))
      .filter((s): s is WorkingSettlement => Boolean(s));
    if (firstSetts.length > 0) activeSettlementId = firstSetts[0]!.id;
  }

  const dialog = openTwDialog("State Forces", body(), {
    width: 980,
    applyLabel: "Apply State Forces",
    onApply: () => {
      saveActiveForm();

      // 1. If campaign is active, update in-memory campaign state
      if (campaign) {
        // Sync armies
        for (const [id, a] of workingArmies) {
          campaign.armies[id] = {
            id,
            factionId: a.stateId,
            name: a.name,
            cell: a.cell,
            fleet: a.fleet,
            stance: a.stance as any,
            movementLeft: campaign.armies[id]?.movementLeft ?? 0,
            units: a.units.map(u => ({ type: u.type, count: u.count, exp: u.exp }))
          };
        }
        for (const existingId of Object.keys(campaign.armies)) {
          if (!workingArmies.has(existingId)) delete campaign.armies[existingId];
        }

        // Sync regions
        for (const [rId, r] of workingRegions) {
          if (campaign.regions[String(rId)]) {
            campaign.regions[String(rId)]!.buildings = [...r.buildings];
            campaign.regions[String(rId)]!.order = r.order;
          }
        }

        // Sync tech
        for (const [sId, techs] of workingTech) {
          if (campaign.factions[String(sId)]) {
            campaign.factions[String(sId)]!.tech = [...techs];
          }
        }
      }

      // 2. Sync settlement stats into pack or FMG burgs
      if (pack?.settlements) {
        for (const ps of pack.settlements) {
          const ws = workingSettlements.get(ps.id);
          if (ws) {
            ps.walls = ws.walls;
            ps.population = ws.population;
          }
        }
      }
      const f = fmg();
      if (f?.pack?.burgs) {
        for (const b of f.pack.burgs) {
          if (b?.i) {
            const ws = workingSettlements.get(b.i);
            if (ws) {
              (b as any).walls = ws.walls;
              b.population = ws.population;
            }
          }
        }
      }

      // 3. Bound roster enforcement:
      // "The state is bound to use the faction roster for all of its forces of all types - no deviation"
      for (const s of states) {
        const bound = getBoundRoster(s, docs);
        upsertStateDef(docs, s.id, {
          rosterId: bound.id,
          roster: undefined,
          buildings: undefined,
          tech: undefined
        });
        if (fmg()?.pack?.states?.[s.id]) {
          fmg()!.pack!.states![s.id]!.rosterId = bound.id;
        }
      }

      clearErrors(document.body);
      const res = editContent(docs);
      if (!res.ok) {
        showErrors(dialog, res.errors);
        return;
      }
      flushMirror();
      closeDialog();
      toasts("State forces applied — rules and campaign updated.");
    }
  });

  wire();

  function rerender(): void {
    const msg = document.getElementById("alertMessage");
    if (msg) msg.innerHTML = body();
  }

  function saveActiveForm(): void {
    const dialogEl = document.querySelector(".tw-dialog");
    if (!dialogEl) return;

    if (tab === "armies" && activeArmyId) {
      const army = workingArmies.get(activeArmyId);
      if (army) {
        const nameInput = dialogEl.querySelector<HTMLInputElement>("#tw-army-name-input");
        if (nameInput) army.name = nameInput.value.trim() || army.name;
        const stanceSelect = dialogEl.querySelector<HTMLSelectElement>("#tw-army-stance-select");
        if (stanceSelect) army.stance = stanceSelect.value;

        dialogEl.querySelectorAll<HTMLInputElement>("[data-tw-unit-count]").forEach(input => {
          const idx = Number(input.dataset.twUnitCount);
          const count = Number(input.value);
          if (army.units[idx] && Number.isFinite(count) && count > 0) {
            army.units[idx]!.count = count;
          }
        });

        dialogEl.querySelectorAll<HTMLInputElement>("[data-tw-unit-exp]").forEach(input => {
          const idx = Number(input.dataset.twUnitExp);
          const exp = Number(input.value);
          if (army.units[idx] && Number.isFinite(exp)) {
            army.units[idx]!.exp = Math.max(0, Math.min(9, exp));
          }
        });
      }
    } else if (tab === "buildings" && activeSettlementId) {
      const sett = workingSettlements.get(activeSettlementId);
      if (sett) {
        const wallsSelect = dialogEl.querySelector<HTMLSelectElement>("#tw-sett-walls-select");
        if (wallsSelect) sett.walls = Number(wallsSelect.value);
        const popInput = dialogEl.querySelector<HTMLInputElement>("#tw-sett-pop-input");
        if (popInput) sett.population = Math.max(0, Number(popInput.value));
      }
      if (activeRegionId) {
        const reg = workingRegions.get(activeRegionId);
        const orderInput = dialogEl.querySelector<HTMLInputElement>("#tw-reg-order-input");
        if (reg && orderInput) reg.order = Math.max(0, Math.min(100, Number(orderInput.value)));
      }
    }
  }

  function body(): string {
    return `<div class="tw-state-forces">
      <div class="tw-editor-head">
        <h3>State Forces</h3>
        <p class="tw-editor-sub">${escapeHtml(rulesSummary())} — armies, settlements & technology of individual states</p>
      </div>
      <nav class="tw-tabs">
        <button type="button" class="tw-tab${tab === "armies" ? " is-active" : ""}" data-tw-tab="armies">Armies</button>
        <button type="button" class="tw-tab${tab === "buildings" ? " is-active" : ""}" data-tw-tab="buildings">Buildings</button>
        <button type="button" class="tw-tab${tab === "tech" ? " is-active" : ""}" data-tw-tab="tech">Technology</button>
      </nav>
      <div id="tw-errors" class="tw-errors"></div>
      <div class="tw-state-forces-layout">
        <aside class="tw-state-forces-tree">
          ${renderDirectory()}
        </aside>
        <main class="tw-state-forces-content">
          ${renderMainContent()}
        </main>
      </div>
    </div>`;
  }

  function renderDirectory(): string {
    if (tab === "armies") return renderArmiesTree();
    if (tab === "buildings") return renderBuildingsTree();
    return renderTechTree();
  }

  function renderArmiesTree(): string {
    return states
      .map(s => {
        const isStateActive = s.id === activeStateId;
        const isExp = expanded[`state-${s.id}`] ?? true;
        const armies = [...workingArmies.values()].filter(a => a.stateId === s.id);

        let childrenHtml = "";
        if (isExp) {
          if (armies.length === 0) {
            childrenHtml = `<div class="tw-tree-empty">No armies</div>`;
          } else {
            childrenHtml = armies
              .map(a => {
                const isArmyActive = isStateActive && a.id === activeArmyId;
                const totalMen = a.units.reduce((acc, u) => acc + (u.count || 0), 0);
                return `<button type="button" class="tw-tree-item${isArmyActive ? " is-active" : ""}" data-tw-pick-army="${escapeHtml(a.id)}" data-tw-state-id="${s.id}">
                  <span class="tw-tree-item-icon">${a.fleet ? "⚓" : "⚔"}</span>
                  <span class="tw-tree-item-name">${escapeHtml(a.name)}</span>
                  <span class="tw-badge">${totalMen}m</span>
                </button>`;
              })
              .join("");
          }
          childrenHtml += `<div style="padding: 4px 6px;">
            <button type="button" class="tw-btn tw-btn--sm tw-btn--block" data-tw-add-army-for="${s.id}">+ Add army</button>
          </div>`;
        }

        return `<div class="tw-tree-group">
          <div class="tw-tree-head${isStateActive ? " is-active" : ""}" data-tw-pick-state="${s.id}">
            <button type="button" class="tw-tree-toggle" data-tw-toggle="state-${s.id}">
              ${isExp ? "▼" : "▶"}
            </button>
            <span class="tw-faction-swatch" style="background-color: ${escapeHtml(s.color)}"></span>
            <span class="tw-tree-name">${escapeHtml(s.name)}</span>
            <span class="tw-badge">${armies.length}</span>
          </div>
          ${isExp ? `<div class="tw-tree-children">${childrenHtml}</div>` : ""}
        </div>`;
      })
      .join("");
  }

  function renderBuildingsTree(): string {
    return states
      .map(s => {
        const isStateActive = s.id === activeStateId;
        const isExp = expanded[`state-${s.id}`] ?? true;
        const regions = [...workingRegions.values()].filter(r => r.stateId === s.id);

        let regionsHtml = "";
        if (isExp) {
          if (regions.length === 0) {
            regionsHtml = `<div class="tw-tree-empty">No regions</div>`;
          } else {
            regionsHtml = regions
              .map(r => {
                const isRegExp = expanded[`reg-${r.id}`] ?? true;
                const isRegActive = isStateActive && r.id === activeRegionId;
                const setts = r.settlements
                  .map(id => workingSettlements.get(id))
                  .filter((sett): sett is WorkingSettlement => Boolean(sett));

                let settsHtml = "";
                if (isRegExp) {
                  if (setts.length === 0) {
                    settsHtml = `<div class="tw-tree-empty" style="padding-left: 18px;">No settlements</div>`;
                  } else {
                    settsHtml = setts
                      .map(sett => {
                        const isSettActive = isRegActive && sett.id === activeSettlementId;
                        const icon = sett.capital ? "👑" : sett.port ? "⚓" : "🏰";
                        return `<button type="button" class="tw-tree-item tw-tree-item--indent${isSettActive ? " is-active" : ""}" data-tw-pick-settlement="${sett.id}" data-tw-reg-id="${r.id}" data-tw-state-id="${s.id}">
                          <span class="tw-tree-item-icon">${icon}</span>
                          <span class="tw-tree-item-name">${escapeHtml(sett.name)}</span>
                          ${sett.capital ? `<span class="tw-badge" style="background: #e2d194; color: #423005;">Cap</span>` : ""}
                        </button>`;
                      })
                      .join("");
                  }
                }

                return `<div class="tw-tree-subgroup">
                  <div class="tw-tree-subhead${isRegActive ? " is-active" : ""}" data-tw-pick-region="${r.id}" data-tw-state-id="${s.id}">
                    <button type="button" class="tw-tree-toggle" data-tw-toggle="reg-${r.id}">
                      ${isRegExp ? "▼" : "▶"}
                    </button>
                    <span class="tw-tree-name">🗺 ${escapeHtml(r.name)}</span>
                  </div>
                  ${isRegExp ? `<div class="tw-tree-children">${settsHtml}</div>` : ""}
                </div>`;
              })
              .join("");
          }
        }

        return `<div class="tw-tree-group">
          <div class="tw-tree-head${isStateActive ? " is-active" : ""}" data-tw-pick-state="${s.id}">
            <button type="button" class="tw-tree-toggle" data-tw-toggle="state-${s.id}">
              ${isExp ? "▼" : "▶"}
            </button>
            <span class="tw-faction-swatch" style="background-color: ${escapeHtml(s.color)}"></span>
            <span class="tw-tree-name">${escapeHtml(s.name)}</span>
          </div>
          ${isExp ? `<div class="tw-tree-children">${regionsHtml}</div>` : ""}
        </div>`;
      })
      .join("");
  }

  function renderTechTree(): string {
    return states
      .map(s => {
        const isStateActive = s.id === activeStateId;
        const bound = getBoundRoster(s, docs);
        const techs = bound.tech;
        const researched = workingTech.get(s.id)?.size ?? 0;

        return `<div class="tw-tree-group">
          <div class="tw-tree-head${isStateActive ? " is-active" : ""}" data-tw-pick-state="${s.id}">
            <span class="tw-faction-swatch" style="background-color: ${escapeHtml(s.color)}"></span>
            <span class="tw-tree-name">${escapeHtml(s.name)}</span>
            <span class="tw-badge">${researched}/${techs.length}</span>
          </div>
        </div>`;
      })
      .join("");
  }

  function renderMainContent(): string {
    const curState = states.find(s => s.id === activeStateId) ?? states[0]!;
    const bound = getBoundRoster(curState, docs);

    if (tab === "armies") {
      const army = activeArmyId ? workingArmies.get(activeArmyId) : null;
      if (!army) {
        return `<div class="tw-empty-note" style="padding-top: 40px;">
          Select an army from the directory on the left, or click <strong>+ Add army</strong> under ${escapeHtml(curState.name)}.
        </div>`;
      }

      const totalMen = army.units.reduce((acc, u) => acc + (u.count || 0), 0);
      const recruitableUnitIds = bound.recruitable.length > 0 ? bound.recruitable : Object.keys(bound.units);

      const unitRowsHtml = army.units
        .map((u, idx) => {
          const uDef = bound.units[u.type];
          const name = uDef?.name ?? u.type;
          const maxMen = uDef?.men ?? 120;
          const category = uDef?.category ?? "infantry";

          return `<tr>
            <td style="font-weight: 600;">${escapeHtml(category)}</td>
            <td>
              <span style="font-weight: 600; color: #000;">${escapeHtml(name)}</span>
              <span class="tw-state-id" style="margin-left: 4px;">#${escapeHtml(u.type)}</span>
            </td>
            <td>
              <input type="number" class="tw-input tw-input--number" value="${u.count}" min="1" max="${maxMen * 2}" data-tw-unit-count="${idx}" />
              <span style="font-size: 0.85em; color: #555;"> / ${maxMen}</span>
            </td>
            <td>
              <input type="number" class="tw-input tw-input--number" value="${u.exp}" min="0" max="9" data-tw-unit-exp="${idx}" />
            </td>
            <td style="text-align: right;">
              <button type="button" class="tw-btn tw-btn--sm tw-btn--danger" data-tw-del-unit="${idx}" title="Remove unit">&times;</button>
            </td>
          </tr>`;
        })
        .join("");

      return `<div>
        <div class="tw-roster-head-form">
          <label class="tw-field" style="max-width: 260px;">
            <span>Army Name</span>
            <input class="tw-input" id="tw-army-name-input" value="${escapeHtml(army.name)}" />
          </label>
          <label class="tw-field" style="max-width: 140px;">
            <span>Stance</span>
            <select class="tw-select" id="tw-army-stance-select">
              <option value="normal"${army.stance === "normal" ? " selected" : ""}>Normal</option>
              <option value="march"${army.stance === "march" ? " selected" : ""}>March</option>
              <option value="encamp"${army.stance === "encamp" ? " selected" : ""}>Encamp</option>
              <option value="ambush"${army.stance === "ambush" ? " selected" : ""}>Ambush</option>
              <option value="raid"${army.stance === "raid" ? " selected" : ""}>Raid</option>
            </select>
          </label>
          <div style="margin-left: auto; display: flex; gap: 8px; align-items: flex-end;">
            <span class="tw-badge" style="padding: 6px 10px; font-size: 12px;">Total: ${totalMen} troops (${army.units.length} regiments)</span>
            <button type="button" class="tw-btn tw-btn--sm tw-btn--danger" data-tw-del-army="${army.id}">Delete Army</button>
          </div>
        </div>

        <div style="font-size: 12px; color: #444; margin-bottom: 10px;">
          <strong>State:</strong> ${escapeHtml(curState.name)} · <strong>Faction Force:</strong> ${escapeHtml(bound.name)} · <strong>Cell:</strong> #${army.cell} ${army.fleet ? "· <strong>[Fleet]</strong>" : ""}
        </div>

        <h4 class="tw-editor-group">Regiments & Units (${army.units.length})</h4>
        <div class="tw-units-wrap">
          <table class="tw-units">
            <thead>
              <tr>
                <th style="width: 100px;">Category</th>
                <th>Unit</th>
                <th style="width: 130px;">Troops</th>
                <th style="width: 90px;">Veterancy</th>
                <th style="width: 60px; text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${unitRowsHtml || `<tr><td colspan="5" class="tw-empty-note">No units in this army. Recruit units below.</td></tr>`}
            </tbody>
          </table>
        </div>

        <div style="margin-top: 14px; padding: 12px; border: 1px solid #ccc; border-radius: 4px; background: #fafafa; display: flex; gap: 10px; align-items: flex-end;">
          <label class="tw-field" style="flex: 1;">
            <span>Recruit Unit (Bound Roster: ${escapeHtml(bound.name)})</span>
            <select class="tw-select" id="tw-add-unit-type">
              ${recruitableUnitIds
                .map(uid => {
                  const u = bound.units[uid];
                  return `<option value="${escapeHtml(uid)}">${escapeHtml(u?.name ?? uid)} (${u?.category ?? "infantry"} · ${u?.men ?? 120} men)</option>`;
                })
                .join("")}
            </select>
          </label>
          <label class="tw-field" style="width: 110px;">
            <span>Troops</span>
            <input type="number" class="tw-input tw-input--number" id="tw-add-unit-men" value="120" min="1" />
          </label>
          <button type="button" class="tw-btn" id="tw-add-unit-btn">+ Add Unit</button>
        </div>
      </div>`;
    }

    if (tab === "buildings") {
      const sett = activeSettlementId ? workingSettlements.get(activeSettlementId) : null;
      const reg = activeRegionId ? workingRegions.get(activeRegionId) : null;

      if (!sett || !reg) {
        return `<div class="tw-empty-note" style="padding-top: 40px;">
          Select a settlement from the directory on the left to view and edit its buildings and stats.
        </div>`;
      }

      const builtHtml = reg.buildings
        .map((bId, idx) => {
          const bDef = bound.buildings.find(b => b.id === bId);
          const name = bDef?.name ?? bId;
          const chain = bDef?.chain ?? "general";
          const tier = bDef?.tier ?? 1;
          const cost = bDef?.cost ?? 0;

          return `<tr>
            <td style="font-weight: 600; color: #000;">${escapeHtml(name)}</td>
            <td>${escapeHtml(chain)} (Tier ${tier})</td>
            <td>${cost} gold</td>
            <td style="text-align: right;">
              <button type="button" class="tw-btn tw-btn--sm tw-btn--danger" data-tw-del-building="${idx}" title="Remove building">&times;</button>
            </td>
          </tr>`;
        })
        .join("");

      return `<div>
        <div class="tw-roster-head-form" style="align-items: center;">
          <h3 style="margin: 0; font-size: 16px;">
            ${sett.capital ? "👑 " : sett.port ? "⚓ " : "🏰 "} ${escapeHtml(sett.name)}
          </h3>
          <div style="margin-left: auto; display: flex; gap: 6px;">
            ${sett.capital ? `<span class="tw-badge" style="background: #e2d194; color: #423005; font-size: 12px; padding: 4px 8px;">Capital</span>` : ""}
            ${sett.port ? `<span class="tw-badge" style="background: #bde0fe; color: #003049; font-size: 12px; padding: 4px 8px;">Port</span>` : ""}
            <span class="tw-badge" style="font-size: 12px; padding: 4px 8px;">Region: ${escapeHtml(reg.name)}</span>
            <span class="tw-badge" style="font-size: 12px; padding: 4px 8px;">State: ${escapeHtml(curState.name)}</span>
          </div>
        </div>

        <h4 class="tw-editor-group">Settlement & Region Stats</h4>
        <div class="tw-settlement-stats">
          <label class="tw-field">
            <span>Fortifications / Walls</span>
            <select class="tw-select" id="tw-sett-walls-select">
              <option value="0"${sett.walls === 0 ? " selected" : ""}>None (Tier 0)</option>
              <option value="1"${sett.walls === 1 ? " selected" : ""}>Walls (Tier 1)</option>
              <option value="2"${sett.walls === 2 ? " selected" : ""}>Citadel (Tier 2)</option>
            </select>
          </label>
          <label class="tw-field">
            <span>Population (thousands)</span>
            <input type="number" class="tw-input tw-input--number" id="tw-sett-pop-input" value="${sett.population}" step="0.5" min="0" />
          </label>
          <label class="tw-field">
            <span>Public Order</span>
            <input type="number" class="tw-input tw-input--number" id="tw-reg-order-input" value="${reg.order}" min="0" max="100" />
          </label>
        </div>

        <h4 class="tw-editor-group">Constructed Buildings (${reg.buildings.length})</h4>
        <div class="tw-units-wrap">
          <table class="tw-units">
            <thead>
              <tr>
                <th>Building</th>
                <th style="width: 140px;">Chain & Tier</th>
                <th style="width: 100px;">Base Cost</th>
                <th style="width: 60px; text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${builtHtml || `<tr><td colspan="4" class="tw-empty-note">No buildings constructed in this settlement/region. Construct buildings below.</td></tr>`}
            </tbody>
          </table>
        </div>

        <div style="margin-top: 14px; padding: 12px; border: 1px solid #ccc; border-radius: 4px; background: #fafafa; display: flex; gap: 10px; align-items: flex-end;">
          <label class="tw-field" style="flex: 1;">
            <span>Construct Building (Bound Roster: ${escapeHtml(bound.name)})</span>
            <select class="tw-select" id="tw-add-building-id">
              ${bound.buildings.map(b => `<option value="${escapeHtml(b.id)}">${escapeHtml(b.name)} — ${b.chain} Tier ${b.tier} (${b.cost}g)</option>`).join("")}
            </select>
          </label>
          <button type="button" class="tw-btn" id="tw-add-building-btn">+ Construct Building</button>
        </div>
      </div>`;
    }

    // Technology Tab
    const researchedSet = workingTech.get(curState.id) ?? new Set<string>();
    const techList = bound.tech;

    const techItemsHtml = techList
      .map(t => {
        const isChecked = researchedSet.has(t.id);
        const effectsParts: string[] = [];
        if (t.effects.incomePct) effectsParts.push(`+${t.effects.incomePct}% income`);
        if (t.effects.upkeepReduction) effectsParts.push(`-${Math.round(t.effects.upkeepReduction * 100)}% upkeep`);
        if (t.effects.unlock?.length) effectsParts.push(`Unlocks: ${t.effects.unlock.join(", ")}`);
        const effString = effectsParts.length > 0 ? effectsParts.join(" · ") : "Standard advances";

        return `<label class="tw-tech-item${isChecked ? " is-checked" : ""}">
          <input type="checkbox" class="native" data-tw-tech-id="${escapeHtml(t.id)}" ${isChecked ? "checked" : ""} />
          <span class="tw-tech-name">${escapeHtml(t.name)}</span>
          <span class="tw-tech-era">Era ${t.era ?? 1} · ${t.cost}g</span>
          <span class="tw-tech-effects">${escapeHtml(effString)}</span>
        </label>`;
      })
      .join("");

    return `<div>
      <div class="tw-roster-head-form" style="align-items: center;">
        <h3 style="margin: 0; font-size: 16px;">
          Technology · ${escapeHtml(curState.name)}
        </h3>
        <div style="margin-left: auto; display: flex; gap: 8px;">
          <button type="button" class="tw-btn tw-btn--sm" id="tw-tech-select-all">Select All</button>
          <button type="button" class="tw-btn tw-btn--sm" id="tw-tech-clear-all">Clear All</button>
        </div>
      </div>

      <div style="font-size: 12px; color: #444; margin-bottom: 8px;">
        <strong>Bound Faction Force:</strong> ${escapeHtml(bound.name)} · <strong>Researched:</strong> ${researchedSet.size} of ${techList.length} technologies
      </div>

      <p class="tw-hint" style="margin-bottom: 8px;">
        Multi-select the technologies researched by ${escapeHtml(curState.name)}. The state is bound to its faction force roster (${escapeHtml(bound.name)}).
      </p>

      <div class="tw-tech-list">
        ${techItemsHtml || `<div class="tw-empty-note">No technologies defined for this faction force.</div>`}
      </div>
    </div>`;
  }

  function wire(): void {
    const dialogEl = document.querySelector(".tw-dialog");
    if (!dialogEl) return;

    dialogEl.addEventListener("click", e => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // 1. Tab switching
      const tabBtn = target.closest<HTMLButtonElement>("[data-tw-tab]");
      if (tabBtn) {
        saveActiveForm();
        tab = tabBtn.dataset.twTab as StateForcesTab;
        rerender();
        return;
      }

      // 2. Tree toggles
      const toggleBtn = target.closest<HTMLButtonElement>("[data-tw-toggle]");
      if (toggleBtn) {
        const key = toggleBtn.dataset.twToggle!;
        expanded[key] = !expanded[key];
        rerender();
        return;
      }

      // 3. State picking
      const stateHead = target.closest<HTMLElement>("[data-tw-pick-state]");
      if (stateHead && !target.closest("[data-tw-toggle]")) {
        saveActiveForm();
        const sId = Number(stateHead.dataset.twPickState);
        activeStateId = sId;
        const armies = [...workingArmies.values()].filter(a => a.stateId === sId);
        activeArmyId = armies[0]?.id ?? null;
        const regs = [...workingRegions.values()].filter(r => r.stateId === sId);
        activeRegionId = regs[0]?.id ?? null;
        if (regs[0]) {
          expanded[`reg-${regs[0].id}`] = true;
          activeSettlementId = regs[0].settlements[0] ?? null;
        }
        rerender();
        return;
      }

      // 4. Army picking
      const armyBtn = target.closest<HTMLButtonElement>("[data-tw-pick-army]");
      if (armyBtn) {
        saveActiveForm();
        activeArmyId = armyBtn.dataset.twPickArmy!;
        activeStateId = Number(armyBtn.dataset.twStateId);
        rerender();
        return;
      }

      // 5. Region picking
      const regHead = target.closest<HTMLElement>("[data-tw-pick-region]");
      if (regHead && !target.closest("[data-tw-toggle]")) {
        saveActiveForm();
        activeRegionId = Number(regHead.dataset.twPickRegion);
        activeStateId = Number(regHead.dataset.twStateId);
        const reg = workingRegions.get(activeRegionId);
        if (reg?.settlements[0]) activeSettlementId = reg.settlements[0];
        rerender();
        return;
      }

      // 6. Settlement picking
      const settBtn = target.closest<HTMLButtonElement>("[data-tw-pick-settlement]");
      if (settBtn) {
        saveActiveForm();
        activeSettlementId = Number(settBtn.dataset.twPickSettlement);
        activeRegionId = Number(settBtn.dataset.twRegId);
        activeStateId = Number(settBtn.dataset.twStateId);
        rerender();
        return;
      }

      // 7. Add Army
      const addArmyBtn = target.closest<HTMLButtonElement>("[data-tw-add-army-for]");
      if (addArmyBtn) {
        saveActiveForm();
        const sId = Number(addArmyBtn.dataset.twAddArmyFor);
        const stateObj = states.find(s => s.id === sId) ?? states[0]!;
        const bound = getBoundRoster(stateObj, docs);
        const newId = `army-${Date.now()}`;
        const defaultUnitId = bound.recruitable[0] || Object.keys(bound.units)[0] || "infantry";
        const defUnit = bound.units[defaultUnitId];
        const initialCount = defUnit?.men ?? 120;

        const armiesForState = [...workingArmies.values()].filter(a => a.stateId === sId);
        const capitalSett = [...workingSettlements.values()].find(s => s.stateId === sId && s.capital);

        workingArmies.set(newId, {
          id: newId,
          stateId: sId,
          name: `${stateObj.name} Army ${armiesForState.length + 1}`,
          cell: capitalSett ? ((capitalSett as any).cell ?? 100) : 100,
          fleet: false,
          stance: "normal",
          units: [{ type: defaultUnitId, count: initialCount, exp: 0 }]
        });
        activeStateId = sId;
        activeArmyId = newId;
        expanded[`state-${sId}`] = true;
        rerender();
        return;
      }

      // 8. Delete Army
      const delArmyBtn = target.closest<HTMLButtonElement>("[data-tw-del-army]");
      if (delArmyBtn) {
        const aId = delArmyBtn.dataset.twDelArmy!;
        workingArmies.delete(aId);
        const remain = [...workingArmies.values()].filter(a => a.stateId === activeStateId);
        activeArmyId = remain[0]?.id ?? null;
        rerender();
        return;
      }

      // 9. Remove Unit from Army
      const delUnitBtn = target.closest<HTMLButtonElement>("[data-tw-del-unit]");
      if (delUnitBtn && activeArmyId) {
        const idx = Number(delUnitBtn.dataset.twDelUnit);
        const army = workingArmies.get(activeArmyId);
        if (army?.units[idx]) {
          army.units.splice(idx, 1);
          rerender();
        }
        return;
      }

      // 10. Add Unit to Army
      if (target.id === "tw-add-unit-btn" && activeArmyId) {
        const army = workingArmies.get(activeArmyId);
        const typeSelect = dialogEl.querySelector<HTMLSelectElement>("#tw-add-unit-type");
        const menInput = dialogEl.querySelector<HTMLInputElement>("#tw-add-unit-men");
        if (army && typeSelect && menInput) {
          const uType = typeSelect.value;
          const count = Math.max(1, Number(menInput.value) || 100);
          army.units.push({ type: uType, count, exp: 0 });
          rerender();
        }
        return;
      }

      // 11. Remove Building from Settlement/Region
      const delBldBtn = target.closest<HTMLButtonElement>("[data-tw-del-building]");
      if (delBldBtn && activeRegionId) {
        const idx = Number(delBldBtn.dataset.twDelBuilding);
        const reg = workingRegions.get(activeRegionId);
        if (reg?.buildings[idx]) {
          reg.buildings.splice(idx, 1);
          rerender();
        }
        return;
      }

      // 12. Add Building to Settlement/Region
      if (target.id === "tw-add-building-btn" && activeRegionId) {
        const reg = workingRegions.get(activeRegionId);
        const bSelect = dialogEl.querySelector<HTMLSelectElement>("#tw-add-building-id");
        if (reg && bSelect?.value) {
          reg.buildings.push(bSelect.value);
          rerender();
        }
        return;
      }

      // 13. Tech Select All
      if (target.id === "tw-tech-select-all") {
        const curState = states.find(s => s.id === activeStateId) ?? states[0]!;
        const bound = getBoundRoster(curState, docs);
        const set = workingTech.get(curState.id) ?? new Set<string>();
        for (const t of bound.tech) set.add(t.id);
        workingTech.set(curState.id, set);
        rerender();
        return;
      }

      // 14. Tech Clear All
      if (target.id === "tw-tech-clear-all") {
        const curState = states.find(s => s.id === activeStateId) ?? states[0]!;
        workingTech.set(curState.id, new Set<string>());
        rerender();
        return;
      }
    });

    dialogEl.addEventListener("change", e => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Tech checkbox toggle
      if (target.hasAttribute("data-tw-tech-id")) {
        const input = target as HTMLInputElement;
        const techId = input.dataset.twTechId!;
        const set = workingTech.get(activeStateId) ?? new Set<string>();
        if (input.checked) set.add(techId);
        else set.delete(techId);
        workingTech.set(activeStateId, set);
        input.closest(".tw-tech-item")?.classList.toggle("is-checked", input.checked);
      }
    });
  }
}
