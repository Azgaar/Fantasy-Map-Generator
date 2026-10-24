// Generic ordered-steps runner

import { log } from "@/utils/logger";
import { errorText } from "@/utils/string-utils";

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
    log.group(this.name);
    log.time(this.name);
    const start = performance.now();

    try {
      for (const step of this.steps) {
        log.time(step.id);
        const stepStart = performance.now();
        try {
          await step.run(context);
        } catch (error) {
          const reason = errorText(error);
          throw new Error(`${this.name} failed at step "${step.id}": ${reason}`, { cause: error });
        } finally {
          log.timeEnd(step.id);
          performance.measure(step.id, { start: stepStart, detail: this.name });
        }
      }
    } finally {
      log.timeEnd(this.name);
      performance.measure(this.name, { start });
      log.groupEnd();
    }
  }
}
