// Generic ordered-steps runner. No knowledge of generators, pack, or grid — mirrors registry.ts,
// where the mechanism is layer-agnostic and callers supply the configuration.
//
// Registration order is the execution order (same rule as `mapLayers`/`Layers`) — there is no
// declared dependency graph, just an ordered list.

export interface PipelineStep<Id extends string = string> {
  id: Id;
  run: () => void | Promise<void>;
}

export interface PipelineOverrides<Id extends string = string> {
  replace?: Partial<Record<Id, () => void | Promise<void>>>; // swap a step's run(), same id/position
  omit?: readonly Id[]; // drop steps entirely; everything else keeps its relative order
}

export class Pipeline<Id extends string = string> {
  readonly ids: readonly Id[];
  private readonly steps: readonly PipelineStep<Id>[];
  private readonly stepById: ReadonlyMap<Id, PipelineStep<Id>>;
  private readonly indexById: ReadonlyMap<Id, number>;

  constructor(steps: readonly PipelineStep<Id>[]) {
    const indexById = new Map<Id, number>();
    for (const step of steps) {
      if (indexById.has(step.id)) {
        throw new Error(`Pipeline: duplicate step id "${step.id}"`);
      }
      indexById.set(step.id, indexById.size);
    }

    this.steps = steps;
    this.ids = steps.map(step => step.id);
    this.stepById = new Map(steps.map(step => [step.id, step]));
    this.indexById = indexById;
  }

  static derive<Id extends string>(base: Pipeline<Id>, overrides: PipelineOverrides<Id>): Pipeline<Id> {
    const omit = new Set(overrides.omit ?? []);
    const steps = base.steps
      .filter(step => !omit.has(step.id))
      .map((step): PipelineStep<Id> => {
        const run = overrides.replace?.[step.id];
        return run ? { id: step.id, run } : step;
      });
    return new Pipeline(steps);
  }

  derive(overrides: PipelineOverrides<Id>): Pipeline<Id> {
    return Pipeline.derive(this, overrides);
  }

  has(id: string): id is Id {
    return this.indexById.has(id as Id);
  }

  async run(): Promise<void> {
    await this.runSteps(this.ids);
  }

  async runFrom(id: Id, opts?: { assume?: readonly Id[] }): Promise<void> {
    const startIndex = this.indexById.get(id);
    if (startIndex === undefined) {
      throw new Error(`Pipeline: unknown step "${id}"`);
    }

    const assume = new Set(opts?.assume ?? []);
    await this.runSteps(this.ids.slice(startIndex).filter(stepId => !assume.has(stepId)));
  }

  private async runSteps(idsToRun: readonly Id[]): Promise<void> {
    for (const id of idsToRun) await this.stepById.get(id)!.run();
  }
}
