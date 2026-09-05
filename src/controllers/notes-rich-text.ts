// Pre-Quill stand-in for the Quill module of the same name (Azgaar #1803 branch). Only the
// representable check is needed by the assistant's write_note tool; the Quill branch replaces this
// file wholesale at merge time.

const RICH_TEXT_TAGS = new Set([
  "p",
  "div",
  "br",
  "span",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "a",
  "img",
  "ol",
  "ul",
  "li",
  "blockquote",
  "pre",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "sub",
  "sup",
  "table",
  "tbody",
  "tr",
  "td",
  "th"
]);

export function canEditAsRichText(html: string): boolean {
  if (!html.trim()) return true;
  // a template keeps every element in the fragment (DOMParser would move a leading <script> into <head>)
  const template = document.createElement("template");
  template.innerHTML = html;
  const elements = [...template.content.querySelectorAll("*")];
  return elements.every(element => RICH_TEXT_TAGS.has(element.tagName.toLowerCase()));
}
