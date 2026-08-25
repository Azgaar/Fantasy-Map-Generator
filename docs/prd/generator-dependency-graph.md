# PRD — Generator Pipeline

## Problem Statement

The canonical "build a world from scratch" routine is a single hardcoded call sequence —
`async function generate(options)` in [`public/main.js`](../../public/main.js) — roughly 40 generator
calls in a fixed order, with no representation anywhere of that order besides the code itself. The
only other record of it is prose: [`docs/domain/generation_pipeline.md`](../domain/generation_pipeline.md)
hand-transcribes the sequence into a 16-phase table.

This costs real, documented maintenance burden, not hypothetical:

- **Three other call sites replicate slices of the same sequence by hand** —
  [`src/controllers/heightmap-editor.ts`](../../src/controllers/heightmap-editor.ts) `regenerateErasedData()`
  and `restoreRiskedData()`, and [`src/generators/resample.ts`](../../src/generators/resample.ts)
  `Resampler.process()`. Each re-derives, independently, which phases to rerun, which to restore from
  saved data, and which to skip.
- **The doc ends in a five-step manual checklist** ("Add the call in `public/main.js`... If the step
  runs after phase 5, also add it to `regenerateErasedData()`... If it writes a per-cell array, add it
  to `restoreCellData`...") for adding one new generation step. Four files, by hand, with the doc
  itself warning that skipping a site makes "features... silently fail when entered through that
  path." This is the exact failure mode `docs/prd/layers-management.md` fixed for layers: state that
  is supposed to be authoritative in one place is actually spread across several, kept in sync by
  discipline rather than structure.

## Solution

A generic **pipeline** mechanism — `createPipeline` in `src/utils/pipeline.ts` — mirroring how
`createRegistry` in `src/utils/registry.ts` is a layer-agnostic factory that `Controllers`/`Services`
are just configuration over. `createPipeline` knows nothing about generators, `pack`, or `grid`; it
takes an ordered array of `{id, run}` steps and returns an object that can run them.

**Registration order is the execution order**, the same rule `mapLayers`/`Layers` already uses for
z-order. `Pipeline.run()` just iterates the array. There is no declared dependency graph: an earlier
version of this design gave each step a `dependsOn` list, validated at construction and used to compute
which steps are "downstream" of a given one — in practice that list was always just naming the
immediately preceding step (the real generation sequence has never needed anything but a straight
line), so the extra concept added validation logic and API surface without doing any real work. It was
dropped. If a genuine non-linear ordering need ever shows up, `dependsOn` is a well-understood shape to
bring back — see Further Notes.

`src/generators/pipeline.ts` is the configuration: the concrete `pipelineSteps` array — one entry per
existing generator call, in the same order `generate()` calls them today — plus the exported `Pipeline`
instance and its derived `PipelineStepId` type. `Pipeline.run()` replaces the linear body of
`generate()`. `Pipeline.runFrom(id, { assume })` runs a step and everything registered after it, minus
the ids in `assume` (steps whose data was restored rather than regenerated) — the shape a replication
site would need, though see Out of Scope for why the three existing ones aren't migrated to it yet.

This is deliberately narrow: it makes **call order** explicit and centrally declared. It does not
change how a generator reads or writes data — every step's `run()` still calls straight into the
existing `Cultures.generate()`, `Markets.generate()`, etc., which still read and write the shared
`pack`/`grid` globals exactly as they do today.

## User Stories

1. As a contributor adding a new generation step, I want to declare it once — its id and its `run()` —
   in one file, so that `generate()`'s sequence has a single source of truth instead of being retyped
   at each call site that needs a slice of it.
2. As a contributor, I want `Pipeline.run()` to execute every step in the order it is registered, so
   that `generate()` in `main.js` stops being the one place that encodes the whole sequence by hand, and
   so that the execution order is exactly what's written in `pipelineSteps`, with nothing computed or
   reordered behind it.
3. As a contributor, I want a step's `run()` to be free to stay exactly what it is today (a call into
   `Cultures.generate()`, awaiting `HeightmapGenerator.generate(grid)`, etc.), so that adopting the
   pipeline requires no changes inside any existing generator.
