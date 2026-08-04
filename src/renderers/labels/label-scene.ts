import type { LabelType } from "@/generators/labels";
import type { Point } from "@/types/global";
import type { LabelData, PathLabelData } from "./types";

export interface SceneLabel {
  data: LabelData;
  anchor: Point;
  order: number;
  revision: number;
}

export class LabelScene {
  private labels = new Map<string, SceneLabel>();
  private forced = new Set<string>();
  private groups = new Map<string, SceneLabel[]>();
  private nextOrder = 0;
  private nextRevision = 0;
  valid = false;

  replaceAll(labels: LabelData[]): void {
    this.labels.clear();
    this.groups.clear();
    this.nextOrder = 0;
    for (const data of labels) this.set(data);
    this.valid = true;
  }

  updateType(type: LabelType, labels: LabelData[], ids?: number[]): void {
    const selected = ids && new Set(ids.map(id => `${type}Label${id}`));
    const orders = new Map<string, number>();
    for (const [id, label] of this.labels) {
      if (label.data.type !== type || (selected && !selected.has(id))) continue;
      orders.set(id, label.order);
      this.labels.delete(id);
    }
    for (const data of labels) this.set(data, orders.get(data.id));
    this.groups.clear();
    this.valid = true;
  }

  remove(type: LabelType, id: number): void {
    const labelId = `${type}Label${id}`;
    this.labels.delete(labelId);
    this.groups.clear();
    this.forced.delete(labelId);
  }

  invalidate(): void {
    this.labels.clear();
    this.groups.clear();
    this.forced.clear();
    this.valid = false;
  }

  force(id: string): void {
    this.forced.add(id);
  }

  release(id: string): void {
    this.forced.delete(id);
  }

  isForced(id: string): boolean {
    return this.forced.has(id);
  }

  get(id: string): SceneLabel | undefined {
    return this.labels.get(id);
  }

  getGroup(group: string): SceneLabel[] {
    if (!this.groups.size) {
      for (const label of this.getAll()) {
        const labels = this.groups.get(label.data.group) || [];
        labels.push(label);
        this.groups.set(label.data.group, labels);
      }
    }
    return this.groups.get(group) || [];
  }

  getAll(): SceneLabel[] {
    return Array.from(this.labels.values()).toSorted((a, b) => a.order - b.order);
  }

  private set(data: LabelData, order?: number): void {
    const existing = this.labels.get(data.id);
    this.labels.set(data.id, {
      data,
      anchor: getLabelAnchor(data),
      order: order ?? existing?.order ?? this.nextOrder++,
      revision: ++this.nextRevision
    });
  }
}

export function getLabelAnchor(label: LabelData): Point {
  const [x, y] = "pathPoints" in label ? interpolatePath(label) : [label.x, label.y];
  return [x + (label.dx || 0), y + (label.dy || 0)];
}

function interpolatePath(label: PathLabelData): Point {
  const points = label.pathPoints;
  if (!points.length) return [0, 0];
  if (points.length === 1) return points[0];

  const lengths = points
    .slice(1)
    .map((point, index) => Math.hypot(point[0] - points[index][0], point[1] - points[index][1]));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (!total) return points[0];

  let distance = total * ((label.startOffset ?? 50) / 100);
  for (let i = 0; i < lengths.length; i++) {
    if (distance > lengths[i]) {
      distance -= lengths[i];
      continue;
    }
    const ratio = distance / lengths[i];
    return [
      points[i][0] + (points[i + 1][0] - points[i][0]) * ratio,
      points[i][1] + (points[i + 1][1] - points[i][1]) * ratio
    ];
  }
  return points.at(-1)!;
}
