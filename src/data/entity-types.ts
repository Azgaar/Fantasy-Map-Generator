export const ENTITY_TYPES = [
  "state",
  "province",
  "burg",
  "marker",
  "river",
  "route",
  "feature",
  "zone",
  "journey",
  "market",
  "regiment",
  "addedLabel",
  "culture",
  "religion",
  "biome",
  "good"
] as const;

export const RECORD_TYPES = ["cell", "ice", "relief", "measurer", "deal", "transport", "nameBase"] as const;

export type EntityType = (typeof ENTITY_TYPES)[number] | (typeof RECORD_TYPES)[number];

export const isEntityType = (value: string): value is EntityType =>
  (ENTITY_TYPES as readonly string[]).includes(value) || (RECORD_TYPES as readonly string[]).includes(value);

export interface EntityRef {
  type: EntityType;
  id: number;
  sub?: number;
}
