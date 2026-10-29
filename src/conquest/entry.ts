/**
 * entry.ts — the single module the FMG fork loads.
 *
 * Injected by the build (see build/inject.ts) and nothing else. Its whole job is
 * to stand Total War up inside a running FMG:
 *
 *   1. publish the engine on the global scope (the compile Worker imports this
 *      very file and finds it there)
 *   2. adopt FMG's globals (one seam: ui/fmg.ts)
 *   3. publish our layer labels/hotkeys and register our layers (A.2)
 *   4. install the ⚔ button, its menu and the right-hand rail (A.5, A.6)
 *   5. claim our line in the `.map` file
 *   6. follow FMG's world lifecycle: compile the new world and rebind the session
 *
 * The ordering is load-bearing. Layers register *before* a map loads, so FMG's own
 * `Layers.restore()` applies the visibility a saved `.map` asked for — register
 * later and every Total War layer would come up off, ignoring the file.
 *
 * This module also runs *outside a browser*: the compile Worker imports it to get
 * the engine (host/compiler.ts). Everything DOM-shaped therefore sits behind
 * `boot()`, which only the document branch ever calls.
 */
import { bootstrapConfigLibrary, currentContent, rulesSummary } from "./content/store";
import type { ContentPack, RawContentDocs } from "./engine/common/content";
import { azgaarMapFromSnapshot, type FmgWorldSnapshot, structuralSignature } from "./engine/compile/from-fmg";
import { type CompileRequest, type CompileResponse, handleRequest } from "./engine/compile/worker-protocol";
import type { AzgaarMap } from "./engine/compiler/azgaar";
import { worldPackId } from "./engine/compiler/index";
import type { Command } from "./engine/game/commandTypes";
import type { CampaignConfig } from "./engine/game/config";
import { compileSnapshot, disposeCompiler } from "./host/compiler";
import { snapshotFromFmg } from "./host/world-snapshot";
import { type CampaignHandle, CampaignStore, type CommandOutcome, type RebaseResult } from "./store/campaign";
import { loadSlot } from "./store/mod-slot";
import {
  adoptFromSlot,
  adoptRulesFromSlot,
  afterRebase,
  archiveCampaign,
  clearSession,
  currentSession,
  dispatchCommand,
  editConfig,
  editContent,
  flushMirror,
  currentArchive as rebaseArchive,
  resetRules,
  setSession,
  startCampaign,
  type TwSession
} from "./store/session";
import { installButton, registerCommands, toggleTotalWarMenu } from "./ui/button";
import { fmg, fmgFigures, twWarn, whenFmgReady } from "./ui/fmg";
import {
  installZoomRedraw,
  onWorldReplaced,
  registerLayerButtons,
  registerLayers,
  twLayerIds
} from "./ui/layers/index";
import { showLogDialog } from "./ui/log";
import { installRail } from "./ui/panels/rail";
import { lastRebase, recordRebase, showRebaseReport } from "./ui/rebase";
import { installSelection } from "./ui/selection";
import { getSelection, getSource, installWorldSync, onSelection, redrawLayers } from "./ui/session";
import { installStyles } from "./ui/style";

let booted = false;
let compiling = false;
let lastCompiledSig = "";
let compiles = 0;

/** The snapshot the current pack was compiled from — kept for the parity harness. */
let lastSnapshot: FmgWorldSnapshot | null = null;

