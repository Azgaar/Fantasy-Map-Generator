import {generateText, hasApiKey, getLanguageOverride, getCustomPrompt} from "./ai-providers";

export type EntityType = "burg" | "state" | "stateFullName" | "province" | "provinceFullName" | "river" | "lake" | "culture" | "religion" | "deity" | "marker" | "zone" | "route" | "map";

export interface EntityContext {
  form?: string;
  stateName?: string;
  length?: number;
  width?: number;
  discharge?: number;
  routeGroup?: string;
  connectedBurgs?: string[];
  religionType?: string;
  religionForm?: string;
  zoneType?: string;
  zoneBiome?: string;
  zoneNearBurg?: string;
}

// Map nameBase index to language/culture name for prompt context
const BASE_TO_LANGUAGE: Record<number, string> = {
  0: "German",
  1: "English",
  2: "French",
  3: "Italian",
  4: "Spanish",
  5: "Ruthenian/Slavic",
  6: "Nordic/Scandinavian",
  7: "Greek",
  8: "Roman/Latin",
  9: "Finnish",
  10: "Korean",
  11: "Chinese",
  12: "Japanese",
  13: "Portuguese",
  14: "Nahuatl/Aztec",
  15: "Hungarian",
  16: "Turkish",
  17: "Berber",
  18: "Arabic",
  19: "Inuit",
  20: "Basque",
  21: "Nigerian",
  22: "Celtic",
  23: "Mesopotamian",
  24: "Iranian/Persian",
  25: "Hawaiian",
  26: "Kannada/Indian",
  27: "Quechua/Andean",
  28: "Swahili/East African",
  29: "Vietnamese",
  30: "Cantonese/Chinese",
  31: "Mongolian",
  32: "Human Generic Fantasy",
  33: "Elven Fantasy",
  34: "Dark Elven Fantasy",
  35: "Dwarven Fantasy",
  36: "Goblin Fantasy",
  37: "Orcish Fantasy",
  38: "Giant Fantasy",
  39: "Draconic Fantasy",
  40: "Arachnid Fantasy",
  41: "Serpent Fantasy",
  42: "Levantine"
};

const ENTITY_DESCRIPTIONS: Record<EntityType, string> = {
  burg: "a city or town",
  state: "a country or state",
  stateFullName: "the full official name of a country including its translated governmental form",
  province: "a province or administrative subdivision",
  provinceFullName: "the full official name of a province including its translated governmental form",
  river: "a river",
  lake: "a lake",
  culture: "a culture or people",
  religion: "a religion or faith",
  deity: "a supreme deity with an epithet (e.g. 'Arath, The Eternal')",
  marker: "a geographic landmark or point of interest",
  zone: "a geographic zone or region (short descriptive name, 2-4 words)",
  route: "a trade route or road",
  map: "a fantasy world or continent"
};

function getLanguageName(base: number): string {
  return BASE_TO_LANGUAGE[base] || "Fantasy";
}

export function getLanguageForCulture(cultureIndex: number): string {
  const override = getLanguageOverride();
  if (override) return override;
  const culture = pack.cultures[cultureIndex];
  if (!culture) return "Fantasy";
  return getLanguageName(culture.base);
}

function getEffectiveLanguage(cultureIndex: number): string {
  const override = getLanguageOverride();
  if (override) return override;
  return getLanguageForCulture(cultureIndex);
}

