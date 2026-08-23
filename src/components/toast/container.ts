// <toast-container> — stacks <toast-item> notifications; use the `toast()` helper
// from "@/components/toast" rather than calling the element directly.
import "./item";
import type { ToastItemElement, ToastType } from "./item";

const style = /* css */ `
  toast-container {
    position: fixed;
    top: 0.6em;
    right: 0.6em;
    z-index: 99999;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.4em;
    pointer-events: none;
  }
`;

const styleElement = document.createElement("style");
styleElement.setAttribute("type", "text/css");
styleElement.innerHTML = style;
document.head.appendChild(styleElement);

class ToastContainer extends HTMLElement {
  show(message: string, type: ToastType = "info", duration = 4000): void {
    const item = document.createElement("toast-item") as ToastItemElement;
    item.type = type;
    item.message = message;
    this.prepend(item);
    if (duration) item.autoDismiss(duration);
  }
}

customElements.define("toast-container", ToastContainer);

export type ToastContainerElement = InstanceType<typeof ToastContainer>;
