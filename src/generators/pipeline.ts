// Generic ordered-steps runner. No knowledge of generators, pack, or grid — mirrors registry.ts,
// where the mechanism is layer-agnostic and callers supply the configuration.
//
// Registration order is the execution order (same rule as `mapLayers`/`Layers`) — there is no
// declared dependency graph, just an ordered list.

export interface PipelineStep<Id extends string = string, TContext = void> {
  id: Id;
  run: (context: TContext) => void | Promise<void>;
}

export class Pipeline<Id extends string = string, TContext = void> {
  readonly ids: readonly Id[];
  private readonly name: string;
  private readonly steps: readonly PipelineStep<Id, TContext>[];
  private readonly indexById: ReadonlyMap<Id, number>;

  constructor(name: string, steps: readonly PipelineStep<Id, TContext>[]) {
    this.name = name;

    const indexById = new Map<Id, number>();
    for (const step of steps) {
      if (indexById.has(step.id)) {
        throw new Error(`Pipeline "${name}": duplicate step id "${step.id}"`);
      }
      indexById.set(step.id, indexById.size);
    }

    this.steps = steps;
    this.ids = steps.map(step => step.id);
    this.indexById = indexById;
  }

  has(id: string): id is Id {
    return this.indexById.has(id as Id);
  }

  async run(context: TContext): Promise<void> {
    await this.runSteps(this.steps, context);
  }

  async runFrom(id: Id, context: TContext, opts?: { assume?: readonly Id[] }): Promise<void> {
    const startIndex = this.indexById.get(id);
    if (startIndex === undefined) {
      throw new Error(`Pipeline "${this.name}": unknown step "${id}"`);
    }

    const assume = new Set(opts?.assume ?? []);
    const steps = this.steps.slice(startIndex).filter(step => !assume.has(step.id));
    await this.runSteps(steps, context);
  }

  private async runSteps(steps: readonly PipelineStep<Id, TContext>[], context: TContext): Promise<void> {
    INFO && console.group(this.name);
    TIME && console.time(this.name);

    try {
      for (const step of steps) {
        TIME && console.time(step.id);
        try {
          await step.run(context);
        } catch (error) {
          throw new Error(`${this.name} failed at step "${step.id}"`, { cause: error });
        } finally {
          TIME && console.timeEnd(step.id);
        }
      }
    } finally {
      TIME && console.timeEnd(this.name);
      INFO && console.groupEnd();
    }
  }
}
