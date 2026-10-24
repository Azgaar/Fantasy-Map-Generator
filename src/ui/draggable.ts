// Let a floating panel be moved by a handle, by mouse, touch or pen
import { dragPointer } from "@/ui/pointer-drag";
import { minmax } from "@/utils/number-utils";

// a press on a control stays a click on it, however the pointer jitters
const CONTROLS = "input, textarea, button, select, option";

const gripOf = (event: Event, handle: string): Element | null => {
  const target = event.target as Element;
  return target.closest(CONTROLS) ? null : target.closest(handle);
};

/** The panel follows the pointer from its handle; the handle stays within the viewport so it can be grabbed again */
export function makeDraggable(panel: HTMLElement, handle: string): void {
  if (getComputedStyle(panel).position === "static") panel.style.position = "relative";

  panel.addEventListener("mousedown", event => {
    if (gripOf(event, handle)) event.preventDefault(); // no text selection
  });
  panel.addEventListener("pointerdown", event => {
    const grip = gripOf(event, handle);
    if (event.button !== 0 || !grip) return;
    const box = grip.getBoundingClientRect();
    const style = getComputedStyle(panel);
    const start = { left: parseFloat(style.left) || 0, top: parseFloat(style.top) || 0 };

    dragPointer(event, (dx, dy) => {
      const left = start.left + minmax(dx, -box.left, window.innerWidth - box.right);
      const top = start.top + minmax(dy, -box.top, window.innerHeight - box.bottom);
      Object.assign(panel.style, { left: `${left}px`, top: `${top}px`, right: "auto", bottom: "auto" });
    });
  });
}
