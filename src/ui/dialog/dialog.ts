// The app's dialog window: placement, dragging, resizing, stacking and minimizing, see docs/prd/native-dialogs.md
import { dragPointer } from "@/ui/pointer-drag";
import { t } from "@/utils/i18n";
import { ensureEl, findEl } from "@/utils/node-utils";
import { minmax } from "@/utils/number-utils";
import { type DialogPosition, placeBox } from "./position";
import { dialogState } from "./state";

type DialogButton = { label: string; onClick: (event: MouseEvent) => void; tip?: string; className?: string };
type MessageButton = Omit<DialogButton, "onClick"> & { onClick?: (event: MouseEvent) => unknown }; // false keeps the window open
type TitlebarButton = {
  id?: string;
  label: string;
  tip: string;
  className: string;
  onClick: (event: MouseEvent) => void;
};

type DialogOptions = {
  title?: string;
  position?: DialogPosition;
  width?: number | string;
  height?: number | "auto";
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  resizable?: boolean;
  fullscreen?: boolean; // covers the viewport; false restores the size and spot it had
  buttons?: DialogButton[];
  footer?: string | HTMLElement;
  titlebarButtons?: TitlebarButton[];
  className?: string;
  modal?: boolean;
  closeOnEscape?: boolean;
  persistent?: boolean; // hidden on close instead of removed, for markup built once
  rememberPosition?: boolean; // false for message windows reused by unrelated callers
  beforeClose?: () => boolean | undefined;
  onClose?: () => void;
  onResize?: () => void;
};

type MessageOptions = Omit<DialogOptions, "buttons" | "persistent" | "rememberPosition"> & {
  id?: string; // to address the window later, generated otherwise
  message: string | HTMLElement; // markup, or an element built before opening, such as a chart
  buttons?: MessageButton[]; // each closes the window unless its handler returns false; OK when none
};

type ConfirmOptions = {
  title?: string;
  message?: string;
  confirm?: string;
  cancel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  event?: Event; // a Shift-click skips the question
  width?: string;
  modal?: boolean;
};

type PromptOptions<T> = { default: T; title?: string; step?: number; min?: number; max?: number; required?: boolean };

type Point = { left: number; top: number };

type Instance = {
  id: string;
  options: DialogOptions;
  content: HTMLElement;
  window: HTMLElement;
  buttonpane: HTMLElement | null;
  overlay: HTMLElement | null;
  opener: Element | null;
  manual: Point | null; // where the user dragged it, overriding the default position
  windowed: { width: DialogOptions["width"]; height: DialogOptions["height"]; point: Point } | null; // before fullscreen
};

const BASE_Z_INDEX = 100;
const RESIZE_EDGES = ["n", "e", "s", "w", "se", "sw", "ne", "nw"] as const;
const TABBABLE = "input, select, textarea, button, object, a[href], area[href], [tabindex]";
const MAP_CENTER = { my: "center", at: "center", of: "svg" };
let messages = 0;

class DialogManager {
  #dialogs = new Map<string, Instance>();

  /** Wrap the element `#id` in a dialog window and show it. Opening an open dialog applies the new options and brings it
   * to the front; without options it shows a dialog again as it was */
  open(id: string, options?: DialogOptions): void {
    const content = ensureEl(id);
    const existing = this.#dialogs.get(id);
    if (existing?.content === content && existing.window.isConnected) {
      if (options) {
        if (existing.options.className) existing.window.classList.remove(existing.options.className);
        existing.options = { ...options };
        if (options.rememberPosition === false) existing.manual = null; // a new message starts where its caller asks
      }
      this.#render(existing);
      if (existing.window.hidden) {
        this.#show(existing);
        return;
      }
      this.#size(existing);
      this.#place(existing);
      this.#raise(existing);
      return;
    }

    existing?.window.remove(); // its content was replaced without closing the dialog
    const instance = this.#create(content, options ?? {});
    this.#dialogs.set(id, instance);
    this.#show(instance);
  }