declare global {
  var OpenConquest: typeof TotalWar;
  var TotalWar: {
    layers: () => string[];
    version: string;
    menu: typeof toggleTotalWarMenu;
    /** what the layers currently see — the first thing to look at in a console */
    stats: () => {
      /** false if boot threw part-way — the first thing to check in a console */
      booted: boolean;
      empty: boolean;
      regions: number;
      settlements: number;
      armies: number;
      width: number;
      height: number;
      selection: string;
      /** the compiled world — present as soon as a map has been compiled */
      world: {
        packId: string;
        factionCount: number;
        regionCount: number;
        settlementCount: number;
        armyCount: number;
        landCellCount: number;
        landEdgeCount: number;
        compileMs: number;
        ran: string;
      } | null;
      /** the campaign attached to it — null until one is started */
      campaign: {
        id: string;
        factionId: number;
        turn: number;
        commands: number;
        stateHash: string;
      } | null;
    };
    /** Present so the compile Worker can call back into the engine (B.4). */
    engine?: { handleCompileRequest: (request: CompileRequest) => CompileResponse };
    /** The full state hash of the attached campaign ("" when none). */
    stateHash: () => string;
    /** The identity of the campaign, for the `.map` slot in Phase C. */
    handle: () => CampaignHandle | null;
    /**
     * The live ruleset (Phase D: page state, so it can change under a running
     * campaign). The parity harness pins the server to whatever this returns.
     */
    content: () => ContentPack;
    /**
     * The live game config, pinned for parity alongside `content()`: the server
     * otherwise loads its own game.json while the page runs these values, and two
     * different tax rates produce two different treasuries — a divergence that
     * looks like an engine bug and is not one.
     */
    config: () => CampaignConfig;
    /**
     * The live content *docs* — what the editors mutate and what the `.map` slot
     * carries. Distinct from `content()`, which is the validated pack.
     */
    contentDocs: () => RawContentDocs;
    /** Apply edited content docs (validated, then the log is re-replayed). */
    setContent: (docs: unknown) => { ok: boolean; errors: string[]; warnings: string[] };
    /** Apply an edited game config. */
    setConfig: (config: CampaignConfig) => { ok: boolean; errors: string[]; warnings: string[] };
    /** Back to the shipped ruleset. */
    resetRules: () => { ok: boolean; errors: string[]; warnings: string[] };
    /** The content summary line the editors show ("edited · 9124d357"). */
    rulesSummary: () => string;
    /** What the last structural rebase did (null before the first one). */
    rebase: () => {
      at: number;
      applied: number;
      dropped: number;
      escalated: boolean;
      reason?: string;
      failures: number;
    } | null;
    /** A campaign a rebase had to archive, if any. */
    archive: () => { id: string; turn: number; commands: number } | null;
    /** The rebase report dialog — also reachable from the ⚔ menu. */
    showRebaseReport: () => void;
    /** The campaign log dialog — also on the ⚔ menu's Campaign rows. */
    showLog: () => void;
    /** The compiled pack's content hash: in-page compile ≡ server compile. */
    packContentHash: () => string;
    /**
     * The exact input the in-page compile consumed.
     *
     * Exists for the parity harness (B.6): posting this to the server's
     * `/mappacks/compile` makes the two compilers run on identical bytes, so a
     * differing hash can only mean the compilers disagree. Phase F deletes it
     * with the harness.
     */
    compileInput: () => AzgaarMap | null;
    session: () => TwSession | null;
    startCampaign: (factionId?: number) => CommandOutcome | null;
    dispatch: (command: Command) => CommandOutcome | null;
    dispose?: () => void;
  };
}

// The engine half has no DOM in it, so it is published unconditionally: the
// Worker imports this module and looks for exactly this.
globalThis.TotalWar = {
  layers: twLayerIds,
  version: "0.3.0-phaseB",
  menu: toggleTotalWarMenu,
  stats: () => {
    const source = getSource();
    const live = currentSession();
    const store = live?.store;
    return {
      booted,
      empty: source.empty,
      regions: source.regions().length,
      settlements: source.settlements().length,
      armies: source.armies().length,
      width: source.width,
      height: source.height,
      selection: JSON.stringify(getSelection()),
      world: live
        ? {
            packId: live.packId,
            factionCount: live.factionNames.length,
            regionCount: live.regionCount,
            settlementCount: live.settlementCount,
            armyCount: live.armyCount,
            landCellCount: live.landCellCount,
            landEdgeCount: live.landEdgeCount,
            compileMs: Math.round(live.compileMs),
            ran: live.ran,
            compiles
          }
        : null,
      campaign:
        live && store?.state
          ? {
              id: store.state.id,
              factionId: store.state.factionId,
              turn: store.state.turn,
              commands: store.log.length,
              stateHash: store.stateHash().slice(0, 12)
            }
          : null,
      rebase: lastRebase() ? { ...lastRebase()!, failures: lastRebase()!.failures.length } : null,
      archive: rebaseArchive()
        ? { id: rebaseArchive()!.id, turn: rebaseArchive()!.turn, commands: rebaseArchive()!.commands }
        : null
    };
  },
  engine: { handleCompileRequest: handleRequest },
  stateHash: () => currentSession()?.store.stateHash() ?? "",
  handle: () => currentSession()?.store.handle() ?? null,
  content: () => currentContent().content,
  config: () => currentContent().config,
  contentDocs: () => structuredClone(currentContent().docs),
  setContent: docs => editContent(docs as RawContentDocs),
  setConfig: config => editConfig(config),
  resetRules: () => resetRules(),
  rulesSummary: () => rulesSummary(),
  rebase: () => {
    const record = lastRebase();
    return record ? { ...record, failures: record.failures.length } : null;
  },
  archive: () => {
    const archived = rebaseArchive();
    return archived ? { id: archived.id, turn: archived.turn, commands: archived.commands } : null;
  },
  showRebaseReport: () => showRebaseReport(),
  showLog: () => showLogDialog(),
  packContentHash: () => currentSession()?.store.packContentHash ?? "",
  compileInput: () => (lastSnapshot ? azgaarMapFromSnapshot(lastSnapshot) : null),
  session: currentSession,
  startCampaign: (factionId?: number) => startCampaign(factionId),
  dispatch: (command: Command) => dispatchCommand(command)
};
globalThis.OpenConquest = globalThis.TotalWar;

