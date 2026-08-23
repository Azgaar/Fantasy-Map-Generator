// Entry point for showing toasts. Deliberately kept separate from ./container so importing
// this function doesn't trigger that module's customElements.define/document.createElement
// calls (which throw in Node-env tests without a real DOM). The custom elements themselves are
// registered via "@/components" (see components/index.ts). The only side effect here is
// registering the window.toast bridge below, for legacy public/ scripts outside the module graph.
import type { ToastContainerElement } from "./container";
import type { ToastType } from "./item";

export function toast(message: string, type: ToastType = "info", duration: number = 4000): void {
  document.querySelector<ToastContainerElement>("toast-container")?.show(message, type, duration);
}

window.toast = toast;
