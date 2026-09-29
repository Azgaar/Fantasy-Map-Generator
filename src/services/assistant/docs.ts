// Reference material the model reads on demand through read_docs, kept out of the system prompt

import { COMMANDS, GLOBAL_DECLARATIONS, REGISTRY_KEYS } from "./context.generated";

let topics: Map<string, string> | null = null;

async function load(): Promise<Map<string, string>> {
  const [dataModel, configuration, packedGraph] = await Promise.all([
    import("../../../docs/architecture/data-model.md?raw"),
    import("../../../docs/architecture/configuration.md?raw"),
    import("../../types/PackedGraph.ts?raw")
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
  map.set("Commands", `Command ids for \`[label](command:id)\` links, as \`id: name\`:\n${COMMANDS}`);
  return map;
}

/** Topics match case-insensitively; a "(pack)"-style suffix from the field index is ignored */
export async function readDocs(requested: string[]): Promise<string> {
  topics ??= await load();
  const byKey = new Map([...topics].map(([title, text]) => [title.toLowerCase(), text]));
  const found = requested.map(topic =>
    byKey.get(
      topic
        .replace(/\(.*\)/, "")
        .trim()
        .toLowerCase()
    )
  );
  const unknown = requested.filter((_, index) => !found[index]);
  if (unknown.length) found.push(`Unknown topics: ${unknown.join(", ")}. Available: ${[...topics.keys()].join(", ")}`);
  return found.filter(Boolean).join("\n\n");
}
