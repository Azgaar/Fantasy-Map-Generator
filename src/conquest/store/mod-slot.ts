/**
 * mod-slot.ts — the campaign's slot state, persisted in the browser store.
 *
 * The campaign is the **command log, never the state**: the log is small,
 * append-only and replayable, and replay is already the engine's contract. `turn`
 * is carried as a convenience for display only — it is rederived by the replay
 * and a mismatch is reported rather than trusted.
 *
 * This module is the single owner of the slot's shape. Everything else (the
 * store, the menu, the mirror) reads and writes through here, so the on-disk
 * contract has exactly one definition. It persists to IndexedDB (the app's `ldb`
 * helper) **keyed by map id**: a campaign is a session over a world, not map
 * data, so it deliberately does not travel inside the `.map` file. The mirror
 * (store/mirror.ts) is a second, pack-keyed copy kept as insurance.
 *
 * Restore timing is the subtle part. The slot is loaded when FMG announces a
 * world (`map:generated`), but the world has not compiled yet — there is no pack
 * to replay against. So a loaded payload is held as "pending" and adopted by the
 * session once the compile lands (see `store/session.ts`).
 */

import { LocalDB } from "@/services/local-db";
import type { SlotContent } from "../content/store";
import type { Command } from "../engine/game/commandTypes";
import { fmg, twWarn } from "../ui/fmg";

/** Slot schema version, so a future migration knows what it is reading. */
export const SLOT_VERSION = 1;

/** The campaign as it is stored for a map. */
export interface CampaignSlot {
  /** human-readable campaign id (deterministic: `<pack>-<seed>`) */
  id: string;
  /** which compiled pack the log belongs to — a mismatch means "do not replay" */
  mapPackId: string;
  factionId: number;
  seed: number;
  /** convenience only; the replay recomputes it */
  turn: number;
  /**
   * The **ruleset** hash (the ContentPack: rosters, costs, rules). A mismatch
   * means the campaign was played under different rules — refused, Phase E may
   * soften this. Not the world hash below; the two are easy to confuse, which is
   * why they have different names.
   */
  contentHash: string;
  /**
   * The **world** content hash (pack.meta.contentHash). `mapPackId` already
   * pins name+seed, but two edits of one map share those; this pins the bytes.
   */
  worldHash: string;
  /** the append-only command log — this IS the campaign */
  commands: Command[];
}

export interface TotalWarSlot {
  v: number;
  campaign?: CampaignSlot;
  /**
   * The map's own ruleset: content travels with the map's stored state, so a
   * shared repo carries the rules it was played under. Absent when the map plays
   * by the shipped rules.
   */
  settings?: SlotContent;
  ui?: {
    /** Total War layer ids the player had on */
    layers?: string[];
    /** the Total War menu's mode: "campaign" (playing) | "cartographer" (editing) */
    mode?: "campaign" | "cartographer";
    /** the last layer preset applied from the ⚔ menu (see ui/presets.ts) */
    preset?: string;
  };
}

/** In-memory copy of what we last wrote or read. */
let slot: TotalWarSlot = { v: SLOT_VERSION };

/** A payload handed over by storage, waiting for a pack to replay against. */
let pending: TotalWarSlot | null = null;

/** The map the in-memory slot belongs to, so a world switch drops stale state. */
let currentMapId: number | string | null = null;
let loaded: Promise<void> | null = null;

export const getSlot = (): TotalWarSlot => slot;

export function setSlot(next: Partial<TotalWarSlot>): void {
  slot = { ...slot, ...next, v: SLOT_VERSION };
  persist();
}

/** The payload from storage for the map being loaded, or null. Consumed by the session. */
export const pendingSlot = (): TotalWarSlot | null => pending;

export function clearPendingSlot(): void {
  pending = null;
}