function buildContextString(entityType: EntityType, ctx?: EntityContext): string {
  if (!ctx) return "";
  const parts: string[] = [];

  if (entityType === "state" && ctx.form) {
    parts.push(`This is a ${ctx.form}.`);
  }
  if (entityType === "stateFullName" || entityType === "provinceFullName") {
    if (ctx.stateName) parts.push(`The short name is "${ctx.stateName}".`);
    if (ctx.form) parts.push(`The governmental form is "${ctx.form}".`);
  }
  if (entityType === "province" && ctx.form) {
    parts.push(`This is a ${ctx.form}.`);
  }
  if (entityType === "river") {
    if (ctx.length) parts.push(`The river is ${ctx.length} km long.`);
    if (ctx.width) parts.push(`It is ${ctx.width} m wide at the mouth.`);
    if (ctx.discharge) parts.push(`It has a discharge of ${ctx.discharge} m³/s.`);
  }
  if (entityType === "route") {
    if (ctx.routeGroup) parts.push(`This is a ${ctx.routeGroup.replace(/s$/, "")}.`);
    if (ctx.connectedBurgs?.length) parts.push(`It connects ${ctx.connectedBurgs.join(" and ")}.`);
  }
  if ((entityType === "religion" || entityType === "deity") && ctx.religionType) {
    parts.push(`This is a ${ctx.religionType} ${ctx.religionForm || "religion"}.`);
  }
  if (entityType === "zone" && ctx.zoneType) {
    parts.push(`This is a ${ctx.zoneType} zone.`);
    if (ctx.zoneBiome) parts.push(`The affected area is ${ctx.zoneBiome}.`);
    if (ctx.zoneNearBurg) parts.push(`Near the settlement of ${ctx.zoneNearBurg}.`);
  }
  return parts.join(" ");
}

function buildFullNamePrompt(language: string, form: string, shortName: string): string {
  const customPrompt = getCustomPrompt();
  let prompt = `Translate the governmental form "${form}" into ${language} and combine it with the name "${shortName}" into a natural full official name. Use patterns like "Königreich Eldrida" or "Grafschaft Merkendorf". The result MUST be 2-4 words maximum. Keep the original short name intact. Reply with ONLY the full name, nothing else.`;
  if (customPrompt) prompt += ` Additional instructions: ${customPrompt}`;
  return prompt;
}

function buildSingleNamePrompt(entityType: EntityType, language: string, ctx?: EntityContext): string {
  if ((entityType === "stateFullName" || entityType === "provinceFullName") && ctx?.form && ctx?.stateName) {
    return buildFullNamePrompt(language, ctx.form, ctx.stateName);
  }

  const entity = ENTITY_DESCRIPTIONS[entityType];
  const context = buildContextString(entityType, ctx);
  const customPrompt = getCustomPrompt();

  let prompt = `Generate a single fantasy name for ${entity} in a ${language} linguistic style.`;
  if (context) prompt += ` ${context}`;
  prompt += ` Reply with ONLY the name, nothing else. No quotes, no explanation.`;
  if (customPrompt) prompt += ` Additional instructions: ${customPrompt}`;
  return prompt;
}

function buildBatchNamePrompt(entityType: EntityType, language: string, count: number, ctx?: EntityContext): string {
  const entity = ENTITY_DESCRIPTIONS[entityType];
  const context = buildContextString(entityType, ctx);
  const customPrompt = getCustomPrompt();

  let prompt = `Generate ${count} unique fantasy names for ${entity}s in a ${language} linguistic style. All names MUST be unique — no duplicates allowed.`;
  if (context) prompt += ` ${context}`;
  prompt += ` Reply with ONLY the names, one per line. No numbering, no quotes, no explanation.`;
  if (customPrompt) prompt += ` Additional instructions: ${customPrompt}`;
  return prompt;
}

function openAiSetupDialog(): void {
  tip("No AI key configured. Go to Options tab → AI Name Generation to set up your AI provider.", true, "error", 6000);
}

