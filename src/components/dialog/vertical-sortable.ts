interface VerticalSortableOptions {
  container: HTMLElement;
  handleSelector: string;
  itemSelector: string;
  onUpdate?: (item: HTMLElement) => void;
}

export function enableVerticalSortable({
  container,
  handleSelector,
  itemSelector,
  onUpdate
}: VerticalSortableOptions): () => void {
  let activeHandle: HTMLElement | null = null;
  let activeItem: HTMLElement | null = null;
  let activePointerId = -1;
  let initialIndex = -1;

  const getItems = () => Array.from(container.querySelectorAll<HTMLElement>(`:scope > ${itemSelector}`));

  const finish = (event: PointerEvent) => {
    if (!activeHandle || !activeItem || event.pointerId !== activePointerId) return;
    if (activeHandle.hasPointerCapture(event.pointerId)) activeHandle.releasePointerCapture(event.pointerId);
    activeItem.classList.remove("sorting");
    const item = activeItem;
    const changed = getItems().indexOf(item) !== initialIndex;
    activeHandle = null;
    activeItem = null;
    activePointerId = -1;
    initialIndex = -1;
    if (changed) onUpdate?.(item);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const handle = (event.target as Element).closest<HTMLElement>(handleSelector);
    const item = handle?.closest<HTMLElement>(itemSelector);
    if (!handle || !item || item.parentElement !== container) return;

    event.preventDefault();
    activeHandle = handle;
    activeItem = item;
    activePointerId = event.pointerId;
    initialIndex = getItems().indexOf(item);
    handle.setPointerCapture(event.pointerId);
    item.classList.add("sorting");
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!activeHandle || !activeItem || event.pointerId !== activePointerId) return;
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>(itemSelector);
    if (!target || target === activeItem || target.parentElement !== container) return;

    const targetRect = target.getBoundingClientRect();
    if (event.clientY < targetRect.top + targetRect.height / 2) container.insertBefore(activeItem, target);
    else container.insertBefore(activeItem, target.nextElementSibling);
  };

  container.style.touchAction = "pan-x";
  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerup", finish);
  container.addEventListener("pointercancel", finish);

  return () => {
    container.removeEventListener("pointerdown", onPointerDown);
    container.removeEventListener("pointermove", onPointerMove);
    container.removeEventListener("pointerup", finish);
    container.removeEventListener("pointercancel", finish);
  };
}
