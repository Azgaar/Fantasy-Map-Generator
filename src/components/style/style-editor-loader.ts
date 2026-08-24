import type { StyleEditorApi } from "./style-editor-runtime";

let editorPromise: Promise<StyleEditorApi> | null = null;

export function loadStyleEditor(): Promise<StyleEditorApi> {
  editorPromise ??= import("./style-editor-runtime").then(() => window.StyleEditor);
  return editorPromise;
}

const deferredEditor: StyleEditorApi = {
  calculateFriendlyGridSize: () => void loadStyleEditor().then(editor => editor.calculateFriendlyGridSize()),
  changeFont: () => void loadStyleEditor().then(editor => editor.changeFont()),
  edit: (element, group) => void loadStyleEditor().then(editor => editor.edit(element, group)),
  refresh: () => void loadStyleEditor().then(editor => editor.refresh()),
  updateTextureSelectValue: href => void loadStyleEditor().then(editor => editor.updateTextureSelectValue(href))
};

window.StyleEditor = deferredEditor;

const styleTab = document.getElementById("styleTab");
styleTab?.addEventListener("focus", () => void loadStyleEditor(), { once: true });
styleTab?.addEventListener("pointerenter", () => void loadStyleEditor(), { once: true });
