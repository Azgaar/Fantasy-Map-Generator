// <slider-input> — a range slider paired with a number input, kept in sync;
// re-dispatches "input"/"change" as CustomEvents with {detail: {value}}

const style = /* css */ `
  slider-input {
    display: flex;
    align-items: center;
    gap: .4em;
  }
`;

const styleElement = document.createElement("style");
styleElement.setAttribute("type", "text/css");
styleElement.innerHTML = style;
document.head.appendChild(styleElement);

const template = document.createElement("template");
template.innerHTML = /* html */ `
  <input type="range" />
  <input type="number" />
`;

class SliderInput extends HTMLElement {
  constructor() {
    super();
    this.appendChild(template.content.cloneNode(true));

    const range = this.querySelector<HTMLInputElement>("input[type=range]")!;
    const number = this.querySelector<HTMLInputElement>("input[type=number]")!;

    range.value = number.value = this.value || this.getAttribute("value") || "50";
    range.min = number.min = this.getAttribute("min") || "0";
    range.max = number.max = this.getAttribute("max") || "100";
    range.step = number.step = this.getAttribute("step") || "1";

    range.addEventListener("input", this.handleEvent.bind(this));
    number.addEventListener("input", this.handleEvent.bind(this));
    range.addEventListener("change", this.handleEvent.bind(this));
    number.addEventListener("change", this.handleEvent.bind(this));
  }

  handleEvent(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    const isInvalid = Number.isNaN(Number(value));
    if (isInvalid || value === "") return e.stopPropagation();

    const range = this.querySelector<HTMLInputElement>("input[type=range]")!;
    const number = this.querySelector<HTMLInputElement>("input[type=number]")!;
    this.value = range.value = number.value = value;

    this.dispatchEvent(
      new CustomEvent(e.type, {
        detail: { value },
        bubbles: true,
        composed: true
      })
    );
  }

  set value(value: string) {
    const range = this.querySelector<HTMLInputElement>("input[type=range]")!;
    const number = this.querySelector<HTMLInputElement>("input[type=number]")!;
    range.value = number.value = value;
  }

  get value(): string {
    const number = this.querySelector<HTMLInputElement>("input[type=number]")!;
    return number.value;
  }

  get valueAsNumber(): number {
    const number = this.querySelector<HTMLInputElement>("input[type=number]")!;
    return number.valueAsNumber;
  }
}

customElements.define("slider-input", SliderInput);
