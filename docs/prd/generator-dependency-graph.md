# PRD — Generator Dependency Graph

## Problem Statement

The canonical "build a world from scratch" routine is a single hardcoded call sequence —
`async function generate(options)` in [`public/main.js`](../../public/main.js) — roughly 40 generator
calls in a fixed order, with no representation anywhere of *why* that order is correct. The only
record of the dependencies between steps is prose: [`docs/domain/generation_pipeline.md`](../domain/generation_pipeline.md)
hand-transcribes the sequence into a 16-phase table and spells out the two ordering constraints that
matter ("Goods depend on nothing pack-side but must exist before `Markets.generate`"; "Economy depends
on the whole settlement chain"). Nothing enforces either constraint; both are just comments a future
edit can silently violate.

This costs real, documented maintenance burden, not hypothetical:

- **Three other call sites replicate slices of the same sequence by hand** —
  [`src/controllers/heightmap-editor.ts`](../../src/controllers/heightmap-editor.ts) `regenerateErasedData()`
  and `restoreRiskedData()`, and [`src/generators/resample.ts`](../../src/generators/resample.ts)
  `Resampler.process()`. Each re-derives, independently, which phases to rerun, which to restore from
  saved data, and which to skip. `regenerateErasedData()` even reorders one call relative to the
  canonical sequence (`Ice.generate()` runs after taxes instead of after `Features.defineGroups()`) —
  a deliberate exception the doc calls out, but nothing in the code says so; a reader has to already
  know the doc exists to know the reordering is safe rather than a bug.
- **The doc ends in a five-step manual checklist** ("Add the call in `public/main.js`... If the step
  runs after phase 5, also add it to `regenerateErasedData()`... If it writes a per-cell array, add it
  to `restoreCellData`...") for adding one new generation step. Four files, by hand, with the doc
  itself warning that skipping a site makes "features... silently fail when entered through that
  path." This is the exact failure mode `docs/prd/layers-management.md` fixed for layers: state that
  is supposed to be authoritative in one place is actually spread across several, kept in sync by
  discipline rather than structure.
- **There is no way to ask "what does X depend on?" or "what depends on X?" in code.** A contributor
  answers that question today by reading the phase table and guessing, or grepping call sites. This is
  also what blocks the long-standing "package architecture" idea for this project (self-contained,
  interchangeable generator modules, e.g. a swappable biome/climate module for the frequently
  requested open-climates use case): interchangeability requires a declared contract of inputs and
  outputs, and today a module's dependents are only discoverable by reading its call site in
  `generate()`.

## Solution

A generic **pipeline** mechanism — `createPipeline` in `src/utils/pipeline.ts` — mirroring how
`createRegistry` in `src/utils/registry.ts` is a layer-agnostic factory that `Controllers`/`Services`
are just configuration over. `createPipeline` knows nothing about generators, `pack`, or `grid`; it
takes an ordered array of `PipelineStep`s and returns an object that can run them.

The first version keeps the mechanism deliberately simple: **registration order is the execution
order**, the same rule `mapLayers`/`Layers` already uses for z-order. There is no computed topological
sort. Each step may still declare `dependsOn`, but that list is only *validated* at construction (every
named dependency must already be an earlier entry in the array) and used to compute `descendantsOf`
for `runFrom` — it does not decide *where* a step runs. Ordering is exactly what a contributor reads in
the array, top to bottom, same as `generate()` today.

`src/generators/pipeline.ts` is the configuration: the concrete `pipelineSteps` array — one entry per
existing generator call, in the same order `generate()` calls them today — plus the exported `Pipeline`
instance and its derived `PipelineStepId` type. `Pipeline.run()` replaces the linear body of
`generate()`, and `Pipeline.runFrom(id, { assume })` runs a step and everything transitively downstream
of it (per the declared `dependsOn` edges), treating the ids in `assume` as already satisfied (their
data was restored, not regenerated) rather than running them. That single method expresses what
`regenerateErasedData`, `restoreRiskedData`, and `Resampler.process()` each do today by manually
copying and editing a slice of the phase list.

This is deliberately narrow: it makes **call order** explicit and centrally declared, and gives
`dependsOn` just enough teeth to catch a step registered before what it needs and to answer "what runs
after X". It does not change how a generator reads or writes data — every step's `run()` still calls
straight into the existing `Cultures.generate()`, `Markets.generate()`, etc., which still read and
write the shared `pack`/`grid` globals exactly as they do today. Turning generators into modules with
explicit typed inputs/outputs (the "self-contained package" vision in full) is a separate, larger
migration this PRD sets the ground for but does not attempt — see Out of Scope.

## User Stories

1. As a contributor adding a new generation step, I want to declare it once — its id, what it depends
   on, and its `run()` — in one file, so that I don't have to hand-edit `main.js`,
   `heightmap-editor.ts`, and `resample.ts` separately and hope I found every site.
2. As a contributor, I want registering a step whose declared dependency doesn't exist yet, or names an
   id that comes later in the array, to throw at startup, so that a step declared before what it needs
   is a load-time error instead of a silent ordering bug discovered later on a specific map.
3. As a contributor, I want `Pipeline.run()` to execute every step in the order it is registered, so
   that `generate()` in `main.js` stops being the one place that encodes the whole sequence by hand, and
   so that the execution order is exactly what's written in `pipelineSteps`, with nothing computed or
   reordered behind it.
4. As a maintainer of `heightmap-editor.ts`, I want `Pipeline.runFrom("hydrologyBase", { assume: [...] })`
   to run exactly the steps downstream of the heightmap edit, so that `regenerateErasedData()` stops
   being a hand-copied, independently-maintained slice of `generate()`.
5. As a maintainer of `heightmap-editor.ts`, I want `restoreRiskedData()` to express "cultures, burgs,
   states, provinces, and religions are restored, not regenerated, but the economy must still be
   rebuilt against the new cell topology" as an `assume` set rather than a second hand-written call
   list, so that the two heightmap-exit paths can't silently drift from each other or from `generate()`.
6. As a maintainer of `resample.ts`, I want to express "skip `rivers` because meanders are restored
   from the parent map, but still run everything that would normally depend on it" as one `assume`
   entry, so that `Resampler.process()` reads as a set of restored artifacts rather than a fourth copy
   of the phase list.
7. As a contributor, I want a step's `run()` to be free to stay exactly what it is today (a call into
   `Cultures.generate()`, awaiting `HeightmapGenerator.generate(grid)`, etc.), so that adopting the
   graph requires no changes inside any existing generator.
8. As a maintainer, I want the ordering constraint "Goods must exist before Markets" to be a
   `dependsOn` edge instead of a comment in a doc, so that it can't be silently violated by reordering
   calls in `main.js`.
9. As a maintainer, I want the `Ice.generate()` reordering in `regenerateErasedData()` (it runs after
   taxes there, but after `defineGroups` in `generate()`) to be visible as a real difference between
   the two call graphs, so that a reader doesn't need outside knowledge of the doc to know it's
   intentional.
10. As a contributor, I want to ask the registry what depends on a given step (its transitive
    descendants), so that I can answer "if I change how biomes are assigned, what else needs to
    rerun?" without grepping call sites.
11. As a maintainer, I want `docs/domain/generation_pipeline.md` rewritten to describe the pipeline and
    its three `runFrom` call sites instead of a hand-maintained phase table, so that the documentation
    and the code cannot drift the way the old table already had (it still names the pre-migration path
    `public/modules/ui/heightmap-editor.js`, which moved to `src/controllers/heightmap-editor.ts`).
12. As a maintainer, I want `createPipeline` unit-tested against fake steps, so that registration-order
    execution, `assume`-set behavior, and out-of-order/missing-dependency detection are guaranteed
    without exercising real `pack`/`grid` generation.
13. As a contributor, I want async steps (only `heightmap`, via `HeightmapGenerator.generate(grid)`,
    today) to work the same as sync ones, so that the executor doesn't force every generator to become
    async for uniformity.
14. As a maintainer, I want registering a step to not require touching every existing generator file at
    once, so that the migration can land incrementally, one call site's worth of steps at a time,
    consistent with how the rest of the codebase migrates.
15. As a maintainer, I want the ordering/dispatch mechanism itself to know nothing about generators,
    `pack`, or `grid` — the same split as `createRegistry` and `Controllers`/`Services` — so that
    `src/generators/pipeline.ts` is plain configuration and the mechanism in `src/utils/pipeline.ts`
    could back an unrelated ordered-steps use case later without being extracted out of `generators/`
    first.

## Implementation Decisions

### Step and pipeline shape

```ts
// src/utils/pipeline.ts — generic, no knowledge of generators/pack/grid, mirrors registry.ts
export interface PipelineStep<Id extends string = string> {
  id: Id;
  dependsOn?: Id[]; // ids of earlier-registered steps this one is documented to need
  run: () => void | Promise<void>;
}

export interface Pipeline<Id extends string = string> {
  readonly ids: readonly Id[]; // registration order = execution order
  has(id: string): id is Id;
  descendantsOf(id: Id): Id[]; // steps that (transitively) declare id as a dependency, in registration order

  run(): Promise<void>; // every step, in registration order
  runFrom(id: Id, opts?: {assume?: Id[]}): Promise<void>; // id + descendants, minus assume, in order
}

export function createPipeline<Id extends string = string>(steps: PipelineStep<Id>[]): Pipeline<Id>; // validates at construction
```

```ts
// src/generators/pipeline.ts — configuration only
import { createPipeline } from "@/utils/pipeline";

const pipelineSteps = [
  {id: "grid", run: () => { grid = shouldRegenerateGrid(...) ? generateGrid() : grid; }},
  {id: "heightmap", dependsOn: ["grid"], run: () => HeightmapGenerator.generate(grid)},
  // ...one entry per existing generate() call, in the same order generate() calls them today
  {id: "cultures", dependsOn: ["rankCells"], run: () => Cultures.generate()}
] as const satisfies PipelineStep[];

export const Pipeline = createPipeline(pipelineSteps);
export type PipelineStepId = (typeof pipelineSteps)[number]["id"];
```

- **Registration order is the execution order — no computed ordering.** `run()` just iterates `steps`
  in array order, the same rule already established for `mapLayers`/`Layers` ("registration order is
  the z-order, the init order and the draw order"). There is no topological sort, so there is no notion
  of a schedule separate from what's written in the file: the array *is* the pipeline, read top to
  bottom, same as `generate()` is today.
- **`dependsOn` is validated, not scheduled.** At construction, `createPipeline` walks the array once;
  for each step, every id in `dependsOn` must already be a preceding entry. An id that isn't registered
  at all, or is registered later in the array, throws immediately. This is a much smaller check than a
  general cycle detector — it can't be a cycle, because "must appear earlier" is the whole rule — but it
  catches the same real mistake: a step declared before what it needs.
- **`descendantsOf(id)` is a plain forward scan**, not a topological-sort artifact: walk the array after
  `id`, collecting steps whose `dependsOn` includes `id` or (transitively) includes a step already
  collected. It exists for `runFrom`; nothing else in this design needs it.
- **Granularity matches individual generator calls, not the doc's 16 phases.** The phase table
  compresses ~40 calls into 16 rows, which is exactly why the three replication sites still need local
  judgment calls today (the Ice-ordering exception lives *inside* a phase). Steps are one per existing
  call — `grid`, `heightmap`, `markupGrid`, `addLakesInDeepDepressions`, `openNearSeaLakes`,
  `mapCoordinates`, `temperatures`, `precipitation`, `repack` (`reGraph` + `Features.markupPack`),
  `defaultRuler`, `rivers`, `biomes`, `featureGroups`, `ice`, `goods`, `rankCells`, `cultures`,
  `culturesExpand`, `burgs`, `states`, `routes`, `religions`, `burgsSpecify`, `stateStatistics`,
  `stateForms`, `provinces`, `provincePoles`, `riversSpecify`, `lakeNames`, `markets`, `production`,
  `taxes`, `military`, `markers`, `zones`, `addedLabels`, `mapName` — so an `assume` set can name
  exactly the artifacts a replication site restores instead of a whole phase.
- **Seed/sizing (`setSeed`, `applyGraphSize`, `randomizeOptions`) stays outside the pipeline.** These are
  one-time setup for a from-scratch generation, not steps any other step or replication site depends
  on individually; `main.js` calls them before `Pipeline.run()`.
- **`dependsOn` is seeded from the existing call order in `generation_pipeline.md`, then verified against
  each generator's actual reads/writes as part of implementation.** Because array position — not
  `dependsOn` — decides where a step runs, an inaccurate edge can't misorder execution; it can only
  make `descendantsOf` (and so a `runFrom` `assume` set) too narrow or too wide. Still worth getting
  right, but the failure mode is strictly less severe than in a scheduler that trusts the edges to order
  things: e.g. nothing found so far shows `biomes` actually reading river data despite sitting in the
  same historical phase as `rivers` in the doc.
- **`run()` bodies are thin wrappers, unchanged internals.** `{id: "cultures", dependsOn: ["rankCells"], run: () => Cultures.generate()}` — no generator's method signature or global read/write pattern changes.
- **`assume` only affects the executed set, not validation.** `runFrom` computes `descendantsOf(id)`,
  unions `{id}`, subtracts `assume`, and runs the rest in registration order. It does not check that the
  assumed steps' data is actually present — that responsibility stays with the caller, same as today.
- **The generic/config split mirrors `registry.ts`.** `createPipeline` is the one place that knows how
  to validate and iterate a step array — the unit under test — while `src/generators/pipeline.ts`'s
  `pipelineSteps` is just data, exactly as `Controllers`/`Services` are data passed to `createRegistry`.
  No second consumer of `createPipeline` is planned as part of this work; the split exists so generator
  concepts never leak into the mechanism, not because another use case is queued up.

### Replication sites

- **`main.js` `generate()`**: the ~40-call body is replaced by `await Pipeline.run()`, after the
  existing seed/sizing calls and the `shouldRegenerateGrid` branch (which decides whether `grid` itself
  is a step or a pre-condition — kept as a pre-condition, since it branches on `precreatedGraph`, an
  option `Pipeline` has no vocabulary for).
- **`heightmap-editor.ts` `regenerateErasedData()`**: becomes
  `Pipeline.runFrom("markupGrid")` (erosion-conditional calls stay inside the `markupGrid`/`rivers`
  steps' own `run()`, parametrized the same way they are today). The `Ice.generate()` reordering doesn't
  survive the registration-order simplification for free: `pipelineSteps` is one shared array, so
  `ice`'s position is the same for every caller of `runFrom` — there is no per-call-site `dependsOn`
  override anymore (that only worked when edges drove a computed order). The choice is therefore binary:
  either accept the graph's single canonical position for `ice` everywhere, including here (recommended
  — verify visually that it does not matter, since `Ice` only depends on temperature/features per the
  existing doc note), or keep this one call site's `Ice.generate()` as an explicit call outside
  `runFrom`, the same way seed/sizing stays outside the pipeline. This needs a decision during
  implementation, flagged here rather than assumed.
- **`heightmap-editor.ts` `restoreRiskedData()`**: becomes
  `Pipeline.runFrom("markupGrid", { assume: ["cultures", "burgs", "states", "provinces", "religions"] })`
  after the existing cell-remapping code that repopulates `pack.cells.*` from the saved grid mapping —
  that remapping is data restoration, not a generator, and stays outside the graph.
- **`resample.ts` `Resampler.process()`**: becomes
  `Pipeline.runFrom("markupGrid", { assume: ["rivers", "cultures", "burgs", "states", "routes", "religions", "provinces", "goods"] })`
  after `Resampler`'s own restore methods run, matching the parent-quadtree-based restoration already
  documented in `generation_pipeline.md`.

### Docs

`docs/domain/generation_pipeline.md` is rewritten to describe `pipelineSteps`, `Pipeline.run()`, and
the three `runFrom` call sites in place of the hand-maintained phase table — mirroring how
`lazy_loading.md` was rewritten when `controller-service-registry.md` replaced the old loader file. The
"Adding a new global generation step" checklist collapses from four hand-edited files to one: add the
step (with its real `dependsOn`) to `pipeline.ts`, then decide whether each `runFrom` call site's
`assume` set needs it. That second half is not eliminated — a replication site restoring a step's data
instead of rerunning it is still a judgment call a human makes — but it is now one array literal per
site instead of re-deriving a whole call sequence.

## Testing Decisions

- **What makes a good test here:** assert external behavior of `createPipeline` against fake steps —
  `run()` executes in exactly registration order regardless of `dependsOn`, `runFrom` executes exactly
  `descendants ∪ {id} \ assume` in registration order, and a `dependsOn` id that is unregistered or
  registered later in the array throws at construction. Do not assert internal scan/traversal
  bookkeeping.
- **Module under test:** `createPipeline` in isolation (`src/utils/pipeline.test.ts`, alongside
  `registry.test.ts`), built over fake steps with `run: vi.fn()` — no real `pack`/`grid`. The concrete
  `pipelineSteps` array in `src/generators/pipeline.ts` is configuration, like `Controllers`/`Services`,
  and is not separately unit-tested.
- **Representative cases:** steps run in the order they're passed to `createPipeline`, not in
  `dependsOn` order (a step listed first whose `dependsOn` names a later step must fail construction,
  not silently run first); a `dependsOn` naming an unregistered id, or an id registered later in the
  array, throws at construction; `descendantsOf` returns transitive dependents in registration order;
  `runFrom` on a mid-array id runs only that id and its descendants; an `assume` entry removes a
  descendant from the executed set while steps depending on it still run; an async `run()` is awaited
  before the next step starts.
- **Real pipeline wiring is integration-level and not re-tested here.** The individual generators
  already have their own unit tests (`*-generator.test.ts`); this work does not change their behavior,
  only what calls them and in what order. The three migrated call sites remain covered by whatever
  existing tests exercise heightmap editing and resample/submap (E2E, per `generation_pipeline.md`'s
  existing scope).

## Out of Scope

- **Explicit input/output generators.** Steps' `run()` still reads and writes the shared `pack`/`grid`
  globals in place; no generator gains typed parameters or a return value describing what it wrote.
  This PRD makes *order* explicit, not *data flow* — a larger migration that would touch every
  generator's signature, tracked separately.
- **A new state object per generation step, or copying `pack`/`grid` between steps.** Conflicts with
  this project's performance doctrine (`AGENTS.md`: mutate in place, structure-of-arrays, no per-step
  copies of large arrays). The graph works over the existing mutate-in-place model.
- **Deriving `dependsOn` automatically from static analysis of each generator's field reads/writes.**
  Edges are declared by hand (seeded from the current call order, then verified), not inferred; a
  static-analysis pass could reduce the risk of a wrong edge later but is not required to ship this.
- **The "Other regeneration callers" partial paths** listed at the end of `generation_pipeline.md`
  (`tools.ts` Tools-tab handlers, `auto-update.ts` version migrations, `world-configurator.ts`'s
  climate-only refresh). Only the three full-replication sites are migrated to `Pipeline.runFrom`;
  the smaller, already-partial callers are unaffected.
- **Fixing the stale file path in `generation_pipeline.md`** (`public/modules/ui/heightmap-editor.js`,
  now `src/controllers/heightmap-editor.ts`) beyond what the doc rewrite naturally corrects.

## Further Notes

- **Scope is deliberately just ordering.** This gives contributors a place to answer "what does X
  depend on" and "what runs after X" in code instead of by reading a prose table, and it removes the
  specific, already-documented failure mode of a replication site drifting from `generate()`. It does
  not make generators self-contained or interchangeable — that would require typed inputs/outputs per
  generator, which is out of scope here.
- **The `Ice` reordering is the one place this migration can change observable behavior**, and is
  called out rather than silently resolved one way — see Implementation Decisions. Every other
  replication site's `assume` set is a direct translation of what it restores today, not a behavior
  change.
- **Residual manual judgment.** `runFrom`'s `assume` set is still hand-picked per call site, same as
  the phase list it replaces — the graph does not know which of a step's outputs a given caller has
  actually restored. What it removes is the need to re-derive *ordering* by hand; a wrong `assume` set
  is still possible, but a wrong *order* no longer is.
