# PRD: AI Chat — Conversational Map Control

## Problem Statement

FMG has an enormous surface. Every dialog, layer, style option and entity type is reachable, but
only by knowing where it lives. A user who wants "list every landlocked state with more than three
burgs" or "make all ports in Kelmora capitals" has no path at all — those aren't features, they're
_combinations_ of features, and there is a combinatorial number of them.

## Solution

Give the model **one tool: `run(code)`**, executed as JavaScript in the page, against the real
`pack`/`grid`. The model isn't handed 3000 commands; it is handed the data model and composes
whatever it needs. Loops, filters, joins and aggregations happen in its script, locally, in
milliseconds — and only the script's _return value_ re-enters the conversation, so a query over
10 000 cells costs a few hundred tokens.

There is no new API to write. FMG already exposes almost everything as a global: `pack` and `grid`
for data, generator singletons (`Burgs`, `States`, `Cultures`, `Goods`, …) for operations that hold
invariants, `draw*`/`toggle*` for rendering, `zoomTo`/`scale`/`viewX`/`viewY` for the view,
`options` and `style` for configuration, and the `Controllers`/`Services` registries for dialogs
and IO. A script running in page scope can already do essentially anything a user can.

```js
// what the model writes for "make large coastal burgs in Kelmora ports"
const state = pack.states.find(s => s.name === "Kelmora");
const targets = pack.burgs.filter(
  b => b.i && !b.removed && b.state === state.i && b.population > 5 && pack.cells.haven[b.cell]
);
targets.forEach(b => (b.port = pack.cells.haven[b.cell]));
drawLayers();
return { changed: targets.map(b => b.name) };
```

Everything else in this document is the scaffolding that makes that call trustworthy: how the model
learns a surface that is actively changing, what comes back when the script throws, and how the user
undoes a script that did the wrong thing.

## Non-goals

- **A curated `api` facade.** FMG is mid-migration; a hand-written wrapper would freeze names that
  are deliberately in motion, become a second surface to maintain, and be stale the week after it
  ships. The model targets the real globals and learns them by **reflection at runtime**, not from a
  frozen contract. Drift is designed out rather than defended against.
- **Prompt-injection and data-privacy hardening.** The map runs on the user's machine, with the
  user's own API key, on data the user owns. Map text flowing back into the model is not a threat
  model we defend against.
- **Any server component.** No hosting, no proxy, no accounts.
- **MCP** in the Prototype or MVP. It is an Ideal-state item, and only as an additional transport
  over the same `run` tool.
- **Provider-hosted code execution / Programmatic Tool Calling.** The model's code would run in the
  provider's sandbox, making every `pack.cells` access a network round trip. Wrong side of the wire.
- **Replacing the editors.** Chat is a second way in, not a migration path for the UI.
- **Sandboxing the model's code from the page.** Isolation buys nothing here; blast-radius control
  comes from snapshots and undo, not from a Worker boundary that would cost a full `pack` clone per
  call — and would cut the script off from the globals that make it useful.

## Shared architecture

All three stages build the same object; each stage adds a layer.

### Module layout

```
src/services/agent/
  runtime.ts      # compile + execute + capture + serialize the result
  context.ts      # assembles the cached system prefix
  inventory.ts    # generated globals inventory (build artifact, never hand-edited)
  providers.ts    # tool-calling adapters (anthropic | openai | ollama)
  snapshot.ts     # clone, restore, diff
src/controllers/ai-chat.ts   # the dock UI, registered in controllers/index.ts
```

`ai-chat.ts` owns its own dialog markup and injects it into `#dialogs`, per the existing controller
convention. `src/services/agent/` sits below controllers and imports nothing from them — it reaches
the app the same way the model's script does, through globals.

### The runtime

```ts
interface RunResult {
  ok: boolean;
  value?: unknown; // JSON-serialized, truncated at ~8 KB with an explicit marker
  logs?: string[]; // captured console.*, capped
  error?: { message: string; stack: string };
  ms: number;
  diff?: ChangeSummary; // snapshot-derived, MVP+
}
```

Compiled with `new AsyncFunction("describe", code)` so the model can use top-level `await`. Nothing
else is injected: the script runs in page scope, where the globals already live. Synchronous JS
cannot be preempted, so "timeout" is a wall-clock measurement reported back, not a hard kill.
Accepted limitation.

### The mutation surface is the globals

There is no allowlist and no wrapper. What the model is told about, roughly grouped:

