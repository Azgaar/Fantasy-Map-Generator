import type { Point } from "@/types/global";

export const DEFAULT_LABEL_TYPES = ["state", "province", "burg", "river", "route", "added"] as const;

export type LabelType = (typeof DEFAULT_LABEL_TYPES)[number];

export type LabelNameMode = "auto" | "short" | "full";

export interface LabelZoomBounds {
  min: number | null;
  max: number | null;
}

export interface LabelGroup {
  name: string;
  type: LabelType;
  active?: boolean; // defaults to true
  layerDependency?: string | null;
  zoom: LabelZoomBounds;
  mode?: LabelNameMode; // defaults to "auto"
  isDefault?: boolean; // if group is a default (fallback) group for its type
}

export interface Label {
  text?: string;
  group?: string;
  dx?: number;
  dy?: number;
  fontSize?: number;
  letterSpacing?: number;
}

export interface PathLabel extends Label {
  pathPoints?: Point[];
  startOffset?: number;
}

declare global {
  var Labels: LabelsModule;
  var AddedLabels: AddedLabelsModule;
}

class LabelsModule {
  getDefaultGroups(): LabelGroup[] {
    // order matters for z-indexing
    return [
      {
        name: "river",
        type: "river",
        layerDependency: "toggleRivers",
        zoom: { min: 6, max: 40 },
        isDefault: true
      },
      {
        name: "route",
        type: "route",
        layerDependency: "toggleRoutes",
        zoom: { min: 6, max: 40 },
        isDefault: true
      },
      // burg groups from Burgs.getDefaultGroups()
      {
        name: "hamlet",
        type: "burg",
        zoom: { min: 5, max: 60 }
      },
      {
        name: "village",
        type: "burg",
        zoom: { min: 3, max: 40 }
      },
      {
        name: "trading_post",
        type: "burg",
        zoom: { min: 5, max: 60 }
      },
      {
        name: "caravanserai",
        type: "burg",
        zoom: { min: 5, max: 60 }
      },
      {
        name: "monastery",
        type: "burg",
        zoom: { min: 5, max: 60 }
      },
      {
        name: "fort",
        type: "burg",
        zoom: { min: 5, max: 60 }
      },
      {
        name: "town",
        type: "burg",
        zoom: { min: 2, max: 30 },
        isDefault: true
      },
      {
        name: "city",
        type: "burg",
        zoom: { min: 1.4, max: 25 }
      },
      {
        name: "capital",
        type: "burg",
        zoom: { min: 1, max: 25 }
      },
      // province, state and default group for custom labels
      {
        name: "province",
        type: "province",
        layerDependency: "toggleProvinces",
        zoom: { min: 1, max: 15 },
        isDefault: true
      },
      {
        name: "added",
        type: "added",
        zoom: { min: 0.2, max: 5.5 },
        isDefault: true
      },
      {
        name: "state",
        type: "state",
        zoom: { min: null, max: 4.5 },
        isDefault: true
      }
    ];
  }

  getFallbackGroup(type: LabelType): LabelGroup {
    const fallbackGroup = this.getDefaultGroups().find(group => group.isDefault && group.type === type);
    return fallbackGroup ?? { name: type, type, zoom: { min: null, max: null }, isDefault: true };
  }

  findGroup(groupName: string, type: LabelType): LabelGroup {
    const group = options.labels.groups.find(group => group.name === groupName);
    if (group) return group;
    return this.getFallbackGroup(type);
  }
}

// Custom labels are the only labels stored independently from map entities
export interface AddedLabel extends PathLabel {
  i: number;
  text: string;
  pathPoints: Point[];
  group: string;
}

export class AddedLabelsModule {
  initiate(): void {
    pack.labels = [];
  }

  get(i: number): AddedLabel | undefined {
    return pack.labels.find(label => label.i === i);
  }

  add(data: Omit<AddedLabel, "i">): AddedLabel {
    const i = pack.labels.reduce((max, label) => Math.max(max, label.i), -1) + 1;
    const label = { ...data, i };
    pack.labels.push(label);
    return label;
  }

  remove(i: number): void {
    pack.labels = pack.labels.filter(label => label.i !== i);
    notes = notes.filter(note => note.id !== `addedLabel${i}`);
  }
}

window.Labels = new LabelsModule();
window.AddedLabels = new AddedLabelsModule();
