/**
 * store.ts — the ruleset as page state (Phase D / D6, D8).
 *
 * Before this phase the ruleset was a mirror of `rosters/default.yaml` baked into
 * the mod, and the real content lived on the server as YAML. Now the ruleset is
 * *page state*: JSON docs bundled from `docs/`, validated through the engine's own
 * `validateAndResolve`, editable in dialogs, and — because D8 says content is
 * per-map — carried inside the `.map` file's Total War slot so a shared file brings
 * its own rules.
 *
 * Three rules this module enforces:
 *
 *  1. **Validation before adoption.** A draft that does not validate is never
 *     adopted, and the live rules are never left half-applied. The caller gets
 *     every error at once with did-you-mean hints, and the page keeps playing.
 *  2. **The shipped ruleset is the baseline, and "reset" means exactly that.**
 *     Edits are stored as the *difference from shipped*, never as a private copy
 *     of everything, so a baseline fix in `docs/` still reaches edited maps.
 *  3. **The slot only carries what differs.** A map with no edits writes no
 *     settings at all, keeping a stock save byte-identical.
 */
import { type ContentPack, type RawContentDocs, validateAndResolve } from "../engine/common/content";
import { type CampaignConfig, resolveConfig } from "../engine/game/config";
import { type LibraryDocs, loadConfigLibrary } from "../store/config-store";
import { twWarn } from "../ui/fmg";
import { BUNDLED_DOCS } from "./bundled";
import gameConfigDoc from "./docs/game.json" with { type: "json" };

/** Where the live ruleset came from — shown in the editors, useful in a bug report. */
type ContentSource = "bundled" | "map" | "edited" | "config";

interface ContentState {
  /** the live docs — what the editors mutate and the slot carries */
  docs: RawContentDocs;
  /** the validated ruleset the engine runs on */
  content: ContentPack;
  /** the resolved game config (turn calendar, taxes, movement) */
  config: CampaignConfig;
  /** non-fatal notes from the last validation */
  warnings: string[];
  source: ContentSource;
  /** true when the live docs differ from the shipped baseline */
  edited: boolean;
}

export interface ApplyResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface SlotContent {
  /** present only when the map's rules differ from the shipped baseline */
  docs?: RawContentDocs;
  /** present only when the map's config differs from the shipped one */
  config?: CampaignConfig;
}

/** Deep clone: docs are handed to editors that mutate them in place. */
const clone = <T>(value: T): T => structuredClone(value);

/** Shipped docs, cloned so nothing downstream can mutate the baseline. */
const shippedDocs = (): RawContentDocs => clone(BUNDLED_DOCS);

/** Shipped config, resolved from `docs/game.json` at boot. */
const shippedConfig = (): CampaignConfig => resolveConfig(clone(gameConfigDoc));

function build(docs: RawContentDocs): { content: ContentPack | null; errors: string[]; warnings: string[] } {
  const result = validateAndResolve(clone(docs));
  return { content: result.content, errors: result.errors, warnings: result.warnings };
}

/** Do these two docs differ? Used to decide whether the slot carries anything. */
function docsDiffer(a: RawContentDocs, b: RawContentDocs): boolean {
  return JSON.stringify(sortKeys(a)) !== JSON.stringify(sortKeys(b));
}

/**
 * Key order must not decide whether two rulesets are the same.
 *
 * An editor that rebuilds an object literal in a different key order would
 * otherwise make every map look edited, and the slot would grow a full copy of the
 * ruleset for nothing.
 */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortKeys(entry)])
    );
  }
  return value;
}

let state: ContentState = boot();
const listeners = new Set<(state: ContentState) => void>();

function boot(): ContentState {
  const docs = shippedDocs();
  const { content, errors } = build(docs);
  if (!content) {
    // The shipped ruleset is invalid. That is a build error, not something a
    // player can cause — and there is no sensible fallback to invent here, since
    // any invented rules would be a silent lie about the game's rules. Fail loudly
    // at boot; entry.ts catches it and the campaign UI simply stays off.
    throw new Error(`the shipped ruleset is invalid:\n  ${errors.join("\n  ")}`);
  }
  const coherence = coherenceErrors(content);
  if (coherence.length > 0) throw new Error(`the shipped ruleset is incoherent:\n  ${coherence.join("\n  ")}`);
  return { docs, content, config: shippedConfig(), warnings: [], source: "bundled", edited: false };
}

