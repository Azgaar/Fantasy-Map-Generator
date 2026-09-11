import Quill, { Delta, type Range } from "quill";
import { BlockEmbed } from "quill/blots/block";
import { FontStyle } from "quill/formats/font";
import type Table from "quill/modules/table";
import { tip } from "@/components/tooltips";
import { ICONS } from "@/data/icons-list";
import "quill/dist/quill.snow.css";

// Quill's own align, size and font formats are ql-* classes that only render inside the editor. Inline
// styles render wherever a note is shown, and no whitelist keeps the sizes and fonts TinyMCE wrote
const { StyleAttributor, Scope } = Quill.import("parchment");
Quill.register("formats/align", Quill.import("attributors/style/align"), true);
Quill.register("formats/size", new StyleAttributor("size", "font-size", { scope: Scope.INLINE }), true);
FontStyle.whitelist = undefined;
Quill.register("formats/font", FontStyle, true);

class Divider extends BlockEmbed {
  static blotName = "divider";
  static tagName = "HR";

  static value(): boolean {
    return true;
  }
}
Quill.register(Divider);

// Unsupported markup stays in HTML mode. `pre` is absent on purpose: Quill holds a code block but
// getSemanticHTML writes it back empty, so a note with one would lose its code on the first edit
const RICH_TEXT_TAGS = new Set(
  "p div br hr span strong b em i u s strike a img ol ul li blockquote code h1 h2 h3 h4 h5 h6 sub sup table tbody tr td".split(
    " "
  )
);

const TABLE_ACTIONS: Record<string, (table: Table) => void> = {
  insert: table => table.insertTable(3, 3),
  "row-above": table => table.insertRowAbove(),
  "row-below": table => table.insertRowBelow(),
  "column-left": table => table.insertColumnLeft(),
  "column-right": table => table.insertColumnRight(),
  "delete-row": table => table.deleteRow(),
  "delete-column": table => table.deleteColumn(),
  "delete-table": table => table.deleteTable()
};

export const TOOLBAR_HTML = /* html */ `<div id="notesToolbar" role="toolbar" aria-label="Note formatting">
    <span class="ql-formats" role="group" aria-label="History">
      <button class="ql-undo icon-ccw" data-tip="Undo"></button>
      <button class="ql-redo icon-cw" data-tip="Redo"></button>
    </span>
    <span class="ql-formats" role="group" aria-label="Font and size">
      <select class="ql-font" data-tip="Font"><option selected>Font</option></select>
      <select class="ql-size" data-tip="Text size">
        <option value="10px">Small</option>
        <option selected>Normal</option>
        <option value="18px">Large</option>
        <option value="32px">Huge</option>
      </select>
    </span>
    <span class="ql-formats" role="group" aria-label="Text formatting">
      <button class="ql-bold" data-tip="Bold"></button>
      <button class="ql-italic" data-tip="Italic"></button>
      <button class="ql-underline" data-tip="Underline"></button>
      <button class="ql-strike" data-tip="Strikethrough"></button>
      <select class="ql-color" data-tip="Text color"></select>
      <select class="ql-background" data-tip="Highlight color"></select>
      <button class="ql-clean" data-tip="Clear formatting"></button>
    </span>
    <span class="ql-formats" role="group" aria-label="Paragraph formatting">
      <select class="ql-align" data-tip="Alignment"></select>
      <button class="ql-list" value="bullet" data-tip="Bulleted list"></button>
      <button class="ql-list" value="ordered" data-tip="Numbered list"></button>
      <button class="ql-indent" value="-1" data-tip="Decrease indent"></button>
      <button class="ql-indent" value="+1" data-tip="Increase indent"></button>
      <button class="ql-blockquote" data-tip="Quote"></button>
    </span>
    <span class="ql-formats" role="group" aria-label="Insert">
      <button class="ql-link" data-tip="Insert or edit a link (Ctrl+K)"></button>
      <button class="ql-image" data-tip="Insert an image from a file"></button>
      <select id="notesTable" class="notes-table" data-tip="Insert a table or edit the one under the cursor">
        <option value="" selected>Table</option>
        <option value="insert">Insert table</option>
        <option value="row-above">Add row above</option>
        <option value="row-below">Add row below</option>
        <option value="column-left">Add column left</option>
        <option value="column-right">Add column right</option>
        <option value="delete-row">Delete row</option>
        <option value="delete-column">Delete column</option>
        <option value="delete-table">Delete table</option>
      </select>
      <button class="ql-symbol" data-tip="Insert a symbol">Ω</button>
      <button class="ql-divider" data-tip="Horizontal rule">―</button>
    </span>
  </div>`;

