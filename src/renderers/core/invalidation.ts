import type { MapLayerId } from "./layer-registry";

export type RenderInvalidation =
  | { kind: "camera" }
  | { kind: "visibility"; layer: MapLayerId }
  | { kind: "style"; layer: MapLayerId }
  | { cellIds?: readonly number[]; kind: "assignment"; layer: MapLayerId }
  | { kind: "geometry"; layer: MapLayerId }
  | { domainId: number | string; kind: "entity"; layer: MapLayerId }
  | { kind: "topology" }
  | { kind: "world" };

export interface RenderInvalidationBatch {
  invalidations: readonly RenderInvalidation[];
  requiresSceneBuild: boolean;
}

const SCENE_BUILD_KINDS = new Set<RenderInvalidation["kind"]>([
  "assignment",
  "entity",
  "geometry",
  "style",
  "topology",
  "world"
]);

export function coalesceInvalidations(invalidations: Iterable<RenderInvalidation>): RenderInvalidationBatch {
  const queued = [...invalidations];
  if (queued.some(invalidation => invalidation.kind === "world")) {
    return createBatch([{ kind: "world" }, ...retainViewInvalidations(queued)]);
  }
  if (queued.some(invalidation => invalidation.kind === "topology")) {
    const retained = queued.filter(
      invalidation =>
        invalidation.kind !== "topology" &&
        invalidation.kind !== "geometry" &&
        invalidation.kind !== "assignment" &&
        invalidation.kind !== "entity"
    );
    return createBatch([{ kind: "topology" }, ...deduplicate(retained)]);
  }
  return createBatch(deduplicate(mergeAssignments(queued)));
}

function retainViewInvalidations(invalidations: readonly RenderInvalidation[]): RenderInvalidation[] {
  return deduplicate(
    invalidations.filter(invalidation => invalidation.kind === "camera" || invalidation.kind === "visibility")
  );
}

function mergeAssignments(invalidations: readonly RenderInvalidation[]): RenderInvalidation[] {
  const assignments = new Map<MapLayerId, Set<number> | null>();
  const others: RenderInvalidation[] = [];
  for (const invalidation of invalidations) {
    if (invalidation.kind !== "assignment") {
      others.push(invalidation);
      continue;
    }
    const current = assignments.get(invalidation.layer);
    if (!invalidation.cellIds || current === null) {
      assignments.set(invalidation.layer, null);
      continue;
    }
    const cellIds = current ?? new Set<number>();
    for (const cellId of invalidation.cellIds) cellIds.add(cellId);
    assignments.set(invalidation.layer, cellIds);
  }
  for (const [layer, cellIds] of assignments) {
    others.push({
      cellIds: cellIds ? [...cellIds].sort((left, right) => left - right) : undefined,
      kind: "assignment",
      layer
    });
  }
  return others;
}

function deduplicate(invalidations: readonly RenderInvalidation[]): RenderInvalidation[] {
  const unique = new Map<string, RenderInvalidation>();
  for (const invalidation of invalidations) unique.set(getInvalidationKey(invalidation), invalidation);
  return [...unique.values()];
}

function getInvalidationKey(invalidation: RenderInvalidation): string {
  if (invalidation.kind === "camera" || invalidation.kind === "topology" || invalidation.kind === "world") {
    return invalidation.kind;
  }
  if (invalidation.kind === "entity") return `${invalidation.kind}:${invalidation.layer}:${invalidation.domainId}`;
  return `${invalidation.kind}:${invalidation.layer}`;
}

function createBatch(invalidations: readonly RenderInvalidation[]): RenderInvalidationBatch {
  return {
    invalidations,
    requiresSceneBuild: invalidations.some(invalidation => SCENE_BUILD_KINDS.has(invalidation.kind))
  };
}
