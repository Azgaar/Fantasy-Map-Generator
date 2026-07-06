// SVG group id state labels are rendered into
export const STATE_LABELS_GROUP = "states";

// attributes every label shares, regardless of how it is rendered
export interface BaseLabel {
  i: number;
  text: string;
  group: string;
  dx?: number;
  dy?: number;
}

// label rendered along an SVG textPath; pathPoints may be absent until a fitting pass stores them
export interface PathLabel extends BaseLabel {
  pathPoints?: [number, number][];
  startOffset?: number;
  fontSize?: number;
  letterSpacing?: number;
}

// label anchored to a single map point
export interface PointLabel extends BaseLabel {
  x: number;
  y: number;
}

export interface StateLabel extends PathLabel {
  type: "state";
  stateId: number;
}

export interface BurgLabel extends PointLabel {
  type: "burg";
  burgId: number;
}

export interface CustomLabel extends PathLabel {
  type: "custom";
  pathPoints: [number, number][];
}

export type LabelData = StateLabel | BurgLabel | CustomLabel;

export const isPathLabel = (label: LabelData): label is StateLabel | CustomLabel =>
  label.type === "state" || label.type === "custom";

class LabelsModule {
  private freeIds: Set<number> = new Set();
  private maxId: number = 0;
  // initialization flag as the constructor version doesn't blocks other modules from beeing initialized.
  private initialized: boolean = false;

  private getNextId(): number {
    if (!this.initialized) {
      this.initialized = true;
      this.freeIds.clear();
      const existingIds = pack.labels.map(l => l.i).sort((a, b) => a - b);

      for (let id = 0; id < existingIds[existingIds.length - 1]; id++) {
        if (!existingIds.includes(id)) this.freeIds.add(id);
      }

      this.maxId = existingIds.length > 0 ? existingIds[existingIds.length - 1] + 1 : 0;
    }

    if (this.freeIds.size > 0) {
      // Get and remove the next available ID from the freeIds set
      const id = this.freeIds.values().next().value!;
      this.freeIds.delete(id);
      return id;
    }

    // maxId is always 1 greater than the current highest ID, so we can return it and then increment for the next call
    const nextId = this.maxId;
    this.maxId++;
    return nextId;
  }

  generate(): void {
    this.clear();
    this.generateStateLabels();
    this.generateBurgLabels();
  }

  getAll(): LabelData[] {
    return pack.labels;
  }

  get(id: number): LabelData | undefined {
    return pack.labels.find(l => l.i === id);
  }

  getByGroup(group: string): LabelData[] {
    return pack.labels.filter(l => l.group === group);
  }

  getByType(type: "state"): StateLabel[];
  getByType(type: "burg"): BurgLabel[];
  getByType(type: "custom"): CustomLabel[];
  getByType(type: LabelData["type"]): LabelData[] {
    return pack.labels.filter(l => l.type === type);
  }

  getBurgLabel(burgId: number): BurgLabel | undefined {
    return pack.labels.find((l): l is BurgLabel => l.type === "burg" && l.burgId === burgId);
  }

  getStateLabel(stateId: number): StateLabel | undefined {
    return pack.labels.find((l): l is StateLabel => l.type === "state" && l.stateId === stateId);
  }

  // get the label for a state, creating it if missing (e.g. for a newly created state)
  ensureStateLabel(stateId: number): StateLabel {
    return (
      this.getStateLabel(stateId) ??
      this.addStateLabel({ stateId, group: STATE_LABELS_GROUP, text: pack.states[stateId].name!, fontSize: 100 })
    );
  }

  addStateLabel(data: Omit<StateLabel, "i" | "type">): StateLabel {
    const label: StateLabel = {
      ...data,
      i: this.getNextId(),
      type: "state"
    };
    pack.labels.push(label);
    return label;
  }

  addBurgLabel(data: Omit<BurgLabel, "i" | "type">): BurgLabel {
    const label: BurgLabel = { ...data, i: this.getNextId(), type: "burg" };
    pack.labels.push(label);
    return label;
  }

  addCustomLabel(data: Omit<CustomLabel, "i" | "type">): CustomLabel {
    const label: CustomLabel = {
      ...data,
      i: this.getNextId(),
      type: "custom"
    };
    pack.labels.push(label);
    return label;
  }

  update<T extends LabelData>(label: T, updates: Partial<T>): T;
  update(id: number, updates: Partial<LabelData>): LabelData | undefined;
  update(target: number | LabelData, updates: Partial<LabelData>): LabelData | undefined {
    const label = typeof target === "number" ? pack.labels.find(l => l.i === target) : target;
    if (!label) {
      ERROR && console.error(`Label with id ${target} was not found for update.`);
      return undefined;
    }
    Object.assign(label, updates, { i: label.i, type: label.type });
    return label;
  }

  remove(target: number | LabelData): void {
    const id = typeof target === "number" ? target : target.i;
    const index = pack.labels.findIndex(l => l.i === id);
    if (index === -1) return;
    this.freeIds.add(id);
    pack.labels.splice(index, 1);
  }

  removeByType(type: LabelData["type"]): void {
    this.initialized = false;
    pack.labels = pack.labels.filter(l => l.type !== type);
  }

  removeByGroup(group: string): void {
    this.initialized = false;
    pack.labels = pack.labels.filter(l => l.group !== group);
  }

  clear(): void {
    pack.labels = [];
    this.initialized = false;
  }

  // replace all labels from deserialized data and reset id bookkeeping
  load(labels: LabelData[]): void {
    pack.labels = labels;
    this.freeIds.clear();
    this.maxId = 0;
    this.initialized = false;
  }

  /**
   * Generate state labels data entries for each non-locked state.
   * Only stores essential label data; raycast path calculation happens during the fitting pass.
   * Labels of locked states are kept as they are.
   */
  generateStateLabels(): void {
    if (TIME) console.time("generateStateLabels");

    const { states } = pack;

    // keep labels of locked states — they are not regenerated below
    this.initialized = false;
    pack.labels = pack.labels.filter(l => l.type !== "state" || states[l.stateId]?.lock);

    for (const state of states) {
      if (!state.i || state.removed || state.lock) continue;

      this.addStateLabel({
        stateId: state.i,
        group: STATE_LABELS_GROUP,
        text: state.name!,
        fontSize: 100
      });
    }

    if (TIME) console.timeEnd("generateStateLabels");
  }

  /**
   * Generate burg labels data from burgs.
   * Populates pack.labels with BurgLabelData for each burg.
   */
  generateBurgLabels(): void {
    if (TIME) console.time("generateBurgLabels");

    this.removeByType("burg");

    for (const burg of pack.burgs) {
      if (!burg.i || burg.removed) continue;

      const group = burg.group || "unmarked";

      this.addBurgLabel({
        burgId: burg.i,
        group,
        text: burg.name!,
        x: burg.x,
        y: burg.y
      });
    }

    if (TIME) console.timeEnd("generateBurgLabels");
  }
}

export const Labels = new LabelsModule();
window.Labels = Labels;
