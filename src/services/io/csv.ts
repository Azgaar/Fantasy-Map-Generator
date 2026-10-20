import { csvFormatRows, csvParseRows } from "d3";
import { createFileInput, downloadFile, getFileName } from "@/utils/fileUtils";
import { t } from "@/utils/i18n";

type Cell = string | number | boolean | null | undefined;

interface ReadOptions {
  required: readonly string[];
  units?: readonly string[]; // columns exported with a unit, such as "Area mi2"
}

interface Table {
  rows: Record<string, string>[];
  unknown: string[];
}

const UNSAFE = /["<>]/;
const UNSAFE_CHARS = '" < >';

/** Comma-separated tables: downloads quote what needs it, uploads are checked before any value is used */
class CsvService {
  private input: HTMLInputElement | null = null;

  /** Save a table as `<map> <name>.csv`; null and undefined become empty cells */
  download(name: string, header: readonly string[], rows: readonly (readonly Cell[])[]): void {
    const cells = rows.map(row => row.map(cell => (cell === null || cell === undefined ? "" : String(cell))));
    const bom = "\uFEFF"; // spreadsheets read the file as UTF-8 only with it
    downloadFile(bom + csvFormatRows([[...header], ...cells]), `${getFileName(name)}.csv`, "text/csv");
  }

  /** Ask for a file and pass its text on */
  pick(onLoad: (text: string) => void, accept = ".csv"): void {
    this.input ??= createFileInput(accept);
    const input = this.input;
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      input.value = "";
      if (file) onLoad(await file.text());
    };
    input.click();
  }

  /** Rows of a comma-separated text without blank ones; an empty or semicolon-separated text throws */
  parse(text: string): string[][] {
    const firstLine = text.trimStart().split(/\r?\n/, 1)[0];
    if (firstLine.includes(";") && !firstLine.includes(","))
      throw new Error(t("Only comma-separated CSV files are supported"));
    const rows = csvParseRows(text).filter(cells => cells.some(cell => cell.trim()));
    if (!rows.length) throw new Error(t("No data to upload"));
    return rows;
  }

  /** Data rows keyed by the known columns, matched ignoring case and outer spaces; other headers are listed as unknown */
  read(text: string, known: readonly string[], { required, units = [] }: ReadOptions): Table {
    const [header, ...body] = this.parse(text);
    const keys = header.map(name => {
      const key = name.trim().toLowerCase();
      return known.find(column => {
        const lower = column.toLowerCase();
        return key === lower || (units.includes(column) && key.startsWith(`${lower} `));
      });
    });
    const absent = required.find(column => !keys.includes(column));
    if (absent) throw new Error(t("The file has no {{column}} column", { column: absent }));
    if (!body.length) throw new Error(t("No data to upload"));

    const rows = body.map(cells => {
      const row: Record<string, string> = {};
      keys.forEach((key, i) => {
        if (key) row[key] = cells[i] ?? "";
      });
      return row;
    });
    return {
      rows,
      unknown: header.filter((name, i) => name.trim() && !keys[i])
    };
  }

  /** The message for a text that holds characters breaking the editors' markup, if it does */
  unsafeText(text: string): string | undefined {
    return UNSAFE.test(text) ? t("Text cannot contain {{chars}}", { chars: UNSAFE_CHARS }) : undefined;
  }

  /** The living entity with this name, for cells that refer to another entity by name */
  byName<T extends { name?: string; removed?: boolean }>(
    list: T[],
    name: string,
    test: (entity: T) => boolean = () => true
  ): T {
    const entity = list.find(
      item => item && typeof item === "object" && !item.removed && item.name === name && test(item)
    );
    if (!entity) throw new Error(`Name not found: ${name}`);
    return entity;
  }
}

export const Csv = new CsvService();
