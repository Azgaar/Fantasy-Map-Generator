import style from "./ui-dialog.css?raw";
import templateHtml from "./ui-dialog.html?raw";
import slottedContentStyle from "./ui-dialog-slotted-content.css?raw";

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

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getDeepActiveElement(): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

class UiDialog extends HTMLElement {
  private built = false;
  private resizedHeight: string | null = null;
  private opener: HTMLElement | null = null;

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

    this.setAttribute("role", "dialog");
    this.setAttribute("aria-modal", "false");
    if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "-1");

    const titleEl = shadow.querySelector<HTMLElement>(".ui-dialog-title")!;
    titleEl.textContent = this.getAttribute("dialog-title") || "";
    this.setAttribute("aria-label", this.getAttribute("dialog-title") || "");

    const titlebar = shadow.querySelector<HTMLElement>(".ui-dialog-titlebar")!;
    titlebar.addEventListener("pointerdown", this.handleDragStart.bind(this));

    const minimizeButton = shadow.querySelector<HTMLButtonElement>(".ui-dialog-titlebar-collapse")!;
    minimizeButton.addEventListener("click", () => this.toggleMinimize());

    const closeButton = shadow.querySelector<HTMLButtonElement>(".ui-dialog-titlebar-close")!;
    closeButton.addEventListener("click", () => this.close());

    for (const handle of shadow.querySelectorAll<HTMLElement>(".ui-resizable-handle")) {
      const direction = handle.dataset.dir!;
      handle.addEventListener("pointerdown", event => this.handleResizeStart(event, direction));
    }

    this.classList.toggle("has-actions", this.querySelectorAll('[slot="actions"]').length > 0);
    this.addEventListener("pointerdown", () => this.bringToFront());
    this.addEventListener("keydown", this.handleKeydown.bind(this));
  }

  private getFocusableElements(): HTMLElement[] {
    const shadowFocusable = Array.from(this.shadowRoot!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    const lightFocusable = Array.from(this.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    return [...shadowFocusable, ...lightFocusable].filter(
      el => !el.hasAttribute("disabled") && el.offsetParent !== null
    );
  }

  private handleKeydown(event: KeyboardEvent) {
    if (event.key !== "Tab") return;

    const focusable = this.getFocusableElements();
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = getDeepActiveElement();

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
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

  private handleResizeStart(event: PointerEvent, direction: string) {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const rect = this.getBoundingClientRect();
    const startWidth = rect.width;
    const startHeight = rect.height;
    const startLeft = rect.left;
    const startTop = rect.top;
    const minWidth = 150;
    const minHeight = 100;
    this.bringToFront();

    const handleMove = (moveEvent: PointerEvent) => {
      this.classList.add("resized");
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      if (direction.includes("e")) {
        const maxWidth = window.innerWidth - startLeft - 8;
        this.style.width = `${Math.min(maxWidth, Math.max(minWidth, startWidth + dx))}px`;
      } else if (direction.includes("w")) {
        const width = Math.max(minWidth, Math.min(startWidth - dx, startLeft + startWidth));
        this.style.width = `${width}px`;
        this.style.left = `${startLeft + startWidth - width}px`;
      }

      if (direction.includes("s")) {
        const maxHeight = window.innerHeight - startTop - 8;
        this.style.height = `${Math.min(maxHeight, Math.max(minHeight, startHeight + dy))}px`;
      } else if (direction.includes("n")) {
        const height = Math.max(minHeight, Math.min(startHeight - dy, startTop + startHeight));
        this.style.height = `${height}px`;
        this.style.top = `${startTop + startHeight - height}px`;
      }
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
    this.opener = getDeepActiveElement() as HTMLElement | null;
    this.removeAttribute("minimized");
    this.setAttribute("open", "");
    this.bringToFront();
    this.dispatchEvent(new CustomEvent("ui-dialog-open", { bubbles: true }));

    requestAnimationFrame(() => {
      const [firstFocusable] = this.getFocusableElements();
      (firstFocusable ?? this).focus();
    });
  }

  close() {
    this.removeAttribute("open");
    this.dispatchEvent(new CustomEvent("ui-dialog-close", { bubbles: true }));
    this.opener?.focus();
    this.opener = null;
  }

  toggleMinimize(force?: boolean) {
    const shouldMinimize = force ?? !this.hasAttribute("minimized");
    this.toggleAttribute("minimized", shouldMinimize);

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
    this.setAttribute("aria-label", value);
    const titleEl = this.shadowRoot?.querySelector<HTMLElement>(".ui-dialog-title");
    if (titleEl) titleEl.textContent = value;
  }
}

customElements.define("ui-dialog", UiDialog);

export type UiDialogElement = InstanceType<typeof UiDialog>;
