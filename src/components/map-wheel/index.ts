// Map Wheel: a radial context controller on right-click. Additive — the top bar and left-click
// editing are untouched; this is a second route in.
import { menuRoot } from "./menu-tree";
import { WHEEL_CSS } from "./styles";
import { renderWheel, type WheelRoots, type WheelState } from "./wheel";

const HOST_ID = "mapWheel";
const RADIUS = 258; // half the 516px box
const MARGIN = 8;
const DRAWER_RESERVE = 354; // drawer width 340 + 14 clear of the ring

let host: HTMLElement | null = null;

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

export function closeMapWheel(): void {
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

export function openMapWheel(event: MouseEvent, roots: WheelRoots): void {
  closeMapWheel();

  host = document.createElement("div");
  host.id = HOST_ID;
  host.addEventListener("contextmenu", e => e.preventDefault());
  document.body.append(host);

  const origin = document.createElement("div");
  origin.className = "mw-origin";
  origin.style.left = `${event.clientX}px`;
  origin.style.top = `${event.clientY}px`;
  host.append(origin);

  const wheel = document.createElement("div");
  wheel.className = "mw-wheel";
  host.append(wheel);

  const [cx, cy] = clampCentre(event.clientX, event.clientY, window.innerWidth, window.innerHeight);
  wheel.style.left = `${cx}px`;
  wheel.style.top = `${cy}px`;

  let state: WheelState = { mode: "here", path: [], hot: null };
  const draw = (): void =>
    renderWheel(wheel, roots, state, {
      onState: next => {
        state = next;
        draw();
      },
      onPanel: () => {},
      onLeaf: node => {
        closeMapWheel();
        try {
          node.run?.();
        } catch (error) {
          console.error("map wheel action failed", error);
        }
      },
      onPick: () => {},
      onToggle: () => {}
    });
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

  event.preventDefault();
  event.stopPropagation();
  openMapWheel(event, { menu: menuRoot, here: () => [] });
}

function mount(): void {
  const style = document.createElement("style");
  style.id = "mapWheelStyle";
  style.textContent = WHEEL_CSS;
  document.head.append(style);
  document.addEventListener("contextmenu", onContextMenu, true);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
}
