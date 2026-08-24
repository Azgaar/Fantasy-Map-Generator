// <ui-input> — a styled text input; re-dispatches "input"/"change" as CustomEvents with {detail: {value}}

import style from "./ui-input.css?raw";

const template = document.createElement("template");
template.innerHTML = /* html */ `<style>${style}</style><input type="text" />`;

class UiInput extends HTMLElement {
  private built = false;

  constructor() {
    super();
    this.attachShadow({ mode: "open" }).appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    if (this.built) return;
    this.built = true;

    this.input.value = this.getAttribute("value") || "";
    if (this.hasAttribute("placeholder")) this.input.placeholder = this.getAttribute("placeholder")!;

    for (const type of ["input", "change"]) {
      this.input.addEventListener(type, (e: Event) => {
        e.stopPropagation();
        this.dispatchEvent(
          new CustomEvent(type, { detail: { value: this.input.value }, bubbles: true, composed: true })
        );
      });
    }
  }

  private get input(): HTMLInputElement {
    return this.shadowRoot!.querySelector("input")!;
  }

  get value(): string {
    return this.input.value;
  }

  set value(value: string) {
    this.input.value = value;
  }
}

customElements.define("ui-input", UiInput);

export type UiInputElement = InstanceType<typeof UiInput>;
