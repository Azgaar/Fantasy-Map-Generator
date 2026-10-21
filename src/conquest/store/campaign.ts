/**
 * campaign.ts — the in-page campaign: a command log and a replayed state.
 *
 * The server's `campaigns.ts` was never a server-shaped thing. It was an
 * event-sourced store — `createCampaign` + `applyCommand` + a `stateHash` — and
 * all of that now happens in the page (MOD-PLAN B.5). What the server owned was
 * the *I/O*: a folder of JSON files and an HTTP endpoint in front of them. Neither
 * belongs in the product, and neither is reimplemented here — Phase C moves the
 * command log into the `.map` file, Phase F deletes the server copy.
 *
 * Two properties are inherited deliberately, because they are what makes a
 * campaign a campaign rather than a save file:
 *
 *  - **the log is the state.** `apply()` appends to `commands` and mutates the
 *    live campaign; rebuilding from the log reproduces it exactly. Nothing else
 *    is persisted, and nothing else is trusted.
 *  - **every command is hashed.** `stateHash()` is recomputed after each command
 *    so the UI can show it and a test can compare two runs. It is the same
 *    function the server uses, and the same function the parity harness checks.
 */

import { type ContentPack, type ResolvedContent, resolveForPack } from "../engine/common/content";
import type { MapPack } from "../engine/common/types";
import { applyCommand } from "../engine/game/commands";
import type { Command } from "../engine/game/commandTypes";
import type { CampaignConfig } from "../engine/game/config";
import type { EngineCtx } from "../engine/game/context";
import { type Campaign, createCampaign, stateHash } from "../engine/game/state";
import { twWarn } from "../ui/fmg";

export interface CampaignHandle {
  mapPackId: string;
  factionId: number;
  seed: number;
  contentHash: string;
}

interface CampaignStoreOptions {
  pack: MapPack;
  content: ContentPack;
  config: CampaignConfig;
  /** Defaults to the resolved content for this pack. */
  resolved?: ResolvedContent;
  mapPackId?: string;
}

export interface CommandOutcome {
  ok: boolean;
  error?: string;
  stateHash: string;
}

export interface RebaseResult {
  ok: boolean;
  applied: number;
  dropped: number;
  failures: { index: number; command: Command; error: string }[];
  stateHash?: string;
  error?: string;
}

type Listener = (campaign: Campaign) => void;

/**
 * One live campaign, plus its log.
 *
 * Commands are applied to a mutable `Campaign` object exactly as the server did,
 * so engine code needed no changes at all in this phase — the engine was already
 * a set of pure functions over a mutable state.
 */
export class CampaignStore {
  /** The compiled pack's content hash — in-page compile ≡ server compile (B.6). */
  readonly packContentHash: string;

  /** The ruleset (ContentPack) hash — campaign identity, distinct from the world's. */
  get rulesetHash(): string {
    return this.content.hash;
  }

  readonly pack: MapPack;
  // Mutable as of Phase D: the ruleset is page state now, and setRules swaps it
  // atomically (a campaign is re-replayed, or the swap is refused).
  private content: ContentPack;
  private config: CampaignConfig;
  public resolved: ResolvedContent;
  private readonly mapPackId: string;

  private campaign: Campaign | null = null;
  private commands: Command[] = [];
  private hash = "";
  private listeners = new Set<Listener>();

  constructor(options: CampaignStoreOptions) {
    this.pack = options.pack;
    this.content = options.content;
    this.config = options.config;
    this.resolved = options.resolved ?? resolveForPack(options.pack, options.content);
    this.mapPackId = options.mapPackId ?? options.pack.meta.mapId;
    this.packContentHash = options.pack.meta.contentHash;
  }

  get attached(): boolean {
    return this.campaign !== null;
  }

  /** The live campaign state, or null when nothing is attached. */
  get state(): Campaign | null {
    return this.campaign;
  }

  /** The append-only log — the campaign's real identity. */
  get log(): readonly Command[] {
    return this.commands;
  }

  /** Identity of what is loaded, for the `.map` slot in Phase C. */
  handle(): CampaignHandle | null {
    if (!this.campaign) return null;
    return {
      mapPackId: this.mapPackId,
      factionId: this.campaign.factionId,
      seed: this.campaign.seed,
      contentHash: this.content.hash
    };
  }

