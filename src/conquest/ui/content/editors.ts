/**
 * editors.ts — the *state* editors (D2), reworked around what the dialogs are
 * actually for: the units, buildings and technology of individual active
 * states. The game's defaults live in the Config dialog (config.ts); what an
 * empire fields, builds and researches lives here.
 *
 * Each editor works on a *draft* of the content docs and only writes them back
 * when the whole thing validates — a rejected edit leaves the live ruleset and
 * the campaign in progress exactly as they were, with the errors on screen
 * instead of a broken game.
 *
 * Editing rules while a campaign runs means re-running its log (the rules are
 * part of the state hash), which is `editContent`'s job in `store/session.ts`.
 * If the log cannot replay under the edited rules the edit is refused — an edit
 * must never be able to invalidate a campaign.
 *
 * Per-state edits land as faction defs bound by `stateId` (the same shape the
 * Factions editor writes), merged so the three editors never trample each
 * other's fields.
 */
import { currentContent, rulesSummary } from "../../content/store";
import type { UnitType } from "../../engine/common/content";
import { inferRosterForCulture, type RawContentDocs } from "../../engine/common/content";
import type { CampaignConfig } from "../../engine/game/config";
import { currentSession, editConfig, editContent } from "../../store/session";
import { escapeHtml, type FmgState, fmg } from "../fmg";
import { clearErrors, type Field, openTwDialog, readFields, renderFields, showErrors } from "./dialog";
import { closeDialog, toasts } from "./shared";
import { openStateForcesDialog } from "./state-forces";

export { openStateForcesDialog };

/** A working copy. Nothing the dialog does touches the live ruleset until Apply. */
const draft = (): RawContentDocs => structuredClone(currentContent().docs);

const configDraft = (): CampaignConfig => structuredClone(currentContent().config);

// ---------------------------------------------------------------------------
// Shared chrome
// ---------------------------------------------------------------------------

/** The banner every editor opens with: what these rules are, and whether they are yours. */
function header(title: string): string {
  const state = currentContent();
  return `<div class="tw-editor-head">
      <h3>${escapeHtml(title)}</h3>
      <p class="tw-editor-sub">${escapeHtml(rulesSummary())}${state.edited ? " — travels with this map" : ""}</p>
    </div><div id="tw-errors" class="tw-errors"></div>`;
}

/**
 * Apply a draft and report what happened.
 *
 * The dialog stays open on failure — the user's edits are still on screen, and the
 * errors say which field to look at. On success it closes, because the campaign has
 * just been re-replayed and there is nothing left to fix.
 */
function applyDraft(docs: RawContentDocs, onDone?: (ok: boolean) => void): boolean {
  clearErrors(document.body);
  const result = editContent(docs);
  if (!result.ok) {
    const dialog = document.querySelector(".ui-dialog");
    showErrors((dialog as HTMLElement | null) ?? document.body, result.errors);
    onDone?.(false);
    return false;
  }
  closeDialog();
  return true;
}

// ---------------------------------------------------------------------------
// Per-state plumbing — one def per state, merged, never trampled
// ---------------------------------------------------------------------------

type StateDef = Record<string, unknown> & {
  bind?: { stateId?: number; stateName?: string; cultureName?: string; cultureId?: number; cultureRace?: string };
  rosterId?: string;
  player?: string;
  aiType?: "balanced" | "aggressive" | "defensive" | "economic";
  mechanics?: { corruption?: boolean; confederation?: "cultureGroup" | "never" };
  traits?: string[];
  roster?: { include?: string[]; exclude?: string[]; units?: Record<string, Partial<UnitType>> };
  buildings?: { include?: string[]; exclude?: string[] };
  tech?: { include?: string[]; exclude?: string[] };
};

/** The existing per-state defs, keyed by the state they bind. */
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

/**
 * Write one state's def back into the docs, preserving every field this
 * dialog does not own (the Factions editor's traits/mechanics, another
 * editor's availability lists).
 */
function upsertStateDef(docs: RawContentDocs, stateId: number, patch: Partial<StateDef>): void {
  // An all-undefined patch is a no-op — never materialize a def for it, or a
  // map with untouched states would grow sixteen empty defs.
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
    // Drop fields whose patch explicitly removed them (undefined values).
    for (const [key, value] of Object.entries(patch)) if (value === undefined) delete existing[key];
  } else {
    list.push({ bind: { stateId }, ...patch } as StateDef);
  }
  (file.doc as Record<string, unknown>).factions = list;
}

// ---------------------------------------------------------------------------
// State Forces (replaces individual Units & armies, Buildings, Technology dialogs)
// ---------------------------------------------------------------------------

