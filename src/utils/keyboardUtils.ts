export function isCtrlPressed(event?: MouseEvent) {
  return event && (event.ctrlKey || event.metaKey);
}