/**
 * Coherence checks the validator does not make.
 *
 * `regimentMap` and `garrison` name unit ids; a roster can validate with an entry
 * pointing at a unit nobody declared, which compiles fine and throws the first time
 * an army fights. This is that check, as *errors* rather than a throw, so an editor
 * can report it like any other validation failure.
 */
export function coherenceErrors(content: ContentPack): string[] {
  const errors: string[] = [];
  for (const roster of Object.values(content.rosters)) {
    const ids = new Set(Object.keys(roster.units));
    for (const [category, unitId] of Object.entries(roster.regimentMap)) {
      if (!ids.has(unitId))
        errors.push(`roster '${roster.id}': regimentMap.${category} points at unknown unit '${unitId}'`);
    }
    for (const [slot, unitId] of Object.entries(roster.garrison)) {
      if (!ids.has(unitId)) errors.push(`roster '${roster.id}': garrison.${slot} points at unknown unit '${unitId}'`);
    }
  }
  return errors;
}

/** The live ruleset. */
export function currentContent(): ContentState {
  return state;
}

/** Available rosters for UI dropdowns */
export function getAvailableRosters(): { id: string; name: string }[] {
  try {
    const rosters = currentContent()?.content?.rosters;
    if (rosters && Object.keys(rosters).length > 0) {
      return Object.values(rosters).map(r => ({ id: r.id, name: r.name || r.id }));
    }
  } catch {
    // fallback
  }
  return [
    { id: "commonBase", name: "Common" },
    { id: "dwarfBase", name: "Dwarf" },
    { id: "elfBase", name: "Elf" },
    { id: "orcBase", name: "Orc" },
    { id: "steppeBase", name: "Steppe" }
  ];
}

/** Render HTML <option> tags for roster selects */
export function getRosterOptions(selectedId?: string): string {
  const rosters = getAvailableRosters();
  return rosters
    .map(r => `<option value="${r.id}" ${r.id === selectedId ? "selected" : ""}>${r.name}</option>`)
    .join("");
}

