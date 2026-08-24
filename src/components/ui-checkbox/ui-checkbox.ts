// <ui-checkbox label="..."> — a styled checkbox, checked state mirrored onto the host attribute;
// re-dispatches "change" as a CustomEvent with {detail: {checked}}

import style from "./ui-checkbox.css?raw";

const template = document.createElement("template");
template.innerHTML = /* html */ `<style>${style}</style><input type="checkbox" id="input" /><label for="input"></label>`;

class UiCheckbox extends HTMLElement {
  private built = false;

  constructor() {
    super();
    this.attachShadow({ mode: "open" }).appendChild(template.content.cloneNode(true));
  }

  static get observedAttributes() {
    return ["label"];
  }

  connectedCallback() {
    if (this.built) return;
    this.built = true;

    this.input.checked = this.hasAttribute("checked");
    this.label.textContent = this.getAttribute("label") || "";
    this.input.addEventListener("change", () => {
      this.toggleAttribute("checked", this.input.checked);
      this.dispatchEvent(
        new CustomEvent("change", { detail: { checked: this.input.checked }, bubbles: true, composed: true })
      );
    });
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
    if (name === "label" && this.built) this.label.textContent = newValue || "";
  }

  private get input(): HTMLInputElement {
    return this.shadowRoot!.querySelector("input")!;
  }

  private get label(): HTMLLabelElement {
    return this.shadowRoot!.querySelector("label")!;
  }

  get checked(): boolean {
    return this.input.checked;
  }

  set checked(value: boolean) {
    this.input.checked = value;
    this.toggleAttribute("checked", value);
  }
}

customElements.define("ui-checkbox", UiCheckbox);

export type UiCheckboxElement = InstanceType<typeof UiCheckbox>;
