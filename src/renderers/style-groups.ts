// Route, lake and river groups are open-ended: the style store is their only record
type StyleGroups = Record<string, { attrs: Record<string, string | number | null | undefined> }>;

/** Match the layer's groups to the store, in order. User-named: addressed by data-group, not id */
export function syncStyleGroups(layer: Element, groups: StyleGroups): void {
  const elements = new Map<string, SVGGElement>();
  for (const el of Array.from(layer.querySelectorAll<SVGGElement>(":scope > g"))) {
    const name = el.dataset.group;
    if (name && Object.hasOwn(groups, name)) elements.set(name, el);
    else el.remove();
  }

  for (const [name, { attrs }] of Object.entries(groups)) {
    let group = elements.get(name);
    if (!group) {
      group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.dataset.group = name;
      for (const [attr, value] of Object.entries(attrs)) {
        if (value !== null && value !== undefined) group.setAttribute(attr, String(value));
      }
    }
    layer.append(group); // the store order is the drawing order
  }
}