export function openRosterEditor(): void {
  openStateForcesDialog();
}

export function openBuildingsEditor(): void {
  openStateForcesDialog();
}

export function openTechEditor(): void {
  openStateForcesDialog();
}

// ---------------------------------------------------------------------------
// Game config — flat numbers, no records
// ---------------------------------------------------------------------------

export function openGameConfig(): void {
  const config = configDraft();
  const at = (path: string): number => {
    let node: unknown = config;
    for (const key of path.split(".")) node = (node as Record<string, unknown>)?.[key];
    return Number(node ?? 0);
  };
  const set = (path: string, value: number): void => {
    const keys = path.split(".");
    let node = config as unknown as Record<string, unknown>;
    for (const key of keys.slice(0, -1)) node = node[key] as Record<string, unknown>;
    node[keys.at(-1)!] = value;
  };
  // Booleans share `at`/`set`'s path walk; they just read and write a different type.
  const atBool = (path: string): boolean => Boolean(atRaw(path));
  const setBool = (path: string, value: boolean): void => {
    const keys = path.split(".");
    let node = config as unknown as Record<string, unknown>;
    for (const key of keys.slice(0, -1)) node = node[key] as Record<string, unknown>;
    node[keys.at(-1)!] = value;
  };
  function atRaw(path: string): unknown {
    let node: unknown = config;
    for (const key of path.split(".")) node = (node as Record<string, unknown>)?.[key];
    return node;
  }

  const groups: { title: string; fields: Field[] }[] = [
    {
      title: "Turns",
      fields: [
        numberField("start year", "turn.startYear", at, set, 0, 1),
        numberField("seasons per year", "turn.seasonsPerYear", at, set, 1, 4),
        numberField("victory region fraction", "victory.regionFraction", at, set, 0.05, 1, 0.05)
      ]
    },
    {
      title: "Movement",
      fields: [
        numberField("cost divisor", "movement.costDivisor", at, set, 1, 100),
        numberField("base points", "movement.basePoints", at, set, 1, 500),
        numberField("road multiplier", "movement.roadMultiplier", at, set, 0.1, 2, 0.05),
        numberField("trail multiplier", "movement.trailMultiplier", at, set, 0.1, 2, 0.05),
        numberField("winter movement", "seasons.winterMovementMult", at, set, 0.1, 2, 0.05)
      ]
    },
    {
      title: "Battle",
      fields: [
        numberField("max rounds", "battle.maxRounds", at, set, 1, 20),
        numberField("rout threshold", "battle.routThreshold", at, set, 0.05, 0.9, 0.05),
        numberField("attrition scale", "battle.attritionScale", at, set, 0, 1, 0.05),
        numberField("wall bonus / tier", "battle.wallBonusPerTier", at, set, 0, 1, 0.05),
        numberField("ambush bonus", "battle.ambushBonus", at, set, 0, 1, 0.05)
      ]
    },
    {
      title: "Economy",
      fields: [
        numberField("tax per 1000 pop", "economy.taxPer1000Pop", at, set, 0, 20, 0.1),
        checkboxField(
          "tax form from map",
          "economy.taxFromMap",
          atBool,
          setBool,
          "Use each state's Azgaar salesTax/pollTax instead of one flat rate. Republics tax commerce least, theocracies most; poll tax also drags public order."
        ),
        numberField(
          "poll tax order drag",
          "economy.pollTaxOrderDrag",
          at,
          set,
          0,
          100,
          1,
          "Order points per turn of poll tax, per owned region."
        ),
        numberField(
          "garrison per region",
          "economy.garrisonUpkeepPerRegion",
          at,
          set,
          0,
          2000,
          10,
          "Gold per owned region per turn, on top of army upkeep — the price of holding land. 0 disables. Stops a large realm from free-riding on tax income alone."
        ),
        numberField("corruption per step", "economy.corruptionPerStep", at, set, 0, 0.5, 0.01),
        checkboxField(
          "specialties from map",
          "economy.specialtiesFromMap",
          atBool,
          setBool,
          "Bonus income for regions producing goods the map says they can (wood, ore, horses…). Makes terrain matter."
        ),
        numberField(
          "income per specialty",
          "economy.specialtyIncomePerGood",
          at,
          set,
          0,
          0.5,
          0.01,
          "Measured on the sample world: counts run 3…16 (median 7), so 0.02 keeps every region under the cap."
        ),
        numberField(
          "specialty cap",
          "economy.specialtyCap",
          at,
          set,
          0,
          1,
          0.05,
          "Ceiling on the specialty bonus. Keep it above (median specialties × income per specialty) or the clamp, not the map, decides."
        ),
        numberField("corruption cap", "economy.corruptionCap", at, set, 0, 1, 0.05),
        numberField("starting order", "economy.startOrder", at, set, 0, 200),
        numberField("occupied order", "economy.occupiedOrder", at, set, 0, 200)
      ]
    },
    {
      title: "Military",
      fields: [
        numberField("max units per army", "military.maxUnitsPerArmy", at, set, 1, 100),
        numberField("replenish fraction", "military.replenishFraction", at, set, 0, 1, 0.05),
        numberField("encamp replenish bonus", "military.encampReplenishBonus", at, set, 0, 10),
        numberField("brigand units", "rebellion.brigandUnits", at, set, 0, 20)
      ]
    }
  ];

  const body = (): string =>
    `${header("Game config")}${groups
      .map(group => `<h4 class="tw-editor-group">${escapeHtml(group.title)}</h4>${renderFields(group.fields)}`)
      .join("")}`;

  const dialog = openTwDialog("Rules · Game config", body(), {
    width: 560,
    applyLabel: "Apply config",
    onApply: () => {
      const errors: string[] = [];
      for (const group of groups) {
        const root = dialog.querySelectorAll(".tw-fields")[groups.indexOf(group)];
        const read = readFields(root as HTMLElement, group.fields);
        errors.push(...read.errors);
      }
      if (errors.length) return showErrors(dialog, errors);
      const result = editConfig(config);
      if (!result.ok) {
        showErrors(dialog, result.errors);
        return;
      }
      toasts("Config applied — the campaign's log was re-replayed.");
      closeDialog();
    }
  });
}