4. As a maintainer, I want `createPipeline` unit-tested against fake steps, so that registration-order
   execution, `assume`-set behavior, and duplicate-id detection are guaranteed without exercising real
   `pack`/`grid` generation.
5. As a contributor, I want async steps (only `heightmap`, via `HeightmapGenerator.generate(grid)`,
   today) to work the same as sync ones, so that the executor doesn't force every generator to become
   async for uniformity.
6. As a maintainer, I want registering a step to not require touching every existing generator file at
   once, so that the migration can land incrementally, one call site's worth of steps at a time,
   consistent with how the rest of the codebase migrates.
7. As a maintainer, I want the ordering/dispatch mechanism itself to know nothing about generators,
   `pack`, or `grid` — the same split as `createRegistry` and `Controllers`/`Services` — so that
   `src/generators/pipeline.ts` is plain configuration and the mechanism in `src/utils/pipeline.ts`
   could back an unrelated ordered-steps use case later without being extracted out of `generators/`
   first.
8. As a maintainer, I want `Pipeline.runFrom` available (even with no caller yet) so that a future
   replication site that genuinely is a contiguous suffix of the canonical sequence can adopt it without
   the mechanism needing to change.

## Implementation Decisions

### Step and pipeline shape

```ts
// src/utils/pipeline.ts — generic, no knowledge of generators/pack/grid, mirrors registry.ts
export interface PipelineStep<Id extends string = string> {
  id: Id;
  run: () => void | Promise<void>;
}

export interface Pipeline<Id extends string = string> {
  readonly ids: readonly Id[]; // registration order = execution order
  has(id: string): id is Id;

  run(): Promise<void>; // every step, in registration order
  runFrom(id: Id, opts?: {assume?: readonly Id[]}): Promise<void>; // id and everything after it, minus assume
}

export function createPipeline<Id extends string = string>(steps: readonly PipelineStep<Id>[]): Pipeline<Id>; // throws on a duplicate id
```

```ts
// src/generators/pipeline.ts — configuration only
import { createPipeline } from "@/utils/pipeline";

const pipelineSteps = [
  {id: "heightmap", run: async () => { grid.cells.h = await HeightmapGenerator.generate(grid); pack = {} as PackedGraph; }},
  {id: "markupGrid", run: () => Features.markupGrid()},
  // ...one entry per existing generate() call, in the same order generate() calls them today
  {id: "mapName", run: () => Names.getMapName(false)}
] as const satisfies readonly PipelineStep[];

export type PipelineStepId = (typeof pipelineSteps)[number]["id"];
export const Pipeline = createPipeline<PipelineStepId>(pipelineSteps);
```

- **Registration order is the execution order — no dependency graph, no computed ordering.** `run()`
  just iterates `steps` in array order, the same rule already established for `mapLayers`/`Layers`
  ("registration order is the z-order, the init order and the draw order"). The array *is* the
  pipeline, read top to bottom, same as `generate()` is today.
- **Construction only checks for duplicate ids.** `createPipeline` throws if the same id is registered
  twice; there is nothing else to validate once there's no cross-referencing `dependsOn` field.
- **Grid regeneration stays outside the pipeline.** The `shouldRegenerateGrid`/`generateGrid` branch in
  `generate()` depends on `options` (a precreated seed/graph) that a no-argument `run()` has no
  vocabulary for, so it stays as a pre-condition in `main.js`, executed before `Pipeline.run()`. The
  pipeline's first step is `heightmap` (which also resets `pack`), matching what `HeightmapGenerator`
  needs once `grid` is settled.
