import { viewport } from "./viewport";

const MASKS = "mask#land, mask#water";

/** Firefox can drop oversized masks at high zoom; keep their surfaces within the visible map. */
export function updateFeatureMaskBounds(): void {
  const { x, y, width, height, scale } = viewport;
  const attrs = {
    maskUnits: "userSpaceOnUse",
    x: String((-x - 1) / scale),
    y: String((-y - 1) / scale),
    width: String((width + 2) / scale),
    height: String((height + 2) / scale)
  };
  for (const mask of document.querySelector("#map")?.querySelectorAll(MASKS) ?? []) {
    for (const [name, value] of Object.entries(attrs)) mask.setAttribute(name, value);
  }
}

/** Saved maps and exports must include the complete masks, independent of the live viewport. */
export function restoreFeatureMaskBounds(root: ParentNode): void {
  for (const mask of root.querySelectorAll(MASKS)) {
    for (const name of ["maskUnits", "x", "y", "width", "height"]) mask.removeAttribute(name);
  }
}
