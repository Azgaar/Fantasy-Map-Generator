import {tip} from "scripts/tooltips";

const template = document.createElement("template");
template.innerHTML = /* html */ `
  <style>
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
  </style>
  <svg>
    <rect x="0" y="0" width="100%" height="100%">
  </svg>
`;

class FillBox extends HTMLElement {
  private tooltip: string;

  constructor() {
    super();

    this.tooltip = this.dataset.tip || "Fill style. Click to change";

    // cannot use Shadow DOM here as need an access to svg hatches
    this.appendChild(template.content.cloneNode(true));
  }

  private showTip() {
    tip(this.tooltip);
  }

  connectedCallback() {
    this.querySelector("rect")?.setAttribute("fill", this.fill);
    this.querySelector("svg")?.setAttribute("width", this.size);
    this.querySelector("svg")?.setAttribute("height", this.size);

    this.addEventListener("mousemove", this.showTip);
  }

  disconnectedCallback() {
    this.removeEventListener("mousemove", this.showTip);
  }

  get fill() {
    return this.getAttribute("fill") || "#333";
  }

  set fill(newFill) {
    this.setAttribute("fill", newFill);
    this.querySelector("rect")?.setAttribute("fill", newFill);
  }

  get size() {
    return this.getAttribute("size") || "1em";
  }
}

customElements.define("fill-box", FillBox);
