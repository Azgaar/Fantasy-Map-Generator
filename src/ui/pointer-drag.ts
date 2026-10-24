/** Follow the pressed pointer until it lifts, by mouse, touch or pen. Deltas are CSS pixels from the press; `onEnd` gets whether it moved.
 * The pointer is captured only once it moves, so a press that does not move stays a click on whatever was pressed */
export function dragPointer(
  event: PointerEvent,
  onMove: (dx: number, dy: number, event: PointerEvent) => void,
  onEnd?: (moved: boolean) => void
): void {
  const handle = event.currentTarget as HTMLElement;
  const { pointerId, clientX, clientY } = event;
  let moved = false;

  const move = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    const dx = e.clientX - clientX;
    const dy = e.clientY - clientY;
    if (!moved && !dx && !dy) return;
    if (!moved) {
      moved = true;
      handle.setPointerCapture?.(pointerId);
      document.documentElement.classList.add("pointer-dragging"); // iframes would swallow the pointer otherwise
    }
    onMove(dx, dy, e);
  };
  const end = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", end);
    document.documentElement.classList.remove("pointer-dragging");
    onEnd?.(moved);
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
}
