// Pure, side-effect-free entry point for showing toasts. Deliberately kept separate from
// ./container so importing this function doesn't trigger that module's
// customElements.define/document.createElement side effects (e.g. in Node-env tests).
// The custom elements themselves are registered via "@/components" (see components/index.ts).
import type { ToastContainerElement } from "./container";
import type { ToastType } from "./item";

export function toast(message: string, type: ToastType = "info", duration: number = 4000): void {
  document.querySelector<ToastContainerElement>("toast-container")?.show(message, type, duration);
}

window.toast = toast;