  stateHash(): string {
    return this.hash;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  private emit(): void {
    if (!this.campaign) return;
    for (const listener of [...this.listeners]) {
      try {
        listener(this.campaign);
      } catch (error) {
        twWarn("campaign listener threw", error);
      }
    }
  }

  /** Start a campaign on this pack. Detaches any previous one. */
  create(options: { factionId: number; seed: number; id?: string; playerFactionIds?: number[] }): Campaign {
    this.detach();
    const campaign = createCampaign({
      mapPackId: this.mapPackId,
      pack: this.pack,
      factionId: options.factionId,
      seed: options.seed,
      config: this.config,
      content: this.content,
      resolved: this.resolved,
      ...(options.playerFactionIds !== undefined ? { playerFactionIds: options.playerFactionIds } : {}),
      ...(options.id ? { id: options.id } : {})
    });
    this.campaign = campaign;
    this.commands = [];
    this.hash = stateHash(campaign);
    this.emit();
    return campaign;
  }

  private ctx(): EngineCtx | null {
    if (!this.campaign) return null;
    return {
      campaign: this.campaign,
      pack: this.pack,
      config: this.config,
      content: this.content,
      resolved: this.resolved,
      commands: this.commands
    };
  }

  /**
   * Apply one command, appending it to the log.
   *
   * A rejected command is *not* logged: the log is the truth, and a log full of
   * entries that did nothing would replay into a different campaign.
   */
  apply(command: Command): CommandOutcome {
    const ctx = this.ctx();
    if (!ctx) return { ok: false, error: "no campaign attached", stateHash: this.hash };
    const before = this.commands.length;
    // applyCommand appends to ctx.commands itself (unless `internal`), which is
    // what keeps one authority over the log: pushing here as well would double
    // every entry and make a replay diverge from the run that produced it.
    const result = applyCommand(ctx, command);
    if (!result.ok) return { ok: false, error: result.error, stateHash: this.hash };
    if (this.commands.length === before) twWarn("command applied without reaching the log");
    this.hash = stateHash(this.campaign!);
    this.emit();
    return { ok: true, stateHash: this.hash };
  }

  /**
   * Rebuild the campaign from a log, the way Phase C will on load.
   *
   * Divergence throws: replaying a log that does not reproduce the campaign means
   * the log and the state disagree, which is a bug worth surfacing loudly
   * (Phase E replaces this with a tolerant variant that reports what dropped).
   */
  /**
   * Adopt a new ruleset (Phase D / D3: content is page state, editable live).
   *
   * The rules a campaign is born under are part of its identity — the state hash
   * covers them — so changing them mid-campaign means *replaying* the log under
   * the new rules, exactly like loading a file. This is therefore all-or-nothing:
   * if the replay diverges (an edit removed a unit the campaign had recruited), the
   * old rules stay live and the edit is refused. A campaign in progress can never
   * be invalidated by an edit.
   *
   * @returns the new state hash, or the error that made the swap unsafe
   */
  setRules(content: ContentPack, config: CampaignConfig): { ok: boolean; stateHash?: string; error?: string } {
    const log = [...this.commands];
    const previous = this.campaign;
    const previousContent = this.content;
    const previousConfig = this.config;
    const previousResolved = this.resolved;
    const previousHash = this.hash;

    this.content = content;
    this.config = config;
    this.resolved = resolveForPack(this.pack, content);

    if (!previous) {
      // No campaign attached: the new rules simply apply to whatever starts next.
      this.hash = "";
      return { ok: true, stateHash: "" };
    }
    const options = { factionId: previous.factionId, seed: previous.seed, id: previous.id };
    try {
      this.replay(log, options);
      return { ok: true, stateHash: this.hash };
    } catch (error) {
      // Undo the swap: the campaign keeps the rules it was born under, exactly.
      this.content = previousContent;
      this.config = previousConfig;
      this.resolved = previousResolved;
      try {
        this.replay(log, options);
      } catch {
        this.hash = previousHash;
      }
      return { ok: false, error: (error as Error).message };
    }
  }

  replay(log: readonly Command[], options: { factionId: number; seed: number; id?: string }): Campaign {
    this.create(options);
    for (const command of log) {
      const outcome = this.apply(command);
      if (!outcome.ok) {
        throw new Error(`replay diverged at ${JSON.stringify(command).slice(0, 80)}: ${outcome.error}`);
      }
    }
    const campaign = this.campaign!;
    this.emit();
    return campaign;
  }

  /**
   * Tolerant rebase: replay the log as far as it will go.
   *
   * On structural map edits (Phase E), some commands may become impossible to
   * apply (an army moved to a cell that no longer exists, a province was
   * deleted, etc). Rather than throwing and discarding the campaign, we apply
   * every command we can, collect the failures, and return a report — the
   * surviving prefix of the log remains as the campaign's history.
   */
  tolerantRebase(log: readonly Command[], options: { factionId: number; seed: number; id?: string }): RebaseResult {
    try {
      this.create(options);
      const failures: { index: number; command: Command; error: string }[] = [];
      let applied = 0;
      for (let index = 0; index < log.length; index++) {
        const command = log[index];
        const outcome = this.apply(command);
        if (!outcome.ok) {
          failures.push({ index, command, error: outcome.error ?? "unknown" });
          continue;
        }
        applied++;
      }
      const campaign = this.campaign!;
      this.emit();
      return {
        ok: failures.length === 0,
        applied,
        dropped: failures.length,
        failures,
        stateHash: stateHash(campaign)
      };
    } catch (error) {
      const message = (error as Error).message;
      return { ok: false, applied: 0, dropped: log.length, failures: [], error: message };
    }
  }

  /** Drop the campaign. The pack and content stay loaded. */
  detach(): void {
    if (!this.campaign) return;
    this.campaign = null;
    this.commands = [];
    this.hash = "";
    this.emit();
  }
}

/** A deterministic seed for a campaign on a given world. */
export function seedForWorld(mapPackId: string, salt = ""): number {
  let h = 1779033703 ^ mapPackId.length;
  const text = `${mapPackId}:${salt}`;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  return (h ^ (h >>> 13)) >>> 0;
}