const URL_SCHEME = /^[a-z][a-z\d+.-]*:/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BARE_HOST = /^[\w-]+(?:\.[\w-]+)+(?:[/?#].*)?$/;

// A host typed without a scheme becomes a relative href, which navigates the map away when the note is clicked
export function normalizeUrl(value: string): string {
  const url = value.trim();
  if (!url || URL_SCHEME.test(url) || "#/?".includes(url[0])) return url;
  if (EMAIL.test(url)) return `mailto:${url}`;
  return BARE_HOST.test(url) ? `https://${url}` : url;
}

// Quill prefills the link box with the selected text, which is the wanted url only when it reads like one
export function linkFromSelection(text: string): string {
  const value = text.trim();
  return URL_SCHEME.test(value) || EMAIL.test(value) || BARE_HOST.test(value) ? normalizeUrl(value) : "";
}

interface LinkTooltip {
  textbox: HTMLInputElement;
  linkRange?: Range;
  edit(mode: string, preview: string | null): void;
  save(): void;
  hide(): void;
}

// a <template> keeps a leading <script> or <style> in the fragment, where a text/html document would hoist it into <head>
function parseFragment(html: string): DocumentFragment {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content;
}

export function canEditAsRichText(html: string): boolean {
  return Array.from(parseFragment(html).querySelectorAll("*")).every(el => RICH_TEXT_TAGS.has(el.localName));
}

export function createRichTextEditor(
  host: HTMLElement,
  toolbar: HTMLElement,
  onChange: () => void,
  fontFamilies: string[] = []
): Quill {
  const fontSelect = toolbar.querySelector<HTMLSelectElement>(".ql-font");
  for (const family of new Set(fontFamilies)) fontSelect?.add(new Option(family, family));

  // where the link box was opened from, so a url typed with nothing selected can be inserted as its own text
  let linkTarget: Range | null = null;

  const quill = new Quill(host, {
    theme: "snow",
    placeholder: "Write the note here. It shows up in the notes box when the element is hovered or clicked",
    bounds: host, // otherwise the link tooltip is kept inside the body and drifts over the toolbar
    modules: {
      table: true,
      toolbar: {
        container: toolbar,
        handlers: {
          undo: () => quill.history.undo(),
          redo: () => quill.history.redo(),
          divider: () => insertDivider(quill),
          symbol: () => openSymbolPicker(quill, toolbar),
          image: () => insertImage(quill),
          link: (add: boolean) => {
            const tooltip = linkTooltip(quill);
            if (!add) {
              // a collapsed caret formats no text, so unlink the whole link it sits in
              if (tooltip.linkRange) quill.formatText(tooltip.linkRange, "link", false, "user");
              else quill.format("link", false, "user");
              return tooltip.hide();
            }
            linkTarget = quill.getSelection(true);
            if (linkTarget) tooltip.edit("link", linkFromSelection(quill.getText(linkTarget)));
          }
        }
      }
    }
  });

  const tooltip = linkTooltip(quill);
  const saveLink = tooltip.save.bind(tooltip);
  tooltip.save = () => {
    const url = normalizeUrl(tooltip.textbox.value);
    tooltip.textbox.value = url;
    // Quill formats the selection, so a url entered with none would apply to nothing
    if (url && !tooltip.linkRange && linkTarget?.length === 0) {
      quill.insertText(linkTarget.index, url, { link: url }, "user");
      quill.setSelection(linkTarget.index + url.length, 0, "user");
      tooltip.hide();
    } else saveLink();
    linkTarget = null;
  };

  for (const control of toolbar.querySelectorAll<HTMLElement>("[data-tip]")) {
    control.setAttribute("aria-label", control.dataset.tip!);
    control.title = control.dataset.tip!;
  }
  for (const item of toolbar.querySelectorAll<HTMLElement>(".ql-font .ql-picker-item")) {
    item.style.fontFamily = item.dataset.value || "inherit";
  }
  // Fixed menus stay visible outside the dialog's own scroll box.
  for (const picker of toolbar.querySelectorAll<HTMLElement>(".ql-picker")) {
    picker.removeAttribute("id"); // Quill copies every attribute of the select onto the picker, id included
    // the picker toggles on its own mousedown listener, so by now the menu is laid out and can be measured
    const positionMenu = () => {
      if (!picker.classList.contains("ql-expanded")) return;
      const rect = picker.getBoundingClientRect();
      const menu = picker.querySelector<HTMLElement>(".ql-picker-options")!;
      menu.style.left = `${Math.max(0, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 8))}px`;
      menu.style.top = `${rect.bottom}px`;
    };
    picker.addEventListener("mousedown", positionMenu);
    picker.addEventListener("keydown", positionMenu);
  }

  quill.on("text-change", (_delta, _oldContents, source) => {
    if (source === "user") onChange();
  });

  return quill;
}

export function setEditorHtml(quill: Quill, html: string): void {
  quill.container.parentElement?.querySelector<HTMLElement>(".notes-symbols")?.remove();
  // a generated note is plain text, where html would collapse the line breaks the generator wrote
  const source = parseFragment(html).querySelector("*") ? html : html.replace(/\r\n|\r|\n/g, "<br>");
  quill.setContents(quill.clipboard.convert({ html: source }), "silent");
  quill.history.clear();
}

// Quill writes every space as &nbsp;, which stops the hover box from wrapping. It escapes a real U+00A0 as the
// character itself and a typed "&nbsp;" as &amp;nbsp;, so turning the entity back is lossless
export function getEditorHtml(quill: Quill): string {
  const hasEmbed = quill.getContents().ops.some(op => typeof op.insert === "object");
  if (quill.getLength() <= 1 && !hasEmbed) return "";
  const template = document.createElement("template");
  template.innerHTML = quill.getSemanticHTML().replaceAll("&nbsp;", " ");
  for (const el of template.content.querySelectorAll<HTMLElement>('[class*="ql-indent-"]')) {
    const indent = Array.from(el.classList).find(name => /^ql-indent-[1-8]$/.test(name));
    if (indent && el.localName !== "li") el.style.paddingLeft = `${Number(indent.at(-1)) * 3}em`;
  }
  // Quill draws table gridlines from .ql-editor, so a saved note has to carry them itself
  for (const table of template.content.querySelectorAll<HTMLElement>("table")) {
    table.style.borderCollapse = "collapse";
  }
  for (const cell of template.content.querySelectorAll<HTMLElement>("td")) {
    cell.style.border = "1px solid #000";
    cell.style.padding = "2px 5px";
  }
  return template.innerHTML;
}

/** Build a selection preview in a detached editor; the live editor is never changed. */
export function previewSelectionReplacement(quill: Quill, range: Range, html: string): string {
  if (range.index < 0 || range.length < 1 || range.index + range.length > quill.getLength())
    throw new Error("The note selection changed");
  const replacement = quill.clipboard.convert({ html });
  const lastInsert = replacement.ops.at(-1)?.insert;
  if (
    quill.getText(range.index, range.length).endsWith("\n") &&
    !(typeof lastInsert === "string" && lastInsert.endsWith("\n"))
  )
    replacement.insert("\n", quill.getFormat(range.index + range.length - 1, 1));
  const change = new Delta().retain(range.index).delete(range.length).concat(replacement);
  const scratch = new Quill(document.createElement("div"), { modules: { toolbar: false, table: true } });
  scratch.setContents(quill.getContents().compose(change), "silent");
  return getEditorHtml(scratch);
}

function linkTooltip(quill: Quill): LinkTooltip {
  return (quill.theme as unknown as { tooltip: LinkTooltip }).tooltip;
}

function insertDivider(quill: Quill): void {
  const range = quill.getSelection(true);
  if (!range) return;
  const [line, offset] = quill.getLine(range.index);
  const change = new Delta().retain(range.index).delete(range.length);
  if (offset) change.insert("\n", line?.formats());
  change.insert({ divider: true }).insert("\n");
  quill.history.cutoff();
  quill.updateContents(change, "user");
  quill.setSelection(range.index + (offset ? 2 : 1), 0, "silent");
  quill.history.cutoff();
}

// Quill's own handler inlines any file as a data uri, and the note is stored inside the .map file
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

function insertImage(quill: Quill): void {
  const range = quill.getSelection(true);
  if (!range) return;

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE) {
      const size = (file.size / 1024 / 1024).toFixed(1);
      return tip(
        `The image is ${size} MB. Images are stored inside the map file, the limit is 2 MB`,
        false,
        "error",
        5000
      );
    }

    const reader = new FileReader();
    reader.onload = () => {
      quill.insertEmbed(range.index, "image", reader.result as string, "user");
      quill.setSelection(range.index + 1, 0, "silent");
    };
    reader.readAsDataURL(file);
  });
  input.click();
}