function numberField(
  label: string,
  path: string,
  at: (path: string) => number,
  set: (path: string, value: number) => void,
  min?: number,
  max?: number,
  step?: number,
  tip?: string
): Field {
  return {
    kind: "number",
    label,
    ...(tip !== undefined ? { tip } : {}),
    ...(min !== undefined ? { min } : {}),
    ...(max !== undefined ? { max } : {}),
    ...(step !== undefined ? { step } : {}),
    read: () => at(path),
    write: value => set(path, value)
  };
}

/** A boolean config key — same path walk as `numberField`, different value type. */
function checkboxField(
  label: string,
  path: string,
  at: (path: string) => boolean,
  set: (path: string, value: boolean) => void,
  tip?: string
): Field {
  return {
    kind: "checkbox",
    label,
    ...(tip !== undefined ? { tip } : {}),
    read: () => at(path),
    write: value => set(path, value)
  };
}

// ---------------------------------------------------------------------------
// Factions — mechanics and traits for the active states
// ---------------------------------------------------------------------------

export const STANDARD_ENGINE_TRAITS = [
  "aggressiveDiplomacy",
  "chaotic",
  "colonialAmbition",
  "corruption",
  "defensiveDoctrine",
  "imperialBureaucracy",
  "islandTraders",
  "lawful",
  "legionTraditions",
  "merchantRepublic",
  "mountainHolds",
  "raiderCulture",
  "riverRiders",
  "seafarers",
  "steppeHordes",
  "vassalDuty",
  "warmongers",
  "zealous",
  "zealots"
] as const;

interface FactionEditorRow {
  id: number;
  name: string;
  color: string;
  cultureName: string;
  rosterId: string;
  player: string;
  confederation: "cultureGroup" | "never";
  traits: string[];
}

export function getActiveStates(): { id: number; name: string; color: string; cultureName: string }[] {
  const session = currentSession();
  if (session?.store?.pack?.factions && session.store.pack.factions.length > 0) {
    const pack = session.store.pack;
    return pack.factions.map(f => {
      const cultureObj = pack.cultures.find(c => c.i === f.culture);
      return {
        id: f.id,
        name: f.name,
        color: f.color || "#888888",
        cultureName: cultureObj?.name ?? (f.culture > 0 ? `Culture ${f.culture}` : "None")
      };
    });
  }

  // Fallback to FMG globals if session is not active yet
  const f = fmg();
  const rawStates = (f?.pack?.states ?? []).filter(
    (s): s is FmgState & { i: number; name: string } => Boolean(s) && typeof s === "object" && s.i > 0 && !s.removed
  );
  const rawCultures = ((f?.pack?.cultures ?? []) as { i: number; name: string }[]).filter(Boolean);
  return rawStates.map(s => {
    const cultureId = (s as unknown as { culture?: number }).culture ?? 0;
    const cultureObj = rawCultures.find(c => c && c.i === cultureId);
    return {
      id: s.i,
      name: s.name,
      color: s.color || "#888888",
      cultureName: cultureObj?.name ?? (cultureId > 0 ? `Culture ${cultureId}` : "None")
    };
  });
}

