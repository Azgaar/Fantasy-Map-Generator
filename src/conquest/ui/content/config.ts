/**
 * config.ts — the Config dialog: the game's defaults, under one roof.
 *
 * Units, buildings and technology are config, organised by roster.
 * The dialog presents three tabs: Armies, Buildings, and Tech.
 * Across all tabs, the left side displays a collapsible tree directory
 * of rosters (listed by Name). At the bottom of the tree, an "Add new roster"
 * button initializes a new roster with id `roster-${Date.now()}` and copies
 * all defaults (roster units, buildings, tech).
 *
 * Persisted in IndexedDB (store/config-store.ts) and applied to the live ruleset.
 */
import { applyLibrary, currentContent, rulesSummary } from "../../content/store";
import { type LibraryDocs, saveConfigLibrary } from "../../store/config-store";
import { resetRules } from "../../store/session";
import { escapeHtml } from "../fmg";
import { clearErrors, type Field, openTwDialog, readFields, renderFields, showErrors } from "./dialog";
import { closeDialog, toasts } from "./shared";

type ConfigTab = "armies" | "buildings" | "tech";

// ---------------------------------------------------------------------------
// Roster-doc machinery — the doc shape of a roster's units
// ---------------------------------------------------------------------------

interface UnitDraft {
  id: string;
  name: string;
  category: string;
  /** AER blocks at full strength — `men` is derived as blocks × MEN_PER_BLOCK. */
  blocks: number;
  attack: number;
  defense: number;
  charge: number;
  missile: number;
  cost: number;
  upkeep: number;
}

/** One roster as it appears in a doc, before validation. */
interface RosterDraft {
  id: string;
  name?: string;
  extends?: string;
  units: Record<string, UnitDraft>;
  recruitable?: string[];
  garrison: { melee: string; ranged: string };
  regimentMap: { infantry: string; archers: string; cavalry: string; artillery: string };
  caps?: Record<string, number>;
}

/** The docs shape: one file per roster, each `{ id, name, roster: {...}, tech, buildings }`. */
interface RosterFile {
  file: string;
  doc: { id?: string; name?: string; roster: RosterDraft; tech?: EntryDraft[]; buildings?: EntryDraft[] };
}

const rosterDocsOf = (docs: { rosterDocs: { file: string; doc: unknown }[] }): RosterFile[] =>
  docs.rosterDocs as unknown as RosterFile[];

function rosterNameOf(file: { doc: unknown }): string {
  const doc = file.doc as Record<string, unknown>;
  const roster = doc.roster as Record<string, unknown> | undefined;
  return (
    (doc.name as string) || (roster?.name as string) || (doc.id as string) || (roster?.id as string) || "Unnamed Roster"
  );
}

function rosterIdOf(file: { doc: unknown }): string {
  const doc = file.doc as Record<string, unknown>;
  const roster = doc.roster as Record<string, unknown> | undefined;
  return (doc.id as string) || (roster?.id as string) || "";
}

const CATEGORIES = ["melee", "ranged", "cavalry", "artillery"];
const UNIT_NUMBERS: (keyof UnitDraft)[] = ["blocks", "attack", "defense", "charge", "missile", "cost", "upkeep"];

function rosterFields(r: RosterDraft, unitIds: string[]): Field[] {
  return [
    {
      kind: "tags",
      label: "Recruitable units",
      tip: "What a commander of this group may raise",
      candidates: () => unitIds.map(id => ({ value: id, label: r.units[id]?.name ?? id })),
      read: () => r.recruitable ?? [],
      write: values => (r.recruitable = values)
    },
    {
      kind: "select",
      label: "Garrison · melee",
      read: () => r.garrison?.melee ?? "",
      options: () => unitIds.map(id => ({ value: id, label: id })),
      write: v => (r.garrison = { ...r.garrison, melee: v })
    },
    {
      kind: "select",
      label: "Garrison · ranged",
      read: () => r.garrison?.ranged ?? "",
      options: () => unitIds.map(id => ({ value: id, label: id })),
      write: v => (r.garrison = { ...r.garrison, ranged: v })
    },
    ...(["infantry", "archers", "cavalry", "artillery"] as const).map(category => ({
      kind: "select" as const,
      label: `Azgaar ${category} maps to`,
      tip: "Azgaar stores armies as infantry/archers/cavalry/artillery counts; this says which unit that is",
      read: () => r.regimentMap?.[category] ?? "",
      options: () => unitIds.map(id => ({ value: id, label: id })),
      write: (v: string) => (r.regimentMap = { ...r.regimentMap, [category]: v })
    }))
  ];
}

