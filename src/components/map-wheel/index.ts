// Map Wheel: a radial context controller on right-click. Additive — the top bar and left-click
// editing are untouched; this is a second route in.
import { Layers } from "@/components/layers";
import { findEl } from "@/utils/nodeUtils";
import { resolveContext } from "./context";
import { closeDrawer, connectorLine, DRAWER_WIDTH, openDrawer, pickSide } from "./drawer";
import { boxRadius, drawerOffset, VIEWPORT_MARGIN, wheelScale } from "./geometry";
import { hereRoot } from "./here";
import { menuRoot } from "./menu-tree";
import { WHEEL_CSS } from "./styles";
import {
  handleKey,
  renderWheel,
  type WheelCallbacks,
  type WheelHandle,
  type WheelRoots,
  type WheelState
} from "./wheel";

const HOST_ID = "mapWheel";
const MARGIN = VIEWPORT_MARGIN;

/** Room an open drawer needs beyond the wheel's own box on the side it fans out to */
const drawerReserve = (scale: number): number => drawerOffset(scale) + DRAWER_WIDTH - boxRadius(scale);

/** The dial follows the app's own sizing control; absent or unreadable is 1 */
function readUiSize(): number {
  const raw = Number(findEl<HTMLInputElement>("uiSize")?.value);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

let host: HTMLElement | null = null;

/** The sector the open drawer belongs to. The renderer clears the SVG, so the connector is redrawn. */
let openPanel: { path: number[]; mid: number; side: "left" | "right" } | null = null;

// set by openMapWheel, cleared by closeMapWheel; a stale wheel must never keep answering keys
let keyHandler: ((event: KeyboardEvent) => boolean) | null = null;

/** Re-clamps and moves the live wheel. Set by openMapWheel so any exit path can undo a drawer shift. */
let recentre: ((drawerSide: "left" | "right" | null) => void) | null = null;

/** Offset the centre so the wheel (and its drawer, if any) stays fully on screen. Never rotates. */
export function clampCentre(
  x: number,
  y: number,
  width: number,
  height: number,
  drawerSide: "left" | "right" | null = null,
  scale = 1
): [number, number] {
  const radius = boxRadius(scale);
  const reserve = drawerReserve(scale);
  const left = radius + MARGIN + (drawerSide === "left" ? reserve : 0);
  const right = width - radius - MARGIN - (drawerSide === "right" ? reserve : 0);
  const top = radius + MARGIN;
  const bottom = height - radius - MARGIN;

  return [Math.min(Math.max(x, left), Math.max(left, right)), Math.min(Math.max(y, top), Math.max(top, bottom))];
}

/** Always the first thing on any exit path: the drawer holds live app DOM borrowed from #options */
function dropDrawer(): void {
  openPanel = null;
  closeDrawer();
  recentre?.(null); // the wheel gave up room for the drawer; take it back
}

/** A drawer survives a state change only while its own sector is still the chosen one */
const stillUnder = (path: number[], anchor: number[]): boolean => anchor.every((index, i) => path[i] === index);

export function closeMapWheel(): void {
  dropDrawer();
  if (!host) return;
  host.remove();
  host = null;
  keyHandler = null;
  recentre = null;
  window.removeEventListener("keydown", onKeyDown, true);
  window.removeEventListener("wheel", closeMapWheel, true);
  window.removeEventListener("pointerdown", onPointerDown, true);
  window.removeEventListener("blur", closeMapWheel);
}

function onKeyDown(event: KeyboardEvent): void {
  if (keyHandler?.(event)) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (event.key !== "Escape") return;
  event.stopPropagation();
  closeMapWheel();
}

function onPointerDown(event: Event): void {
  if (!host) return;
  if ((event.target as Element | null)?.closest(`#${HOST_ID}`)) return;
  closeMapWheel();
}

/** Tie the drawer back to the sector that opened it, in the same language as a ring spine */
function drawConnector(wheel: HTMLElement, sectorMid: number, side: "left" | "right", scale: number): void {
  const svg = wheel.querySelector("svg.mw-svg");
  if (!svg) return;
  const { x1, y1, x2, y2 } = connectorLine(sectorMid, side, scale);
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("class", "mw-spine mw-connector");
  for (const [key, value] of Object.entries({ x1, y1, x2, y2 })) line.setAttribute(key, value.toFixed(2));
  svg.append(line);
}

export function openMapWheel(event: MouseEvent, roots: WheelRoots, onPickSubject?: (index: number) => void): void {
  closeMapWheel();

  const overlay = document.createElement("div");
  overlay.id = HOST_ID;
  overlay.addEventListener("contextmenu", e => e.preventDefault());
  document.body.append(overlay);
  host = overlay;

  const origin = document.createElement("div");
  origin.className = "mw-origin";
  origin.style.left = `${event.clientX}px`;
  origin.style.top = `${event.clientY}px`;
  overlay.append(origin);

  const wheel = document.createElement("div");
  wheel.className = "mw-wheel";
  overlay.append(wheel);

  // The box, the drawer's offset and every label size follow the app's uiSize, so they are no
  // longer constants the stylesheet can hold: it reads them back off these properties.
  const scale = wheelScale(readUiSize(), window.innerWidth, window.innerHeight);
  wheel.style.setProperty("--mw-ui", String(scale));
  wheel.style.setProperty("--mw-box", `${boxRadius(scale) * 2}px`);
  wheel.style.setProperty("--mw-drawer-offset", `${drawerOffset(scale)}px`);

  // The wheel and an open drawer clamp as one bounding box, so opening a panel can push the ring
  // off the drawer's side and closing it has to give that room back.
  let cx = 0;
  let cy = 0;
  const moveCentre = (drawerSide: "left" | "right" | null): void => {
    [cx, cy] = clampCentre(event.clientX, event.clientY, window.innerWidth, window.innerHeight, drawerSide, scale);
    wheel.style.left = `${cx}px`;
    wheel.style.top = `${cy}px`;
  };
  recentre = moveCentre;
  moveCentre(null);

  // Opens on MENU: the global menus are what most right-clicks are after, and HERE - which is
  // fully resolved either way - is one hub click in.
  let state: WheelState = { mode: "menu", path: [], hot: null };
  // the live ring's hover handle; replaced by every structural redraw
  let handle: WheelHandle | null = null;
  const callbacks: WheelCallbacks = {
    onState: next => {
      if (openPanel && !stillUnder(next.path, openPanel.path)) dropDrawer();
      state = next;
      draw();
    },
    // Hover never redraws: it repaints the two elements involved. A redraw would remove the node
    // under the pointer, and the mouseleave/mouseenter that follows would redraw again.
    onHot: hot => {
      state = { ...state, hot };
      handle?.applyHot(hot);
    },
    onPanel: (spec, mid) => {
      const side = pickSide(mid, cx, window.innerWidth, scale);
      moveCentre(side);
      // the drawer is a child of .mw-wheel: its left/top percentages resolve against the wheel box,
      // so it tracks the ring instead of the middle of the viewport
      openDrawer(wheel, spec, side, () => {
        dropDrawer();
        state = { ...state, path: state.path.slice(0, -1) };
        draw();
      });
      openPanel = { path: state.path, mid, side };
      drawConnector(wheel, mid, side, scale);
    },
    onLeaf: node => {
      closeMapWheel();
      try {
        node.run?.();
      } catch (error) {
        console.error("map wheel action failed", error);
      }
    },
    onPick: index => {
      onPickSubject?.(index);
      dropDrawer();
      state = { mode: "here", path: [], hot: null };
      draw();
    },
    onToggle: node => {
      Layers.toggle(node.toggle!);
      draw();
    }
  };
  const draw = (): void => {
    handle = renderWheel(wheel, roots, state, callbacks, scale);
    if (openPanel) drawConnector(wheel, openPanel.mid, openPanel.side, scale);
  };
  draw();

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("wheel", closeMapWheel, true);
  window.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("blur", closeMapWheel);
  keyHandler = event => handleKey(event, roots, state, callbacks, scale);
}

// Bubble phase, and yield to anything that already claimed the event. Handlers bound closer to the
// target run first, so a mode that owns right-click (journey draw-undo, remove-point) keeps it by
// calling preventDefault. Enumerating those modes here would rot: journey mode has no DOM marker.
function onContextMenu(event: MouseEvent): void {
  if (event.defaultPrevented) return;
  if (window.customization) return; // heightmap mode claims right-click without preventing default
  if (!(event.target as Element | null)?.closest("#map")) return;

  const ctx = resolveContext(event);
  if (!ctx) return; // no map loaded, or the point is off it: let the browser menu through

  event.preventDefault();

  let subject = 0;
  const roots: WheelRoots = { menu: menuRoot, here: () => hereRoot(ctx, subject) };
  openMapWheel(event, roots, index => {
    subject = index;
  });
}

function mount(): void {
  const style = document.createElement("style");
  style.id = "mapWheelStyle";
  style.textContent = WHEEL_CSS;
  document.head.append(style);
  document.addEventListener("contextmenu", onContextMenu);
  // a hidden tab must not leave borrowed app DOM stranded in the drawer
  document.addEventListener("visibilitychange", () => closeMapWheel());
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
}