async function compileWorld(): Promise<void> {
  return compileWorldScheduled();
}

/**
 * Compile the loaded world and rebind the session — Phase E's three policies.
 *
 * This runs debounced (800ms) after `map:generated` *and* after every FMG edit
 * that repaints a layer (`installEditWatch` below). Which of E.3's policies
 * applies is decided here, from two cheap questions:
 *
 *  - **Is this the same live world?** FMG's editors mutate `pack` in place, so
 *    the snapshot's array *references* persist across edits; generate/load build
 *    fresh objects. Reference equality is a free and exact world-identity test.
 *  - **Did the structure change?** `structuralSignature` — a hash over just the
 *    columns and id sets the compiler reads (~60 KB, microseconds).
 *
 * Same world + unchanged signature → *cosmetic only*: nothing at all (E.3a — the
 * one hash is the entire cost). Otherwise compile; and if a campaign is live on
 * this world, **rebase** its log onto the new pack tolerantly (E.3c/E.4), or
 * escalate to archive + detach when even that cannot work (E.5). A genuinely new
 * world takes the Phase C path: adopt the map's own rules, then its campaign.
 */
function debounce<T extends (...args: unknown[]) => unknown>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: unknown[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void fn(...args);
    }, ms);
  }) as T;
}

/** E.2: editors fire many repaints in a burst; one compile per quiet 800ms. */
const compileWorldScheduled = debounce(async () => {
  await compileWorldImpl();
}, 800);

