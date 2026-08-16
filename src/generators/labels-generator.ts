import type { LayerId } from "@/components/layers";
import type { Point } from "@/types/global";

export const LABEL_TYPES = ["state", "province", "burg", "river", "route", "added"] as const;

export type LabelType = (typeof LABEL_TYPES)[number];

export type LabelNameMode = "auto" | "short" | "full";

export interface LabelZoomBounds {
  min: number | null;
  max: number | null;
}

export interface LabelGroup {
  name: string;
  type: LabelType;
  active?: boolean; // defaults to true
  layerDependency?: LayerId | null;
  zoom: LabelZoomBounds;
  mode?: LabelNameMode; // defaults to "auto"
  isDefault?: boolean; // if group is a default (fallback) group for its type
}

export interface Label {
  text?: string;
  group?: string;
  hidden?: boolean;
  dx?: number;
  dy?: number;
  fontSize?: number;
  letterSpacing?: number;
  pathPoints?: Point[]; // curve text along
  startOffset?: number;
}

declare global {
  var Labels: LabelsModule;
}

export class LabelsModule {
  getDefaultGroups(): LabelGroup[] {
    // order matters for z-indexing
    return [
      {
        name: "river",
        type: "river",
        layerDependency: "rivers",
        zoom: { min: 6, max: 40 },
        isDefault: true
      },
      {
        name: "route",
        type: "route",
        layerDependency: "routes",
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
        layerDependency: "provinces",
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

  getDefaultOptions() {
    return {
      resizeOnZoom: true,
      showAll: false,
      groups: this.getDefaultGroups()
    };
  }

  getFallbackGroup(type: LabelType): LabelGroup {
    const fallbackGroup = this.getDefaultGroups().find(group => group.isDefault && group.type === type);
    return fallbackGroup ?? { name: type, type, zoom: { min: null, max: null }, isDefault: true };
  }

  findGroup(groupName: string, type: LabelType): LabelGroup {
    const group = options.labels.groups.find(group => group.name === groupName && group.type === type);
    return group ?? this.getFallbackGroup(type);
  }

  getEntity(type: LabelType, id: number) {
    const entities: Record<LabelType, { i: number; label?: Label }[]> = {
      state: pack.states,
      province: pack.provinces,
      burg: pack.burgs,
      river: pack.rivers,
      route: pack.routes,
      added: pack.addedLabels
    };
    return entities[type].find(entity => entity.i === id);
  }

  setGroup(label: { type: LabelType; entityId: number; group: string }): void {
    const entity = this.getEntity(label.type, label.entityId);
    if (!entity) return;
    entity.label = { ...entity.label, group: label.group };
  }

  hasOverride(type: LabelType, id: number): boolean {
    const label = this.getEntity(type, id)?.label;
    if (!label) return false;
    if (type !== "added") return true;

    const { dx, dy, startOffset, fontSize, letterSpacing, pathPoints, hidden } = label;
    return [dx, dy, startOffset, fontSize, letterSpacing, pathPoints, hidden].some(value => value !== undefined);
  }

  resetOverride(type: LabelType, id: number): void {
    const entity = this.getEntity(type, id);
    if (!entity) return;

    if (type === "added") {
      const { text, group } = entity.label ?? {};
      entity.label = { text, group };
    } else delete entity.label;
  }
}

window.Labels = new LabelsModule();