function cleanResult(result: string): string {
  return result.replace(/^["'\d.\s]+|["'\s]+$/g, "").split("\n")[0].trim();
}

export async function generateAiName(entityType: EntityType, cultureIndex: number, ctx?: EntityContext): Promise<string> {
  if (!hasApiKey()) {
    openAiSetupDialog();
    throw new Error("No API key configured");
  }

  const language = getEffectiveLanguage(cultureIndex);
  const prompt = buildSingleNamePrompt(entityType, language, ctx);
  const result = await generateText(prompt);
  return cleanResult(result);
}

export async function generateAiNames(
  entityType: EntityType,
  cultureIndex: number,
  count: number,
  ctx?: EntityContext
): Promise<string[]> {
  if (!hasApiKey()) {
    openAiSetupDialog();
    throw new Error("No API key configured");
  }

  const language = getEffectiveLanguage(cultureIndex);
  const prompt = buildBatchNamePrompt(entityType, language, count, ctx);
  const result = await generateText(prompt);

  const names = result
    .split("\n")
    .map(line => line.replace(/^["'\d.\s\-)+]+|["'\s]+$/g, "").trim())
    .filter(name => name.length > 0);

  // Deduplicate: keep first occurrence, skip duplicates
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(name);
    }
  }
  return unique.slice(0, count);
}

export async function translateTerms(terms: string[], cultureIndex: number): Promise<string[]> {
  if (!hasApiKey()) {
    openAiSetupDialog();
    throw new Error("No API key configured");
  }

  const language = getEffectiveLanguage(cultureIndex);
  if (language === "English" || language === "Fantasy") return [...terms];

  const customPrompt = getCustomPrompt();
  let prompt = `Translate each of the following terms into ${language}. Reply with ONLY the translations, one per line, in the same order. No numbering, no quotes, no explanation.\n${terms.join("\n")}`;
  if (customPrompt) prompt += ` Additional instructions: ${customPrompt}`;

  const result = await generateText(prompt);
  const translated = result
    .split("\n")
    .map(line => line.replace(/^["'\d.\s\-)+]+|["'\s]+$/g, "").trim())
    .filter(t => t.length > 0);

  return terms.map((original, i) => translated[i] || original);
}

export interface ReligionInput {
  type: string;
  form: string;
}

export interface ReligionResult {
  name: string;
  deity: string | null;
}

const STRUCTURED_CHUNK = 30;

export async function generateReligionsBatch(
  religions: ReligionInput[],
  cultureIndex: number
): Promise<ReligionResult[]> {
  if (!hasApiKey()) {
    openAiSetupDialog();
    throw new Error("No API key configured");
  }

  const language = getEffectiveLanguage(cultureIndex);
  const customPrompt = getCustomPrompt();
  const results: ReligionResult[] = [];

  for (let start = 0; start < religions.length; start += STRUCTURED_CHUNK) {
    const chunk = religions.slice(start, start + STRUCTURED_CHUNK);
    const religionList = chunk
      .map((r, i) => `${i + 1}. Type=${r.type}, Form=${r.form}`)
      .join("\n");

    let prompt = `Generate names and supreme deities for ${chunk.length} fantasy religions in a ${language} linguistic style.
The religion type and form MUST strongly influence the style of both the religion name and the deity name.
For each religion, create a fitting religion name and a supreme deity with an epithet (e.g. "Arath, The Eternal").
If the form is "Non-theism" or "Animism", write "none" for the deity.

${religionList}

Reply with one line per religion in the format: ReligionName | DeityName
No numbering, no quotes, no explanation.`;
    if (customPrompt) prompt += ` Additional instructions: ${customPrompt}`;

    const result = await generateText(prompt);
    const parsed = result
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0 && line.includes("|"))
      .slice(0, chunk.length)
      .map(line => {
        const parts = line.split("|").map(s => s.replace(/^["'\d.\s\-)+]+|["'\s]+$/g, "").trim());
        const name = parts[0] || "";
        const deityRaw = parts[1] || "";
        return {
          name,
          deity: deityRaw.toLowerCase() === "none" || !deityRaw ? null : deityRaw
        };
      });

    results.push(...parsed);
  }

  return results;
}

export interface ZoneInput {
  type: string;
  biome: string;
  nearBurg: string;
}

export async function generateZoneDescriptionsBatch(
  zoneInputs: ZoneInput[],
  cultureIndex: number
): Promise<string[]> {
  if (!hasApiKey()) {
    openAiSetupDialog();
    throw new Error("No API key configured");
  }

  const language = getEffectiveLanguage(cultureIndex);
  const customPrompt = getCustomPrompt();
  const results: string[] = [];

  for (let start = 0; start < zoneInputs.length; start += STRUCTURED_CHUNK) {
    const chunk = zoneInputs.slice(start, start + STRUCTURED_CHUNK);
    const zoneList = chunk
      .map((z, i) => `${i + 1}. Type="${z.type}", Biome="${z.biome}", NearSettlement="${z.nearBurg}"`)
      .join("\n");

    let prompt = `Generate short descriptive names (2-4 words) for ${chunk.length} fantasy map zones in ${language}.
These are NOT place names — they describe events or conditions affecting an area.
The description must match the zone type and geographic context.
Examples: for Flood near river → "Hochwasser am Silberfluss", for Disease near city → "Pest von Grünwald", for Avalanche in mountains → "Lawinenfeld am Nordpass".
All names MUST be unique.

${zoneList}

Reply with ONLY the descriptions, one per line. No numbering, no quotes, no explanation.`;
    if (customPrompt) prompt += ` Additional instructions: ${customPrompt}`;

    const result = await generateText(prompt);
    const parsed = result
      .split("\n")
      .map(line => line.replace(/^["'\d.\s\-)+]+|["'\s]+$/g, "").trim())
      .filter(name => name.length > 0)
      .slice(0, chunk.length);

    results.push(...parsed);
  }

  return results;
}

export async function generateFullNamesBatch(
  items: {shortName: string; form: string}[],
  cultureIndex: number
): Promise<string[]> {
  if (!hasApiKey()) {
    openAiSetupDialog();
    throw new Error("No API key configured");
  }

  const language = getEffectiveLanguage(cultureIndex);
  const customPrompt = getCustomPrompt();
  const results: string[] = [];

  for (let start = 0; start < items.length; start += STRUCTURED_CHUNK) {
    const chunk = items.slice(start, start + STRUCTURED_CHUNK);
    const itemList = chunk
      .map((item, i) => `${i + 1}. Name="${item.shortName}", Form="${item.form}"`)
      .join("\n");

    let prompt = `Translate each governmental form into ${language} and combine with the given name into a natural full official name. Use patterns like "Königreich Eldrida" or "Grafschaft Merkendorf". Each result MUST be 2-4 words. Keep the original short names intact.

${itemList}

Reply with ONLY the full names, one per line, in the same order. No numbering, no quotes, no explanation.`;
    if (customPrompt) prompt += ` Additional instructions: ${customPrompt}`;

    const result = await generateText(prompt);
    const parsed = result
      .split("\n")
      .map(line => line.replace(/^["'\d.\s\-)+]+|["'\s]+$/g, "").trim())
      .filter(name => name.length > 0)
      .slice(0, chunk.length);

    results.push(...parsed);
  }

  return results;
}

declare global {
  var generateWithAi: ((defaultPrompt: string, onApply: (result: string) => void) => void) | undefined;
  var AiNames: {
    generateName: (entityType: EntityType, cultureIndex: number, ctx?: EntityContext) => Promise<string>;
    generateNames: (entityType: EntityType, cultureIndex: number, count: number, ctx?: EntityContext) => Promise<string[]>;
    translateTerms: (terms: string[], cultureIndex: number) => Promise<string[]>;
    generateReligionsBatch: (religions: ReligionInput[], cultureIndex: number) => Promise<ReligionResult[]>;
    generateFullNamesBatch: (items: {shortName: string; form: string}[], cultureIndex: number) => Promise<string[]>;
    generateZoneDescriptionsBatch: (zones: ZoneInput[], cultureIndex: number) => Promise<string[]>;
    getLanguageForCulture: typeof getLanguageForCulture;
  };
}

window.AiNames = {
  generateName: generateAiName,
  generateNames: generateAiNames,
  translateTerms,
  generateReligionsBatch,
  generateFullNamesBatch,
  generateZoneDescriptionsBatch,
  getLanguageForCulture
};
