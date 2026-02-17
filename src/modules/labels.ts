declare global {
  var Labels: LabelsModule;
}

export interface StateLabelData {
  i: number;
  type: "state";
  stateId: number;
  text: string;
  fontSize?: number;
}

export interface BurgLabelData {
  i: number;
  type: "burg";
  burgId: number;
  group: string;
  text: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export interface CustomLabelData {
  i: number;
  type: "custom";
  group: string;
  text: string;
  pathPoints: [number, number][];
  startOffset?: number;
  fontSize?: number;
  letterSpacing?: number;
  transform?: string;
}

export type LabelData = StateLabelData | BurgLabelData | CustomLabelData;

class LabelsModule {
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

  getByType(type: LabelData["type"]): LabelData[] {
    return pack.labels.filter((l) => l.type === type);
  }

  getByGroup(group: string): LabelData[] {
    return pack.labels.filter(
      (l) => (l.type === "burg" || l.type === "custom") && l.group === group,
    );
  }

  getStateLabel(stateId: number): StateLabelData | undefined {
    return pack.labels.find(
      (l) => l.type === "state" && l.stateId === stateId,
    ) as StateLabelData | undefined;
  }

  getBurgLabel(burgId: number): BurgLabelData | undefined {
    return pack.labels.find(
      (l) => l.type === "burg" && l.burgId === burgId,
    ) as BurgLabelData | undefined;
  }

  addStateLabel(
    data: Omit<StateLabelData, "i" | "type">,
  ): StateLabelData {
    const label: StateLabelData = { i: this.getNextId(), type: "state", ...data };
    pack.labels.push(label);
    return label;
  }

  addBurgLabel(data: Omit<BurgLabelData, "i" | "type">): BurgLabelData {
    const label: BurgLabelData = { i: this.getNextId(), type: "burg", ...data };
    pack.labels.push(label);
    return label;
  }

  addCustomLabel(
    data: Omit<CustomLabelData, "i" | "type">,
  ): CustomLabelData {
    const label: CustomLabelData = { i: this.getNextId(), type: "custom", ...data };
    pack.labels.push(label);
    return label;
  }

  updateLabel(id: number, updates: Partial<LabelData>): void {
    const label = pack.labels.find((l) => l.i === id);
    if (!label) return;
    Object.assign(label, updates, { i: label.i, type: label.type });
  }

  removeLabel(id: number): void {
    const index = pack.labels.findIndex((l) => l.i === id);
    if (index !== -1) pack.labels.splice(index, 1);
  }

  removeByType(type: LabelData["type"]): void {
    pack.labels = pack.labels.filter((l) => l.type !== type);
  }

  removeByGroup(group: string): void {
    pack.labels = pack.labels.filter(
      (l) =>
        !((l.type === "burg" || l.type === "custom") && l.group === group),
    );
  }

  removeStateLabel(stateId: number): void {
    const index = pack.labels.findIndex(
      (l) => l.type === "state" && l.stateId === stateId,
    );
    if (index !== -1) pack.labels.splice(index, 1);
  }

  removeBurgLabel(burgId: number): void {
    const index = pack.labels.findIndex(
      (l) => l.type === "burg" && l.burgId === burgId,
    );
    if (index !== -1) pack.labels.splice(index, 1);
  }

  clear(): void {
    pack.labels = [];
  }
  
  /**
   * Generate state labels data entries for each state.
   * Only stores essential label data; raycast path calculation happens during rendering.
   * @param list - Optional array of stateIds to regenerate only those
   */
  generateStateLabels(list?: number[]): void {
    if (TIME) console.time("generateStateLabels");
  
    const { states } = pack;
  
    // Remove existing state labels that need regeneration
    if (list) {
      list.forEach((stateId) => this.removeStateLabel(stateId));
    } else {
      this.removeByType("state");
    }
  
    // Generate new label entries
    for (const state of states) {
      if (!state.i || state.removed || state.lock) continue;
      if (list && !list.includes(state.i)) continue;
  
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
  
    // Remove existing burg labels
    this.removeByType("burg");
  
    // Generate new labels for all active burgs
    for (const burg of pack.burgs) {
      if (!burg.i || burg.removed) continue;
  
      const group = burg.group || "unmarked";
  
      // Get label group offset attributes if they exist (will be set during rendering)
      // For now, use defaults - these will be updated during rendering phase
      const dx = 0;
      const dy = 0;
  
      this.addBurgLabel({
        burgId: burg.i,
        group,
        text: burg.name!,
        x: burg.x,
        y: burg.y,
        dx,
        dy,
      });
    }
  
    if (TIME) console.timeEnd("generateBurgLabels");
  }

}


window.Labels = new LabelsModule();
