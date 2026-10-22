// Seeded nebula clusters: short ellipse random walks, one gas palette each
import Alea from "alea";

export type NebulaGroup = "ion" | "dust" | "neutral";

export const NEBULA_GROUPS: readonly NebulaGroup[] = ["ion", "dust", "neutral"];

export interface NebulaEllipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotate: number; // degrees, aligned with the walk heading
  opacity: number;
}

export interface NebulaCluster {
  group: NebulaGroup;
  filter: string; // url(#id) of the cluster's turbulence filter, empty when filters are skipped
  ellipses: NebulaEllipse[];
}

export interface NebulaParams {
  width: number;
  height: number;
  count: number; // clusters
  size: number; // cluster extent, percent of the map's larger side
  seed: string;
  filters: boolean; // false in the speed performance preset: gradients instead of turbulence
}

const STEPS = [5, 9]; // ellipses per cluster, inclusive range

export function getNebulae({ width, height, count, size, seed, filters }: NebulaParams): NebulaCluster[] {
  const random = Alea(seed);
  const extent = (Math.max(width, height) * size) / 100;
  const clusters: NebulaCluster[] = [];

  for (let index = 0; index < count; index++) {
    const group = NEBULA_GROUPS[Math.floor(random() * NEBULA_GROUPS.length)]!;
    let heading = random() * Math.PI * 2;
    let x = width * (0.2 + 0.6 * random());
    let y = height * (0.2 + 0.6 * random());
    const steps = STEPS[0] + Math.floor(random() * (STEPS[1] - STEPS[0] + 1));
    const ellipses: NebulaEllipse[] = [];

    for (let step = 0; step < steps; step++) {
      const radius = extent * (0.25 + 0.3 * random());
      ellipses.push({
        cx: round(clamp(x, width)),
        cy: round(clamp(y, height)),
        rx: round(radius),
        ry: round(radius * (0.45 + 0.4 * random())),
        rotate: round((heading * 180) / Math.PI),
        opacity: round(0.55 + 0.45 * random())
      });
      heading += (random() - 0.5) * 1.2;
      const drift = extent * (0.2 + 0.25 * random());
      x += Math.cos(heading) * drift;
      y += Math.sin(heading) * drift;
    }

    clusters.push({ group, filter: filters ? `url(#nebulae-filter-${index})` : "", ellipses });
  }

  return clusters;
}

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);
const round = (value: number) => Math.round(value * 100) / 100;
