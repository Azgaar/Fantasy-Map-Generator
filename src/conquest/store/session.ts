/**
 * session.ts — the campaign session: what is compiled, and what is being played.
 *
 * Deliberately separate from `entry.ts`. The entry point owns *when* things happen
 * (boot, world sync); this owns *what* is loaded, so the UI can read it without
 * importing the entry — and without the import cycle that would otherwise exist
 * between the rail (which renders campaign state) and the module that creates
 * campaigns.
 *
 * This is also where a campaign meets its file: `adoptFromSlot` replays the log a
 * `.map` carried, `toSlot` hands the current log back, and the mirror keeps a copy
 * outside the file. Everything else in the app treats this module as the only
 * source of campaign truth.
 */

import {
  type ApplyResult,
  currentContent,
  loadFromSlot as loadContentFromSlot,
  resetToShipped,
  slotContent,
  applyConfig as storeApplyConfig,
  applyDocs as storeApplyDocs
} from "../content/store";
import type { Command } from "../engine/game/commandTypes";
import { fmg, twWarn } from "../ui/fmg";
import { type CampaignStore, type CommandOutcome, seedForWorld } from "./campaign";
import { clearConfigLibrary } from "./config-store";
import { deleteMirror, getMirror, type MirrorRecord, mirrorOnChange } from "./mirror";
import {
  type CampaignSlot,
  campaignSlotOf,
  clearPendingSlot,
  getSlot,
  pendingSlot,
  setSlot,
  type TotalWarSlot
} from "./mod-slot";

export interface TwSession {
  store: CampaignStore;
  packId: string;
  factionNames: { id: number; name: string }[];
  regionCount: number;
  settlementCount: number;
  armyCount: number;
  landCellCount: number;
  landEdgeCount: number;
  compileMs: number;
  ran: "worker" | "main";
}

interface AdoptResult {
  adopted: boolean;
  reason?: string;
  /** the state hash after a successful replay — callers compare, they don't trust */
  stateHash?: string;
}

let session: TwSession | null = null;
const listeners = new Set<() => void>();
let mirror: { schedule: () => void; flush: () => void; cancel: () => void } | null = null;

// Registered once for the page's lifetime (not per-world: worlds recompile when
// FMG regenerates, and a listener per compile is a leak). A tab closed mid-campaign
// still gets its debounced mirror write out the door.
if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("pagehide", () => flushMirror());
}

/** The live session, or null before a world has compiled. */
export function currentSession(): TwSession | null {
  return session;
}

/**
 * Subscribe to session changes: a new world, a campaign started, a command
 * applied. The rail renders from this, which is why it can never disagree with
 * what is actually loaded — it is told, rather than having to remember to ask.
 */
export function onSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

function notify(): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch (error) {
      twWarn("session listener threw", error);
    }
  }
}

/** The mirror record for the live campaign, or null when none is attached. */
function mirrorRecord(): MirrorRecord | null {
  const live = session;
  const campaign = live?.store.state;
  if (!live || !campaign) return null;
  return {
    mapPackId: live.packId,
    mapName: fmg()?.mapName ?? live.packId,
    slot: { v: 1, campaign: campaignSlotOf(campaign, live.store.log, live.store.packContentHash) },
    savedAt: Date.now(),
    stateHash: live.store.stateHash(),
    turn: campaign.turn
  };
}

export function setSession(next: TwSession | null): void {
  session = next;
  if (next) {
    // Every command rewrites the mirror after a short debounce, and the page's
    // `pagehide` flushes whatever is pending — so a closed tab still has a copy.
    mirror = mirrorOnChange(mirrorRecord);
  } else {
    mirror?.flush();
    mirror = null;
  }
  notify();
}

export function clearSession(): void {
  setSession(null);
}

/**
 * Attach a campaign to the compiled world.
 *
 * The seed is derived from the pack id, not from the clock: the engine forbids
 * `Math.random()`, and a campaign that cannot be reproduced is a campaign that
 * cannot be saved. Same world → same campaign, every time.
 */
export function startCampaign(factionId?: number): CommandOutcome | null {
  const store = session?.store;
  if (!session || !store) {
    twWarn("no compiled world — nothing to start a campaign on");
    return null;
  }
  const resolved = store.resolved;
  const playerFactions = session.store.pack.factions
    .map(f => f.id)
    .filter(id => resolved.factions[String(id)]?.controller === "player");

  const chosen =
    factionId ?? (playerFactions.length > 0 ? playerFactions[0] : factionId === undefined ? 0 : defaultFactionId());
  if (chosen == null) {
    twWarn("this map has no factions to play");
    return null;
  }
  try {
    store.create({
      factionId: chosen,
      playerFactionIds: factionId !== undefined ? [factionId] : playerFactions,
      seed: seedForWorld(session.packId)
    });
  } catch (error) {
    twWarn("campaign did not start", error);
    return { ok: false, error: (error as Error).message, stateHash: "" };
  }
  publishCampaignToSlot();
  notify();
  return { ok: true, stateHash: store.stateHash() };
}