| Group                | Examples                                                                       |
| -------------------- | ------------------------------------------------------------------------------ |
| Data                 | `pack`, `grid`, `options`, `style`, `notes`, `seed`, `graphWidth`/`graphHeight` |
| Generator singletons | `Burgs`, `States`, `Provinces`, `Cultures`, `Religions`, `Names`, `Goods`, …    |
| Renderers            | `drawStates`, `drawBorders`, `drawStateLabels`, `drawRoutes`, `drawLayers`, …   |
| Layers               | `toggleStates`, `toggleLabels`, `layerIsOn`, `editStyle`                        |
| View                 | `zoomTo`, `panMap`, `setMapZoom`, `resetZoom`, `fitMapToScreen`, `scale`, `viewX`, `viewY`, `findCell` |
| SVG selections       | `svg`, `viewbox`, `labels`, `burgIcons`, `routes`, … (d3 selections)            |
| Registries           | `Controllers.<Name>.open(...)`, `Services.Save.saveMap(...)`                    |

**House rule given to the model, not enforced by code:** prefer a generator singleton when one
exists for the operation (it holds the invariants — cell reassignment, label placement, downstream
recomputation); fall back to writing `pack` fields directly when it doesn't; then redraw. Legacy
globals can be absent until their module loads, so guard with `typeof X === "function"`.

### Grounding the model

A static system prefix, marked for provider prompt caching, containing:

1. **A generated globals inventory** — built from `src/types/global.ts`, the `declare global` blocks
   across `src/generators/*`, and the `Controllers`/`Services` key lists. A build step emits it; it
   is never hand-maintained, so it tracks the migration automatically.
2. `PackedGraph` and related declarations from [src/types](../../src/types).
3. A trimmed [data_model.md](../architecture/data_model.md) (468 lines — near-perfect handbook size).
4. A hand-written **gotchas** section: `i === 0` sentinel entries, `removed` flags, `h >= 20` is
   land, `cells.c` adjacency vs `cells.v` vertices, `haven`/`harbor` semantics, `pack` vs `grid`
   coordinates. These are the things a type signature cannot say and the model will otherwise guess.
5. A **redraw cheatsheet** — which draw function to call after which kind of change
   (`drawStateLabels()` after a rename, `drawStates()` + `drawBorders()` after cell reassignment),
   with `drawLayers()` as the always-correct fallback that redraws every visible layer.

Plus a `describe(path)` helper available _inside_ the sandbox, returning keys, types and a sample
value for any expression. This is the real defence against drift: when the migration moves
something, the model finds out by looking, not by being told.

---

## Stage 1 — Prototype

**Goal:** find out whether the model can actually reason over FMG's data model well enough to make
this worth building. Answer that in an evening, on a branch.

**Scope**

- Chat dock: message list, input, model selector, key field. Reuses the provider keys already in
  `localStorage` (`fmg-ai-kl-${provider}`) written by the AI Text Generator.
- One tool, `run(code)`, plus `describe()`. **Read-only questions only.**
- One provider (Anthropic; the tool-use loop is cheapest to write first) and one capable model.
- The full system prefix as described above.
- The error loop: script throws → stack trace goes back → model retries. Capped at 5 tool
  iterations per user turn.
- Result rendered in the transcript as text, plus a collapsible "show script" panel.
- A `structuredClone` snapshot before each run, restorable from the console. Read-only is a prompt
  instruction, not a sandbox guarantee, and the snapshot costs a few lines.

**Out of scope:** mutation as a supported feature, undo UI, change summaries, streaming, other
providers, persistence, cost display.