function openSymbolPicker(quill: Quill, toolbar: HTMLElement): void {
  const range = quill.getSelection(true);
  if (!range) return;
  toolbar.parentElement?.querySelector(".notes-symbols")?.remove();
  const picker = document.createElement("div");
  picker.className = "notes-symbols";
  picker.popover = "auto";
  picker.setAttribute("aria-label", "Insert a symbol");
  const symbols = [...new Set([..."©®™°±×÷−≠≈≤≥∞√∑πΩµ•†‡§¶…–—«»‘’“”←↑→↓↔★☆✓✗", ...ICONS])];
  for (const symbol of symbols) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = symbol;
    button.setAttribute("aria-label", `Insert ${symbol}`);
    button.addEventListener("click", () => {
      insertSymbol(quill, range, symbol);
      picker.remove();
    });
    picker.append(button);
  }
  toolbar.parentElement?.append(picker);
  picker.showPopover();
  const rect = toolbar.querySelector(".ql-symbol")!.getBoundingClientRect();
  picker.style.left = `${Math.max(0, Math.min(rect.left, window.innerWidth - picker.offsetWidth - 8))}px`;
  picker.style.top = `${rect.bottom}px`;
}

export function insertSymbol(quill: Quill, range: Range, symbol: string): void {
  quill.history.cutoff();
  quill.updateContents(
    new Delta().retain(range.index).delete(range.length).insert(symbol, quill.getFormat(range)),
    "user"
  );
  quill.setSelection(range.index + symbol.length, 0, "user");
  quill.history.cutoff();
}

// the table module reads the live selection, which a click on a control outside the editor has just blurred
export function runTableAction(quill: Quill, action: string): void {
  const run = TABLE_ACTIONS[action];
  if (!run) return;
  quill.focus();
  run(quill.getModule("table") as Table);
}
