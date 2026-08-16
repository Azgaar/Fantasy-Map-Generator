interface ElementDraggingOptions {
  element: HTMLElement;
  handleSelector: string;
}

export function enableElementDragging({ element, handleSelector }: ElementDraggingOptions): () => void {
  let pointerId = -1;
  let offsetX = 0;
  let offsetY = 0;
  let handle: HTMLElement | null = null;

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const nextHandle = (event.target as Element).closest<HTMLElement>(handleSelector);
    if (!nextHandle || !element.contains(nextHandle)) return;

    const bounds = element.getBoundingClientRect();
    pointerId = event.pointerId;
    offsetX = event.clientX - bounds.left;
    offsetY = event.clientY - bounds.top;
    handle = nextHandle;
    handle.setPointerCapture(pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    const bounds = element.getBoundingClientRect();
    element.style.left = `${Math.max(0, Math.min(event.clientX - offsetX, innerWidth - bounds.width))}px`;
    element.style.top = `${Math.max(0, Math.min(event.clientY - offsetY, innerHeight - bounds.height))}px`;
    element.style.right = "auto";
    element.style.bottom = "auto";
  };

  const finish = (event: PointerEvent) => {
    if (!handle || event.pointerId !== pointerId) return;
    if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
    pointerId = -1;
    handle = null;
  };

  element.addEventListener("pointerdown", onPointerDown);
  element.addEventListener("pointermove", onPointerMove);
  element.addEventListener("pointerup", finish);
  element.addEventListener("pointercancel", finish);

  return () => {
    element.removeEventListener("pointerdown", onPointerDown);
    element.removeEventListener("pointermove", onPointerMove);
    element.removeEventListener("pointerup", finish);
    element.removeEventListener("pointercancel", finish);
  };
}
