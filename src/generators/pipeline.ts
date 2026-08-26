// Generic ordered-steps runner
export interface PipelineStep<Id extends string = string, TContext = void> {
  id: Id;
  run: (context: TContext) => unknown;
}

export class Pipeline<Id extends string = string, TContext = void> {
  private readonly name: string;
  private readonly steps: readonly PipelineStep<Id, TContext>[];

  constructor(name: string, steps: readonly PipelineStep<Id, TContext>[]) {
    this.name = name;
    this.steps = steps;
  }

  async run(context: TContext): Promise<void> {
    INFO && console.group(this.name);
    TIME && console.time(this.name);

    try {
      for (const step of this.steps) {
        TIME && console.time(step.id);
        try {
          await step.run(context);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          throw new Error(`${this.name} failed at step "${step.id}": ${reason}`, { cause: error });
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