/** Run one command against the live campaign. The menu, rail and hotkeys all land here. */
export function dispatchCommand(command: Command): CommandOutcome | null {
  const store = session?.store;
  if (!store) return null;
  const outcome = store.apply(command);
  if (outcome.ok) {
    publishCampaignToSlot();
    notify();
  }
  return outcome;
}

/** Drop the campaign but keep the compiled world loaded. */
export function detachCampaign(): void {
  const store = session?.store;
  if (!store) return;
  store.detach();
  setSlot({ campaign: undefined });
  setSlot({ ui: { ...getSlot().ui, mode: "cartographer" } });
  // Cancel before delete: a debounced write that landed after the delete would
  // resurrect the campaign we just discarded.
  mirror?.cancel();
  if (session) void deleteMirror(session.packId);
  notify();
}

/**
 * Copy this campaign into a second, independent one: same world, same faction,
 * same starting position, its own log from turn 1.
 *
 * The only difference is the seed — which is the point, because the log branches
 * the moment the two are played differently.
 */
export function duplicateCampaign(): CommandOutcome | null {
  const store = session?.store;
  if (!session || !store) return null;
  const source = store.state;
  const factionId = source?.factionId ?? defaultFactionId();
  if (factionId == null) return null;
  try {
    store.create({ factionId, seed: (source?.seed ?? seedForWorld(session.packId)) + 1 });
  } catch (error) {
    twWarn("could not duplicate the campaign", error);
    return { ok: false, error: (error as Error).message, stateHash: "" };
  }
  publishCampaignToSlot();
  notify();
  return { ok: true, stateHash: store.stateHash() };
}

/** The lowest-id faction on the map: Azgaar ids start at 1, and 0 is the sea. */
function defaultFactionId(): number | null {
  const names = session?.factionNames ?? [];
  if (names.length === 0) return null;
  return names.reduce((lowest, faction) => Math.min(lowest, faction.id), names[0]!.id);
}

// ---------------------------------------------------------------------------
// The campaign ↔ the .map file
// ---------------------------------------------------------------------------

/**
 * Put the live campaign into the slot, so FMG's next save carries it, and
 * schedule the off-file mirror write (C.3's insurance, debounced).
 */
function publishCampaignToSlot(): void {
  const live = session;
  const campaign = live?.store.state;
  setSlot({ campaign: campaign ? campaignSlotOf(campaign, live.store.log, live.store.packContentHash) : undefined });
  mirror?.schedule();
}

/** The campaign as it will be written into the next save. */
function slotForSave(): TotalWarSlot {
  const live = session;
  const campaign = live?.store.state;
  return {
    v: 1,
    ...(campaign ? { campaign: campaignSlotOf(campaign, live.store.log, live.store.packContentHash) } : {}),
    ui: getSlot().ui,
    settings: getSlot().settings
  };
}

/**
 * Replay a campaign payload against the world on screen.
 *
 * The one place adoption happens. It refuses in every case where replaying would
 * be a lie — a different world, a different ruleset, or a log that no longer
 * reproduces — and the campaign stays in the mirror either way: nothing is
 * discarded without being asked. Phase E adds the tolerant replay that recovers
 * what it can instead of refusing outright.
 *
 * Two quiet guarantees sit here:
 * - a campaign for another world never contaminates this map's next save (the
 *   slot's copy is dropped; the mirror, keyed by pack id, is untouched);
 * - the replayed `turn` must agree with the slot's convenience copy — the engine
 *   is deterministic, so a divergence is a bug, and it is reported, not trusted.
 */
