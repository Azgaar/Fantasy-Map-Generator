// Knowledge Base search for read_help: keyword scoring over the question sections

const TOP = 3;
const RELATED = 6;
const STOP_WORDS = new Set(
  "the and for how can what why does with from that this are not you your into there their have has get make map use way any all its was will where when which who also than then them they just only some more like want do my me is it to of in on an or be".split(
    " "
  )
);

interface Section {
  heading: string;
  text: string;
  headingTerms: Set<string>;
  bodyTerms: Set<string>;
}

let sections: Section[] | null = null;

const terms = (text: string): string[] =>
  (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter(word => word.length > 1 && !STOP_WORDS.has(word))
    .map(word => (word.length > 3 ? word.replace(/(?:es|s)$/, "") : word));

async function load(): Promise<Section[]> {
  const source = (await import("../../../../docs/wiki/Knowledge Base.md?raw")).default as string;
  return source.split(/(?=^### )/m).flatMap(part => {
    const heading = part.match(/^### (.+)$/m)?.[1];
    if (!heading) return [];
    const text = part.trim();
    return [{ heading, text, headingTerms: new Set(terms(heading)), bodyTerms: new Set(terms(text)) }];
  });
}

/** Best-matching sections in full, then headings of the next matches; an exact heading returns just that section */
export async function searchHelp(query: string): Promise<string> {
  sections ??= await load();
  const exact = sections.find(section => section.heading === query.trim());
  if (exact) return exact.text;

  const words = [...new Set(terms(query))];
  const ranked = sections
    .map(section => ({
      section,
      score: words.reduce(
        (sum, word) => sum + (section.headingTerms.has(word) ? 3 : 0) + (section.bodyTerms.has(word) ? 1 : 0),
        0
      )
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return `No Knowledge Base sections match "${query}". Try other words.`;

  const top = ranked.slice(0, TOP).map(({ section }) => section.text);
  const related = ranked.slice(TOP, TOP + RELATED).map(({ section }) => `- ${section.heading}`);
  if (related.length) top.push(`Other matches (pass a heading as the query to read it):\n${related.join("\n")}`);
  return top.join("\n\n");
}
