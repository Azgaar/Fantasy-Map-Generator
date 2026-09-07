// Map Wheel: a radial context menu on right-click, whose contents follow what was clicked.
// Subject ranking and the action list live in ./context, the ring itself in ./wheel.
import { resolveContext } from "./context";
import { WHEEL_CSS } from "./styles";
import { drawWheel } from "./wheel";

const HOST_ID = "mapWheel";

let host: HTMLElement | null = null;

export function closeMapWheel(): void {
  if (!host) return;
  host.remove();
  host = null;
  window.removeEventListener("keydown", onKeyDown, true);
  window.removeEventListener("wheel", closeMapWheel, true);
  window.removeEventListener("blur", closeMapWheel);
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key !== "Escape") return;
  event.stopPropagation();
  closeMapWheel();
}

function openMapWheel(event: MouseEvent): void {
  const ctx = resolveContext(event);
  if (!ctx) return;

  closeMapWheel();
  host = document.createElement("div");
  host.id = HOST_ID;
  host.addEventListener("contextmenu", e => e.preventDefault());
  host.addEventListener("pointerdown", e => {
    if (e.target === host) closeMapWheel();
  });
  document.body.append(host);

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("wheel", closeMapWheel, true);
  window.addEventListener("blur", closeMapWheel);

  drawWheel(host, ctx, closeMapWheel);
}

function onContextMenu(event: MouseEvent): void {
  // stay out of modes that already claim right-click (customization, journey path drawing)
  if (customization) return;
  if (!(event.target as Element | null)?.closest("#map")) return;

  event.preventDefault();
  event.stopPropagation();
  openMapWheel(event);
}

function mount(): void {
  const style = document.createElement("style");
  style.id = "mapWheelStyle";
  style.textContent = WHEEL_CSS;
  document.head.append(style);

  document.addEventListener("contextmenu", onContextMenu, true);
  document.addEventListener(
    "pointerdown",
    event => {
      if (host && !(event.target as Element | null)?.closest(`#${HOST_ID}`)) closeMapWheel();
    },
    true
  );
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
else mount();