function adoptStored(stored: CampaignSlot | null, options: { checkContent?: boolean } = {}): AdoptResult {
  if (!stored) return { adopted: false, reason: "no campaign supplied" };
  const live = session;
  if (!live) return { adopted: false, reason: "no compiled world yet" };
  if (stored.mapPackId !== live.packId) {
    // Not this world's campaign: forget it in the slot so this map's next save
    // cannot carry a foreign campaign. The mirror keeps the original.
    setSlot({ campaign: undefined });
    return { adopted: false, reason: `belongs to pack '${stored.mapPackId}', this world is '${live.packId}'` };
  }
  if (options.checkContent) {
    if (stored.contentHash && stored.contentHash !== live.store.rulesetHash) {
      return { adopted: false, reason: "was played under different rules (content changed)" };
    }
    if (stored.worldHash && stored.worldHash !== live.store.packContentHash) {
      return { adopted: false, reason: "this world has changed since the campaign was played" };
    }
  }
  try {
    live.store.replay(stored.commands, { factionId: stored.factionId, seed: stored.seed, id: stored.id });
  } catch (error) {
    twWarn("campaign replay failed — the log is kept, nothing was attached", error);
    return { adopted: false, reason: (error as Error).message };
  }
  const stateHash = live.store.stateHash();
  const state = live.store.state;
  if (state && state.turn !== stored.turn) {
    twWarn(
      `campaign divergence: the file says turn ${stored.turn}, the replay produced ${state.turn} — ` +
        `the log no longer describes this campaign`
    );
  }
  setSlot({ ui: { ...getSlot().ui, mode: "campaign" } });
  publishCampaignToSlot();
  notify();
  return { adopted: true, stateHash };
}

/** Replay the campaign the `.map` being loaded carried, if any. */
export function adoptFromSlot(): AdoptResult {
  const stored = pendingSlot()?.campaign ?? null;
  if (!stored) {
    clearPendingSlot();
    return { adopted: false, reason: "no campaign in this map" };
  }
  const live = session;
  const result = adoptStored(stored, { checkContent: true });
  // A campaign for another world stays *pending*. Since Phase E a page
  // legitimately compiles several worlds in sequence — FMG's boot may
  // quick-restore a browser-storage world before the player opens the real map —
  // and the right world may be the next compile. The held copy is memory-only
  // and dies with the page; the *slot* copy is still wiped by `adoptStored`, so
  // no save can ever carry a foreign campaign. Any other refusal (content hash,
  // replay failure) matched this world, so retrying cannot help: drop it.
  const worldMismatch = live != null && stored.mapPackId !== live.packId;
  if (result.adopted || !worldMismatch) clearPendingSlot();
  return result;
}

/**
 * Recover a mirrored campaign for the world on screen (C.3's insurance).
 *
 * The mirror also records the state hash at write time; a replay that disagrees
 * is determinism broken, so it is reported even though the campaign attaches —
 * the player keeps a playable campaign either way.
 */
export async function restoreFromMirror(): Promise<AdoptResult> {
  const live = session;
  if (!live) return { adopted: false, reason: "no compiled world yet" };
  const record = await getMirror(live.packId);
  if (!record?.slot.campaign) return { adopted: false, reason: "no mirrored campaign for this world" };
  const result = adoptStored(record.slot.campaign, { checkContent: true });
  if (result.adopted && record.stateHash && record.stateHash !== result.stateHash) {
    twWarn(
      `mirror divergence: recorded ${record.stateHash.slice(0, 12)}…, replay produced ` +
        `${result.stateHash?.slice(0, 12)}…`
    );
  }
  return result;
}

/** The mirrored campaign for this world, if any — for the rail's mirror line. */
export async function mirrorStatus(): Promise<{ savedAt: number; turn: number } | null> {
  const live = session;
  if (!live) return null;
  const record = await getMirror(live.packId);
  return record ? { savedAt: record.savedAt, turn: record.turn } : null;
}

/** Write the mirror right now (page unload, explicit save). */
export function flushMirror(): void {
  mirror?.flush();
}

/** The campaign as a downloadable `.totalwar.json`, for sharing or backup. */
export function exportPayload(): string {
  return JSON.stringify(slotForSave(), null, 2);
}

// ---------------------------------------------------------------------------
// Rules (Phase D): content is page state, editable while a campaign runs
// ---------------------------------------------------------------------------

/**
 * Adopt an edited ruleset.
 *
 * The flow is deliberately the same shape as loading a file: validate, then
 * *replay the log under the new rules*. A campaign's rules are part of its
 * identity (they're in the state hash), so there is no cheaper correct answer
 * than re-running the log — and if the replay diverges the edit is refused and the
 * campaign keeps the rules it was born with. Phase E routes structural map edits
 * into this same path; this is the first of the two triggers (D3).
 */
function applyRules(next: ApplyResult & { stateHash?: string }): ApplyResult {
  if (!next.ok) return next;
  publishRulesToSlot();
  notify();
  return next;
}

/** Apply raw docs (from an editor or the console): validate, then swap. */
export function editContent(docs: Parameters<typeof storeApplyDocs>[0]): ApplyResult {
  return applyRules(swapRules(storeApplyDocs(docs)));
}

/** Apply a game config edit (turn calendar, taxes, movement). */
export function editConfig(config: Parameters<typeof storeApplyConfig>[0]): ApplyResult {
  return applyRules(swapRules(storeApplyConfig(config)));
}

