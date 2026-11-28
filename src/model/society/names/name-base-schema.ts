import { z } from "zod";
import type { Corpus, Formant, Grammar, NameBase, PatternLayout, SoundRule, Template } from "@/types/names";

type Fields<T> = Record<keyof T, z.ZodType>; // all of them: zod drops a field it is not told of

const weight = z.number().int().min(0).optional();
const share = z.number().min(0).max(1).optional();
const length = z.tuple([z.number(), z.number()]);
const rewrites = z.array(z.object({ match: z.string(), replace: z.string() })).optional();

const corpus = z.object({
  names: z.array(z.string()),
  mode: z.enum(["chain", "pick"]).optional(),
  length: length.optional()
} satisfies Fields<Corpus>);

const formant = z.object({
  form: z.string().min(1),
  weight,
  position: z.enum(["first", "last", "word", "stem"]).optional(),
  short: z.string().optional(),
  class: z.string().optional(),
  hyphen: z.boolean().optional()
} satisfies Fields<Formant>);

const rule = z.object({
  match: z.string(),
  replace: z.string(),
  at: z.literal("join").optional(),
  when: z.enum(["long", "foreign"]).optional(),
  chance: share,
  as: z.string().optional()
} satisfies Fields<SoundRule>);

const grammar = z.object({
  classes: z.record(z.string(), z.string()).optional(),
  endings: z.record(z.string(), z.record(z.string(), z.string())).optional(),
  derive: z.object({ stem: rewrites, first: rewrites }).optional()
} satisfies Fields<Grammar>);

const template = z.object({ parts: z.string(), weight } satisfies Fields<Template>);

const pattern = z.object({
  weight,
  female: share,
  templates: z.array(template).optional()
} satisfies Fields<PatternLayout>);

/** A base as a namesbase file holds it */
export const NAME_BASE_SCHEMA = z.object({
  id: z.string().regex(/^[\p{L}\p{N}-]+$/u),
  name: z.string().min(1),
  description: z.string().optional(),
  length,
  extends: z.string().optional(),
  places: corpus,
  waters: corpus.optional(),
  people: z.object({ male: corpus.optional(), female: corpus.optional() }).optional(),
  rules: z.array(rule).optional(),
  joining: z.array(z.string()).optional(),
  grammar: grammar.optional(),
  settled: share,
  lexicon: z.record(z.string(), z.array(formant)).optional(),
  patterns: z.record(z.string(), pattern).optional()
} satisfies Fields<NameBase>);