- **Granularity matches individual generator calls, not the doc's 16 phases.** The phase table
  compresses ~40 calls into 16 rows. Steps are one per existing call — `heightmap`, `markupGrid`,
  `addLakesInDeepDepressions`, `openNearSeaLakes`, `mapCoordinates` (folds in `defineMapSize`),
  `temperatures`, `precipitation`, `repack` (`reGraph` + `Features.markupPack`), `defaultRuler`,
  `rivers`, `biomes`, `featureGroups`, `ice`, `goods`, `rankCells`, `cultures`, `culturesExpand`,
  `burgs`, `states`, `routes`, `religions`, `burgsSpecify`, `stateStatistics`, `stateForms`,
  `provinces`, `provincePoles`, `riversSpecify`, `lakeNames`, `markets`, `production`, `taxes`,
  `military`, `markers`, `zones`, `addedLabels`, `mapName`.
- **Seed/sizing (`setSeed`, `applyGraphSize`, `randomizeOptions`) also stays outside the pipeline.**
  Same reason as the grid branch: one-time, option-dependent setup `main.js` runs before `Pipeline.run()`.
- **`run()` bodies are thin wrappers, unchanged internals.** `{id: "cultures", run: () => Cultures.generate()}`
  — no generator's method signature or global read/write pattern changes. A couple of calls needed a
  block body to discard a return value the strict `void | Promise<void>` signature doesn't accept
  (`Burgs.generate()`, `Markets.generate()` both return arrays today) — cosmetic, not behavioral.
- **The generic/config split mirrors `registry.ts`.** `createPipeline` is the one place that knows how
  to validate and iterate a step array — the unit under test — while `src/generators/pipeline.ts`'s
  `pipelineSteps` is just data, exactly as `Controllers`/`Services` are data passed to `createRegistry`.
  No second consumer of `createPipeline` is planned as part of this work; the split exists so generator
  concepts never leak into the mechanism, not because another use case is queued up.
- **`window.Pipeline` bridge.** `public/main.js` is still classic script, so `Pipeline` is exposed via
  `window.Pipeline = Pipeline` plus a `declare global` (with the same
  `biome-ignore lint/suspicious/noRedeclare` comment `Measurers` already uses for the same reason: a
  named export and a legacy `window` global sharing one identifier).

### `main.js`

`generate()`'s ~40-call body is replaced by `await Pipeline.run()`, placed after the existing
seed/sizing calls and the `shouldRegenerateGrid` branch. This is implemented and verified (typecheck,
lint, unit tests, `npm run build`, and manual smoke-testing of initial generation and regeneration all
pass).

### Docs

`docs/domain/generation_pipeline.md` should eventually be rewritten to describe `pipelineSteps` and
`Pipeline.run()` in place of the hand-maintained phase table for the parts that are now true (the
`main.js` sequence). It still accurately describes the three replication sites, which remain
hand-maintained — see Out of Scope.

## Testing Decisions

- **What makes a good test here:** assert external behavior of `createPipeline` against fake steps —
  `run()` executes in registration order, `runFrom` executes the id and everything after it minus
  `assume`, a duplicate id throws at construction, an unknown id passed to `runFrom` rejects.
- **Module under test:** `createPipeline` in isolation (`src/utils/pipeline.test.ts`, alongside
  `registry.test.ts`), built over fake steps with `run: vi.fn()` — no real `pack`/`grid`. The concrete
  `pipelineSteps` array in `src/generators/pipeline.ts` is configuration, like `Controllers`/`Services`,
  and is not separately unit-tested.
- **Representative cases (implemented):** steps run in registration order; a duplicate id throws at
  construction; `runFrom` runs the given step and everything after it; `runFrom` on an unknown id
  rejects (it's `async`, so a bad id is a rejected promise, not a synchronous throw — this was an actual
  bug caught by the test, since the first implementation's `runFrom` wasn't itself `async` and threw
  synchronously instead); an `assume` entry removes a step from the executed set; an async step is
  awaited before the next one starts; `run()` propagates a step's error and stops; `has` narrows an
  untrusted string.
- **Real pipeline wiring is integration-level and not re-tested here.** The individual generators
  already have their own unit tests (`*-generator.test.ts`); this work does not change their behavior,
  only what calls them and in what order.

## Out of Scope

