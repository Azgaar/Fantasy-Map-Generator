import Quill, { Delta, type Range } from "quill";
import { BlockEmbed } from "quill/blots/block";
import { FontStyle } from "quill/formats/font";
import type Table from "quill/modules/table";
import { ICONS } from "@/data/icons-list";
import { tip } from "@/ui/tooltips";
import "quill/dist/quill.snow.css";
import { t } from "@/utils/i18n";

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

/** The formatting toolbar, with the id its editor finds it by: two editors can be open at once */
export const getToolbarHtml = (
  id: string
): string => /* html */ `<div id="${id}" class="notes-toolbar" role="toolbar" aria-label="${t("Note formatting")}">
    <span class="ql-formats" role="group" aria-label="${t("History")}">
      <button class="ql-undo icon-ccw" data-tip="${t("Undo")}"></button>
      <button class="ql-redo icon-cw" data-tip="${t("Redo")}"></button>
    </span>
    <span class="ql-formats" role="group" aria-label="${t("Font and size")}">
      <select class="ql-font" data-tip="${t("Font")}"><option selected>${t("Font")}</option></select>
      <select class="ql-size" data-tip="${t("Text size")}">
        <option value="10px">${t("Small")}</option>
        <option selected>${t("Normal")}</option>
        <option value="18px">${t("Large")}</option>
        <option value="32px">${t("Huge")}</option>
      </select>
    </span>
    <span class="ql-formats" role="group" aria-label="${t("Text formatting")}">
      <button class="ql-bold" data-tip="${t("Bold")}"></button>
      <button class="ql-italic" data-tip="${t("Italic")}"></button>
      <button class="ql-underline" data-tip="${t("Underline")}"></button>
      <button class="ql-strike" data-tip="${t("Strikethrough")}"></button>
      <select class="ql-color" data-tip="${t("Text color")}"></select>
      <select class="ql-background" data-tip="${t("Highlight color")}"></select>
      <button class="ql-clean" data-tip="${t("Clear formatting")}"></button>
    </span>
    <span class="ql-formats" role="group" aria-label="${t("Paragraph formatting")}">
      <select class="ql-align" data-tip="${t("Alignment")}"></select>
      <button class="ql-list" value="bullet" data-tip="${t("Bulleted list")}"></button>
      <button class="ql-list" value="ordered" data-tip="${t("Numbered list")}"></button>
      <button class="ql-indent" value="-1" data-tip="${t("Decrease indent")}"></button>
      <button class="ql-indent" value="+1" data-tip="${t("Increase indent")}"></button>
      <button class="ql-blockquote" data-tip="${t("Quote")}"></button>
    </span>
    <span class="ql-formats" role="group" aria-label="${t("Insert")}">
      <button class="ql-link" data-tip="${t("Insert or edit a link (Ctrl+K)")}"></button>
      <button class="ql-image" data-tip="${t("Insert an image from a file")}"></button>
      <select class="notes-table" data-tip="${t("Insert a table or edit the one under the cursor")}">
        <option value="" selected>${t("Table")}</option>
        <option value="insert">${t("Insert table")}</option>
        <option value="row-above">${t("Add row above")}</option>
        <option value="row-below">${t("Add row below")}</option>
        <option value="column-left">${t("Add column left")}</option>
        <option value="column-right">${t("Add column right")}</option>
        <option value="delete-row">${t("Delete row")}</option>
        <option value="delete-column">${t("Delete column")}</option>
        <option value="delete-table">${t("Delete table")}</option>
      </select>
      <button class="ql-symbol" data-tip="${t("Insert a symbol")}">Ω</button>
      <button class="ql-divider" data-tip="${t("Horizontal rule")}">―</button>
    </span>
  </div>`;

