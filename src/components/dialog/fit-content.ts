// Fork's dialog fit-content gutter fix (see docs/domain lessons: editor_dialog_fit_content_gutter).
// Ported verbatim from public/modules/ui/editors.js (upstream-deleted file).
// get browser-defined fit-content
export function fitContent(): string {
  return !("chrome" in window) ? "-moz-max-content" : "fit-content";
}
