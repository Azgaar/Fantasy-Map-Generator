// Releases read from the wiki changelog, docs/wiki/Changelog.md: a bold linked version header, then one-line changes

import { renderMarkdown } from "@/utils/markdown";

export type Release = { version: string; date?: string; changes: string[] };

const HEADER = /^\*\*\[(\d+\.\d+(?:\.\d+)?)\]\([^)]*\)(?:\s*-\s*(\d{4}-\d{2}-\d{2}))?\*\*/;

/** Releases in the changelog's order, newest first. Old two-part versions (1.140) get a zero patch */
export function parseChangelog(markdown: string): Release[] {
  const releases: Release[] = [];
  for (const line of markdown.split("\n")) {
    const header = line.match(HEADER);
    if (header) releases.push({ version: withPatch(header[1]!), date: header[2], changes: [] });
    else if (line.startsWith("- ")) releases.at(-1)?.changes.push(line.slice(2).trim());
  }
  return releases;
}

/** Changes as a list; the changelog's `_italic_` credits become `*italic*`, which the renderer knows */
export function renderChanges(changes: string[]): string {
  return renderMarkdown(changes.map(change => `- ${underscoresToAsterisks(change)}`).join("\n"));
}

const withPatch = (version: string): string => (version.split(".").length === 2 ? `${version}.0` : version);

const underscoresToAsterisks = (change: string): string =>
  change.replace(/_(\[[^\]]+\]\([^)\s]+\))_/g, "*$1*").replace(/(^|\s)_([^_\s][^_]*?)_(?=[\s.,;:!?)]|$)/g, "$1*$2*");