function renderTraitsTags(stateId: number, traits: string[]): string {
  const tagsHtml = traits
    .map(
      t =>
        `<span class="tw-tag tw-tag--removable">${escapeHtml(t)}<button type="button" class="tw-tag-remove" data-state-id="${stateId}" data-trait="${escapeHtml(t)}" title="Remove trait">&times;</button></span>`
    )
    .join(" ");

  const available = STANDARD_ENGINE_TRAITS.filter(t => !traits.includes(t));
  const optionsHtml = available.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");

  return `<div class="tw-traits-cell">
    <div class="tw-traits-list">${tagsHtml || `<span class="tw-traits-none">No traits</span>`}</div>
    <div class="tw-trait-picker">
      <select class="tw-select tw-select--sm tw-trait-select" data-state-id="${stateId}">
        <option value="">+ Add trait...</option>
        ${optionsHtml}
      </select>
      <button type="button" class="tw-btn tw-btn--sm tw-add-trait-btn" data-state-id="${stateId}">Add</button>
    </div>
  </div>`;
}

export function openFactionEditor(): void {
  const docs = draft();
  const states = getActiveStates();

  if (states.length === 0) {
    openTwDialog(
      "Rules · Factions",
      `${header("Factions")}<p class="tw-empty-note">No active states found on this map. Generate or load a map with states first.</p>`,
      {
        width: 500
      }
    );
    return;
  }

  const rosterList: { id: string; name: string }[] = docs.rosterDocs
    .map(file => {
      const doc = (file.doc ?? {}) as Record<string, unknown>;
      const roster = (doc.roster ?? {}) as Record<string, unknown>;
      const id = (doc.id as string) || (roster.id as string) || "";
      const name = (doc.name as string) || (roster.name as string) || id || "Unnamed Roster";
      return { id, name };
    })
    .filter(r => r.id.length > 0);

  if (rosterList.length === 0) {
    rosterList.push({ id: docs.meta.defaultRoster || "default", name: "Default" });
  }

  const rostersMap: Record<string, unknown> = {};
  for (const r of rosterList) rostersMap[r.id] = true;

  const existingDefs = stateDefsOf(docs);
  const rows: FactionEditorRow[] = states.map((s, index) => {
    const existing = existingDefs.get(s.id);
    const mechanics = (existing?.mechanics ?? {}) as { corruption?: boolean; confederation?: "cultureGroup" | "never" };

    const inferredRoster = inferRosterForCulture(
      s.cultureName,
      rostersMap,
      docs.meta.defaultRoster || rosterList[0]!.id
    );
    const rosterId =
      existing?.rosterId && rosterList.some(r => r.id === existing.rosterId) ? existing.rosterId : inferredRoster;

    let playerVal: string;
    if (existing?.player) {
      playerVal = existing.player;
    } else if (existing?.aiType) {
      playerVal = `ai-${existing.aiType}`;
    } else {
      const anyPlayer = [...existingDefs.values()].some(d => d.player === "player");
      if (!anyPlayer && index === 0) {
        playerVal = "player";
      } else {
        playerVal = "ai-balanced";
      }
    }

    const traits = [...((existing?.traits as string[]) ?? [])];
    if (mechanics.corruption !== false && !traits.includes("corruption")) {
      traits.push("corruption");
    }

    return {
      id: s.id,
      name: s.name,
      color: s.color,
      cultureName: s.cultureName,
      rosterId,
      player: playerVal,
      confederation: mechanics.confederation ?? "cultureGroup",
      traits
    };
  });

  const tableRowsHtml = rows
    .map(
      row => `
      <tr data-state-id="${row.id}">
        <td>
          <div class="tw-faction-col">
            <span class="tw-faction-swatch" style="background-color: ${escapeHtml(row.color)}"></span>
            <span class="tw-faction-name">${escapeHtml(row.name)}</span>
            <span class="tw-state-id">#${row.id}</span>
          </div>
        </td>
        <td>
          <span class="tw-culture-label">${escapeHtml(row.cultureName)}</span>
        </td>
        <td>
          <select class="tw-select tw-select--sm tw-roster-select" data-state-id="${row.id}">
            ${rosterList
              .map(
                r =>
                  `<option value="${escapeHtml(r.id)}" ${row.rosterId === r.id ? "selected" : ""}>${escapeHtml(r.name)}</option>`
              )
              .join("")}
          </select>
        </td>
        <td>
          <select class="tw-select tw-select--sm tw-player-select" data-state-id="${row.id}">
            <option value="player" ${row.player === "player" ? "selected" : ""}>Player</option>
            <option value="ai-balanced" ${row.player === "ai-balanced" ? "selected" : ""}>AI: Balanced</option>
            <option value="ai-aggressive" ${row.player === "ai-aggressive" ? "selected" : ""}>AI: Aggressive</option>
            <option value="ai-defensive" ${row.player === "ai-defensive" ? "selected" : ""}>AI: Defensive</option>
            <option value="ai-economic" ${row.player === "ai-economic" ? "selected" : ""}>AI: Economic</option>
          </select>
        </td>
        <td>
          <select class="tw-select tw-select--sm tw-confed-select" data-state-id="${row.id}">
            <option value="cultureGroup" ${row.confederation === "cultureGroup" ? "selected" : ""}>cultureGroup</option>
            <option value="never" ${row.confederation === "never" ? "selected" : ""}>never</option>
          </select>
        </td>
        <td id="tw-traits-container-${row.id}">
          ${renderTraitsTags(row.id, row.traits)}
        </td>
      </tr>`
    )
    .join("");

  const bodyHtml = `
    ${header("Factions")}
    <div class="tw-factions-wrap">
      <table class="tw-factions-table">
        <thead>
          <tr>
            <th style="min-width: 170px;">State</th>
            <th style="min-width: 120px;">Culture</th>
            <th style="min-width: 140px;">Faction</th>
            <th style="min-width: 140px;">Player</th>
            <th style="min-width: 130px;">Confederation</th>
            <th style="min-width: 220px;">Traits</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    </div>`;

  const dialog = openTwDialog("Rules · Factions", bodyHtml, {
    width: 960,
    applyLabel: "Apply rules",
    onApply: () => {
      for (const r of rows) {
        const hasCorruption = r.traits.includes("corruption");
        upsertStateDef(docs, r.id, {
          rosterId: r.rosterId,
          player: r.player,
          mechanics: { corruption: hasCorruption, confederation: r.confederation },
          traits: [...r.traits]
        });
      }
      applyDraft(docs, ok => {
        if (ok) toasts("Faction rules applied — the campaign's log was re-replayed.");
      });
    }
  });

  const tableWrap = dialog.querySelector(".tw-factions-wrap");
  if (tableWrap) {
    tableWrap.addEventListener("click", e => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const removeBtn = target.closest<HTMLButtonElement>(".tw-tag-remove");
      if (removeBtn) {
        const stateId = Number(removeBtn.dataset.stateId);
        const trait = removeBtn.dataset.trait;
        const row = rows.find(r => r.id === stateId);
        if (row && trait) {
          row.traits = row.traits.filter(t => t !== trait);
          const container = dialog.querySelector(`#tw-traits-container-${stateId}`);
          if (container) container.innerHTML = renderTraitsTags(stateId, row.traits);
        }
        return;
      }

      const addBtn = target.closest<HTMLButtonElement>(".tw-add-trait-btn");
      if (addBtn) {
        const stateId = Number(addBtn.dataset.stateId);
        const select = dialog.querySelector<HTMLSelectElement>(`.tw-trait-select[data-state-id="${stateId}"]`);
        const trait = select?.value;
        const row = rows.find(r => r.id === stateId);
        if (row && trait && !row.traits.includes(trait)) {
          row.traits.push(trait);
          const container = dialog.querySelector(`#tw-traits-container-${stateId}`);
          if (container) container.innerHTML = renderTraitsTags(stateId, row.traits);
        }
        return;
      }
    });

    tableWrap.addEventListener("change", e => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (target.classList.contains("tw-roster-select")) {
        const select = target as HTMLSelectElement;
        const stateId = Number(select.dataset.stateId);
        const row = rows.find(r => r.id === stateId);
        if (row) row.rosterId = select.value;
      } else if (target.classList.contains("tw-player-select")) {
        const select = target as HTMLSelectElement;
        const stateId = Number(select.dataset.stateId);
        const row = rows.find(r => r.id === stateId);
        if (row) row.player = select.value;
      } else if (target.classList.contains("tw-confed-select")) {
        const select = target as HTMLSelectElement;
        const stateId = Number(select.dataset.stateId);
        const row = rows.find(r => r.id === stateId);
        if (row) row.confederation = select.value as "cultureGroup" | "never";
      }
    });
  }
}