- **Explicit input/output generators.** Steps' `run()` still reads and writes the shared `pack`/`grid`
  globals in place; no generator gains typed parameters or a return value describing what it wrote.
  This PRD makes *order* explicit, not *data flow* — a larger migration that would touch every
  generator's signature, tracked separately.
- **A new state object per generation step, or copying `pack`/`grid` between steps.** Conflicts with
  this project's performance doctrine (`AGENTS.md`: mutate in place, structure-of-arrays, no per-step
  copies of large arrays). The pipeline works over the existing mutate-in-place model.
- **A declared dependency graph (`dependsOn`, cycle/order validation, "what depends on X").** Dropped —
  see Solution and Further Notes. Revisit only if a real, non-linear ordering need shows up.
- **Migrating `heightmap-editor.ts`'s `regenerateErasedData()`/`restoreRiskedData()` and
  `resample.ts`'s `Resampler.process()` to `Pipeline.runFrom`.** Investigated and deliberately not done:
  none of the three is a clean contiguous-suffix-of-the-canonical-sequence the way `runFrom` assumes.
  - `regenerateErasedData()` calls `Biomes.define()`, not `Biomes.generate()` — a real semantic
    difference (recompute cell biomes against the existing catalog vs. reset the catalog to defaults
    first) that the shared `biomes` step doesn't have a variant for. It also gates
    `addLakesInDeepDepressions`/`openNearSeaLakes` behind an `erosionAllowed` flag a no-argument step
    can't express, and reorders `Ice.generate()` to run after taxes instead of after `defineGroups`.
  - `restoreRiskedData()` interleaves generator calls with a large amount of bespoke cell-remapping code
    (reassigning `pack.cells.*` from a saved grid mapping) between them, and its economy step is
    conditional: `Production.regenerateEconomy()` when a goods catalogue already exists, or the normal
    `Markets.generate → Production.produce → collectTaxes` chain otherwise — not a slice of
    `pipelineSteps` at any granularity that array currently has.
  - `resample.ts`'s `Resampler.process()` is almost entirely bespoke restoration logic; it calls almost
    none of the canonical `.generate()` entry points directly.

  Forcing any of these into `Pipeline.runFrom` as-is would risk silently changing behavior (e.g.
  discarding a user's custom biome catalog on heightmap-edit exit). Revisiting this is real future work
  — most likely by giving the affected steps a documented "variant" (e.g. a `defineBiomes` step beside
  `biomes`) rather than by parametrizing `run()`, which would reopen the "explicit input/output" scope
  this PRD deliberately avoids — but it needs its own investigation, not a mechanical port.
- **Deriving step edges automatically from static analysis of each generator's field reads/writes.**
  Moot without `dependsOn`; would only be relevant if a dependency graph is reintroduced.
- **Fixing the stale file path in `generation_pipeline.md`** (`public/modules/ui/heightmap-editor.js`,
  now `src/controllers/heightmap-editor.ts`).

## Further Notes

- **Why `dependsOn` was dropped rather than kept "for completeness":** it was designed, implemented,
  unit-tested, and then removed once implementation made it obvious the real generation sequence has
  never been anything but a straight line — every step's one declared dependency was always just "the
  step before it." A concept that only ever restates array position isn't pulling its weight; it added
  a validation pass, a `descendantsOf` traversal, and API surface for a distinction (declared graph vs.
  bare order) that had no instance where the two actually diverged. Simplicity won over anticipating a
  need that hasn't materialized.
- **What would justify bringing it back:** a real step with more than one genuine prerequisite that
  isn't just "whatever's immediately before it" — which is more likely to show up once/if the three
  deferred replication sites are revisited and need to express something like "this step needs both the
  settlement chain and the goods catalogue, independently of each other." Until then, `runFrom`'s
  "everything after this point" semantics are sufficient and exactly as expressive as the sequence
  actually is.
- **Scope is deliberately just ordering.** This gives `generate()`'s sequence one authoritative
  location instead of the sequence being implicit in `main.js`'s body, and gives future replication
  sites (once they're investigated properly) a `runFrom` to adopt. It does not make generators
  self-contained or interchangeable.
