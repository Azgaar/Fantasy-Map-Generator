// Route and lake groups are open-ended: the style store is their only record, so their elements are made from it
import { createEl } from "@/utils/node-utils";

type StyleGroups = Record<string, { attrs: Record<string, string | number | null | undefined> }>;

/** Match the layer's group elements to the store groups, in the store order: create the missing ones, drop the removed */
export function syncStyleGroups(layer: Element, groups: StyleGroups): void {
  const elements = new Map<string, SVGGElement>();
  for (const el of Array.from(layer.querySelectorAll<SVGGElement>(":scope > g"))) {
    el.dataset.group ||= el.id; // the registry stamps only its declared groups
    if (Object.hasOwn(groups, el.dataset.group)) elements.set(el.dataset.group, el);
    else el.remove();
  }

  for (const [name, { attrs }] of Object.entries(groups)) {
    let group = elements.get(name);
    if (!group) {
      group = createEl<SVGGElement>("g", name);
      group.dataset.group = name;
      for (const [attr, value] of Object.entries(attrs)) {
        if (value !== null && value !== undefined) group.setAttribute(attr, String(value));
      }
    }
    layer.append(group); // the store order is the drawing order
  }
}

/** Whether a new group can take the name: it must be free in the store and, as the element id, on the page */
export function isGroupNameFree(groups: StyleGroups, name: string): boolean {
  return !Object.hasOwn(groups, name) && !document.getElementById(name);
}
