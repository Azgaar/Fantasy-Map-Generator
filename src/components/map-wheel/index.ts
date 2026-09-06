// Map Wheel: a radial context controller on right-click. Additive — the top bar and left-click
// editing are untouched; this is a second route in.
import { Layers } from "@/components/layers";
import { findEl } from "@/utils/nodeUtils";
import { resolveContext } from "./context";
import { closeDrawer, DRAWER_ID, DRAWER_WIDTH, openDrawer, pickSide } from "./drawer";
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
const drawerReserve = (openLevel: number, scale: number): number =>
  drawerOffset(openLevel, scale) + DRAWER_WIDTH - boxRadius(scale);

/** The dial follows the app's own sizing control; absent or unreadable is 1 */
function readUiSize(): number {
  const raw = Number(findEl<HTMLInputElement>("uiSize")?.value);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

let host: HTMLElement | null = null;

/** The path of the sector the open drawer belongs to; the drawer closes when it stops being chosen */
let openPanel: number[] | null = null;

// set by openMapWheel, cleared by closeMapWheel; a stale wheel must never keep answering keys
let keyHandler: ((event: KeyboardEvent) => boolean) | null = null;

/** Re-clamps and moves the live wheel. Set by openMapWheel so any exit path can undo a drawer shift. */
let recentre: ((drawerSide: "left" | "right" | null) => void) | null = null;

/**
 * Watches <html> for the app rewriting its theme variables. The wheel used to sample the palette
 * once per structural redraw, which was defensible while it was a transient ring - but the drawer
 * hosts Options → Interface, so the user can sit inside the wheel moving the hue and transparency
 * sliders. Attribute-level, so it catches changeDialogsTheme, changeThemeHue and the restore-defaults
 * button alike without knowing about any of them. Disconnected in closeMapWheel: an observer holding
 * a closed wheel's handle is the same leak the keyHandler teardown guards against.
 */
let themeWatch: MutationObserver | null = null;

/**
 * Offset the centre so the wheel (and its drawer, if any) stays fully on screen. Never rotates.
 *
 * `openLevel` is the outermost open ring, which is what the drawer hangs off: a drawer beside a
 * two-ring wheel needs 164px less room than one beside a four-ring wheel, and reserving the
 * four-ring figure would shove the whole dial across the map for no reason.
 */
export function clampCentre(
  x: number,
  y: number,
  width: number,
  height: number,
  drawerSide: "left" | "right" | null = null,
  scale = 1,
  openLevel = 0
): [number, number] {
  const radius = boxRadius(scale);
  const reserve = drawerReserve(openLevel, scale);
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
  themeWatch?.disconnect();
  themeWatch = null;
  if (!host) return;
  host.remove();
  host = null;
  keyHandler = null;
  recentre = null;
  window.removeEventListener("keydown", onKeyDown, true);
  window.removeEventListener("wheel", onWheel, true);
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

/**
 * The wheel dismisses on a map zoom, and a wheel event is how a zoom begins - but the drawer holds
 * the app's real forms and scrolls. Dismissing on the first notch of a scroll over it detached the
 * drawer mid-gesture, and the rest of that scroll landed on the map and zoomed it.
 *
 * The exemption is the DRAWER only, deliberately not the whole overlay: wheeling over the ring means
 * reaching for the map behind it, and the dismiss-on-zoom rule should stand there.
 */
function onWheel(event: Event): void {
  if ((event.target as Element | null)?.closest(`#${DRAWER_ID}`)) return;
  closeMapWheel();
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

  // The box is sized for the deepest possible drill, but only the OPEN rings are drawn - so the
  // drawer hangs off the outermost open ring, not off the box. Kept current by draw().
  let openLevel = 0;

  // The wheel and an open drawer clamp as one bounding box, so opening a panel can push the ring
  // off the drawer's side and closing it has to give that room back.
  let cx = 0;
  let cy = 0;
  const moveCentre = (drawerSide: "left" | "right" | null): void => {
    const { innerWidth: w, innerHeight: h } = window;
    [cx, cy] = clampCentre(event.clientX, event.clientY, w, h, drawerSide, scale, openLevel);
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
      if (openPanel && !stillUnder(next.path, openPanel)) dropDrawer();
      state = next;
      draw();
    },
    // Hover never redraws: it repaints the two elements involved. A redraw would remove the node
    // under the pointer, and the mouseleave/mouseenter that follows would redraw again.
    onHot: hot => {
      state = { ...state, hot };
      handle?.applyHot(hot);
    },
    // dispatch() re-issues the state before it opens a panel, so `openLevel` is already the panel
    // sector's own level here - which is what pickSide must measure room against, or the side it
    // picks and the offset the stylesheet places the drawer at are computed from different radii.
    onPanel: (spec, mid) => {
      const side = pickSide(mid, cx, window.innerWidth, openLevel, scale);
      moveCentre(side);
      // the drawer is a child of .mw-wheel: its left/top percentages resolve against the wheel box,
      // so it tracks the ring instead of the middle of the viewport
      openDrawer(wheel, spec, side, () => {
        dropDrawer();
        state = { ...state, path: state.path.slice(0, -1) };
        draw();
      });
      openPanel = state.path;
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
    openLevel = handle.openLevel;
    // the drawer's offset is a function of how deep the wheel is open, so it moves with every drill
    wheel.style.setProperty("--mw-drawer-offset", `${drawerOffset(openLevel, scale)}px`);
  };
  draw();

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("wheel", onWheel, true);
  window.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("blur", closeMapWheel);
  keyHandler = event => handleKey(event, roots, state, callbacks, scale);

  // The theme is the app's to change while the wheel is open - Options → Interface is one of the
  // drawers. Repaint in place rather than redraw: a rebuild on every slider step is the hover loop
  // all over again, and it would tear the drawer's borrowed DOM out from under the pointer.
  if (typeof MutationObserver !== "undefined") {
    themeWatch = new MutationObserver(() => handle?.repaint());
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
  }
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