function unitsTable(units: Record<string, UnitDraft>, activeUnit?: string): string {
  const rows = Object.entries(units)
    .map(
      ([id, unit]) => `<tr${activeUnit === id ? ' class="is-patched"' : ""}>
        <td class="tw-unit-id">${escapeHtml(id)}</td>
        <td><input class="tw-input" data-tw-unit="${id}|name" value="${escapeHtml(unit.name ?? id)}" /></td>
        <td><select class="tw-select" data-tw-unit="${id}|category">${CATEGORIES.map(
          category => `<option value="${category}"${unit.category === category ? " selected" : ""}>${category}</option>`
        ).join("")}</select></td>
        ${UNIT_NUMBERS.filter(key => key !== "name")
          .map(
            key =>
              `<td><input class="tw-input tw-input--number" type="number" step="any" data-tw-unit="${id}|${key}" value="${unit[key] ?? 0}" /></td>`
          )
          .join("")}
      </tr>`
    )
    .join("");
  return `<table class="tw-units">
      <thead><tr><th>id</th><th>name</th><th>category</th>${UNIT_NUMBERS.filter(key => key !== "name")
        .map(key => `<th>${key}</th>`)
        .join("")}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/** Read the units table back into the draft. Returns per-cell problems. */
function readUnitsTable(dialog: HTMLElement, units: Record<string, UnitDraft>): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  dialog.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-tw-unit]").forEach(input => {
    const [id, key] = (input.dataset.twUnit ?? "").split("|");
    const unit = units[id ?? ""] as unknown as Record<string, unknown> | undefined;
    if (!unit || !key) return;
    if (key === "name" || key === "category") unit[key] = input.value;
    else {
      const value = Number(input.value);
      if (!Number.isFinite(value)) errors.push(`unit '${id}': ${key} must be a number`);
      else if (value < 0) errors.push(`unit '${id}': ${key} must not be negative`);
      else unit[key] = value;
    }
  });
  return { ok: errors.length === 0, errors };
}

const TABS: { id: ConfigTab; label: string }[] = [
  { id: "armies", label: "Armies" },
  { id: "buildings", label: "Buildings" },
  { id: "tech", label: "Tech" }
];

type EntryKind = "building" | "tech";
interface EntryDraft {
  id: string;
  name?: string;
  group?: string;
  [key: string]: unknown;
}

/**
 * The draft: the config-authored doc lists, normalized to roster-based docs,
 * plus pure-UI selection state that never reaches storage.
 */
interface ConfigDraft {
  lib: LibraryDocs;
  tab: ConfigTab;
  group: string;
  expanded: Record<string, boolean>;
  entry: Record<EntryKind, string>;
  activeUnit?: string;
  newEntry: Record<"unit" | EntryKind, string>;
}

// ---------------------------------------------------------------------------
// Draft accessors — read through flatteners so the dialog stays crash-safe.
// ---------------------------------------------------------------------------

function flat(files: { file: string; doc: unknown }[], section: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const file of files) {
    const list = (file.doc as Record<string, unknown> | null)?.[section];
    if (Array.isArray(list)) out.push(...(list as Record<string, unknown>[]));
    else if (list && typeof list === "object") out.push(list as Record<string, unknown>);
  }
  return out;
}

const groupsOf = (draft: ConfigDraft): RosterDraft[] =>
  draft.lib.rosterDocs.map(file => (file.doc as { roster: RosterDraft }).roster);

const groupOf = (draft: ConfigDraft, id: string): RosterDraft | undefined => groupsOf(draft).find(r => r.id === id);

const groupFileOf = (draft: ConfigDraft, id: string): RosterFile | undefined =>
  rosterDocsOf(draft.lib).find(file => rosterIdOf(file) === id);

/** The common group: the shipped default roster, the base every group extends. */
const commonId = (draft: ConfigDraft): string => {
  const meta = currentContent().docs.meta as { defaultRoster?: string };
  const ids = draft.lib.rosterDocs.map(r => rosterIdOf(r));
  return meta.defaultRoster && ids.includes(meta.defaultRoster) ? meta.defaultRoster : (ids[0] ?? "commonBase");
};

interface BindingDraft {
  cultureName?: string;
  cultureId?: number;
  cultureRace?: string;
  roster: string;
}

const bindingsOf = (draft: ConfigDraft): BindingDraft[] =>
  flat(draft.lib.culturesDocs, "cultures") as unknown as BindingDraft[];

const setBindings = (draft: ConfigDraft, bindings: BindingDraft[]): void => {
  draft.lib.culturesDocs = [{ file: "groups.json", doc: { cultures: bindings } }];
};

const buildingsOf = (draft: ConfigDraft): EntryDraft[] =>
  [...flat(draft.lib.rosterDocs, "buildings"), ...flat(draft.lib.buildingsDocs ?? [], "buildings")] as EntryDraft[];
const techOf = (draft: ConfigDraft): EntryDraft[] =>
  [...flat(draft.lib.rosterDocs, "tech"), ...flat(draft.lib.techDocs ?? [], "tech")] as EntryDraft[];

const setBuildings = (draft: ConfigDraft, buildings: EntryDraft[]): void => {
  const common = commonId(draft);
  for (const rDoc of draft.lib.rosterDocs) {
    const doc = rDoc.doc as Record<string, unknown>;
    const rId = (doc.id as string) ?? (doc.roster as { id?: string })?.id;
    doc.buildings = buildings.filter(b => (b.group ?? common) === rId);
  }
};
const setTech = (draft: ConfigDraft, tech: EntryDraft[]): void => {
  const common = commonId(draft);
  for (const rDoc of draft.lib.rosterDocs) {
    const doc = rDoc.doc as Record<string, unknown>;
    const rId = (doc.id as string) ?? (doc.roster as { id?: string })?.id;
    doc.tech = tech.filter(t => (t.group ?? common) === rId);
  }
};

function loadDraft(): ConfigDraft {
  const docs = currentContent().docs;
  const rosters = rosterDocsOf(docs).map(entry => {
    const doc = entry.doc as Record<string, unknown>;
    const rId = (doc.id as string) ?? (doc.roster as { id?: string })?.id ?? "";
    return {
      file: `rosters/${rId}.json`,
      doc: structuredClone(entry.doc)
    };
  });
  const draft: ConfigDraft = {
    lib: {
      rosterDocs: rosters,
      culturesDocs: [{ file: "groups.json", doc: { cultures: flat(docs.culturesDocs ?? [], "cultures") } }],
      buildingsDocs: docs.buildingsDocs ? structuredClone(docs.buildingsDocs) : [],
      techDocs: docs.techDocs ? structuredClone(docs.techDocs) : []
    },
    tab: "armies",
    group: "",
    expanded: {},
    entry: { building: "", tech: "" },
    newEntry: { unit: "", building: "", tech: "" }
  };
  draft.group = commonId(draft);
  for (const file of draft.lib.rosterDocs) {
    const id = rosterIdOf(file);
    if (id) draft.expanded[id] = true;
  }
  return draft;
}

// ---------------------------------------------------------------------------
// The dialog
// ---------------------------------------------------------------------------

export function openConfigDialog(): void {
  const draft = loadDraft();
  if (draft.lib.rosterDocs.length === 0) {
    toasts("no rosters in this ruleset — nothing to configure", "warn");
    return;
  }

  const dialog = openTwDialog("Faction Forces · armies · buildings · tech", body(), {
    width: 960,
    applyLabel: "Apply config",
    extra: [
      {
        label: "Reset to shipped",
        onClick: () => {
          const outcome = resetRules();
          if (outcome.ok) {
            toasts("Config reset — shipped rules are live and the saved library was cleared.");
            closeDialog();
          } else showErrors(dialog, outcome.errors);
        }
      }
    ],
    onApply: () => apply()
  });

  wire();

  function rerender(): void {
    const message = document.getElementById("alertMessage");
    if (message) message.innerHTML = body();
  }

  function body(): string {
    return `<div class="tw-config">
        <p class="tw-editor-sub tw-config-sub">${escapeHtml(rulesSummary())} — the library is saved in this browser; maps carry the resolved rules</p>
        <nav class="tw-tabs">${TABS.map(
          tab =>
            `<button type="button" class="tw-tab${draft.tab === tab.id ? " is-active" : ""}" data-tw-tab="${tab.id}">${escapeHtml(tab.label)}</button>`
        ).join("")}</nav>
        <div id="tw-errors" class="tw-errors"></div>
        <div class="tw-editor">
          ${rosterTreeNav()}
          ${tabBody()}
        </div>
      </div>`;
  }

  function rosterTreeNav(): string {
    const common = commonId(draft);
    return `<aside class="tw-roster-tree">
      <div class="tw-roster-tree-list">
        ${draft.lib.rosterDocs
          .map(file => {
            const rId = rosterIdOf(file);
            const rName = rosterNameOf(file);
            const isCommon = rId === common;
            const isRosterActive = draft.group === rId;
            const isExpanded = draft.expanded[rId] ?? true;

            let childrenHtml = "";
            if (isExpanded) {
              if (draft.tab === "armies") {
                const rDoc = file.doc as Record<string, unknown>;
                const units = (rDoc.roster as RosterDraft)?.units ?? {};
                const unitEntries = Object.entries(units);
                childrenHtml =
                  unitEntries.length === 0
                    ? `<div class="tw-tree-empty">No units</div>`
                    : unitEntries
                        .map(
                          ([uid, u]) => `
                    <button type="button" class="tw-tree-item${isRosterActive && draft.activeUnit === uid ? " is-active" : ""}" data-tw-unit-pick="${escapeHtml(rId)}|${escapeHtml(uid)}">
                      <span class="tw-tree-item-icon">⚔</span>
                      <span class="tw-tree-item-name">${escapeHtml(u.name ?? uid)}</span>
                    </button>
                  `
                        )
                        .join("");
              } else if (draft.tab === "buildings") {
                const pool = buildingsOf(draft).filter(b => (b.group ?? common) === rId);
                childrenHtml =
                  pool.length === 0
                    ? `<div class="tw-tree-empty">No buildings</div>`
                    : pool
                        .map(
                          b => `
                    <button type="button" class="tw-tree-item${isRosterActive && draft.entry.building === String(b.id) ? " is-active" : ""}" data-tw-entry-pick="${escapeHtml(rId)}|building|${escapeHtml(String(b.id))}">
                      <span class="tw-tree-item-icon">🏛</span>
                      <span class="tw-tree-item-name">${escapeHtml(String(b.name ?? b.id))}</span>
                    </button>
                  `
                        )
                        .join("");
              } else if (draft.tab === "tech") {
                const pool = techOf(draft).filter(t => (t.group ?? common) === rId);
                childrenHtml =
                  pool.length === 0
                    ? `<div class="tw-tree-empty">No tech</div>`
                    : pool
                        .map(
                          t => `
                    <button type="button" class="tw-tree-item${isRosterActive && draft.entry.tech === String(t.id) ? " is-active" : ""}" data-tw-entry-pick="${escapeHtml(rId)}|tech|${escapeHtml(String(t.id))}">
                      <span class="tw-tree-item-icon">📜</span>
                      <span class="tw-tree-item-name">${escapeHtml(String(t.name ?? t.id))}</span>
                    </button>
                  `
                        )
                        .join("");
              }
            }

            return `<div class="tw-tree-group">
              <div class="tw-tree-head${isRosterActive ? " is-active" : ""}" data-tw-group="${escapeHtml(rId)}">
                <button type="button" class="tw-tree-toggle" data-tw-toggle="${escapeHtml(rId)}">
                  ${isExpanded ? "▼" : "▶"}
                </button>
                <span class="tw-tree-name">${escapeHtml(rName)}</span>
                ${isCommon ? `<span class="tw-badge">default</span>` : ""}
                ${!isCommon ? `<button type="button" class="tw-tree-del" data-tw-del-group="${escapeHtml(rId)}" title="Delete roster">✕</button>` : ""}
              </div>
              ${isExpanded ? `<div class="tw-tree-children">${childrenHtml}</div>` : ""}
            </div>`;
          })
          .join("")}
      </div>
      <div class="tw-roster-tree-footer">
        <button type="button" class="tw-btn tw-btn--block" id="tw-add-roster">+ Add new roster</button>
      </div>
    </aside>`;
  }

  function tabBody(): string {
    switch (draft.tab) {
      case "armies":
        return armiesBody();
      case "buildings":
        return entriesBody("building");
      case "tech":
        return entriesBody("tech");
    }
  }

  function armiesBody(): string {
    const file = groupFileOf(draft, draft.group) ?? draft.lib.rosterDocs[0]!;
    const doc = file.doc as Record<string, unknown>;
    const roster = (doc.roster as RosterDraft) ?? {
      id: draft.group,
      units: {},
      garrison: { melee: "", ranged: "" },
      regimentMap: { infantry: "", archers: "", cavalry: "", artillery: "" }
    };
    const rId = rosterIdOf(file);
    const rName = rosterNameOf(file);
    const unitIds = Object.keys(roster.units ?? {});
    const isCommon = rId === commonId(draft);

    return `<div class="tw-editor-main">
      <div class="tw-roster-head-form">
        <label class="tw-field">
          <span>Roster Name</span>
          <input class="tw-input" id="tw-roster-name-input" data-tw-roster-name="${escapeHtml(rId)}" value="${escapeHtml(rName)}" placeholder="Enter roster name..." />
        </label>
        <label class="tw-field">
          <span>Roster ID</span>
          <input class="tw-input" value="${escapeHtml(rId)}" readonly disabled title="Internal ID" />
        </label>
        ${!isCommon ? `<button type="button" class="tw-btn tw-btn--sm tw-btn--danger" data-tw-del-group="${escapeHtml(rId)}">Delete roster</button>` : ""}
      </div>
      <div id="tw-roster-form">${renderFields(rosterFields(roster, unitIds))}</div>
      <h4 class="tw-editor-group">Units (${unitIds.length})</h4>
      <div class="tw-units-wrap">
        ${unitsTable(roster.units ?? {}, draft.activeUnit)}
      </div>
      <div class="tw-entry-new">
        <input class="tw-input" id="tw-new-unit" placeholder="new unit id, e.g. ironGuard" />
        <button type="button" class="tw-btn" id="tw-add-unit">Add unit</button>
        ${
          unitIds.length > 0
            ? `<select class="tw-select tw-select--sm" id="tw-del-unit-pick">
                ${unitIds.map(id => `<option value="${escapeHtml(id)}">${escapeHtml(roster.units?.[id]?.name ?? id)}</option>`).join("")}
              </select>
              <button type="button" class="tw-btn tw-btn--sm" id="tw-del-unit">Remove unit</button>`
            : ""
        }
      </div>
    </div>`;
  }

  function entriesBody(kind: EntryKind): string {
    const pool = kind === "building" ? buildingsOf(draft) : techOf(draft);
    const common = commonId(draft);
    const mine = pool.filter(entry => (entry.group ?? common) === draft.group);
    const currentId = draft.entry[kind];
    const current = mine.find(entry => String(entry.id) === currentId) ?? mine[0] ?? null;
    if (current) draft.entry[kind] = String(current.id);
    const fields = kind === "building" ? buildingFields(current) : techFields(current);
    const file = groupFileOf(draft, draft.group);
    const rName = file ? rosterNameOf(file) : draft.group;

    return `<div class="tw-editor-main">
      <div id="tw-entry-form">
        ${current ? renderFields(fields) : `<p class="tw-empty-note">No ${kind} entries in ${escapeHtml(rName)} yet — add one below.</p>`}
      </div>
      <div class="tw-entry-new">
        <input class="tw-input" id="tw-new-entry" placeholder="new ${kind} id" />
        <button type="button" class="tw-btn" id="tw-add-entry">Add ${kind}</button>
        ${
          mine.length > 0
            ? `<select class="tw-select tw-select--sm" id="tw-del-entry-pick">
                ${mine.map(entry => `<option value="${escapeHtml(String(entry.id))}">${escapeHtml(String(entry.name ?? entry.id))}</option>`).join("")}
              </select>
              <button type="button" class="tw-btn tw-btn--sm" id="tw-del-entry">Remove ${kind}</button>`
            : ""
        }
      </div>
    </div>`;
  }

  // -- the two entry field lists (buildings, tech) ----------------------------

  function buildingFields(record: EntryDraft | null): Field[] {
    if (!record) return [];
    const effects = (record.effects ?? {}) as Record<string, unknown>;
    const setEffect = (key: string, value: unknown): void => {
      record.effects = { ...effects, [key]: value };
    };
    return [
      { kind: "text", label: "id", read: () => String(record.id ?? ""), write: v => (record.id = v) },
      { kind: "text", label: "name", read: () => String(record.name ?? ""), write: v => (record.name = v) },
      {
        kind: "text",
        label: "chain",
        tip: "Upgrades run along a chain",
        read: () => String(record.chain ?? ""),
        write: v => (record.chain = v)
      },
      { kind: "number", label: "tier", min: 0, read: () => Number(record.tier ?? 1), write: v => (record.tier = v) },
      { kind: "number", label: "cost", min: 0, read: () => Number(record.cost ?? 0), write: v => (record.cost = v) },
      {
        kind: "number",
        label: "turns to build",
        min: 1,
        read: () => Number(record.turns ?? 1),
        write: v => (record.turns = v)
      },
      {
        kind: "tags",
        label: "settlement kinds",
        candidates: () => [
          { value: "major", label: "major" },
          { value: "minor", label: "minor" }
        ],
        read: () => (record.settlementKinds as string[]) ?? [],
        write: values => (record.settlementKinds = values)
      },
      {
        kind: "number",
        label: "income %",
        step: 0.05,
        read: () => Number(effects.incomePct ?? 0),
        write: v => setEffect("incomePct", v)
      },
      {
        kind: "number",
        label: "order / turn",
        step: 0.5,
        read: () => Number(effects.orderPerTurn ?? 0),
        write: v => setEffect("orderPerTurn", v)
      },
      {
        kind: "number",
        label: "walls (tiers)",
        min: 0,
        step: 1,
        read: () => Number(effects.walls ?? 0),
        write: v => setEffect("walls", v)
      },
      {
        kind: "tags",
        label: "unlocks units",
        candidates: () =>
          groupsOf(draft).flatMap(r => Object.keys(r.units ?? {}).map(id => ({ value: id, label: id }))),
        read: () => (effects.unlock as string[]) ?? [],
        write: values => setEffect("unlock", values)
      },
      groupField(record)
    ];
  }

  function techFields(record: EntryDraft | null): Field[] {
    if (!record) return [];
    const effects = (record.effects ?? {}) as Record<string, unknown>;
    const setEffect = (key: string, value: unknown): void => {
      record.effects = { ...effects, [key]: value };
    };
    return [
      { kind: "text", label: "id", read: () => String(record.id ?? ""), write: v => (record.id = v) },
      { kind: "text", label: "name", read: () => String(record.name ?? ""), write: v => (record.name = v) },
      { kind: "number", label: "cost", min: 0, read: () => Number(record.cost ?? 0), write: v => (record.cost = v) },
      {
        kind: "number",
        label: "income %",
        step: 0.05,
        read: () => Number(effects.incomePct ?? 0),
        write: v => setEffect("incomePct", v)
      },
      {
        kind: "number",
        label: "upkeep reduction",
        step: 0.05,
        read: () => Number(effects.upkeepReduction ?? 0),
        write: v => setEffect("upkeepReduction", v)
      },
      {
        kind: "tags",
        label: "unlocks units",
        candidates: () =>
          groupsOf(draft).flatMap(r => Object.keys(r.units ?? {}).map(id => ({ value: id, label: id }))),
        read: () => (effects.unlock as string[]) ?? [],
        write: values => setEffect("unlock", values)
      },
      groupField(record)
    ];
  }

  /** Common vs group ownership — the field that puts an entry inside a group. */
  function groupField(record: EntryDraft): Field {
    const common = commonId(draft);
    return {
      kind: "select",
      label: "culture group",
      tip: "Who gets this. Common is every faction; a group only its own.",
      options: () => [
        { value: "", label: `${common} (common)` },
        ...draft.lib.rosterDocs
          .map(r => ({ id: rosterIdOf(r), name: rosterNameOf(r) }))
          .filter(r => r.id !== common)
          .map(r => ({ value: r.id, label: r.name }))
      ],
      read: () => String(record.group ?? ""),
      write: v => {
        if (v) record.group = v;
        else delete record.group;
      }
    };
  }

  // -- apply ------------------------------------------------------------------

  /** Read the visible form back into the draft (per tab), reporting problems. */
  function collectForm(): string[] {
    if (draft.tab === "armies") {
      const roster = groupOf(draft, draft.group) ?? groupsOf(draft)[0]!;
      const file = groupFileOf(draft, draft.group) ?? draft.lib.rosterDocs[0]!;
      const doc = file.doc as Record<string, unknown>;
      const dialog = document.querySelector(".tw-dialog") as HTMLElement | null;
      if (!dialog) return ["the dialog is not on screen"];
      const nameInput = dialog.querySelector<HTMLInputElement>("#tw-roster-name-input");
      if (nameInput) {
        doc.name = nameInput.value;
        roster.name = nameInput.value;
      }
      const root = dialog.querySelector("#tw-roster-form") as HTMLElement | null;
      if (!root) return [];
      const read = readFields(root, rosterFields(roster, Object.keys(roster.units ?? {})));
      if (!read.ok) return read.errors;
      return readUnitsTable(dialog, roster.units ?? {}).errors;
    }
    if (draft.tab === "buildings" || draft.tab === "tech") {
      const dialog = document.querySelector(".tw-dialog") as HTMLElement | null;
      const root = dialog?.querySelector("#tw-entry-form") as HTMLElement | null;
      if (!root) return [];
      const kind = draft.tab === "buildings" ? "building" : "tech";
      const pool = kind === "building" ? buildingsOf(draft) : techOf(draft);
      const current = pool.find(entry => String(entry.id) === draft.entry[kind]);
      if (!current) return [];
      const fields = kind === "building" ? buildingFields(current) : techFields(current);
      return readFields(root, fields).errors;
    }
    return [];
  }

  function apply(): void {
    const dialog = (document.querySelector(".tw-dialog") as HTMLElement | null) ?? document.body;
    clearErrors(dialog);
    const errors = collectForm();
    if (errors.length) {
      showErrors(dialog, errors);
      return;
    }

    const result = applyLibrary(draft.lib);
    if (!result.ok) {
      showErrors(dialog, result.errors);
      return;
    }
    void saveConfigLibrary(draft.lib).then(saved => {
      toasts(
        saved
          ? "Config applied and saved in this browser."
          : "Config applied — but the browser refused to save it (private window?).",
        saved ? "info" : "warn"
      );
    });
    closeDialog();
  }

  // -- events -----------------------------------------------------------------

  function wire(): void {
    const dialog = document.querySelector(".tw-dialog") as HTMLElement | null;
    if (!dialog) return;

    dialog.addEventListener("input", event => {
      const input = event.target as HTMLInputElement;
      if (input.id === "tw-roster-name-input") {
        const rId = input.dataset.twRosterName;
        const file = draft.lib.rosterDocs.find(f => rosterIdOf(f) === rId);
        if (file) {
          (file.doc as Record<string, unknown>).name = input.value;
          const r = (file.doc as { roster?: RosterDraft }).roster;
          if (r) r.name = input.value;
          const treeLabel = dialog.querySelector(`[data-tw-group="${rId}"] .tw-tree-name`);
          if (treeLabel) treeLabel.textContent = input.value || rId || "Unnamed Roster";
        }
      }
    });

    dialog.addEventListener("change", event => {
      const input = event.target as HTMLInputElement | HTMLSelectElement;
      if (input.dataset.twUnit) {
        const [unitId, key] = (input.dataset.twUnit ?? "").split("|");
        const roster = groupOf(draft, draft.group);
        const unit = roster?.units?.[unitId ?? ""] as unknown as Record<string, unknown> | undefined;
        if (unit && key) {
          if (key === "name" || key === "category") unit[key] = input.value;
          else unit[key] = Number(input.value);
        }
      }
    });

    dialog.addEventListener("click", event => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("button, div.tw-tree-head");
      if (!target) return;

      // Expand/collapse toggle
      if (target.dataset.twToggle) {
        event.stopPropagation();
        const rId = target.dataset.twToggle;
        draft.expanded[rId] = !draft.expanded[rId];
        rerender();
        return;
      }

      // Tab selection
      if (target.dataset.twTab) {
        collectForm();
        draft.tab = target.dataset.twTab as ConfigTab;
        rerender();
        return;
      }

      // Unit pick from tree
      if (target.dataset.twUnitPick) {
        const [rId, uid] = target.dataset.twUnitPick.split("|");
        collectForm();
        draft.group = rId;
        draft.activeUnit = uid;
        rerender();
        const row = dialog.querySelector(`[data-tw-unit^="${uid}|"]`) as HTMLElement | null;
        row?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return;
      }

      // Entry pick from tree (building / tech)
      if (target.dataset.twEntryPick) {
        const [rId, kind, entryId] = target.dataset.twEntryPick.split("|");
        collectForm();
        draft.group = rId;
        draft.entry[kind as EntryKind] = entryId;
        rerender();
        return;
      }

      // Roster selection from tree
      if (target.dataset.twGroup) {
        collectForm();
        const rId = target.dataset.twGroup;
        draft.group = rId;
        draft.activeUnit = undefined;
        const common = commonId(draft);
        if (draft.tab === "buildings") {
          const pool = buildingsOf(draft).filter(b => (b.group ?? common) === rId);
          if (pool.length > 0 && !pool.some(b => String(b.id) === draft.entry.building)) {
            draft.entry.building = String(pool[0]!.id);
          }
        } else if (draft.tab === "tech") {
          const pool = techOf(draft).filter(t => (t.group ?? common) === rId);
          if (pool.length > 0 && !pool.some(t => String(t.id) === draft.entry.tech)) {
            draft.entry.tech = String(pool[0]!.id);
          }
        }
        rerender();
        return;
      }

      // Add new roster
      if (target.id === "tw-add-roster") {
        collectForm();
        const newId = `roster-${Date.now()}`;
        const common = commonId(draft);
        const defaultFile = draft.lib.rosterDocs.find(file => rosterIdOf(file) === common);
        const defaultDoc = (defaultFile?.doc as Record<string, unknown>) ?? {};
        const defaultRoster = (defaultDoc.roster as RosterDraft) ?? {
          id: "commonBase",
          units: {},
          recruitable: [],
          garrison: { melee: "", ranged: "" },
          regimentMap: { infantry: "", archers: "", cavalry: "", artillery: "" }
        };

        const clonedRoster: RosterDraft = {
          ...structuredClone(defaultRoster),
          id: newId,
          name: "New Roster"
        };

        const clonedBuildings: EntryDraft[] = ((defaultDoc.buildings as EntryDraft[]) ?? []).map(b => ({
          ...structuredClone(b),
          group: newId
        }));

        const clonedTech: EntryDraft[] = ((defaultDoc.tech as EntryDraft[]) ?? []).map(t => ({
          ...structuredClone(t),
          group: newId
        }));

        const newDoc = {
          id: newId,
          name: "New Roster",
          roster: clonedRoster,
          tech: clonedTech,
          buildings: clonedBuildings
        };

        draft.lib.rosterDocs.push({
          file: `rosters/${newId}.json`,
          doc: newDoc
        });

        draft.group = newId;
        draft.tab = "armies";
        draft.expanded[newId] = true;
        draft.activeUnit = undefined;
        rerender();

        const nameInput = dialog.querySelector<HTMLInputElement>("#tw-roster-name-input");
        nameInput?.select();
        nameInput?.focus();
        return;
      }

      // Delete roster
      if (target.dataset.twDelGroup) {
        const id = target.dataset.twDelGroup;
        const common = commonId(draft);
        if (id === common) {
          showErrors(dialog, ["The default common roster cannot be deleted."]);
          return;
        }
        draft.lib.rosterDocs = draft.lib.rosterDocs.filter(file => rosterIdOf(file) !== id);
        setBindings(
          draft,
          bindingsOf(draft).filter(b => b.roster !== id)
        );
        draft.group = commonId(draft);
        draft.activeUnit = undefined;
        rerender();
        return;
      }

      // Add unit
      if (target.id === "tw-add-unit") {
        const roster = groupOf(draft, draft.group);
        if (!roster) return;
        const input = dialog.querySelector<HTMLInputElement>("#tw-new-unit");
        const id = (input?.value ?? "").trim();
        if (!id) return showErrors(dialog, ["a unit id is required"]);
        roster.units ??= {};
        if (roster.units[id]) return showErrors(dialog, [`unit '${id}' already exists in ${roster.id}`]);
        roster.units[id] = {
          id,
          name: id,
          category: "melee",
          blocks: 0.1,
          attack: 5,
          defense: 5,
          charge: 0,
          missile: 0,
          cost: 100,
          upkeep: 20
        };
        draft.activeUnit = id;
        rerender();
        return;
      }

      // Delete unit
      if (target.id === "tw-del-unit") {
        const roster = groupOf(draft, draft.group);
        const pick = dialog.querySelector<HTMLSelectElement>("#tw-del-unit-pick");
        if (roster && pick?.value) {
          delete roster.units?.[pick.value];
          if (draft.activeUnit === pick.value) draft.activeUnit = undefined;
        }
        rerender();
        return;
      }

      // Add building or tech
      if (target.id === "tw-add-entry") {
        const kind = draft.tab === "buildings" ? "building" : draft.tab === "tech" ? "tech" : null;
        if (!kind) return;
        const input = dialog.querySelector<HTMLInputElement>("#tw-new-entry");
        const id = (input?.value ?? "").trim();
        if (!id) return showErrors(dialog, ["an id is required"]);
        const common = commonId(draft);
        const groupTag = draft.group === common ? undefined : draft.group;
        const created: EntryDraft =
          kind === "building"
            ? {
                id,
                name: id,
                chain: id,
                tier: 1,
                settlementKinds: ["major"],
                cost: 200,
                turns: 1,
                effects: {},
                ...(groupTag ? { group: groupTag } : {})
              }
            : { id, name: id, cost: 800, effects: {}, ...(groupTag ? { group: groupTag } : {}) };

        if (kind === "building") {
          if (buildingsOf(draft).some(b => b.id === id && b.group === groupTag)) {
            return showErrors(dialog, [`building '${id}' already exists in this roster`]);
          }
          setBuildings(draft, [...buildingsOf(draft), created]);
        } else {
          if (techOf(draft).some(t => t.id === id && t.group === groupTag)) {
            return showErrors(dialog, [`tech '${id}' already exists in this roster`]);
          }
          setTech(draft, [...techOf(draft), created]);
        }
        draft.entry[kind] = id;
        rerender();
        return;
      }

      // Delete building or tech
      if (target.id === "tw-del-entry") {
        const kind = draft.tab === "buildings" ? "building" : draft.tab === "tech" ? "tech" : null;
        if (!kind) return;
        const pick = dialog.querySelector<HTMLSelectElement>("#tw-del-entry-pick");
        if (!pick?.value) return;
        if (kind === "building")
          setBuildings(
            draft,
            buildingsOf(draft).filter(b => b.id !== pick.value)
          );
        else if (kind === "tech")
          setTech(
            draft,
            techOf(draft).filter(t => t.id !== pick.value)
          );
        rerender();
        return;
      }
    });
  }
}
