declare global {
  var Labels: LabelsModule;
}

export interface StateLabel {
  i: number;
  type: "state";
  stateId: number;
  text: string;
  pathPoints?: [number, number][];
  startOffset?: number;
  fontSize?: number;
  letterSpacing?: number;
  dx?: number;
  dy?: number;
}

export interface BurgLabel {
  i: number;
  type: "burg";
  burgId: number;
  group: string;
  text: string;
  x: number;
  y: number;
}

export interface CustomLabel {
  i: number;
  type: "custom";
  group: string;
  text: string;
  pathPoints: [number, number][];
  startOffset?: number;
  fontSize?: number;
  letterSpacing?: number;
  dx?: number;
  dy?: number;
}

export type LabelData = StateLabel | BurgLabel | CustomLabel;

class LabelsModule {
  // Gets the next possible Label ID in O(n log n) time. Allows for non-sequential IDs
  private getNextId(): number {
    const labels = pack.labels;
    if (labels.length === 0) return 0;

    const existingIds = labels.map((l) => l.i).sort((a, b) => a - b);
    for (let id = 0; id < existingIds[existingIds.length - 1]; id++) {
      if (!existingIds.includes(id)) return id;
    }
    return existingIds[existingIds.length - 1] + 1;
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
    return pack.labels.find((l) => l.i === id);
  }

  getByGroup(group: string): LabelData[] {
    return pack.labels.filter(
      (l) => (l.type === "burg" || l.type === "custom") && l.group === group,
    );
  }

  private addStateLabel(data: Omit<StateLabel, "i" | "type">): StateLabel {
    const label: StateLabel = {
      ...data,
      i: this.getNextId(),
      type: "state",
    };
    pack.labels.push(label);
    return label;
  }

  private addBurgLabel(data: Omit<BurgLabel, "i" | "type">): BurgLabel {
    const label: BurgLabel = { ...data, i: this.getNextId(), type: "burg", };
    pack.labels.push(label);
    return label;
  }

  addCustomLabel(data: Omit<CustomLabel, "i" | "type">): CustomLabel {
    const label: CustomLabel = {
      ...data,
      i: this.getNextId(),
      type: "custom",
    };
    pack.labels.push(label);
    return label;
  }

  update(id: number, updates: Partial<LabelData>): void {
    const label = pack.labels.find((l) => l.i === id);
    if (!label) {
      ERROR && console.error(`Label with id ${id} was not found for update.`);
      return;
    }
    Object.assign(label, updates, { i: label.i, type: label.type });
  }

  remove(id: number): void {
    const index = pack.labels.findIndex((l) => l.i === id);
    if (index !== -1) pack.labels.splice(index, 1);
  }

  removeByType(type: LabelData["type"]): void {
    pack.labels = pack.labels.filter((l) => l.type !== type);
  }

  removeByGroup(group: string): void {
    pack.labels = pack.labels.filter(
      (l) => !((l.type === "burg" || l.type === "custom") && l.group === group),
    );
  }

  clear(): void {
    pack.labels = [];
  }

  /**
   * Generate state labels data entries for each state.
   * Only stores essential label data; raycast path calculation happens during rendering.
   * @param list - Optional array of stateIds to regenerate only those
   */
  generateStateLabels(): void {
    if (TIME) console.time("generateStateLabels");

    const { states } = pack;

    this.removeByType("state");

    for (const state of states) {
      if (!state.i || state.removed || state.lock) continue;

      this.addStateLabel({
        stateId: state.i,
        text: state.name!,
        fontSize: 100,
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
        y: burg.y,
      });
    }

    if (TIME) console.timeEnd("generateBurgLabels");
  }
}

window.Labels = new LabelsModule();
