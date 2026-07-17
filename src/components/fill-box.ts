// <fill-box> — a small clickable swatch previewing a fill style (color or hatch)
const style = /* css */ `
  fill-box:not([disabled]) {
    cursor: pointer;
  }

  fill-box > svg {
    vertical-align: middle;
    pointer-events: none;
  }

  fill-box > svg > rect {
    stroke: #666666;
    stroke-width: 2;
  }
`;

const styleElement = document.createElement("style");
styleElement.setAttribute("type", "text/css");
styleElement.innerHTML = style;
document.head.appendChild(styleElement);

const template = document.createElement("template");
template.innerHTML = /* html */ `
  <svg>
    <rect x="0" y="0" width="100%" height="100%">
  </svg>
`;

function showTip(this: FillBox) {
  tip(this.tip);
}

class FillBox extends HTMLElement {
  constructor() {
    super();

    this.appendChild(template.content.cloneNode(true));
    this.querySelector("rect")?.setAttribute("fill", this.fill);
    this.querySelector("svg")?.setAttribute("width", this.size);
    this.querySelector("svg")?.setAttribute("height", this.size);
  }

  connectedCallback() {
    this.addEventListener("mousemove", showTip);
  }

  disconnectedCallback() {
    this.removeEventListener("mousemove", showTip);
  }

  get fill(): string {
    return this.getAttribute("fill") || "#333";
  }

  set fill(newFill: string) {
    this.setAttribute("fill", newFill);
    this.querySelector("rect")?.setAttribute("fill", newFill);
  }

  get size(): string {
    return this.getAttribute("size") || "1em";
  }

  get tip(): string {
    return this.dataset.tip || "Fill style. Click to change";
  }
}

// cannot use Shadow DOM here as need an access to svg hatches
customElements.define("fill-box", FillBox);
