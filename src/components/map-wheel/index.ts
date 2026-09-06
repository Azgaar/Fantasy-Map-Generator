// Map Wheel: a radial context controller on right-click. Additive — the top bar and left-click
// editing are untouched; this is a second route in.
import { Layers } from "@/components/layers";
import { resolveContext } from "./context";
import { closeDrawer, connectorLine, openDrawer, pickSide } from "./drawer";
import { hereRoot } from "./here";
import { menuRoot } from "./menu-tree";
import { WHEEL_CSS } from "./styles";
import { renderWheel, type WheelRoots, type WheelState } from "./wheel";

const HOST_ID = "mapWheel";
const RADIUS = 258; // half the 516px box
const MARGIN = 8;
const DRAWER_RESERVE = 354; // drawer width 340 + 14 clear of the ring

let host: HTMLElement | null = null;

/** The sector the open drawer belongs to. The renderer clears the SVG, so the connector is redrawn. */
let openPanel: { path: number[]; mid: number; side: "left" | "right" } | null = null;

/** Offset the centre so the wheel (and its drawer, if any) stays fully on screen. Never rotates. */
export function clampCentre(
  x: number,
  y: number,
  width: number,
  height: number,
  drawerSide: "left" | "right" | null = null
): [number, number] {
  const left = RADIUS + MARGIN + (drawerSide === "left" ? DRAWER_RESERVE : 0);
  const right = width - RADIUS - MARGIN - (drawerSide === "right" ? DRAWER_RESERVE : 0);
  const top = RADIUS + MARGIN;
  const bottom = height - RADIUS - MARGIN;

  return [Math.min(Math.max(x, left), Math.max(left, right)), Math.min(Math.max(y, top), Math.max(top, bottom))];
}

/** Always the first thing on any exit path: the drawer holds live app DOM borrowed from #options */
function dropDrawer(): void {
  openPanel = null;
  closeDrawer();
}

/** A drawer survives a state change only while its own sector is still the chosen one */
const stillUnder = (path: number[], anchor: number[]): boolean => anchor.every((index, i) => path[i] === index);

export function closeMapWheel(): void {
  dropDrawer();
  if (!host) return;
  host.remove();
  host = null;
  window.removeEventListener("keydown", onKeyDown, true);
  window.removeEventListener("wheel", closeMapWheel, true);
  window.removeEventListener("pointerdown", onPointerDown, true);
  window.removeEventListener("blur", closeMapWheel);
}

function onKeyDown(event: KeyboardEvent): void {
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
function drawConnector(wheel: HTMLElement, sectorMid: number, side: "left" | "right"): void {
  const svg = wheel.querySelector("svg.mw-svg");
  if (!svg) return;
  const { x1, y1, x2, y2 } = connectorLine(sectorMid, side);
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

  const [cx, cy] = clampCentre(event.clientX, event.clientY, window.innerWidth, window.innerHeight);
  wheel.style.left = `${cx}px`;
  wheel.style.top = `${cy}px`;

  let state: WheelState = { mode: "here", path: [], hot: null };
  const draw = (): void => {
    renderWheel(wheel, roots, state, {
      onState: next => {
        if (openPanel && !stillUnder(next.path, openPanel.path)) dropDrawer();
        state = next;
        draw();
      },
      onPanel: (spec, mid) => {
        const side = pickSide(mid, cx, window.innerWidth);
        openDrawer(overlay, spec, side, () => {
          dropDrawer();
          state = { ...state, path: state.path.slice(0, -1) };
          draw();
        });
        openPanel = { path: state.path, mid, side };
        drawConnector(wheel, mid, side);
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
        state = { mode: "here", path: [], hot: null };
        draw();
      },
      onToggle: node => {
        Layers.toggle(node.toggle!);
        draw();
      }
    });
    if (openPanel) drawConnector(wheel, openPanel.mid, openPanel.side);
  };
  draw();

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("wheel", closeMapWheel, true);
  window.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("blur", closeMapWheel);
}

function onContextMenu(event: MouseEvent): void {
  // stay out of modes that already claim right-click (heightmap customization, journey drawing)
  if (window.customization) return;
  if (!(event.target as Element | null)?.closest("#map")) return;

  const ctx = resolveContext(event);
  if (!ctx) return; // no map loaded, or the point is off it: let the browser menu through

  event.preventDefault();
  event.stopPropagation();

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
  document.addEventListener("contextmenu", onContextMenu, true);
  // a hidden tab must not leave borrowed app DOM stranded in the drawer
  document.addEventListener("visibilitychange", () => closeMapWheel());
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
}