  /** Change some options of an open dialog: a new `position` re-places it, a new size re-sizes it */
  update(id: string, options: Partial<DialogOptions>): void {
    const instance = this.#get(id);
    if (!instance) return;

    if ("className" in options && instance.options.className)
      instance.window.classList.remove(instance.options.className);
    Object.assign(instance.options, options);
    if ("title" in options) this.#setTitle(instance);
    if ("buttons" in options || "footer" in options) this.#renderButtonpane(instance);
    if ("resizable" in options) this.#renderResizeHandles(instance);
    if (options.className) instance.window.classList.add(options.className);
    this.#size(instance);
    if ("position" in options) this.#place(instance);
    if ("fullscreen" in options) this.#setFullscreen(instance, Boolean(options.fullscreen));
  }

  /** Close the dialog unless its `beforeClose` vetoes; a non-persistent dialog is removed with its content */
  close(id: string): void {
    const instance = this.#get(id);
    if (!instance || instance.options.beforeClose?.() === false) return;
    const { window: element, content, options, overlay, opener } = instance;

    overlay?.remove();
    instance.overlay = null;
    restoreFocus(element, opener);

    if (options.persistent) {
      element.hidden = true;
    } else {
      this.#dialogs.delete(id);
      dialogState.forget(id);
    }
    options.onClose?.();
    content.dispatchEvent(new CustomEvent("dialog:close"));
    if (!options.persistent) element.remove();
  }

  /** Close every open dialog whose content does not match `except`; minimized ones stay, and messages on request */
  closeAll(except?: string, { keepMessages = false } = {}): void {
    for (const [id, { content, window: element }] of this.#dialogs) {
      if (except && content.matches(except)) continue;
      if (keepMessages && content.classList.contains("message")) continue;
      if (element.classList.contains("dialog-minimized")) continue;
      this.close(id);
    }
  }

