// The side drawer. Some of FMG is not a menu — the Style tab is a live form, Options is 27 setting
// rows, About is prose — so the drawer hosts the REAL elements rather than rebuilding them.
//
// FMG's wiring is getElementById lookups with listeners bound at init, so a clone would be dead DOM
// and a rebuild would drift. We move the live element in and put it back on close. That makes
// restore the load-bearing part of this file: while a drawer is open the element is out of
// #options, and every exit path has to return it.
import { findEl } from "@/utils/nodeUtils";
import { drawerOffset, outerRadius } from "./geometry";
import type { DrawerSpec } from "./types";

/** Exported so the renderer knows which child of .mw-wheel it must not clear on a redraw */
export const DRAWER_ID = "mapWheelDrawer";
/** The drawer hosts the app's real forms, so its width is the forms' width and does not scale */
export const DRAWER_WIDTH = 340;
const MAX_HEIGHT = 532; // must track the drawer's CSS max-height

interface Borrowed {
  element: HTMLElement;
  parent: HTMLElement;
  nextSibling: ChildNode | null;
  hidden: HTMLElement[];
}

let borrowed: Borrowed | null = null;
let drawerEl: HTMLElement | null = null;

export const isDrawerOpen = (): boolean => borrowed !== null;

/**
 * Which side to fan out on. Prefer the half the sector points into so the drawer follows the
 * gesture; take the other side when the preferred one has no room, or when the sector points
 * near-vertically and has no meaningful horizontal intent.
 *
 * "Room" is measured where the wheel already sits, because giving up the sector's direction is
 * cheaper than dragging the ring across the map. When neither side has room the wheel has to move
 * regardless, and then the sector's direction wins after all - which is the common case for a ring
 * opened near the middle of a narrow window.
 */
export function pickSide(sectorMid: number, centreX: number, viewportWidth: number, scale = 1): "left" | "right" {
  const offset = drawerOffset(scale);
  const roomRight = viewportWidth - centreX - offset >= DRAWER_WIDTH;
  const roomLeft = centreX - offset >= DRAWER_WIDTH;
  const horizontal = Math.cos(sectorMid);

  if (Math.abs(horizontal) < 0.2) {
    if (roomRight) return "right";
    if (roomLeft) return "left";
    return centreX <= viewportWidth / 2 ? "right" : "left";
  }

  const preferred = horizontal >= 0 ? "right" : "left";
  if (preferred === "right" ? roomRight : roomLeft) return preferred;
  if (preferred === "right" ? roomLeft : roomRight) return preferred === "right" ? "left" : "right";
  return preferred;
}

export function closeDrawer(): void {
  if (borrowed) {
    for (const row of borrowed.hidden) row.hidden = false;
    const { element, parent, nextSibling } = borrowed;
    // the recorded sibling can have been removed while we held the element
    if (nextSibling?.parentNode === parent) parent.insertBefore(element, nextSibling);
    else parent.append(element);
    borrowed = null;
  }

  drawerEl?.remove();
  drawerEl = null;
}

export function openDrawer(overlay: HTMLElement, spec: DrawerSpec, side: "left" | "right", onClose: () => void): void {
  closeDrawer();

  const element = findEl(spec.host);
  if (!element?.parentElement) return;

  drawerEl = document.createElement("div");
  drawerEl.id = DRAWER_ID;
  drawerEl.dataset.side = side;

  const header = document.createElement("div");
  header.className = "mw-drawer-head";
  const title = document.createElement("span");
  title.className = "mw-drawer-title";
  title.textContent = spec.title;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "mw-drawer-close";
  close.textContent = "✕";
  close.addEventListener("click", onClose);
  header.append(title, close);

  const body = document.createElement("div");
  body.className = "mw-drawer-body";

  drawerEl.append(header, body);
  overlay.append(drawerEl);

  borrowed = { element, parent: element.parentElement, nextSibling: element.nextSibling, hidden: [] };
  body.append(element);

  if (spec.only) filterRows(element, spec.only, borrowed);
}

/**
 * Tie the drawer back to the sector that opened it, in the same visual language as a ring spine.
 * The line cannot simply follow the sector's mid-angle: the drawer is a rectangle on one side, so
 * a sector at 10 o'clock with the drawer on the right would point away from it. Run it to the
 * nearest point on the drawer's near edge instead, which reads correctly from any sector.
 */
export function connectorLine(
  sectorMid: number,
  side: "left" | "right",
  scale = 1
): { x1: number; y1: number; x2: number; y2: number } {
  const radius = outerRadius(scale);
  const x1 = Math.cos(sectorMid) * radius;
  const y1 = Math.sin(sectorMid) * radius;
  const x2 = side === "right" ? drawerOffset(scale) : -drawerOffset(scale);
  // clamp to the drawer's own height so the line always lands on its near edge
  const half = Math.min(MAX_HEIGHT, window.innerHeight - 32) / 2;
  return { x1, y1, x2, y2: Math.min(Math.max(y1, -half), half) };
}

/** Hide every row that does not hold one of the named controls, remembering only what we changed */
function filterRows(host: HTMLElement, only: string[], record: Borrowed): void {
  const keep = new Set<Element>();
  for (const id of only) {
    const row = findEl(id)?.closest("tr");
    if (row) keep.add(row);
  }

  for (const row of host.querySelectorAll<HTMLElement>("tr")) {
    if (keep.has(row) || row.hidden) continue;
    row.hidden = true;
    record.hidden.push(row);
  }

  // a heading whose whole table is now hidden is noise
  for (const table of host.querySelectorAll<HTMLElement>("table")) {
    const rows = [...table.querySelectorAll<HTMLElement>("tr")];
    if (!rows.length || rows.some(row => !row.hidden)) continue;
    for (const el of [table, table.previousElementSibling].filter(Boolean) as HTMLElement[]) {
      if (el.hidden) continue;
      el.hidden = true;
      record.hidden.push(el);
    }
  }
}
