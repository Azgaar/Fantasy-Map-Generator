import type { ReliefIcon } from "@/generators/relief-generator";
import { mergeSceneBounds, type SceneRevision, type SpriteBatchPrimitive } from "../primitives";

export function buildReliefSpriteScene(relief: readonly ReliefIcon[], revision: SceneRevision): SpriteBatchPrimitive {
  let bounds: SpriteBatchPrimitive["bounds"] = null;
  const instances = relief.map(({ icon, s, x, y }, index) => {
    const domainId = `relief:${index}`;
    bounds = mergeSceneBounds(bounds, { maxX: x + s, maxY: y + s, minX: x, minY: y });
    return { domainId, height: s, icon, width: s, x, y };
  });

  return {
    bounds,
    domainIds: instances.map(instance => instance.domainId),
    instances,
    kind: "sprite-batch",
    layer: "relief",
    revision
  };
}
