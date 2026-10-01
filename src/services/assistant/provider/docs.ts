// Reference material the model reads on demand through read_docs, kept out of the system prompt

import { GLOBAL_DECLARATIONS, OPERATION_TYPES, OPERATIONS, REGISTRY_KEYS } from "./context.generated";

let topics: Map<string, { title: string; text: string }> | null = null; // by lowercase title

async function load(): Promise<Map<string, { title: string; text: string }>> {
  const [dataModel, configuration, packedGraph, heraldry, { MAP_COMMANDS, isLinkable }] = await Promise.all([
    import("../../../../docs/architecture/data-model.md?raw"),
    import("../../../../docs/architecture/configuration.md?raw"),
    import("../../../types/PackedGraph.ts?raw"),
    import("@/data/emblems"),
    import("@/components/map-commands")
  ]);
  const map = new Map<string, string>();
  for (const part of (dataModel.default as string).split(/(?=^#{1,2} )/m)) {
    const heading = part.match(/^## (.+)$/m)?.[1];
    if (heading) map.set(heading, part.trim());
  }
  map.set("Configuration", configuration.default as string);
  map.set("Globals", `\`\`\`ts\n${GLOBAL_DECLARATIONS}\n\`\`\``);
  map.set(
    "Registries",
    `Callable as \`await Controllers.X.open()\` / \`await Services.X.method()\`:\n${REGISTRY_KEYS}`
  );
  map.set("PackedGraph", `\`\`\`ts\n${packedGraph.default as string}\n\`\`\``);
  map.set(
    "Operations",
    `Operations for \`propose_change\`, with argument types:\n\`\`\`ts\n${OPERATIONS}\n\`\`\`\n\nThe types they name:\n\`\`\`ts\n${OPERATION_TYPES}\n\`\`\``
  );
  map.set("Emblems", emblemVocabulary(heraldry));
  const commands = MAP_COMMANDS.filter(isLinkable).map(({ id, name }) => `${id}: ${name}`);
  map.set("Commands", `Command ids for \`[label](command:id)\` links, as \`id: name\`:\n${commands.join("\n")}`);
  return new Map([...map].map(([title, text]) => [title.toLowerCase(), { title, text }]));
}

const TYPE_NAMES = [...OPERATION_TYPES.matchAll(/^(?:type|interface|const) (\w+)/gm)].map(match => match[1]);

/** "Operations: Markers, States" lists just those models' operations, with the types only when they use one */
function operationsOf(topic: string): { title: string; text: string } | undefined {
  const models = topic
    .match(/^operations\s*:(.+)$/i)?.[1]
    .split(/[\s,]+/)
    .filter(Boolean);
  if (!models?.length) return undefined;
  const prefixes = models.map(model => `${model.toLowerCase()}.`);
  const lines = OPERATIONS.split("\n").filter(line => prefixes.some(prefix => line.toLowerCase().startsWith(prefix)));
  if (!lines.length) return undefined;
  const text = lines.join("\n");
  const typed = TYPE_NAMES.some(name => new RegExp(`\\b${name}\\b`).test(text));
  const types = typed ? `\n\nThe types they name:\n\`\`\`ts\n${OPERATION_TYPES}\n\`\`\`` : "";
  return { title: topic, text: `Operations for \`propose_change\`:\n\`\`\`ts\n${text}\n\`\`\`${types}` };
}

/** Topics match case-insensitively; a "(pack)"-style suffix from the field index is ignored */
export async function readDocs(requested: string[]): Promise<string> {
  topics ??= await load();
  const found = requested.map(
    topic =>
      operationsOf(topic.trim()) ??
      topics!.get(
        topic
          .replace(/\(.*\)/, "")
          .trim()
          .toLowerCase()
      )
  );
  const texts = found.flatMap(topic => topic?.text ?? []);
  const unknown = requested.filter((_, index) => !found[index]);
  if (unknown.length)
    texts.push(
      `Unknown topics: ${unknown.join(", ")}. Available: ${[...topics.values()].map(topic => topic.title).join(", ")}, "Operations: <Model>, <Model>"`
    );
  return texts.join("\n\n");
}

/** The heraldry `Emblems.set` accepts, listed from the generator's own tables */
function emblemVocabulary({
  charges,
  divisions,
  lineWeights,
  ordinaries,
  shields,
  tinctures
}: typeof import("@/data/emblems")) {
  const names = (record: object) => Object.keys(record).join(", ");
  const table = charges as unknown as Record<string, Record<string, number>>;
  const categories = Object.keys(charges.types).filter(category => table[category]);
  return [
    "Heraldic emblems for `Emblems.set`, in the generator's vocabulary (the `Emblem` type is in the Operations topic).",
    `Tinctures. Metals: ${names(tinctures.metals)}. Colours: ${names(tinctures.colours)}. Stains: ${names(tinctures.stains)}.`,
    `Patterns fill a tincture slot as "pattern-tincture-tincture", such as "vair-argent-azure": ${names(tinctures.patterns)}; "semy_of_<charge>-or-gules" strews a charge.`,
    `Divisions (\`division.division\`): ${names(divisions.variants)}.`,
    `Ordinaries that take a \`line\`: ${names(ordinaries.lined)}. Straight ordinaries: ${names(ordinaries.straight)}.`,
    `Lines: ${names(lineWeights)}.`,
    `Shields (\`shield\`): ${Object.keys(shields.types)
      .flatMap(type => Object.keys(shields[type] ?? {}))
      .join(", ")}.`,
    "Charge positions (`p`, one letter per copy): a b c / d e f / g h i are the 3×3 grid from the top left; e is the center; j k l / m n o a tighter grid above and below it; p q left and right of the center; y the top left corner, z the base; A–L around the border.",
    "Charges by category:",
    ...categories.map(category => `- ${category}: ${names(table[category])}`)
  ].join("\n");
}