  isOpen(id: string): boolean {
    return Boolean(this.#get(id));
  }

  /** Remove a dialog and its content without running its close callbacks, as before rendering it anew */
  destroy(id: string): void {
    this.#dialogs.get(id)?.overlay?.remove();
    this.#dialogs.delete(id);
    const content = findEl(id);
    if (!content) return;
    content.closest(".dialog-window")?.remove();
    content.remove();
    dialogState.forget(id);
  }

  /** Tell the user something in a window of its own; returns the message element, to wire the controls it holds */
  message({
    id = `message${++messages}`,
    message,
    buttons = [{ label: t("OK") }],
    title = t("Warning"),
    width = "26em",
    position = MAP_CENTER,
    ...options
  }: MessageOptions): HTMLElement {
    this.destroy(id); // a message with the same id replaces the previous one
    const text = document.createElement("p");
    text.className = "dialog-message";
    if (typeof message === "string") text.innerHTML = message;
    else text.append(message);
    const content = document.createElement("div");
    content.id = id;
    content.className = "message";
    content.append(text);
    ensureEl("dialogs").append(content);

    this.open(id, {
      ...options,
      title,
      width,
      position,
      rememberPosition: false,
      buttons: buttons.map(({ onClick, ...button }) => ({
        ...button,
        onClick: event => {
          if (onClick?.(event) !== false) this.close(id);
        }
      }))
    });
    return text;
  }

  /** Ask before an action that cannot be reverted. Every confirmation in the app goes through it: a Shift-click skips it */
  confirm({
    title = t("Confirm action"),
    message = `${t("Are you sure you want to continue?")}<br>${t("This action cannot be reverted")}`,
    confirm = t("Continue"),
    cancel = t("Cancel"),
    onConfirm,
    onCancel,
    event,
    width,
    modal
  }: ConfirmOptions): void {
    if (isShiftClick(event)) return void onConfirm?.();

    const tip = t("Hold Shift when clicking the button to skip the confirmation");
    const content = this.message({
      title,
      message,
      width,
      modal,
      buttons: [
        { label: confirm, tip, onClick: () => onConfirm?.() },
        { label: cancel, onClick: () => onCancel?.() }
      ]
    });
    const frame = content.closest<HTMLElement>(".dialog-window")!;
    const [confirmButton, cancelButton] = frame.querySelectorAll<HTMLButtonElement>(".dialog-buttonset > button");
    confirmButton.focus();
    frame.addEventListener("keydown", keyEvent => {
      if (keyEvent.key !== "Enter" || document.activeElement === cancelButton) return;
      keyEvent.preventDefault();
      keyEvent.stopPropagation();
      confirmButton.click();
    });
  }

  /** Ask for one value in a window of its own (the native prompt does not work in Electron); `callback` gets it on confirm */
  prompt<T extends number | string>(text: string, options: PromptOptions<T>, callback: (value: T) => void): void {
    const { title = t("Enter value"), step, min, max, required = true } = options;
    const type = typeof options.default === "number" ? "number" : "text";
    const input = document.createElement("input");
    Object.assign(input, {
      type,
      className: "dialog-prompt",
      autocomplete: "off",
      required,
      placeholder: `type a ${type}`
    });
    if (step !== undefined) input.step = String(step);
    if (min !== undefined) input.min = String(min);
    if (max !== undefined) input.max = String(max);
    input.value = String(options.default);
    const body = document.createElement("div");
    body.innerHTML = text;
    body.append(input);

    const confirm = () => {
      if (!input.reportValidity()) return false;
      callback((type === "number" ? +input.value : input.value) as T);
    };
    this.message({
      id: "prompt", // a new question replaces an unanswered one
      title,
      message: body,
      buttons: [{ label: t("Confirm"), onClick: confirm }, { label: t("Cancel") }]
    });
    input.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (confirm() !== false) this.close("prompt");
    });
    input.focus();
  }

  #get(id: string): Instance | undefined {
    const instance = this.#dialogs.get(id);
    if (!instance) return undefined;
    if (!instance.window.isConnected || !instance.content.isConnected) {
      this.#dialogs.delete(id); // removed without closing (destroy)
      return undefined;
    }
    return instance.window.hidden ? undefined : instance;
  }

  #create(content: HTMLElement, options: DialogOptions): Instance {
    const { id } = content;
    const element = document.createElement("div");
    element.className = "dialog-window";
    element.setAttribute("role", "dialog");
    element.setAttribute("aria-labelledby", `${id}-dialog-title`);
    element.tabIndex = -1;
    element.innerHTML = /* html */ `<div class="dialog-titlebar">
      <span id="${id}-dialog-title" class="dialog-title"></span>
      <button type="button" class="dialog-titlebar-button dialog-titlebar-reset icon-ccw" data-tip="${t("Reset the dialog: restore its default position, columns and sorting")}" aria-label="${t("Reset the dialog")}" hidden></button>
      <button type="button" class="dialog-titlebar-button dialog-titlebar-collapse" data-tip="${t("Minimize / maximize")}" aria-label="${t("Minimize / maximize")}">_</button>
      <button type="button" class="dialog-titlebar-button dialog-titlebar-close" data-tip="${t("Close")}" title="${t("Close")}" aria-label="${t("Close")}">✕</button>
    </div>`;

    content.classList.add("dialog-content");
    element.append(content);
    ensureEl("dialogs").append(element);

    const remembered = options.rememberPosition !== false;
    const instance: Instance = {
      id,
      options: { ...options },
      content,
      window: element,
      buttonpane: null,
      overlay: null,
      opener: null,
      windowed: null,
      manual: remembered ? dialogState.get<Point | null>(id, "position", () => null) : null
    };

    this.#render(instance);
    this.#listen(instance);
    return instance;
  }

  #render(instance: Instance): void {
    this.#setTitle(instance);
    this.#renderTitlebarButtons(instance);
    this.#renderButtonpane(instance);
    this.#renderResizeHandles(instance);
    if (instance.options.className) instance.window.classList.add(instance.options.className);
  }

  #show(instance: Instance): void {
    const { window: element, options } = instance;
    instance.opener = document.activeElement;
    element.hidden = false;
    if (instance.content.style.display === "none") instance.content.style.display = ""; // markup may start hidden
    this.#size(instance);
    this.#place(instance);
    element.style.zIndex = String(BASE_Z_INDEX);
    this.#raise(instance);

    if (options.modal) {
      const overlay = document.createElement("div");
      overlay.className = "dialog-overlay";
      overlay.style.zIndex = String(Number(element.style.zIndex) - 1);
      overlay.addEventListener("mousedown", event => event.preventDefault());
      element.before(overlay);
      instance.overlay = overlay;
    }
  }

  #listen(instance: Instance): void {
    const { id, window: element } = instance;
    const titlebar = element.querySelector<HTMLElement>(".dialog-titlebar")!;
    const resetButton = element.querySelector<HTMLButtonElement>(".dialog-titlebar-reset")!;

    element.addEventListener("pointerdown", () => this.#raise(instance));
    element.addEventListener("keydown", event => this.#onKeydown(instance, event));

    titlebar.addEventListener("mousedown", event => {
      if (!(event.target as Element).closest("button")) event.preventDefault(); // no text selection or focus change
    });
    titlebar.addEventListener("pointerdown", event => {
      if (event.button === 0 && !(event.target as Element).closest("button")) this.#drag(instance, event);
    });
    element.querySelector(".dialog-titlebar-collapse")!.addEventListener("click", () => {
      element.classList.toggle("dialog-minimized");
    });
    element.querySelector(".dialog-titlebar-close")!.addEventListener("click", () => this.close(id));
    resetButton.addEventListener("click", () => dialogState.reset(id));
    if (instance.options.rememberPosition === false) return;

    const updateResetButton = () => {
      resetButton.hidden = !dialogState.hasLayout(id);
    };
    updateResetButton();
    dialogState.onChange(id, updateResetButton);
    dialogState.onReset(id, "position", () => {
      instance.manual = null;
      this.#place(instance);
    });
  }

  #onKeydown(instance: Instance, event: KeyboardEvent): void {
    if (event.defaultPrevented) return;
    if (event.key === "Escape" && instance.options.closeOnEscape !== false) {
      event.preventDefault();
      this.close(instance.id);
      return;
    }
    if (event.key !== "Tab") return;

    // keep Tab cycling inside the window
    const tabbables = Array.from(instance.window.querySelectorAll<HTMLElement>(TABBABLE)).filter(isTabbable);
    const first = tabbables[0];
    const last = tabbables.at(-1);
    if (!first || !last) return;
    const target = event.target as HTMLElement;
    const atEdge = event.shiftKey ? target === first : target === last;
    if (!atEdge && target !== instance.window) return;
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }

  #setTitle({ window: element, options }: Instance): void {
    element.querySelector(".dialog-title")!.textContent = options.title || " ";
  }

  #renderTitlebarButtons({ window: element, options }: Instance): void {
    const reset = element.querySelector(".dialog-titlebar-reset");
    for (const custom of element.querySelectorAll(".dialog-titlebar-custom")) custom.remove();
    for (const { id, label, tip, className, onClick } of options.titlebarButtons ?? []) {
      const button = document.createElement("button");
      if (id) button.id = id;
      button.type = "button";
      button.className = `dialog-titlebar-button dialog-titlebar-custom ${className}`;
      button.dataset.tip = tip;
      button.setAttribute("aria-label", label);
      button.addEventListener("click", onClick);
      reset?.before(button);
    }
  }

  #renderButtonpane(instance: Instance): void {
    instance.buttonpane?.remove();
    instance.buttonpane = null;
    const { buttons = [], footer } = instance.options;
    if (!buttons.length && !footer) return;

    const pane = document.createElement("div");
    pane.className = "dialog-buttonpane";
    const set = document.createElement("div");
    set.className = "dialog-buttonset";
    for (const { label, onClick, tip, className } of buttons) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      if (tip) button.dataset.tip = tip;
      if (className) button.className = className;
      button.addEventListener("click", onClick);
      set.append(button);
    }
    pane.append(set);
    if (typeof footer === "string") pane.insertAdjacentHTML("afterbegin", footer);
    else if (footer) pane.prepend(footer);

    instance.content.after(pane);
    instance.buttonpane = pane;
  }

  #renderResizeHandles(instance: Instance): void {
    const { window: element, options } = instance;
    for (const handle of element.querySelectorAll(":scope > .dialog-resize")) handle.remove();
    if (!options.resizable) return;

    for (const edge of RESIZE_EDGES) {
      const handle = document.createElement("div");
      handle.className = `dialog-resize dialog-resize-${edge}`;
      handle.addEventListener("mousedown", event => event.preventDefault());
      handle.addEventListener("pointerdown", event => {
        if (event.button === 0) this.#resize(instance, edge, event);
      });
      element.append(handle);
    }
  }

  /** The content takes what `height` leaves after the titlebar and button pane */
  #size({ window: element, content, options }: Instance): void {
    const { width, height = "auto", minWidth = 150, minHeight, maxHeight } = options;
    Object.assign(content.style, { width: "auto", minHeight: "0", maxHeight: "none", height: "0" });
    const finalWidth = typeof width === "number" && minWidth > width ? minWidth : width;
    element.style.height = "auto";
    element.style.width = typeof finalWidth === "number" ? `${finalWidth}px` : (finalWidth ?? "");

    const nonContentHeight = element.getBoundingClientRect().height;
    if (height === "auto") {
      content.style.minHeight = minHeight === undefined ? "" : `${Math.max(0, minHeight - nonContentHeight)}px`;
      content.style.maxHeight = maxHeight === undefined ? "none" : `${Math.max(0, maxHeight - nonContentHeight)}px`;
      content.style.height = "auto";
    } else {
      content.style.height = `${Math.max(0, height - nonContentHeight)}px`;
    }
  }

  #place(instance: Instance): void {
    const { window: element, options, manual } = instance;
    const position = options.position ?? {};
    const size = element.getBoundingClientRect();
    const point = manual
      ? clampToViewport(manual, element)
      : placeBox(position, size, targetBox(position.of), viewportBox());
    setPoint(element, point);
  }

  #setFullscreen(instance: Instance, on: boolean): void {
    const { window: element, options } = instance;
    if (on === Boolean(instance.windowed)) return;
    if (on) {
      instance.windowed = { width: options.width, height: options.height, point: pointOf(element) };
      const { width, height } = viewportBox();
      options.width = width - (element.offsetWidth - element.clientWidth);
      options.height = height;
      this.#size(instance);
      setPoint(element, { left: 0, top: 0 });
      return;
    }
    const { width, height, point } = instance.windowed!;
    Object.assign(options, { width, height });
    instance.windowed = null;
    this.#size(instance);
    setPoint(element, point);
  }

  #raise({ window: element }: Instance): void {
    const others = Array.from(ensureEl("dialogs").querySelectorAll<HTMLElement>(":scope > .dialog-window")).filter(
      other => other !== element && !other.hidden
    );
    const max = Math.max(...others.map(other => Number(getComputedStyle(other).zIndex) || 0));
    if (max >= Number(element.style.zIndex)) element.style.zIndex = String(max + 1);
  }

  #drag(instance: Instance, event: PointerEvent): void {
    const { window: element } = instance;
    const start = pointOf(element);

    dragPointer(
      event,
      (dx, dy) => setPoint(element, clampToViewport({ left: start.left + dx, top: start.top + dy }, element)),
      moved => {
        if (!moved) return;
        instance.manual = pointOf(element);
        if (instance.options.rememberPosition !== false) dialogState.set(instance.id, "position", instance.manual);
      }
    );
  }

  #resize(instance: Instance, edge: string, event: PointerEvent): void {
    const { window: element, options } = instance;
    const start = element.getBoundingClientRect();
    const borderX = element.offsetWidth - element.clientWidth;
    const borderY = element.offsetHeight - element.clientHeight;
    const { minWidth = 150, maxWidth = Infinity, minHeight = 10, maxHeight = Infinity } = options;
    const chromeHeight = start.height - parseFloat(getComputedStyle(instance.content).height); // titlebar, paddings, button pane
    const { width: viewportWidth, height: viewportHeight } = viewportBox();

    dragPointer(
      event,
      (dx, dy) => {
        let { width, height } = start;
        if (edge.includes("e")) width = minmax(start.width + dx, 0, viewportWidth - start.left);
        if (edge.includes("w")) width = minmax(start.width - dx, 0, start.right);
        if (edge.includes("s")) height = minmax(start.height + dy, 0, viewportHeight - start.top);
        if (edge.includes("n")) height = minmax(start.height - dy, 0, start.bottom);
        width = minmax(width, minWidth + borderX, maxWidth + borderX);
        height = minmax(height, Math.max(minHeight + borderY, chromeHeight), maxHeight + borderY);

        options.width = width - borderX;
        options.height = height;
        this.#size(instance);
        setPoint(element, {
          left: edge.includes("w") ? start.right - width : start.left,
          top: edge.includes("n") ? start.bottom - height : start.top
        });
      },
      moved => {
        if (!moved) return;
        instance.manual = pointOf(element);
        options.onResize?.();
      }
    );
  }
}