/** Back to what shipped. */
export function resetRules(): ApplyResult {
  // The config library is part of "what shipped" from the player's point of
  // view: resetting the rules must not let a saved library re-apply on the
  // next boot. Fire-and-forget — storage refusal is logged, not fatal.
  void clearConfigLibrary().catch(() => {});
  return applyRules(swapRules(resetToShipped()));
}

/**
 * Push the newly validated rules into the live campaign.
 *
 * Split out because it is the one part of "edit the rules" that can fail for a
 * reason validation cannot know: the log may no longer replay under them.
 */
function swapRules(result: ApplyResult): ApplyResult & { stateHash?: string } {
  if (!result.ok) return result;
  const store = session?.store;
  if (!store) return result;
  const live = currentContent();
  const swapped = store.setRules(live.content, live.config);
  if (!swapped.ok) {
    return {
      ok: false,
      // The ruleset itself validated; it is *this campaign* that cannot live under
      // it. Say so precisely — the message comes from the replay divergence.
      errors: [`this campaign cannot continue under the edited rules: ${swapped.error}`],
      warnings: result.warnings
    };
  }
  return { ok: true, errors: [], warnings: result.warnings, stateHash: swapped.stateHash };
}

/**
 * Write the map's rules into the slot — but only when they differ from shipped,
 * so an unedited map still saves byte-identically (D8 with P2's promise).
 *
 * The campaign is re-published first, and that ordering is load-bearing: a
 * campaign's `contentHash` is the ruleset hash, so a rules change invalidates the
 * campaign copy already in the slot. Publishing only the rules would save a map
 * whose campaign was played under one ruleset and whose slot carries another —
 * a file that refuses to open its own campaign.
 */
function publishRulesToSlot(): void {
  publishCampaignToSlot();
  setSlot({ settings: slotContent() });
}

/**
 * Adopt the ruleset a loaded `.map` carried, before its campaign is adopted.
 *
 * Order matters and is the whole point of D8: the campaign's `contentHash` is the
 * ruleset hash, so the rules must already be in place for that check to mean
 * anything. A map whose rules this build cannot load keeps the shipped ones, and
 * its campaign then refuses to attach rather than resuming under rules it was not
 * played with.
 */
export function adoptRulesFromSlot(): boolean {
  const carried = getSlot().settings;
  if (!carried) return false;
  const result = loadContentFromSlot(carried);
  if (!result.ok) {
    twWarn(
      `this map carries rules this build cannot load — keeping the shipped ruleset:\n  ${result.errors.join("\n  ")}`
    );
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Rebase (Phase E): structural map edits under a live campaign
// ---------------------------------------------------------------------------

/**
 * A campaign a rebase could not carry.
 *
 * E5's rule is "never silently discard": when the world changes so much that the
 * log cannot be replayed at all (the faction the campaign played as is gone, say),
 * the log is kept here — in memory, for this session — and the rebase report
 * offers a download before anything is lost.
 */
interface CampaignArchive {
  id: string;
  factionId: number;
  turn: number;
  commands: number;
  log: Command[];
  reason: string;
  at: number;
}

let archive: CampaignArchive | null = null;

/** Keep a detached campaign's log so the user can retrieve it. */
export function archiveCampaign(
  log: readonly Command[],
  state: { id: string; factionId: number; turn: number },
  reason: string
): void {
  archive = {
    id: state.id,
    factionId: state.factionId,
    turn: state.turn,
    commands: log.length,
    log: [...log],
    reason,
    at: Date.now()
  };
}

/** The archived campaign, if a rebase has escalated. */
export function currentArchive(): CampaignArchive | null {
  return archive;
}

/**
 * The archived campaign in the same shape `exportPayload` produces, so an
 * archived log is not a dead end: the download re-imports through the same
 * "campaign from file" path a live export does.
 */
export function sessionArchivePayload(): string {
  const archived = archive;
  if (!archived) return "{}";
  return JSON.stringify(
    {
      v: 1,
      archived: true,
      reason: archived.reason,
      campaign: {
        id: archived.id,
        factionId: archived.factionId,
        seed: 0,
        contentHash: "",
        commands: archived.log
      }
    },
    null,
    2
  );
}

/**
 * After a rebase has been installed as the session: re-publish the surviving log
 * to the slot and mirror, and repaint the rail.
 *
 * Split from the rebase itself because the rebase builds the new store (it needs
 * the compiled pack); everything downstream of the session — the file, the
 * mirror, the UI — just needs to be told the log changed underneath it.
 */
export function afterRebase(): void {
  publishCampaignToSlot();
  notify();
}
