// PROTOTYPE — plumbing shared by every Map Wheel variant: a full-screen host layer,
// dismissal, and viewport clamping. Deliberately holds no layout opinions.
import type { WheelContext } from "./context";

export interface Variant {
  key: string;
  name: string;
  css: string;
  /** Draw the menu into `host` (a full-screen, pointer-events:none layer) */
  render: (ctx: WheelContext, host: HTMLElement, close: () => void) => void;
}

const HOST_ID = "mapWheelPrototypeHost";
const injected = new Set<string>();

export function injectCss(key: string, css: string): void {
  if (injected.has(key)) return;
  injected.add(key);
  const style = document.createElement("style");
  style.dataset.mapWheelPrototype = key;
  style.textContent = css;
  document.head.append(style);
}

let close: (() => void) | null = null;

export function closeOverlay(): void {
  close?.();
}

export function isOpen(): boolean {
  return close !== null;
}

export function openOverlay(variant: Variant, ctx: WheelContext): void {
  closeOverlay();
  injectCss(variant.key, variant.css);

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.dataset.variant = variant.key;
  document.body.append(host);

  const dismiss = (): void => {
    if (close !== dismiss) return;
    close = null;
    host.remove();
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("wheel", dismiss, true);
    window.removeEventListener("blur", dismiss);
  };

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.stopPropagation();
      dismiss();
    }
  }

  close = dismiss;
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("wheel", dismiss, true);
  window.addEventListener("blur", dismiss);

  // clicking the empty part of the host layer dismisses; the menu itself re-enables pointer events
  host.addEventListener("pointerdown", event => {
    if (event.target === host) dismiss();
  });
  host.addEventListener("contextmenu", event => event.preventDefault());

  variant.render(ctx, host, dismiss);
}

/** Keep a floating box fully inside the viewport, flipping it around the anchor if needed */
export function clampToViewport(el: HTMLElement, [x, y]: [number, number], margin = 8): void {
  const { offsetWidth: w, offsetHeight: h } = el;
  const left = x + w + margin > innerWidth ? Math.max(margin, x - w) : x;
  const top = y + h + margin > innerHeight ? Math.max(margin, y - h) : y;
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

export const HOST_CSS = /* css */ `
#${HOST_ID} {
  position: fixed;
  inset: 0;
  z-index: 3000;
  pointer-events: auto;
  font-family: var(--sans-serif);
  user-select: none;
  -webkit-user-select: none;
}
#${HOST_ID} .mw-pop {
  animation: mw-pop 120ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
}
@keyframes mw-pop {
  from { scale: 0.86; opacity: 0; }
  to { scale: 1; opacity: 1; }
}
`;