export const Dialog = new DialogManager();

// Shift is tracked in the capture phase: the hotkeys stop keyup propagation on document,
// and a missed release would skip every confirmation
let shiftHeld = false;
let lastClick: { shift: boolean; time: number } = { shift: false, time: 0 };
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  const track = (held: boolean) => (event: KeyboardEvent) => {
    if (event.key === "Shift") shiftHeld = held;
  };
  window.addEventListener("keydown", track(true), true);
  window.addEventListener("keyup", track(false), true);
  window.addEventListener("blur", () => {
    shiftHeld = false;
  });
  window.addEventListener("click", event => (lastClick = { shift: event.shiftKey, time: Date.now() }), true);
}

function isShiftClick(event?: Event): boolean {
  return (
    Boolean((event as MouseEvent | undefined)?.shiftKey) ||
    shiftHeld ||
    (lastClick.shift && Date.now() - lastClick.time < 300)
  );
}

function setPoint(element: HTMLElement, { left, top }: Point): void {
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
}

function pointOf(element: HTMLElement): Point {
  return { left: parseFloat(element.style.left) || 0, top: parseFloat(element.style.top) || 0 };
}

/** A position saved on a wider screen would put the dialog out of reach, so keep it on screen */
function clampToViewport({ left, top }: Point, element: HTMLElement): Point {
  const { width, height } = viewportBox();
  const size = element.getBoundingClientRect();
  return {
    left: minmax(left, 0, Math.max(width - size.width, 0)),
    top: minmax(top, 0, Math.max(height - size.height, 0))
  };
}