/** Subscribe to rule changes: the editors, the rail and the session all redraw. */
export function onContentChange(listener: (state: ContentState) => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

function publish(next: ContentState): void {
  state = next;
  for (const listener of [...listeners]) {
    try {
      listener(state);
    } catch (error) {
      twWarn("content listener threw", error);
    }
  }
}

/**
 * Adopt new docs after validating them.
 *
 * On failure nothing changes: the caller shows the errors and the campaign keeps
 * playing under the rules it was born with. That asymmetry is the point — a bad
 * edit must never be able to invalidate a campaign in progress.
 */
export function applyDocs(docs: RawContentDocs, source: ContentSource = "edited"): ApplyResult {
  // Shape check first. `validateAndResolve` throws on a payload that is not docs at
  // all (a ContentPack, say), and a thrown TypeError from an editor's "apply" is
  // both unhelpful and a way to lose the dialog's draft — every rejection must
  // come back as errors the dialog can show.
  if (!docs || typeof docs !== "object" || !Array.isArray(docs.rosterDocs)) {
    return {
      ok: false,
      errors: ["these are not content docs: expected { rosterDocs: [...], meta: {...} }"],
      warnings: []
    };
  }
  const { content, errors, warnings } = build(docs);
  if (!content) return { ok: false, errors, warnings };
  const incoherent = coherenceErrors(content);
  if (incoherent.length > 0) return { ok: false, errors: incoherent, warnings };
  publish({
    docs: clone(docs),
    content,
    config: state.config,
    warnings,
    source,
    edited: docsDiffer(docs, shippedDocs())
  });
  return { ok: true, errors, warnings };
}

/** Adopt a new game config (the turn calendar, taxes, movement costs). */
export function applyConfig(config: CampaignConfig, source: ContentSource = "edited"): ApplyResult {
  publish({ ...state, config: clone(config), source, edited: state.edited || configDiffers(config) });
  return { ok: true, errors: [], warnings: [] };
}

function configDiffers(config: CampaignConfig): boolean {
  return JSON.stringify(sortKeys(config)) !== JSON.stringify(sortKeys(shippedConfig()));
}

/** Throw the rulesets away and go back to what shipped. */
export function resetToShipped(): ApplyResult {
  const docs = shippedDocs();
  const { content, errors, warnings } = build(docs);
  if (!content) return { ok: false, errors, warnings };
  publish({ docs, content, config: shippedConfig(), warnings, source: "bundled", edited: false });
  return { ok: true, errors, warnings };
}

// ---------------------------------------------------------------------------
// The config library (culture groups) — authored in IndexedDB, merged here
// ---------------------------------------------------------------------------

/**
 * Merge the config library into the live docs and adopt the result.
 *
 * The library owns the four *config-authored* lists — rosters (the culture
 * groups), culture bindings, buildings, tech. Everything else — per-state defs,
 * victory sets, events, the game config — belongs to the map and survives the
 * merge untouched. Validation runs exactly like an editor apply: on failure
 * nothing changes and the errors come back for the dialog to show.
 */
export function applyLibrary(lib: LibraryDocs): ApplyResult {
  const merged: RawContentDocs = {
    ...state.docs,
    rosterDocs: structuredClone(lib.rosterDocs),
    culturesDocs: structuredClone(lib.culturesDocs),
    buildingsDocs: structuredClone(lib.buildingsDocs),
    techDocs: structuredClone(lib.techDocs)
  };
  return applyDocs(merged, "config");
}

/**
 * Boot: adopt the saved config library, if one exists and the page is still on
 * the shipped baseline.
 *
 * Precedence is the point — a map that carries its own rules (slot docs) always
 * wins over the browser's library, so sharing a map plays the same everywhere.
 * The library therefore only seeds a page that has nothing else to say. Runs
 * async off the boot path: the game starts on shipped rules and the library
 * lands when IndexedDB answers (a moment later, and re-replayed like any edit).
 */
export async function bootstrapConfigLibrary(): Promise<void> {
  try {
    const lib = await loadConfigLibrary();
    if (!lib) return;
    if (state.source !== "bundled" || state.edited) {
      twWarn("config library ignored — this map carries its own rules");
      return;
    }
    const result = applyLibrary(lib);
    if (!result.ok) {
      twWarn(`saved config library did not validate — staying on shipped: ${result.errors[0] ?? ""}`);
    }
  } catch (error) {
    twWarn("config library load failed", error);
  }
}

// ---------------------------------------------------------------------------
// The ruleset ↔ the .map file (D8: content is per-map, not per-browser)
// ---------------------------------------------------------------------------

/**
 * What this map should carry in its slot: only what differs from shipped.
 *
 * Returning `undefined` for an unedited map is what keeps a stock save
 * byte-identical — the slot omits the line when there is nothing to say.
 */
export function slotContent(): SlotContent | undefined {
  if (!state.edited) return undefined;
  return {
    ...(docsDiffer(state.docs, shippedDocs()) ? { docs: clone(state.docs) } : {}),
    ...(configDiffers(state.config) ? { config: clone(state.config) } : {})
  };
}

/**
 * Adopt the ruleset a loaded `.map` carried.
 *
 * Called before the campaign is adopted: the campaign's own `contentHash` is the
 * ruleset hash, so the rules have to be in place *before* that check can mean
 * anything. A map carrying rules the page cannot validate keeps the shipped ones
 * and says so — the map's campaign then refuses to attach, which is the honest
 * outcome (a campaign played under unknown rules must not silently resume under
 * different ones).
 */
export function loadFromSlot(raw: unknown): ApplyResult {
  if (!raw || typeof raw !== "object") return { ok: true, errors: [], warnings: [] };
  const carried = raw as SlotContent;
  let result: ApplyResult = { ok: true, errors: [], warnings: [] };
  if (carried.docs) result = applyDocs(carried.docs, "map");
  if (!result.ok) return result;
  if (carried.config) result = applyConfig(carried.config, "map");
  if (!result.ok) return result;
  if (carried.docs || carried.config) publish({ ...state, source: "map" });
  return { ok: true, errors: [], warnings: [] };
}

/** "shipped · ruleset 9124d357" — the header line in the editors and the menu. */
export function rulesSummary(): string {
  const hash = state.content.hash.slice(0, 8);
  const source = !state.edited
    ? "shipped"
    : state.source === "map"
      ? "this map"
      : state.source === "config"
        ? "config"
        : "edited";
  return `${source} · ${state.edited ? "rules" : "ruleset"} ${hash}`;
}
