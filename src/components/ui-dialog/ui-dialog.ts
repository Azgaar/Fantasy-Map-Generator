// <ui-dialog> — dialog chrome (title bar, minimize, close, actions) shared by app dialogs.
// Replaces jQuery UI's `.dialog()` widget one dialog at a time. Content passed as children
// is distributed via the shadow root's default slot; children with slot="actions" go to the
// button pane.

import style from "./ui-dialog.css?raw";
import templateHtml from "./ui-dialog.html?raw";
import slottedContentStyle from "./ui-dialog-slotted-content.css?raw";

// Slotted content (e.g. range inputs) lives in the light DOM, outside the shadow root,
// so its pseudo-elements can't be reached by the component's own ::slotted() rules.
const slottedContentStyleElement = document.createElement("style");
slottedContentStyleElement.textContent = slottedContentStyle;
document.head.appendChild(slottedContentStyleElement);

const template = document.createElement("template");
template.innerHTML = /* html */ `<style>${style}</style>${templateHtml}`;

let topZIndex = 1000;

type Anchor = { edge: "left" | "right" | "top" | "bottom" | "center"; offset: number };

function parseAnchor(token: string): Anchor {
  const match = token.match(/^(left|right|top|bottom|center)([+-]\d+)?$/);
  if (!match) return { edge: "center", offset: 0 };
  return { edge: match[1] as Anchor["edge"], offset: match[2] ? Number(match[2]) : 0 };
}

class UiDialog extends HTMLElement {
  private built = false;
  private resizedHeight: string | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: "open" }).appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    if (this.built) return;
    this.built = true;
    this.build();
  }

  private build() {
    const shadow = this.shadowRoot!;

    const titleEl = shadow.querySelector<HTMLElement>(".ui-dialog-title")!;
    titleEl.textContent = this.getAttribute("dialog-title") || "";

    const titlebar = shadow.querySelector<HTMLElement>(".ui-dialog-titlebar")!;
    titlebar.addEventListener("pointerdown", this.handleDragStart.bind(this));

    const minimizeButton = shadow.querySelector<HTMLButtonElement>(".ui-dialog-titlebar-collapse")!;
    minimizeButton.addEventListener("click", () => this.toggleMinimize());

    const closeButton = shadow.querySelector<HTMLButtonElement>(".ui-dialog-titlebar-close")!;
    closeButton.addEventListener("click", () => this.close());

    const resizeHandle = shadow.querySelector<HTMLElement>(".ui-dialog-resize-handle")!;
    resizeHandle.addEventListener("pointerdown", this.handleResizeStart.bind(this));

    this.classList.toggle("has-actions", this.querySelectorAll('[slot="actions"]').length > 0);
    this.addEventListener("pointerdown", () => this.bringToFront());
  }

  private handleDragStart(event: PointerEvent) {
    if ((event.target as HTMLElement).closest("button")) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const rect = this.getBoundingClientRect();
    const startLeft = rect.left;
    const startTop = rect.top;
    this.bringToFront();

    const handleMove = (moveEvent: PointerEvent) => {
      this.style.left = `${startLeft + moveEvent.clientX - startX}px`;
      this.style.top = `${startTop + moveEvent.clientY - startY}px`;
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  private handleResizeStart(event: PointerEvent) {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const rect = this.getBoundingClientRect();
    const startWidth = rect.width;
    const startHeight = rect.height;
    // Clamp to both a viewport-relative cap and the space actually available from the
    // dialog's current position, so resizing never pushes it past the viewport edge.
    const maxWidth = Math.min(window.innerWidth * 0.93, window.innerWidth - rect.left - 8);
    const maxHeight = Math.min(window.innerHeight * 0.93, window.innerHeight - rect.top - 8);
    this.bringToFront();

    const handleMove = (moveEvent: PointerEvent) => {
      this.classList.add("resized");
      this.style.width = `${Math.min(maxWidth, Math.max(150, startWidth + moveEvent.clientX - startX))}px`;
      this.style.height = `${Math.min(maxHeight, Math.max(100, startHeight + moveEvent.clientY - startY))}px`;
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  bringToFront() {
    topZIndex += 1;
    this.style.zIndex = String(topZIndex);
  }

  /** Position the dialog relative to a target element, jQuery UI `.position()`-style. */
  positionRelativeTo(target: Element, my: string, at: string) {
    const [myH, myV] = my.split(" ");
    const [atH, atV] = at.split(" ");
    const myHA = parseAnchor(myH);
    const myVA = parseAnchor(myV);
    const atHA = parseAnchor(atH);
    const atVA = parseAnchor(atV);

    const rect = target.getBoundingClientRect();
    const pointX = atHA.edge === "left" ? rect.left : atHA.edge === "right" ? rect.right : rect.left + rect.width / 2;
    const pointY = atVA.edge === "top" ? rect.top : atVA.edge === "bottom" ? rect.bottom : rect.top + rect.height / 2;
    const anchorX = pointX + atHA.offset;
    const anchorY = pointY + atVA.offset;

    requestAnimationFrame(() => {
      const selfRect = this.getBoundingClientRect();
      let left = anchorX - (myHA.edge === "right" ? selfRect.width : myHA.edge === "center" ? selfRect.width / 2 : 0);
      let top = anchorY - (myVA.edge === "bottom" ? selfRect.height : myVA.edge === "center" ? selfRect.height / 2 : 0);

      left = Math.min(Math.max(left, 0), window.innerWidth - selfRect.width);
      top = Math.min(Math.max(top, 0), window.innerHeight - selfRect.height);

      this.style.left = `${left}px`;
      this.style.top = `${top}px`;
    });
  }

  open(options?: { title?: string }) {
    if (options?.title) this.dialogTitle = options.title;
    this.removeAttribute("minimized");
    this.setAttribute("open", "");
    this.bringToFront();
    this.dispatchEvent(new CustomEvent("ui-dialog-open", { bubbles: true }));
  }

  close() {
    this.removeAttribute("open");
    this.dispatchEvent(new CustomEvent("ui-dialog-close", { bubbles: true }));
  }

  toggleMinimize(force?: boolean) {
    const shouldMinimize = force ?? !this.hasAttribute("minimized");
    this.toggleAttribute("minimized", shouldMinimize);

    // A manually resized height would otherwise persist as an inline style, leaving an
    // empty box the size of the resized dialog instead of collapsing to the title bar.
    if (shouldMinimize) {
      this.resizedHeight = this.style.height || null;
      this.style.height = "";
    } else if (this.resizedHeight) {
      this.style.height = this.resizedHeight;
    }
  }

  get dialogTitle(): string {
    return this.getAttribute("dialog-title") || "";
  }

  set dialogTitle(value: string) {
    this.setAttribute("dialog-title", value);
    const titleEl = this.shadowRoot?.querySelector<HTMLElement>(".ui-dialog-title");
    if (titleEl) titleEl.textContent = value;
  }
}

customElements.define("ui-dialog", UiDialog);

export type UiDialogElement = InstanceType<typeof UiDialog>;