async function compileWorldImpl(): Promise<void> {
  // An edit that lands while a compile is in flight must not be dropped: the
  // in-flight compile snapshot the world *before* that edit, so the edit still
  // exists only as an unpainted promise. Reschedule — the re-run snapshots the
  // world as it is now, and the signature check absorbs it if nothing changed.
  if (compiling) {
    compileWorldScheduled();
    return;
  }
  compiling = true;
  try {
    // Snapshot inside the try: a throw here used to escape as an unhandled
    // rejection, and a silent campaign layer is the worst possible symptom.
    const snapshot = snapshotFromFmg();
    if (!snapshot) {
      // Normal exactly once: boot runs before a world is loaded. After that a
      // missing world means the user closed or replaced the map, which is not
      // worth a warning.
      if (booted) twWarn("no world on screen — skipping the compile");
      return;
    }
    const previous = currentSession();
    const previousSnapshot = lastSnapshot;
    lastSnapshot = snapshot;
    const signature = structuralSignature(snapshot);

    // "Same live world" is decided by *object identity of FMG's own arrays*:
    // `snapshotFromFmg` copies the cell columns (so the worker cannot race FMG's
    // writes), but passes the entity arrays through by reference. FMG's editors
    // mutate `pack.states` and friends in place — the reference survives an edit
    // session — while generate and load build a fresh `pack`, and with it fresh
    // arrays. A copied column would have made every edit look like a new world;
    // this check is what tells "the player moved a border" from "the player
    // loaded a different map".
    const sameWorld =
      previous != null &&
      previousSnapshot != null &&
      snapshot.states === previousSnapshot.states &&
      snapshot.burgs === previousSnapshot.burgs;
    // E.3a: an edit that only touched cosmetics lands here — one hash, no compile.
    if (sameWorld && signature === lastCompiledSig) return;

    compiles += 1;
    const result = await compileSnapshot(snapshot);
    // Same naming function the harness uses, because this string becomes the
    // campaign's mapPackId — and therefore part of its state hash.
    const packId = worldPackId(result.pack.meta.name, result.pack.meta.azgaarSeed);
    const live = currentContent();
    const store = new CampaignStore({
      pack: result.pack,
      content: live.content,
      config: live.config,
      mapPackId: packId,
      figures: fmgFigures() ?? undefined
    });

    let report: RebaseResult | null = null;
    if (sameWorld && previous.store.state) {
      // E.3c/E.4 — a structural edit under a live campaign: rebase, don't discard.
      // The new pack may have renamed nothing and moved borders only; it may have
      // deleted the province an army stood in. Tolerant replay keeps what works
      // and reports what does not, which is also what makes FMG's undo work for
      // free: an undo is just another structural edit, and this runs again.
      const old = previous.store.state;
      report = store.tolerantRebase([...previous.store.log], {
        factionId: old.factionId,
        seed: old.seed,
        id: old.id
      });
      if (report.error) {
        // E.5 — the campaign cannot even be created on the new world (its own
        // faction may be gone). Archive the log and continue with no campaign:
        // never silently discard.
        archiveCampaign([...previous.store.log], old, report.error);
        store.detach();
      }
    }

    setSession({
      store,
      packId,
      factionNames: result.pack.factions.map(faction => ({ id: faction.id, name: faction.name })),
      regionCount: result.pack.regions.length,
      settlementCount: result.pack.settlements.length,
      armyCount: result.pack.armies.length,
      landCellCount: result.pack.graph.land.cells.length,
      landEdgeCount: result.pack.graph.land.edges.length,
      compileMs: result.elapsedMs,
      ran: result.ran
    });
    console.info(
      `[openconquest] compiled ${packId} in ${Math.round(result.elapsedMs)}ms (${result.ran} thread) — ` +
        `${result.pack.regions.length} regions, ${result.pack.factions.length} factions`
    );

    if (sameWorld) {
      // The rules did not change (that is Phase D's path), but the log did: the
      // surviving commands must reach the slot and the mirror.
      if (report) afterRebase();
    } else {
      // The stored slot has been read by now (loadSlot rides the world-sync
      // callback and is awaited nowhere else because IndexedDB answers long
      // before this debounce expires) — but be exact and await it anyway.
      await loadSlot();

      // The map may carry its own ruleset. Adopt them *before* the campaign:
      // the campaign's contentHash is the ruleset hash, so the rules have to be
      // in place for that check to mean anything. The store above was built with
      // the shipped rules, so a map carrying its own needs the swap too — no
      // campaign is attached yet, so this cannot invalidate anything.
      if (adoptRulesFromSlot()) store.setRules(currentContent().content, currentContent().config);

      // Phase C: the map may have carried a campaign. It could only be *held* during
      // load (there was no pack to replay against yet), so adopt it now — this is
      // the moment "a .map file carries its campaign" actually happens.
      const adopted = adoptFromSlot();
      if (adopted.adopted) {
        const campaign = store.state;
        console.info(
          `[openconquest] campaign ${campaign?.id} restored from this map — turn ${campaign?.turn}, ` +
            `${store.log.length} commands`
        );
      } else if (adopted.reason && adopted.reason !== "no campaign in this map") {
        twWarn(`campaign in this map was not attached: ${adopted.reason}`);
      }
    }

    lastCompiledSig = signature;
    if (report) recordRebase(report);
  } catch (error) {
    clearSession();
    twWarn("world compile failed — the campaign layer stays off", error);
  } finally {
    compiling = false;
  }
}

