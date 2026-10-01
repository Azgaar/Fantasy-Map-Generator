// Help search for read_help: keyword scoring over the Knowledge Base questions and the wiki's page sections

const TOP = 3;
const RELATED = 6;
const CLIPPED = 2500; // a long section in the results is cut; asking for its heading returns all of it
const SKIPPED_PAGES = new Set(["_Footer", "Home", "Changelog", "Dependencies"]);
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
  const pages = import.meta.glob<string>("../../../../docs/wiki/*.md", { query: "?raw", import: "default" });
  const loaded = await Promise.all(
    Object.entries(pages).map(async ([path, read]) => [path.match(/([^/]+)\.md$/)![1], await read()] as const)
  );
  return loaded.flatMap(([page, source]) => (SKIPPED_PAGES.has(page) ? [] : pageSections(page, source)));
}

/** Knowledge Base sections keep their question as the heading; wiki sections are headed "Page › Section" */
function pageSections(page: string, source: string): Section[] {
  const title = page.replace(/-/g, " ");
  const kb = page === "Knowledge Base";
  return source.split(/(?=^#{2,3} )/m).flatMap(part => {
    const own = part.match(/^#{2,3} (.+)$/m)?.[1];
    if (kb && !own) return [];
    const heading = kb ? own! : own ? `${title} › ${own}` : title;
    const body = own ? part.replace(/^#{2,3} .+$/m, "").trim() : part.trim();
    if (!body) return [];
    return [
      {
        heading,
        text: `### ${heading}\n\n${body}`,
        headingTerms: new Set(terms(heading)),
        bodyTerms: new Set(terms(body))
      }
    ];
  });
}

const clip = (text: string): string =>
  text.length <= CLIPPED ? text : `${text.slice(0, CLIPPED)}\n… (cut: pass the heading as the query to read it all)`;

/** Best-matching sections, then headings of the next matches; an exact heading returns just that section in full */
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
  if (!ranked.length) return `No help sections match "${query}". Try other words.`;

  const top = ranked.slice(0, TOP).map(({ section }) => clip(section.text));
  const related = ranked.slice(TOP, TOP + RELATED).map(({ section }) => `- ${section.heading}`);
  if (related.length) top.push(`Other matches (pass a heading as the query to read it):\n${related.join("\n")}`);
  return top.join("\n\n");
}
