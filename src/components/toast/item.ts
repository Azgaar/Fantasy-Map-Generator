// <toast-item> — a single dismissible, auto-expiring notification card

export type ToastType = "info" | "success" | "warn" | "error";

const style = /* css */ `
  toast-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.7em;
    pointer-events: auto;
    max-width: 26em;
    padding: 0.6em 0.8em 0.75em;
    border: 1px solid var(--dark-solid, #5e4fa2);
    border-left-width: 4px;
    border-radius: 1px;
    box-shadow: 0.5px 0.5px 0px var(--dark-solid, #5e4fa2);
    background: var(--bg-dialogs, #f2f2f2);
    color: #333333;
    font-family: var(--sans-serif);
    font-size: 1rem;
    white-space: pre-line;
    opacity: 0;
    transform: translateY(0.5em);
    overflow: hidden;
    transition: opacity 0.2s ease, transform 0.2s ease;
  }

  toast-item.shown {
    opacity: 1;
    transform: translateY(0);
  }

  toast-item[data-type="info"] {
    border-left-color: #5e5c5c;
  }

  toast-item[data-type="success"] {
    border-left-color: #127912;
  }

  toast-item[data-type="warn"] {
    border-left-color: #be5d08;
  }

  toast-item[data-type="error"] {
    border-left-color: #c13119;
  }

  toast-item .toast-message {
    flex: 1;
  }

  toast-item .toast-close {
    background: none;
    border: none;
    color: var(--dark-solid, #5e4fa2);
    cursor: pointer;
    font-size: 1.1em;
    line-height: 1;
    opacity: 0.7;
  }

  toast-item .toast-close:hover {
    opacity: 1;
  }

  toast-item .toast-timebar {
    position: absolute;
    left: 0;
    bottom: 0;
    height: 3px;
    width: 100%;
    transform-origin: left;
  }

  toast-item[data-type="info"] .toast-timebar {
    background: #5e5c5c;
  }

  toast-item[data-type="success"] .toast-timebar {
    background: #127912;
  }

  toast-item[data-type="warn"] .toast-timebar {
    background: #be5d08;
  }

  toast-item[data-type="error"] .toast-timebar {
    background: #c13119;
  }
`;

const styleElement = document.createElement("style");
styleElement.setAttribute("type", "text/css");
styleElement.innerHTML = style;
document.head.appendChild(styleElement);

const template = document.createElement("template");
template.innerHTML = /* html */ `
  <span class="toast-message"></span>
  <button type="button" class="toast-close" aria-label="Dismiss">&times;</button>
  <div class="toast-timebar"></div>
`;

class ToastItem extends HTMLElement {
  private pendingMessage = "";
  private timebarAnimation?: Animation;
  private built = false;

  // Custom element constructors must not add children (document.createElement throws
  // a NotSupportedError otherwise); build the template once connected instead. Guard against
  // building twice: connectedCallback re-runs if the element is ever disconnected and reattached.
  connectedCallback() {
    if (this.built) return;
    this.built = true;

    this.appendChild(template.content.cloneNode(true));
    this.querySelector(".toast-message")!.textContent = this.pendingMessage;
    this.querySelector(".toast-close")?.addEventListener("click", () => this.dismiss());
    this.addEventListener("mouseenter", () => this.timebarAnimation?.pause());
    this.addEventListener("mouseleave", () => this.timebarAnimation?.play());
    // Double rAF before adding the class: without it the browser can coalesce the initial
    // and "shown" styles into one frame and skip the enter transition entirely.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.classList.add("shown"));
    });
  }

  set message(message: string) {
    this.pendingMessage = message;
    const messageEl = this.querySelector(".toast-message");
    if (messageEl) messageEl.textContent = message;
  }

  set type(type: ToastType) {
    this.dataset.type = type;
  }

  // The Web Animations API gives us native pause()/play() (hover pauses the dismiss timer),
  // which a hand-rolled CSS transition + manual freeze/resume can't do reliably: resuming a
  // CSS transition from a frozen mid-animation value tends to jump straight to the end state
  // instead of continuing to animate.
  autoDismiss(duration: number) {
    const timebar = this.querySelector<HTMLElement>(".toast-timebar");
    if (!timebar) return;

    this.timebarAnimation = timebar.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], {
      duration,
      easing: "linear",
      fill: "forwards"
    });
    this.timebarAnimation.onfinish = () => this.dismiss();
  }

  dismiss() {
    this.timebarAnimation?.cancel();
    this.classList.remove("shown");

    let removed = false;
    const removeOnce = () => {
      if (removed) return;
      removed = true;
      this.remove();
    };
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target !== this) return;
      this.removeEventListener("transitionend", onTransitionEnd);
      removeOnce();
    };
    this.addEventListener("transitionend", onTransitionEnd);
    // Fallback in case transitionend never fires (e.g. reduced-motion overrides or the
    // element is disconnected before the transition can run).
    setTimeout(removeOnce, 300);
  }
}

customElements.define("toast-item", ToastItem);

export type ToastItemElement = InstanceType<typeof ToastItem>;
