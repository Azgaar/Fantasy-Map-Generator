import type { LayerId } from "@/components/layers";
import type { Point } from "@/types/global";
import { safeParseJSON } from "@/utils/stringUtils";
import { requireOneOf } from "@/utils/validationUtils";

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

export type LabelLayout = Partial<
  Record<"dx" | "dy" | "fontSize" | "letterSpacing" | "startOffset", number | null> & { hidden: boolean | null }
>;

const requireNumber = (min: number, max: number) => (value: unknown) => {
  if (typeof value !== "number" || !(value >= min && value <= max))
    throw new Error(`Expected a number from ${min} to ${max}`);
  return value;
};

const LAYOUT: Record<keyof LabelLayout, (value: unknown) => unknown> = {
  dx: requireNumber(-1e5, 1e5),
  dy: requireNumber(-1e5, 1e5),
  fontSize: requireNumber(30, 300),
  letterSpacing: requireNumber(0, 20),
  startOffset: requireNumber(0, 100),
  hidden: value => {
    if (typeof value !== "boolean") throw new Error("hidden must be true or false");
    return value || undefined;
  }
};

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
        zoom: { min: 9, max: 40 },
        isDefault: true
      },
      {
        name: "route",
        type: "route",
        layerDependency: "routes",
        zoom: { min: 9, max: 40 },
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
    return { showAll: false, groups: this.getDefaultGroups() };
  }

  /** a value persisted by an older build can be structurally valid and still leave the renderer with
   * nothing to draw, so drop groups it cannot use and restore any type left without one */
  parseStoredOptions(stored: string | null) {
    const defaults = this.getDefaultOptions();
    const parsed = stored ? safeParseJSON(stored) : null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return defaults;

    const isUsable = (group: LabelGroup) =>
      Boolean(group?.name) && (LABEL_TYPES as readonly string[]).includes(group?.type) && Boolean(group?.zoom);
    const groups: LabelGroup[] = Array.isArray(parsed.groups) ? parsed.groups.filter(isUsable) : [];
    this.restoreMissingTypes(groups);

    const flag = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);
    return { showAll: flag(parsed.showAll, defaults.showAll), groups };
  }

  /** a type left without any group draws no labels at all, so give it the module defaults back */
  restoreMissingTypes(groups: LabelGroup[]): void {
    const defaults = this.getDefaultGroups();
    for (const type of LABEL_TYPES) {
      if (groups.some(group => group.type === type)) continue;
      groups.push(...defaults.filter(group => group.type === type));
    }
  }

  /** burgs can be assigned to groups the label registry has never seen (old maps, the Burg
   * Groups editor) - without an entry the renderer draws no label at all */
  ensureBurgLabelGroups(): void {
    for (const { name } of options.map.burgs.groups) {
      if (options.map.labels.groups.some(group => group.type === "burg" && group.name === name)) continue;
      const defaultGroup = this.getDefaultGroups().find(group => group.type === "burg" && group.name === name);
      options.map.labels.groups.push(
        defaultGroup ?? { ...structuredClone(this.getFallbackGroup("burg")), name, isDefault: false }
      );
    }
  }

  getFallbackGroup(type: LabelType): LabelGroup {
    const fallbackGroup = this.getDefaultGroups().find(group => group.isDefault && group.type === type);
    return fallbackGroup ?? { name: type, type, zoom: { min: null, max: null }, isDefault: true };
  }

  findGroup(groupName: string, type: LabelType): LabelGroup {
    const group = options.map.labels.groups.find(group => group.name === groupName && group.type === type);
    return group ?? this.getFallbackGroup(type);
  }

  private entitiesOf(type: LabelType): { i: number; removed?: boolean; label?: Label; group?: string }[] {
    const entities: Record<LabelType, { i: number; removed?: boolean; label?: Label; group?: string }[]> = {
      state: pack.states,
      province: pack.provinces,
      burg: pack.burgs,
      river: pack.rivers,
      route: pack.routes,
      added: pack.addedLabels
    };
    return (entities[type] ?? []).filter(entity => entity && !entity.removed && (type === "route" || entity.i));
  }

  private requireEntity(type: LabelType, id: number) {
    requireOneOf(type, LABEL_TYPES, "The label type");
    const entity = this.getEntity(type, id);
    if (!entity || (entity as { removed?: boolean }).removed) throw new Error(`The ${type} label ${id} does not exist`);
    return entity;
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

  /** Move a label to a label group, which sets its style and when it shows */
  setGroup(type: LabelType, id: number, group: string): void {
    const entity = this.requireEntity(type, id);
    requireOneOf(
      group,
      options.map.labels.groups.map(({ name }) => name),
      "The label group"
    );
    entity.label = { ...entity.label, group };
  }

  /** Move every label of one group to another, as renaming or removing a group does */
  regroup(from: string, to: string): void {
    for (const type of LABEL_TYPES)
      for (const entity of this.entitiesOf(type)) {
        const group = entity.label?.group || (type === "burg" ? entity.group : undefined) || type;
        if (group === from) entity.label = { ...entity.label, group: to };
      }
  }

  /** Adjust a label: dx and dy shift it, fontSize (30–300%) and letterSpacing (0–20 px) size its text, startOffset (0–100%) slides a label along its path, hidden hides it. null restores the automatic value */
  setLayout(type: LabelType, id: number, layout: LabelLayout): void {
    const entity = this.requireEntity(type, id);
    if (typeof layout !== "object" || layout === null) throw new Error("The layout must be an object");
    const label: Label = { ...entity.label };
    for (const [key, value] of Object.entries(layout) as [keyof LabelLayout, unknown][]) {
      const check = LAYOUT[key];
      if (!check) throw new Error(`Unknown label layout ${key}; known: ${Object.keys(LAYOUT).join(", ")}`);
      const checked = value === null ? undefined : check(value);
      if (checked === undefined) delete label[key];
      else Object.assign(label, { [key]: checked });
    }
    entity.label = label;
  }

  hasOverride(type: LabelType, id: number): boolean {
    const label = this.getEntity(type, id)?.label;
    if (!label) return false;
    if (type !== "added") return true;

    const { dx, dy, startOffset, fontSize, letterSpacing, pathPoints, hidden } = label;
    return [dx, dy, startOffset, fontSize, letterSpacing, pathPoints, hidden].some(value => value !== undefined);
  }

  /** Return a label to its automatic placement and style; an added label keeps its text and group */
  reset(type: LabelType, id: number): void {
    const entity = this.requireEntity(type, id);

    if (type === "added") {
      const { text, group } = entity.label ?? {};
      entity.label = { text, group };
    } else delete entity.label;
  }
}

// biome-ignore lint/suspicious/noRedeclare: legacy seam
export const Labels = new LabelsModule();

window.Labels = Labels;
