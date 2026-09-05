import Quill from "quill";
import type Table from "quill/modules/table";
import "quill/dist/quill.snow.css";

// Quill's own align, size and font formats are ql-* classes that only render inside the editor. Inline
// styles render wherever a note is shown, and no whitelist keeps the sizes and fonts TinyMCE wrote
const { StyleAttributor, Scope } = Quill.import("parchment");
Quill.register("formats/align", Quill.import("attributors/style/align"), true);
Quill.register("formats/size", new StyleAttributor("size", "font-size", { scope: Scope.INLINE }), true);
Quill.register("formats/font", new StyleAttributor("font", "font-family", { scope: Scope.INLINE }), true);

// tags Quill can hold; a note with anything else (iframe, hr, script) is edited as raw HTML instead
const RICH_TEXT_TAGS = new Set(
  "p div br span strong b em i u s strike a img ol ul li blockquote pre h1 h2 h3 h4 h5 h6 sub sup table tbody tr td".split(
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

export const TOOLBAR_HTML = /* html */ `<div id="notesToolbar">
    <span class="ql-formats">
      <button class="ql-undo icon-ccw" data-tip="Undo"></button>
      <button class="ql-redo icon-cw" data-tip="Redo"></button>
    </span>
    <span class="ql-formats">
      <button class="ql-bold" data-tip="Bold"></button>
      <button class="ql-italic" data-tip="Italic"></button>
      <button class="ql-underline" data-tip="Underline"></button>
      <button class="ql-strike" data-tip="Strikethrough"></button>
    </span>
    <span class="ql-formats">
      <select class="ql-color"></select>
      <select class="ql-background"></select>
    </span>
    <span class="ql-formats">
      <select class="ql-align"></select>
      <select class="ql-size">
        <option value="10px">Small</option>
        <option selected>Normal</option>
        <option value="18px">Large</option>
        <option value="32px">Huge</option>
      </select>
    </span>
    <span class="ql-formats">
      <button class="ql-list" value="ordered" data-tip="Numbered list"></button>
      <button class="ql-list" value="bullet" data-tip="Bulleted list"></button>
      <button class="ql-blockquote" data-tip="Quote"></button>
    </span>
    <span class="ql-formats">
      <button class="ql-link" data-tip="Link"></button>
      <button class="ql-image" data-tip="Insert an image from a file"></button>
      <button class="ql-clean" data-tip="Clear formatting"></button>
    </span>
  </div>`;

// a <template> keeps a leading <script> or <style> in the fragment, where a text/html document would hoist it into <head>
export function canEditAsRichText(html: string): boolean {
  const template = document.createElement("template");
  template.innerHTML = html;
  return Array.from(template.content.querySelectorAll("*")).every(el => RICH_TEXT_TAGS.has(el.localName));
}

export function createRichTextEditor(host: HTMLElement, toolbar: HTMLElement, onChange: () => void): Quill {
  const quill = new Quill(host, {
    theme: "snow",
    placeholder: "No notes added. Click on an element (e.g. label or marker) and add a free text note",
    modules: {
      table: true,
      toolbar: {
        container: toolbar,
        handlers: {
          undo: () => quill.history.undo(),
          redo: () => quill.history.redo()
        }
      }
    }
  });

  quill.on("text-change", (_delta, _oldContents, source) => {
    if (source === "user") onChange();
  });

  return quill;
}

export function setEditorHtml(quill: Quill, html: string): void {
  quill.setContents(quill.clipboard.convert({ html }), "silent");
  quill.history.clear();
}

// Quill writes every space as &nbsp;, which stops the hover box from wrapping. It escapes a real U+00A0 as the
// character itself and a typed "&nbsp;" as &amp;nbsp;, so turning the entity back is lossless
export function getEditorHtml(quill: Quill): string {
  return quill.getLength() > 1 ? quill.getSemanticHTML().replaceAll("&nbsp;", " ") : "";
}

// the table module reads the live selection, which a click on a control outside the editor has just blurred
export function runTableAction(quill: Quill, action: string): void {
  const run = TABLE_ACTIONS[action];
  if (!run) return;
  quill.focus();
  run(quill.getModule("table") as Table);
}
