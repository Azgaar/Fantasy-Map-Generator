// A small Markdown-to-HTML renderer for chat answers — headings, lists, tables, code, links and the
// common inline marks. Not a CommonMark implementation: it covers what a model writes in an answer,
// with no dependency and no HTML passthrough (every leaf is escaped, so model output cannot inject
// markup).

interface ListItem {
  indent: number;
  ordered: boolean;
  text: string;
}

const FENCE = /^ {0,3}```(\S*)\s*$/;
const HEADING = /^ {0,3}(#{1,6})\s+(.*)$/;
const RULE = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^ {0,3}>\s?(.*)$/;
const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const TABLE_DIVIDER = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/;

// Code spans are parked behind a NUL-delimited marker: it survives escaping and can never appear
// in model output or in a tag we generate
const PLACEHOLDER = String.fromCharCode(0);
const PLACEHOLDER_PATTERN = new RegExp(`${PLACEHOLDER}(\\d+)${PLACEHOLDER}`, "g");

export function renderMarkdown(source: string): string {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const html: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index++;
      continue;
    }

    if (FENCE.test(line)) {
      const code: string[] = [];
      index++;
      while (index < lines.length && !FENCE.test(lines[index])) code.push(lines[index++]);
      index++; // closing fence, or the end of the input
      html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      // a document h1 is far too loud inside a chat bubble, so the whole scale is shifted down
      const level = Math.min(heading[1].length + 2, 6);
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      index++;
      continue;
    }

    if (RULE.test(line)) {
      html.push("<hr />");
      index++;
      continue;
    }

    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (index < lines.length && QUOTE.test(lines[index])) quoted.push(lines[index++].match(QUOTE)?.[1] ?? "");
      html.push(`<blockquote>${renderMarkdown(quoted.join("\n"))}</blockquote>`);
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const items: ListItem[] = [];
      while (index < lines.length) {
        const match = lines[index].match(LIST_ITEM);
        if (!match) break;
        items.push({ indent: match[1].length, ordered: /\d/.test(match[2]), text: match[3] });
        index++;
      }
      html.push(buildList(items, 0).html);
      continue;
    }

    if (line.includes("|") && index + 1 < lines.length && TABLE_DIVIDER.test(lines[index + 1])) {
      index = buildTable(lines, index, html);
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !startsBlock(lines[index])) paragraph.push(lines[index++]);
    html.push(`<p>${paragraph.map(inline).join("<br />")}</p>`);
  }

  return html.join("");
}

function startsBlock(line: string): boolean {
  return FENCE.test(line) || HEADING.test(line) || RULE.test(line) || QUOTE.test(line) || LIST_ITEM.test(line);
}

// Nested lists are built by recursion so that a child list stays inside its parent's <li>
function buildList(items: ListItem[], start: number): { html: string; next: number } {
  const { indent, ordered } = items[start];
  const contents: string[] = [];
  let index = start;

  while (index < items.length && items[index].indent >= indent) {
    if (items[index].indent > indent && contents.length) {
      const nested = buildList(items, index);
      contents[contents.length - 1] += nested.html;
      index = nested.next;
      continue;
    }
    contents.push(inline(items[index].text));
    index++;
  }

  const tag = ordered ? "ol" : "ul";
  return { html: `<${tag}>${contents.map(content => `<li>${content}</li>`).join("")}</${tag}>`, next: index };
}

function buildTable(lines: string[], start: number, html: string[]): number {
  const headers = splitRow(lines[start]);
  const alignments = splitRow(lines[start + 1]).map(cell => {
    if (cell.startsWith(":") && cell.endsWith(":")) return ' style="text-align: center"';
    if (cell.endsWith(":")) return ' style="text-align: right"';
    return "";
  });

  const cell = (content: string, column: number, tag: "th" | "td"): string =>
    `<${tag}${alignments[column] ?? ""}>${inline(content)}</${tag}>`;

  const rows: string[] = [];
  let index = start + 2;
  while (index < lines.length && lines[index].includes("|")) {
    const values = splitRow(lines[index]);
    rows.push(`<tr>${values.map((value, column) => cell(value, column, "td")).join("")}</tr>`);
    index++;
  }

  const head = headers.map((header, column) => cell(header, column, "th")).join("");
  html.push(`<table><thead><tr>${head}</tr></thead><tbody>${rows.join("")}</tbody></table>`);
  return index;
}

const splitRow = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map(value => value.trim());

// Inline marks. Code spans are pulled out first so that their contents are never re-parsed, then
// everything else is escaped before any tag of ours is introduced.
function inline(text: string): string {
  const codes: string[] = [];
  const withPlaceholders = text.replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(`<code>${escapeHtml(code)}</code>`);
    return `${PLACEHOLDER}${codes.length - 1}${PLACEHOLDER}`;
  });

  const marked = escapeHtml(withPlaceholders)
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (whole, label: string, href: string) =>
      /^https?:\/\//i.test(href) ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>` : whole
    )
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, "<strong>$2</strong>")
    .replace(/\*(?=\S)([^*\n]*\S)\*/g, "<em>$1</em>")
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, "<del>$1</del>");

  return marked.replace(PLACEHOLDER_PATTERN, (_, id: string) => codes[Number(id)]);
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