/** Adopt FMG's saved layer state so we persist what is actually on screen. */
function readLayersFromFmg(): string[] {
  try {
    const registry = fmg()?.Layers;
    if (!registry) return slot.ui?.layers ?? [];
    // `active` holds every user-controlled layer; ours are the tw-prefixed ones.
    // FMG's own save already restores these (Layers.restore), so this is a record
    // for exports, not the mechanism.
    return registry.state.active.filter(id => id.startsWith("tw"));
  } catch {
    return slot.ui?.layers ?? [];
  }
}

/** The on-screen map's id (the last entry of `mapHistory`), or null before one loads. */
function mapId(): number | string | null {
  return fmg()?.mapHistory?.at(-1)?.created ?? null;
}

/**
 * Build the campaign portion of the slot from the live campaign and its log.
 *
 * Two arguments rather than one, because a campaign's state and its command log
 * are genuinely separate things: the state is rederived by replay, and only the
 * log is persisted. The commands are copied, not referenced — the log keeps
 * growing, and the slot must describe the moment it was written.
 */
export function campaignSlotOf(
  campaign: { id: string; mapPackId: string; factionId: number; seed: number; turn: number; contentHash: string },
  commands: readonly Command[],
  worldHash: string
): CampaignSlot {
  return {
    id: campaign.id,
    mapPackId: campaign.mapPackId,
    factionId: campaign.factionId,
    seed: campaign.seed,
    turn: campaign.turn,
    contentHash: campaign.contentHash,
    worldHash,
    commands: commands.map(command => structuredClone(command))
  };
}

/**
 * Write the slot to the browser store, keyed by the map it belongs to. Debounced:
 * every command republishes the slot, and the writes are identical-but-for the log.
 */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist(): void {
  const id = mapId();
  if (id === null) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const layers = readLayersFromFmg();
      const ui: NonNullable<TotalWarSlot["ui"]> = { ...slot.ui };
      if (layers.length) ui.layers = layers;
      const payload: TotalWarSlot = { v: SLOT_VERSION, ...(Object.keys(ui).length ? { ui } : {}) };
      if (slot.campaign) payload.campaign = slot.campaign;
      if (slot.settings) payload.settings = slot.settings;
      void LocalDB.set(`conquest-${id}`, JSON.stringify(payload)).catch(error => twWarn("slot persistence failed", error));
    } catch (error) {
      twWarn("slot serialization failed", error);
    }
  }, 400);
}

/** Adopt a stored payload: it becomes the slot, and its campaign is held as pending. */
function adopt(raw: unknown): void {
  if (raw === null || typeof raw !== "object") return;
  const parsed = raw as Partial<TotalWarSlot>;
  if (parsed.v !== SLOT_VERSION) {
    twWarn(`stored slot has version ${String(parsed.v)} — this build reads ${SLOT_VERSION}; ignoring it`);
    return;
  }
  // Every section, including `settings`: the session reads the map's own ruleset
  // from here before it adopts the map's campaign, and a drop here is silent —
  // the map opens with shipped rules and its campaign refuses to attach.
  slot = { v: SLOT_VERSION, ui: parsed.ui, campaign: parsed.campaign, settings: parsed.settings };
  // Held, not applied: there is no pack yet. The session adopts it after compiling.
  pending = parsed.campaign ? { ...slot, campaign: parsed.campaign } : null;
}

/**
 * Load the on-screen map's slot from the browser store. Resolves once the slot is
 * in memory; the entry awaits it before the session adopts anything. Idempotent
 * per map — a second call for the same map resolves immediately.
 */
export function loadSlot(): Promise<void> {
  const id = mapId();
  if (id === null) return Promise.resolve();
  if (id === currentMapId && loaded) return loaded;
  currentMapId = id;
  slot = { v: SLOT_VERSION };
  pending = null;
  loaded = LocalDB.get<string>(`conquest-${id}`)
    .then(stored => {
      if (!stored) return;
      try {
        adopt(JSON.parse(stored));
      } catch (error) {
        twWarn("stored slot could not be parsed", error);
      }
    })
    .catch(error => twWarn("slot storage unavailable — the campaign will not resume", error));
  return loaded;
}
