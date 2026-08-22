// Generic ordered-steps runner. No knowledge of generators, pack, or grid — mirrors registry.ts,
// where the mechanism is layer-agnostic and callers supply the configuration.
//
// Registration order is the execution order (same rule as `mapLayers`/`Layers`) — there is no
// declared dependency graph, just an ordered list.

export interface PipelineStep<Id extends string = string> {
  id: Id;
  run: () => void | Promise<void>;
}

export interface Pipeline<Id extends string = string> {
  readonly ids: readonly Id[]; // registration order = execution order
  has(id: string): id is Id;

  run(): Promise<void>; // every step, in registration order
  runFrom(id: Id, opts?: { assume?: readonly Id[] }): Promise<void>; // id and everything after it, minus assume
}

export function createPipeline<Id extends string = string>(steps: readonly PipelineStep<Id>[]): Pipeline<Id> {
  const ids = steps.map(step => step.id);
  const indexById = new Map<Id, number>();
  for (const id of ids) {
    if (indexById.has(id)) throw new Error(`Pipeline: duplicate step id "${id}"`);
    indexById.set(id, indexById.size);
  }

  const stepById = new Map<Id, PipelineStep<Id>>(steps.map(step => [step.id, step]));
  const has = (id: string): id is Id => indexById.has(id as Id);

  const runSteps = async (idsToRun: readonly Id[]): Promise<void> => {
    for (const id of idsToRun) await stepById.get(id)!.run();
  };

  return {
    ids,
    has,
    run: () => runSteps(ids),
    runFrom: async (id, opts) => {
      const startIndex = indexById.get(id);
      if (startIndex === undefined) throw new Error(`Pipeline: unknown step "${id}"`);

      const assume = new Set(opts?.assume ?? []);
      return runSteps(ids.slice(startIndex).filter(stepId => !assume.has(stepId)));
    }
  };
}
