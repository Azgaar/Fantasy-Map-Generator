// The sets entities reference by name: military unit types, transport types, burg and label
// groups, coastline settings. Each is a fact of the map it is on and the starting point for the
// next one, so each is said once here - where it lives, what the module defaults are, and what an
// accepted set still needs before the renderer can use it.
// See docs/architecture/configuration.md#preservation-across-maps
import type { z } from "zod";
import { optionsSchema } from "@/components/options-schema";
import { Burgs } from "@/generators/burgs-generator";
import { type CoastlineSettings, DEFAULT_COASTLINE } from "@/generators/coastline-generator";
import { type LabelGroup, Labels } from "@/generators/labels-generator";
import { Military } from "@/generators/military-generator";
import { type Transport, Transports } from "@/generators/transports-generator";
import type { BurgGroup } from "@/types/burg-groups";
import type { MilitaryUnit } from "@/types/Military";

type Definition<T> = {
  /** where the set lives in `facts` */
  get: () => T;
  put: (value: T) => void;
  /** the module that owns the concept answers for the defaults, which are never copied here */
  defaults: () => T;
  /** what a set the schema accepted still needs before the renderer can use it */
  ensure?: (value: T) => void;
};

const define = <T>(definition: Definition<T>): Definition<T> => definition;

export const DEFINITION_SETS = {
  military: define<MilitaryUnit[]>({
    get: () => facts.military.units,
    put: units => (facts.military.units = units),
    defaults: () => Military.getDefaultOptions()
  }),
  transports: define<Transport[]>({
    get: () => facts.transports,
    put: transports => (facts.transports = transports),
    defaults: () => Transports.getDefaults()
  }),
  burgGroups: define<BurgGroup[]>({
    get: () => facts.burgs.groups,
    put: groups => (facts.burgs.groups = groups),
    defaults: () => Burgs.getDefaultGroups(),
    // burg assignment needs a group flagged default, or every burg resolves nothing
    ensure: groups => Burgs.ensureDefaultGroup(groups)
  }),
  labelGroups: define<LabelGroup[]>({
    get: () => facts.labels.groups,
    put: groups => (facts.labels.groups = groups),
    defaults: () => Labels.getDefaultGroups(),
    // each label type needs a group of its own, or the renderer draws that type nowhere
    ensure: groups => Labels.restoreMissingTypes(groups)
  }),
  coastline: define<CoastlineSettings>({
    get: () => facts.coastline,
    put: settings => (facts.coastline = settings),
    defaults: () => ({ ...DEFAULT_COASTLINE })
  })
} satisfies Record<keyof z.infer<typeof optionsSchema>["library"], Definition<any>>;

export type DefinitionSetKey = keyof typeof DEFINITION_SETS;
type SetValue<K extends DefinitionSetKey> = ReturnType<(typeof DEFINITION_SETS)[K]["get"]>;

const entries = () => Object.entries(DEFINITION_SETS) as [DefinitionSetKey, Definition<any>][];

const isEmpty = (value: unknown): boolean => (Array.isArray(value) ? value.length === 0 : !value);

/**
 * A set entities reference by name cannot be empty, or the names they point at draw nothing. Being
 * non-empty is not enough either: a set the schema accepted can still leave the renderer idle
 */
export function ensureDefinitionSets(): void {
  for (const [, definition] of entries()) {
    if (isEmpty(definition.get())) definition.put(definition.defaults());
    definition.ensure?.(definition.get());
  }
}

/** Start a new map from the user's own sets, falling back to the module defaults */
export function applyStoredLibrary(): void {
  for (const [key, definition] of entries()) definition.put(recall(key) ?? definition.defaults());
}

/** The user's own set for the next map, or undefined when they have not saved one */
function recall<K extends DefinitionSetKey>(entry: K): SetValue<K> | undefined {
  const value = options.library[entry];
  return (value === null ? undefined : structuredClone(value)) as SetValue<K> | undefined;
}

/**
 * Keep a set the user edited, so the next map starts from it. Written only by a user edit - never
 * by a load and never by generation
 */
export function remember<K extends DefinitionSetKey>(entry: K, value: SetValue<K>): void {
  Options.set(options => {
    // a set the user reset to the module defaults is not one of their own: clearing the entry lets
    // the next map follow the defaults as they change, instead of freezing today's copy of them
    const isOwn = canonical(entry, value) !== canonical(entry, DEFINITION_SETS[entry].defaults());
    (options.library as Record<string, unknown>)[entry] = isOwn ? structuredClone(value) : null;
  });
}

/** Both sides through the same schema, so a difference in key order is not a difference in value */
function canonical(entry: DefinitionSetKey, value: unknown): string {
  const schema = optionsSchema.shape.library.shape[entry] as z.ZodType;
  return JSON.stringify(schema.safeParse(value).data ?? null);
}