/** The toolbar and the editing surface, the same in every editor */
export const RICH_TEXT_STYLE = /* css */ `
      .notes-toolbar { display: flex; flex-wrap: wrap; align-items: center; flex-shrink: 0; gap: 2px 9px; padding: 4px 6px; background: #f6f5f8; border-radius: 3px 3px 0 0; }
      .notes-toolbar[hidden] { display: none; }
      /* nothing to format while no note is selected */
      .notes-toolbar:has(+ .notes-legend.ql-disabled) { opacity: 0.45; pointer-events: none; }
      .notes-toolbar .ql-formats { display: flex; align-items: center; flex-shrink: 0; margin: 0; }
      .notes-toolbar button, .notes-toolbar .ql-color-picker, .notes-toolbar .ql-icon-picker { width: 26px; height: 26px; }
      .notes-toolbar button { padding: 4px; border-radius: 4px; transition: background-color 0.1s; }
      .notes-toolbar .ql-picker { height: 26px; color: #333; }
      .notes-toolbar .ql-picker-label { border-radius: 4px; }
      .notes-toolbar button:hover, .notes-toolbar .ql-picker-label:hover, .notes-toolbar .ql-expanded .ql-picker-label { background: #ece9f3; }
      .notes-toolbar button.ql-active, .notes-toolbar .ql-picker-label.ql-active { background: #e0d9f0; box-shadow: inset 0 0 0 1px #c4b8e0; }
      /* Quill tints hover and active blue, which fights the app's violet accent */
      .notes-toolbar :is(button:hover, button.ql-active, .ql-picker-label:hover, .ql-active) .ql-stroke { stroke: #5e4fa2; }
      .notes-toolbar :is(button:hover, button.ql-active, .ql-picker-label:hover, .ql-active) .ql-fill { fill: #5e4fa2; }
      .notes-toolbar button:focus-visible, .notes-toolbar .ql-picker-label:focus-visible { outline: 2px solid #5e4fa2; outline-offset: -2px; }
      .notes-toolbar .ql-symbol, .notes-toolbar .ql-divider { font-size: 17px; line-height: 17px; color: #444; }
      .notes-toolbar :is(.ql-symbol, .ql-divider):hover { color: #5e4fa2; }
      .notes-toolbar .ql-font { width: 112px; margin-right: 3px; }
      .notes-toolbar .ql-size { width: 76px; }
      /* Quill previews each size by its own name, which the inline-style values are not */
      .notes-toolbar .ql-size .ql-picker-item[data-value="10px"]::before { font-size: 10px; }
      .notes-toolbar .ql-size .ql-picker-item[data-value="18px"]::before { font-size: 18px; }
      .notes-toolbar .ql-size .ql-picker-item[data-value="32px"]::before { font-size: 32px; }
      .notes-toolbar .notes-table { width: 68px; }
      .notes-toolbar :is(.ql-font, .ql-size, .notes-table) .ql-picker-label { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; padding-right: 18px; font-weight: 400; background: white; border: 1px solid #dedbe2; }
      .notes-toolbar .ql-font .ql-picker-label::before, .notes-toolbar .ql-font .ql-picker-item::before, .notes-toolbar .notes-table .ql-picker-label::before, .notes-toolbar .notes-table .ql-picker-item::before { content: attr(data-label); }
      /* Fixed menus escape the dialog's own scroll box */
      .notes-toolbar .ql-picker-options { position: fixed; /* Quill sizes the menu with min-width: 100%, which once fixed is 100% of the viewport */
        min-width: 0; z-index: 2000; max-height: 45vh; overflow-y: auto; margin-top: 3px; padding: 4px; border-radius: 4px; box-shadow: 0 4px 14px #00000026; }
      .notes-toolbar .ql-picker-item { border-radius: 3px; }
      .notes-toolbar .ql-picker-item:hover { background: #ece9f3; }
      .notes-toolbar .ql-font .ql-picker-options, .notes-toolbar .notes-table .ql-picker-options { min-width: 180px; }
      .notes-symbols { margin: 0; padding: 6px; width: 340px; max-width: calc(100vw - 24px); max-height: 40vh; overflow: auto; background: white; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 4px 14px #00000026; }
      .notes-symbols:popover-open { display: grid; grid-template-columns: repeat(auto-fill, minmax(28px, 1fr)); gap: 2px; }
      .dialog .notes-symbols button { margin: 0; min-height: 28px; padding: 2px; font-size: 18px; background: white; border: 0; border-radius: 3px; }
      .notes-symbols button:hover, .notes-symbols button:focus-visible { background: #ece9f3; }
            .notes-legend { border-radius: 0 0 3px 3px; }
      /* the editing surface should read like the note itself, not like a form field */
      .notes-legend .ql-editor { padding: 12px 16px; font-family: var(--sans-serif); font-size: 14px; line-height: 1.55; color: #1c1c1c; }
      .notes-legend .ql-editor p { margin-bottom: 0.35em; }
      .notes-legend .ql-editor hr { margin: 0.8em 0; border: 0; border-top: 1px solid #c9c5d0; }
      .notes-legend .ql-editor blockquote { color: #444; }
      .notes-legend .ql-editor.ql-blank::before { left: 16px; right: 16px; color: #9a96a3; font-style: italic; }
      /* the link box: Quill's is a bare white strip with blue text links for Edit and Remove */
      .notes-legend .ql-tooltip { z-index: 3; padding: 6px 10px; color: #333; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 4px 14px #00000026; }
      .notes-legend .ql-tooltip::before { content: "Link:"; margin-right: 8px; color: #77737f; }
      .notes-legend .ql-tooltip[data-mode="link"]::before { content: "Enter link:"; }
      .notes-legend .ql-tooltip input[type="text"] { width: 17em; max-width: 50vw; height: 26px; padding: 3px 6px; border: 1px solid #dedbe2; border-radius: 3px; }
      .notes-legend .ql-tooltip input[type="text"]:focus { outline: 2px solid #5e4fa2; outline-offset: -2px; }
      .notes-legend .ql-tooltip a { color: #5e4fa2; }
      .notes-legend .ql-tooltip a.ql-preview { max-width: 22em; }
      .notes-legend .ql-tooltip a.ql-action::after, .notes-legend .ql-tooltip a.ql-remove::before { margin-left: 8px; padding: 2px 6px; border: 0; border-radius: 3px; }
      .notes-legend .ql-tooltip a:hover::after, .notes-legend .ql-tooltip a:hover::before { background: #ece9f3; }
`;

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
    // Exclude video/formula: their HTML exporters interpolate unescaped values (CVE-2025-15056).
    formats: [
      "align",
      "direction",
      "indent",
      "background",
      "color",
      "font",
      "size",
      "blockquote",
      "code-block",
      "header",
      "list",
      "bold",
      "code",
      "italic",
      "link",
      "script",
      "strike",
      "underline",
      "image",
      "table",
      "divider"
    ],
    placeholder: t("Write the note here. It shows up in the notes box when the element is hovered or clicked"),
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
        t("The image is {{size}} MB. Images are stored inside the map file, the limit is 2 MB", { size }),
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
  picker.setAttribute("aria-label", t("Insert a symbol"));
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