**Acceptance:** an eval set of 25 read-only questions against a fixed test `.map`, with known
answers — counts, superlatives, filters, joins across two entity types, geography ("which states
touch the northern ice"), aggregate stats. Target: **≥ 80% correct in ≤ 3 tool iterations**, and
zero cases where a wrong answer is presented without the script being inspectable.

If the model lands well below that, the gotchas section and `describe()` are what grow — not the
tool count.

---

## Stage 2 — MVP

**Goal:** a shippable feature: the chat can change the map, the map redraws, the user can see what
changed and undo it.

**Scope**

_Mutation_ — the model writes to `pack` and calls generator singletons directly. No allowlist, no
gating by domain. The first-slice work is not code but **prompt**: the redraw cheatsheet and the
gotchas section cover the domains we expect first (burgs, states, labels, markers, notes, view and
layers), and grow from eval failures.

_Undo_ — `structuredClone` of `pack`, `grid`, `options`, `style` and `notes` before every run,
depth 3, surfaced as an Undo control on the message that caused the change. Cloneability of the data
objects is an invariant we are keeping (see Decisions).

_Change summary_ — derived by **diffing the snapshot against current state**, not from the model's
own account of what it did and not from counting API calls. "14 burgs modified, 1 state renamed,
labels layer redrawn." This is the guard against semantic drift, which is the real failure mode:
syntactically valid code against a subtly wrong assumption. It also survives the migration untouched,
because a diff over two serializable objects needs no knowledge of how they were changed.

_Redraw_ — the model calls the draw functions itself; the runtime does not try to infer intent. As a
backstop, if a run mutated data and called nothing, the runtime calls `drawLayers()` after it.

_Provider parity_ — all three adapters (`anthropic`, `openai`, `ollama`) support the tool loop.
Models that cannot reliably write JS are offered in read-only mode.

_Ergonomics_ — streaming assistant text, per-turn token/cost readout (the user is paying directly),
cancel button, script panel with syntax highlighting, transcript cleared on new map.

**Acceptance**

- An eval set of 20 mutation tasks with programmatic assertions on the resulting state. Target
  **≥ 85% correct**, and **100% reverted cleanly by Undo** — including the failures.
- No run can leave the map in a state that fails a save/reload round trip (the serializability
  invariant from [CONTEXT.md](../../CONTEXT.md)). Asserted in the eval harness after every task.
- Chat is lazy-loaded; startup bundle size unchanged.

---

## Stage 3 — Ideal state

**The inventory gets better for free.** As the migration converges on a single serializable state
object, snapshot, diff and undo become exact and cheap, and the generated inventory becomes a
smaller, cleaner surface to describe. This PRD's design improves as the codebase does, which is the
whole reason for reflecting rather than wrapping.

**Progressive context.** The prefix shrinks to an index plus a `docs(topic)` tool, so the model pulls
the detailed schema only for the domains it touches. Keeps first-turn cost flat as the surface grows.

**Preview before apply.** Mutating runs execute against a clone, produce a diff summary and an
optional visual preview, and apply on confirmation — for bulk operations above a threshold. Undo
remains the fallback for everything below it.

**The model can see the map.** A `snapshot(region)` helper rasterizes the current SVG and returns it
as an image block, so the model can judge visual results — label collisions, colour clashes, whether
a coastline reads well — rather than only numeric state.

**Scripts as artifacts.** Any script the model wrote can be saved, named, edited and re-run as a
macro; shared as text; replayed against a different map. This is the sleeper feature — chat becomes
FMG's scripting layer, and the community writes the tools we never will.

**Conversation persisted in the `.map` file.** The transcript and its scripts travel with the map, so
"how did this world get this way" is answerable.

**MCP bridge (optional, last).** A thin `fmg-mcp` process exposing the same `run` tool to external
clients (Claude Desktop, Claude Code) over stdio, relayed to the tab by WebSocket. Justified only if
demand appears; because it forwards `run` rather than a bespoke tool set, it stays a weekend's work.

---

## Risks

| Risk                                                     | Mitigation                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Semantic drift** — valid code, wrong domain assumption | Gotchas section; snapshot-derived change summary; undo                         |
| **Hallucinated globals or fields**                       | Generated inventory; `describe()`; the error-retry loop                        |
| **Migration renames a global mid-conversation**          | Inventory regenerated at build; `describe()` at runtime; `typeof` guards       |
| **Model mutates data but forgets to redraw**             | Redraw cheatsheet in prefix; `drawLayers()` backstop after silent mutations    |
| **Token cost surprises the user**                        | Prompt caching on the static prefix; per-turn cost readout                     |
| **Weak models write broken JS**                          | Read-only mode for models not known to handle tool-use + JS well               |
| **A script corrupts the map**                            | Snapshot/undo depth 3; save-reload round-trip assertion in every eval task     |
| **Runaway script hangs the tab**                         | Wall-clock reporting, iteration caps, cancel; accepted limitation              |

## Decisions

1. **Data objects stay cloneable.** `structuredClone` is the undo mechanism, and the migration's
   direction of travel — one serializable state object — makes this stronger over time rather than
   weaker. Anything that would put a non-cloneable value into `pack`/`grid` is a bug.
2. **The eval sets are permanent**, living in `tests/` alongside a fixed test `.map`. They are the
   only measurable definition of "the chat works", and the regression signal when the migration moves
   something under it.
3. **The AI Text Generator stays a separate dialog.** It is a different job — draft prose for a
   field — and folding it into a chat would make the simple case worse.
4. **API keys stay in `localStorage`**, per provider, shared with the AI Text Generator. The key
   field's tooltip is corrected to say the key is stored on the user's machine only, rather than
   claiming it is not stored.
