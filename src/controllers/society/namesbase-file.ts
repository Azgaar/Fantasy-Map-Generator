import { z } from "zod";
import { NAME_BASE_SCHEMA } from "@/model/society/names/name-base-schema";
import { Names } from "@/model/society/names/names-generator";
import type { NameBase } from "@/types/names";
import { Dialog } from "@/ui/dialog/dialog";
import { tip } from "@/ui/tooltips";
import { sentences, t } from "@/utils/i18n";
import { log } from "@/utils/logger";
import { escapeHtml, safeParseJSON } from "@/utils/string-utils";

interface ParseError {
  id: number;
  line: string;
  error: string;
}

/** The text of a namesbase file: a base a line */
function format(bases: NameBase[]): string {
  return `[\n${bases.map(base => JSON.stringify(base)).join(",\n")}\n]`;
}

/** The bases of a namesbase file; what cannot be read is told to the user */
function parse(data: string): NameBase[] {
  const errors: ParseError[] = [];
  const bases = /^\s*[[{]/.test(data) ? parseJson(data) : parseLegacy(data, errors);
  if (errors.length) showParseErrors(errors, bases.length);
  else if (!bases.length)
    tip(sentences(t("Cannot load a namesbase"), t("Please check the data format")), false, "error");
  return bases;
}

/** The bases with an id of its own for each one whose id is taken */
function withOwnIds(bases: NameBase[], taken: string[]): NameBase[] {
  const ids = [...taken];
  return bases.map(base => {
    const id = ids.includes(base.id) ? Names.uniqueId(base.name, ids) : base.id;
    ids.push(id);
    return { ...base, id };
  });
}

/** The bases that differ from the loaded built-in ones */
function withoutShipped(bases: NameBase[]): NameBase[] {
  const asFiled = (base: NameBase) => JSON.stringify(NAME_BASE_SCHEMA.parse(base)); // its fields in one order
  return bases.filter(base => {
    const listed = Names.find(base.id);
    return !listed || !Names.isShipped(listed) || asFiled(listed) !== asFiled(base);
  });
}

/** A JSON file holds one base or a list */
function parseJson(data: string): NameBase[] {
  const parsed: unknown = safeParseJSON(data);
  const { data: bases = [] } = z.array(NAME_BASE_SCHEMA).safeParse(Array.isArray(parsed) ? parsed : [parsed]);
  return withOwnIds(bases as NameBase[], []);
}

/** An older file holds a line of name|min|max|doubled|m|names for each base */
function parseLegacy(data: string, errors: ParseError[]): NameBase[] {
  const ids: string[] = [];
  const lines = data
    .replace(/\r\n|\r/g, "\n")
    .split("\n")
    .filter(Boolean);

  return lines.flatMap((line, index) => {
    try {
      const [name, min, max, doubled, , names] = line.split("|");
      if (!name) throw new Error(t("Name is missing"));
      if (!names) throw new Error(t("Names are missing"));
      const id = Names.uniqueId(name, ids);
      ids.push(id);
      return Names.composeBase(id, name, [+min, +max], names.split(","), doubled);
    } catch (e) {
      errors.push({ id: index + 1, line, error: (e as Error).message });
      log.error(e);
      return [];
    }
  });
}

function showParseErrors(errors: ParseError[], added: number): void {
  log.error("Namesbase upload errors", errors);
  const errorItems = errors
    .map(
      ({ id, line, error }) => /* html */ `<li style="padding:0.6em 0;border-top:1px solid #ddd;">
            <div>
              ${t("Line {{number}}", { number: id })}:
              <span style="color:#8b0000">${escapeHtml(error)}.</span> ${t("Data")}:
            </div>
            <div style="margin-top:0.35em;font-family:var(--font-monospace,monospace);line-height:1.4;word-break:break-word;color:#333;">
              ${escapeHtml(line) || `<i>${t("empty line")}</i>`}
            </div>
          </li>`
    )
    .join("");

  Dialog.message({
    message: /* html */ `<div>
        <p style="margin:0.75em;">
          <strong>${t("File parsing error. Only {{added}} out of {{total}} namebases added.", {
            added,
            total: added + errors.length
          })}</strong>
          ${t("Each namebase should be on its own line and follow the format: name|min|max|duplication|m|names. Parameters should be separated with the | character, and this character should not be used within the parameters. Another prohibited character is /. The most common issue is names and other parameters being on two separate lines.")}
          <ul style="margin:0.5em;">
            <li><code>name</code>: ${t("name of the base.")}</li>
            <li><code>min</code>: ${t("minimal recommended length of generated names. It should be a number.")}</li>
            <li><code>max</code>: ${t("maximal recommended length of generated names. It should be a number greater than minimal length.")}</li>
            <li><code>duplication</code>: ${t("characters that can be duplicated in generated names. For example lkd means names like “Kalla”, “Mikkor”, “Dalddur” are possible. This parameter can be empty.")}</li>
            <li><code>m</code>: ${t("unused parameter, populate with 0.")}</li>
            <li><code>names</code>: ${t("names data, separated with commas. It should contain at least 3 names to be valid.")}</li>
          </ul>
        </p>
        <div>
          <ul style="margin:0;padding-left:1.5em;">
            ${errorItems}
          </ul>
        </div>
      </div>`,
    title: t("Parsing error"),
    width: "min(72vw, 68em)",
    position: { my: "center center-4em", at: "center", of: "svg" },
    buttons: [{ label: t("Continue") }]
  });
}

export const NamesbaseFile = { format, parse, withOwnIds, withoutShipped };
