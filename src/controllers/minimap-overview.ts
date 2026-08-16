export interface OverviewFeature {
  i: number;
  type: string;
  group?: string;
}

export function groupOverviewPaths(
  features: Iterable<OverviewFeature | undefined>,
  pathsByFeature: Map<number, string>
): { land: string[]; lakes: Map<string, string[]> } {
  const land: string[] = [];
  const lakes = new Map<string, string[]>();

  for (const feature of features) {
    if (!feature || feature.type === "ocean") continue;
    const path = pathsByFeature.get(feature.i);
    if (!path) continue;
    if (feature.type !== "lake") land.push(path);
    else {
      const group = feature.group || "freshwater";
      const groupPaths = lakes.get(group) || [];
      groupPaths.push(path);
      lakes.set(group, groupPaths);
    }
  }

  return { land, lakes };
}
