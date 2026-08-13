export type ReliefSet = "simple" | "colored" | "gray";

export interface ReliefSetDefinition {
  name: string;
  base: ReliefSet; // set the icons are taken from
  suffix: string; // icon id suffix
}

// icons of one type available in one set
export interface ReliefTypeIcons {
  set: ReliefSet;
  type: string; // used in icon ids and in biome icons lists
  variants: number[]; // variant numbers, icon id is relief-{type}-{variant}{suffix}
  zoom?: number; // preview zoom in the editor, 1 by default
  scale?: number; // generated icon size multiplier, 1 by default
  fallback?: string; // type to use instead in sets having no icons of this type
}
