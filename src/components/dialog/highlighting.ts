import { debounce, findEl, getPointer } from "@/utils";

const cleanups = new Map<string, () => void>();

/** Highlight matching dialog lines while hovering the map. The listener is removed when the dialog closes. */
export function applyLineHighlighting(
  dialogId: string,
  resolveLineId: (context: { target: Element; cellId: number }) => number | undefined
): void {
  cleanups.get(dialogId)?.();

  const viewbox = findEl("viewbox");
  const dialog = findEl(dialogId);
  if (!viewbox || !dialog) return;

  const highlight = debounce((event: MouseEvent | TouchEvent) => {
    if (!(event.target instanceof Element) || !pack.cells?.p) return;

    const [x, y] = getPointer(event, viewbox);
    const cellId = Pack.findCell(x, y);
    const lineId = cellId === undefined ? undefined : resolveLineId({ target: event.target, cellId });

    if (lineId === undefined) unhighlightLines(dialogId);
    else highlightLine(dialogId, lineId);
  }, 100);

  const cleanup = () => {
    viewbox.removeEventListener("mousemove", highlight);
    viewbox.removeEventListener("touchmove", highlight);
    $(dialog).off("dialogclose.mapHoverHighlighting");
    cleanups.delete(dialogId);
  };

  viewbox.addEventListener("mousemove", highlight);
  viewbox.addEventListener("touchmove", highlight);
  $(dialog).one("dialogclose.mapHoverHighlighting", cleanup);
  cleanups.set(dialogId, cleanup);
}

function highlightLine(containerId: string, lineId: number): void {
  const container = findEl(containerId);
  if (!container) return;

  unhighlightLines(containerId);
  const line = Array.from(container.querySelectorAll<HTMLElement>("div[data-id]")).find(
    element => element.dataset.id === String(lineId)
  );
  if (!line) return;

  line.classList.add("hovered");
}

function unhighlightLines(containerId: string): void {
  const container = findEl(containerId);
  if (!container) return;
  for (const line of Array.from(container.getElementsByClassName("hovered"))) line.classList.remove("hovered");
}
