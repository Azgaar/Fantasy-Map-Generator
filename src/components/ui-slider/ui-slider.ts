// <ui-slider> — a range slider paired with a number input, kept in sync;
// re-dispatches "input"/"change" as CustomEvents with {detail: {value}}

import style from "./ui-slider.css?raw";

const template = document.createElement("template");
template.innerHTML = /* html */ `<style>${style}</style><slot></slot><input type="range" /><input type="number" />`;

class UiSlider extends HTMLElement {
  private built = false;

  constructor() {
    super();
    this.attachShadow({ mode: "open" }).appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    if (this.built) return;
    this.built = true;

    const { range, number } = this;
    range.value = number.value = this.getAttribute("value") || "50";
    range.min = number.min = this.getAttribute("min") || "0";
    range.max = number.max = this.getAttribute("max") || "100";
    range.step = number.step = this.getAttribute("step") || "1";

    range.addEventListener("input", this.handleEvent.bind(this));
    number.addEventListener("input", this.handleEvent.bind(this));
    range.addEventListener("change", this.handleEvent.bind(this));
    number.addEventListener("change", this.handleEvent.bind(this));
  }

  private get range(): HTMLInputElement {
    return this.shadowRoot!.querySelector("input[type=range]")!;
  }

  private get number(): HTMLInputElement {
    return this.shadowRoot!.querySelector("input[type=number]")!;
  }

  private handleEvent(e: Event) {
    e.stopPropagation();

    const value = (e.target as HTMLInputElement).value;
    const isInvalid = Number.isNaN(Number(value));
    if (isInvalid || value === "") return;

    this.range.value = this.number.value = value;

    this.dispatchEvent(
      new CustomEvent(e.type, {
        detail: { value },
        bubbles: true,
        composed: true
      })
    );
  }

  set value(value: string) {
    this.range.value = this.number.value = value;
  }

  get value(): string {
    return this.number.value;
  }

  get valueAsNumber(): number {
    return this.number.valueAsNumber;
  }
}

customElements.define("ui-slider", UiSlider);

export type UiSliderElement = InstanceType<typeof UiSlider>;
