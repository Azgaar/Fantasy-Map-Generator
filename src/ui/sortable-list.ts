// Reorder a container's children by dragging them, by mouse, touch or pen
import "./sortable-list.css";
import { dragPointer } from "@/ui/pointer-drag";

type SortableOptions = {
  items: string; // which direct children move
  handle?: string; // the part of an item to press, the whole item by default
  onReorder?: (item: HTMLElement) => void; // after a drag that changed the order
};

/** Items swap places as the dragged one passes the middle of another; a click right after a drag is swallowed */
export function sortableList(container: HTMLElement, { items, handle, onReorder }: SortableOptions): void {
  const itemOf = (target: EventTarget | null) =>
    Array.from(container.children).find(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child.matches(items) && child.contains(target as Node)
    );

  container.addEventListener("pointerdown", event => {
    const item = itemOf(event.target);
    if (event.button !== 0 || !item || (handle && !(event.target as Element).closest(handle))) return;
    const before = item.nextElementSibling;

    dragPointer(
      event,
      (_dx, _dy, { clientX: x, clientY: y }) => {
        item.classList.add("sortable-dragging");
        const over = itemOf(document.elementFromPoint(x, y));
        if (!over || over === item) return;
        const box = over.getBoundingClientRect();
        const inRow = box.width < container.clientWidth / 2; // items side by side compare horizontally
        const after = inRow ? x > box.left + box.width / 2 : y > box.top + box.height / 2;
        over.insertAdjacentElement(after ? "afterend" : "beforebegin", item);
      },
      moved => {
        item.classList.remove("sortable-dragging");
        if (!moved) return;
        window.addEventListener("click", swallow, { capture: true, once: true });
        setTimeout(() => window.removeEventListener("click", swallow, { capture: true }));
        if (item.nextElementSibling !== before) onReorder?.(item);
      }
    );
  });
}

function swallow(event: Event): void {
  event.stopPropagation();
  event.preventDefault();
}