/**
 * Recompile on a debounce (E.2), triggered by FMG's own repaint calls.
 *
 * `installEditWatch` wraps `Layers.draw`, which every editor calls after it has
 * finished mutating `pack` — states, provinces, burgs, heightmap, biomes, all of
 * them. That makes the hook event-driven (no DOM polling) and total: any editor
 * that repaints is an editor that edited. Layer *visibility* toggles also come
 * through here and are filtered out for free by the signature check.
 */
function installEditWatch(): void {
  const registry = fmg()?.Layers as { draw?: (...ids: string[]) => void; drawAll?: () => void } | undefined;
  if (!registry || typeof registry.draw !== "function") return;
  const originalDraw = registry.draw.bind(registry);
  registry.draw = (...ids: string[]) => {
    originalDraw(...ids);
    // Our own layer redraws are not edits.
    if (!ids.every(id => typeof id === "string" && id.startsWith("tw"))) compileWorld();
  };
  if (typeof registry.drawAll === "function") {
    const originalDrawAll = registry.drawAll.bind(registry);
    registry.drawAll = () => {
      originalDrawAll();
      compileWorld();
    };
  }
}

/** Set only once every step of boot has completed. See `TotalWar.stats().booted`. */
function boot(): void {
  try {
    bootUnsafe();
  } catch (error) {
    twWarn("boot failed — Total War is disabled, FMG is unaffected", error);
  }
}

function bootUnsafe(): void {
  // ORDER MATTERS: FMG's Layers tab re-renders on the emit() that register()
  // causes, and it only emits a button for layers that have a LAYER_TOGGLES
  // entry. Seeding the table first is what puts our layers in the tab at all;
  // registering first would work, and then show an empty list until something
  // else triggered a re-render.
  const buttons = registerLayerButtons();
  const ids = registerLayers();
  const commands = registerCommands();

  installStyles();
  installButton();
  installRail();

  // The saved config library (culture groups) lands off the boot path: the page
  // starts on shipped rules and the library merges in when IndexedDB answers.
  void bootstrapConfigLibrary();

  // The zoom handle must exist BEFORE installWorldSync, which runs its first sync
  // synchronously: a callback closing over a later `const` is a TDZ ReferenceError
  // that aborts the rest of boot. It did, once, and the half-wired mod it left
  // behind (layers registered, click handler missing) is exactly what `booted`
  // now guards against.
  const zoom = installZoomRedraw();
  const unsubscribeSelection = onSelection(() => {});
  const uninstallSelection = installSelection({
    regionAt: cellId => getSource().regionOf(cellId)?.id ?? null,
    armyAt: cellId =>
      getSource()
        .armies()
        .find(army => army.cell === cellId)?.id ?? null
  });
  const uninstallWorld = installWorldSync(allIds => {
    void loadSlot(); // the map's stored slot, read while the debounced compile pends
    onWorldReplaced();
    zoom.rebind(); // FMG swapped #map (and #viewbox) — re-arm before it matters
    redrawLayers(allIds);
    void compileWorld();
  });

  // Phase E: FMG's editors announce their edits by repainting. The watch wraps
  // that path, so a structural edit reaches the debounced compile without any
  // DOM polling and without FMG knowing we are here.
  installEditWatch();

  booted = true;

  console.info(
    `[openconquest] booted — FMG ${fmg() ? "detected" : "missing"}, layers: ${ids.length ? ids.join(", ") : "none"}, ` +
      `tab buttons: ${buttons.length}, commands: ${commands.length}`
  );
  if (!ids.length) twWarn("registered no layers — check the Layers registry");
  if (!buttons.length) twWarn("no Layers-tab buttons — check LAYER_TOGGLES");
  if (!commands.length) twWarn("no omnibar commands — check MAP_COMMANDS");

  // The handles above are the cleanup path if a future phase hot-unloads the mod;
  // for now they are held so the wiring is inspectable from the console.
  globalThis.TotalWar.dispose = (): void => {
    uninstallSelection();
    uninstallWorld();
    unsubscribeSelection();
    zoom.dispose();
    flushMirror();
    disposeCompiler();
  };
}

// No `document` means we are inside the compile Worker: the engine above is all it
// needs, and touching the DOM here would throw inside the worker's first import.
if (typeof document !== "undefined") whenFmgReady(boot);