function viewportBox() {
  const { clientWidth, clientHeight } = document.documentElement;
  return { left: 0, top: 0, width: clientWidth || window.innerWidth, height: clientHeight || window.innerHeight };
}

function targetBox(of: DialogPosition["of"]) {
  const target = typeof of === "string" ? document.querySelector(of) : of;
  if (!(target instanceof Element)) return viewportBox();
  const { left, top, width, height } = target.getBoundingClientRect();
  return { left, top, width, height };
}

function isTabbable(element: HTMLElement): boolean {
  if (element.tabIndex < 0 || (element as HTMLButtonElement).disabled) return false;
  return element.getClientRects().length > 0;
}

/** Back to what had the focus when the dialog opened, unless the focus has moved on (to a window opened meanwhile) */
function restoreFocus(frame: HTMLElement, opener: Element | null): void {
  const active = document.activeElement;
  if (active && active !== document.body && !frame.contains(active)) return;
  if (opener instanceof HTMLElement && opener !== document.body && opener.isConnected && isFocusable(opener)) {
    opener.focus();
    return;
  }
  (active as HTMLElement | null)?.blur?.();
}

function isFocusable(element: HTMLElement): boolean {
  if (!element.getClientRects().length) return false;
  if (element.matches("input, select, textarea, button, object")) return !(element as HTMLButtonElement).disabled;
  return element.matches("a[href], area[href], [tabindex]");
}
