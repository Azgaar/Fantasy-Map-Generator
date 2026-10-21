# Proposal — Three Mod Seams for Stock FMG

> **Status: superseded for our own use, still valid as an upstream proposal.** The upstream lead's
> guidance is that mods maintain the fork format — a full fork gives a mod full developmental
> control, and merging upstream is not an obstacle. Our own mods therefore live in this fork
> (Astral Cartographer's content in core, OpenConquest under `src/conquest/`), and the three seams
> below are implemented in-tree: `LayersRegistry.register(...)`, `window.LAYER_TOGGLES` and
> `window.MAP_COMMANDS`. See [mod-merge-plan.md](mod-merge-plan.md) for the decision record.
>
> The proposal stays here because the seams remain a legitimate contribution to upstream: with them
> in stock FMG, a mod could run on a true stock build — even from a userscript — instead of a
> vendored fork. The three-patch series this proposal was written against lives in the OpenConquest
> repository and is still the smallest possible diff.

A pitch prepared for the upstream FMG GitHub Discussions board. The working patches live in
OpenConquest (`openconquest/build/patches/`) and ship in the vendored client of Astral Cartographer
(`clients/fmg/dist`), both against FMG 1.154.x.

---

**Suggested title:** `Proposal: three tiny mod seams — Layers.register, a reserved .map mod line, and public MAP_COMMANDS / LAYER_TOGGLES`

**Suggested category:** Ideas (or Feature requests, wherever fits)

---

## Summary

FMG has an ecosystem trying to happen around it: culture-set mods, namebase packs, custom layers, total reskins. Today every one of them faces the same choice — fork the whole repo (and age badly against upstream), or ship a userscript that reaches into minified internals (and breaks on every release).

I'd like to propose **three small, additive seams** that make mods first-class without changing FMG for anyone who doesn't use one:

1. **`Layers.register(...)`** — let a mod add a layer that participates in the Layers tab, visibility toggles, hotkeys and save/restore like a native one.
2. **A reserved, namespaced mod line in the `.map` format** — so a mod's data travels with a saved map.
3. **`window.MAP_COMMANDS` and `window.LAYER_TOGGLES`** — let a mod add entries to the command palette / hotkey system.

No plugin loader, no API-stability promises, no bundling of third-party code, no new UI. Vanilla FMG stays byte-for-byte vanilla unless a mod is actually loaded. **Total cost: ~120 lines, most of it one new 44-line file.**

## The problem today

I'm building two mods on FMG — a grand-strategy layer and a sci-fi star-map reskin — and both started the same way: vendor a prebuilt FMG, then maintain a small private patch series to open the seams above. Every FMG release means re-vendoring and re-patching. Every other mod author I've seen do this has the same three patches, slightly differently. Meanwhile simpler mods (namebase packs) are installed by hand through four dialog steps, and die when a map reload replaces `Names.nameBases`.

The patterns are converging. I think they're worth adopting once, officially, instead of N times in N forks.

## The three seams

### 1. `Layers.register(...)` (~20 lines in `components/layers.ts`)

Export `LayerParams`, add a `register()` method to `LayersRegistry` that accepts bare params (so a separately-bundled mod never imports the module), initialize immediately, and widen `LayerId` to accept registered string ids. A registered layer joins the same ordering, visibility and save/restore flow as native layers — the Layers tab just gains entries.

### 2. A reserved mod line in the `.map` format (one 44-line file + one line each in save/load)

A new `services/io/mod-slot.ts`: a mod registers `{ serialize, restore }`; saving appends one trailing record (**omitted entirely when empty, so stock saves stay unchanged**); loading hands the parsed line back. Error-isolated so a failing mod can never cost a player their map.

Two design points I'd change from my own working version, since this would be official:

- **Namespacing**: my patch lets one mod own the line; upstream should make it an object keyed by mod id, so several mods coexist: `{"astral": {...}, "legends": {...}}`.
- **Reservation is the real argument for doing this upstream**: today's `.map` format is positional (`data[52]` = journeys…). Only you can guarantee index 53 stays reserved for mods forever. A fork can't — the first upstream feature that claims record 53 silently corrupts every modded map in the wild. Related: the auto-update migrations would need to carry the mod line through untouched (I believe they rewrite known records only, but that's exactly the kind of invariant worth making explicit in-repo).

### 3. `window.MAP_COMMANDS` / `window.LAYER_TOGGLES` (~14 lines)

The palette and hotkeys already iterate these structures; exposing them lets a mod append a command (`{id, name, aliases, run}`) or label a custom layer's toggle. The omnibar picks mod commands up with zero changes.

## Compatibility — the honest table

| Scenario | Result |
|---|---|
| No mod loaded | Saves byte-identical to today (slot line omitted) |
| Modded map opened in stock FMG | Loads fine; loader reads are already guarded per-record, so the extra line is ignored. Mod features are absent; the line survives until re-saved |
| Modded map **re-saved** in stock FMG | Mod line is dropped (stock doesn't know it). Degradation, not corruption — the map itself is untouched |
| Old map in new FMG | No mod line present → mods get `undefined` and skip restore. Same as today |
| Site / Electron / offline | Nothing changes; seams are inert without a mod script |

That last column of row 3 is the one real trade-off: a stock user editing a modded map loses the mod's data on save. I think that's the correct failure mode — better than forks, where the whole map format diverges — but it should be a conscious, documented decision.

## What this is not

- **Not a plugin system.** No discovery, no loading UI, no sandboxing. A mod is still a script the user deliberately loads (module tag, userscript, Electron) — the same trust model as userscripts today.
- **Not an API-stability promise.** Mods reach `pack`, `Layers`, `Controllers` like userscripts do; they break on major internal changes just as they do now. The seams only guarantee the three integration points.
- **Not a bundle-size or perf change.** All three are inert without a mod.

## Proof it works

Both seam-sets are implemented and shipped against 1.154.x:

- **OpenConquest: Atlas Invictus** — a grand-strategy mod, uses all three (custom campaign layers, mod slot for campaign state, palette commands).
- **Astral Cartographer** — a sci-fi star-map reskin, built on the same vendored client: registers its content layers, persists via the slot, adds palette commands.

The diffs total ~120 lines and touch four files (`layers.ts`, `map-commands.ts`, `layer-labels.ts`, save/load) plus the new `mod-slot.ts`. I'm happy to open them as three PRs against current master, each with tests, or discuss the shape here first — in particular whether you'd want the mod slot namespaced-per-mod from day one, and where the "reserved record" invariant should be documented so it never gets reused accidentally.
