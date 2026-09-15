import { escapeHtml } from "@/utils/stringUtils";

const groups = [
  {
    name: "Atlas",
    prefix: "",
    icons: [
      "circle",
      "square",
      "triangle",
      "cross",
      "star",
      "circled",
      "squared",
      "star-circled",
      "star-circled-empty",
      "star-squared",
      "circle-rayed",
      "circle-dotted",
      "diamond-dotted"
    ]
  },
  {
    name: "Watabou",
    prefix: "watabou-",
    icons: ["capital", "city", "town", "village", "hamlet", "fort", "monastery", "caravanserai", "post"]
  },
  {
    name: "Illustrated",
    prefix: "illustrated-",
    icons: ["palace", "burgh", "castle", "abbey", "caravanserai", "camp"]
  }
];

const icons = groups.flatMap(({ name, prefix, icons }) =>
  icons.map(icon => ({
    id: `#icon-${prefix}${icon}`,
    name: `${prefix ? `${name} ` : ""}${icon.replaceAll("-", " ")}`,
    group: name,
    viewBox: prefix === "watabou-" ? "-45 -88 90 100" : prefix ? "-23 -40 46 43" : "-28 -28 56 56"
  }))
);

const portIcons = [
  { id: "#icon-anchor", name: "Anchor", group: "Ports", viewBox: "-23 -23 46 46" },
  { id: "#icon-harbor", name: "Harbor", group: "Ports", viewBox: "-28 -28 56 56" }
];

const css = document.createElement("style");
css.textContent = /* css */ `
  burg-icon-picker { display: block; min-width: 150px; }
  burg-icon-picker summary { display: flex; align-items: center; gap: 8px; cursor: pointer; }
  burg-icon-picker summary::after { content: "▾"; margin-left: auto; }
  burg-icon-picker summary::-webkit-details-marker { display: none; }
  burg-icon-picker summary svg { width: 40px; height: 40px; flex: none; }
  burg-icon-picker summary span { text-transform: capitalize; }
  burg-icon-picker .burg-icon-choices { max-height: 310px; overflow-y: auto; padding: 4px; }
  burg-icon-picker .burg-icon-group { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
  burg-icon-picker h4 { margin: 8px 0 4px; font-size: 11px; }
  burg-icon-picker .burg-icon-choices button {
    width: 100%; min-width: 0; margin: 0; padding: 4px 2px; border: 1px solid transparent;
    border-radius: 3px; background: #e6dfce; color: #493f32; cursor: pointer; white-space: normal;
  }
  burg-icon-picker .burg-icon-choices button:hover { background: #f4eddb; border-color: #8a7252; }
  burg-icon-picker button[aria-pressed="true"] { background: #fff3cd; border: 2px solid #8a3c32; padding: 3px 1px; }
  burg-icon-picker button:focus-visible, burg-icon-picker summary:focus-visible { outline: 2px solid #8a3c32; }
  burg-icon-picker button svg { display: block; width: 100%; height: 42px; }
  burg-icon-picker button span { display: block; font-size: 9px; line-height: 12px; text-transform: capitalize; overflow-wrap: anywhere; }
  burg-icon-picker svg { overflow: visible; pointer-events: none; }
`;
document.head.append(css);

function preview(id: string, viewBox: string): string {
  return `<svg viewBox="${viewBox}" aria-hidden="true"><use href="${escapeHtml(id)}" font-size="40" stroke-width="1.5"/></svg>`;
}

export class BurgIconPicker extends HTMLElement {
  private selected = "#icon-circle";

  connectedCallback(): void {
    if (this.childElementCount) return;
    const choices = this.hasAttribute("anchors") ? portIcons : icons;
    const groupNames = [...new Set(choices.map(icon => icon.group))];
    this.innerHTML = `<details>
      <summary aria-label="Choose ${this.hasAttribute("anchors") ? "port" : "burg"} icon"></summary>
      <div class="burg-icon-choices">${groupNames
        .map(
          name => `<h4>${name}</h4>
        <div class="burg-icon-group" role="group" aria-label="${name}">${choices
          .filter(icon => icon.group === name)
          .map(
            icon =>
              `<button type="button" data-icon="${icon.id}" title="${icon.name}" aria-label="${icon.name}" aria-pressed="false">
            ${preview(icon.id, icon.viewBox)}<span>${icon.name.replace(`${name} `, "")}</span>
          </button>`
          )
          .join("")}</div>`
        )
        .join("")}
      </div>
    </details>`;
    this.querySelector("details")!.addEventListener("toggle", () => {
      if (this.querySelector("details")!.open) {
        this.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest" });
      }
    });
    this.addEventListener("click", event => {
      const button = (event.target as Element).closest<HTMLButtonElement>("button[data-icon]");
      if (!button) return;
      this.value = button.dataset.icon!;
      this.dispatchEvent(new Event("change", { bubbles: true }));
    });
    this.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      this.close();
    });
    this.update();
  }

  get value(): string {
    return this.selected;
  }

  set value(value: string) {
    this.selected = value || "#icon-circle";
    this.update();
  }

  private close(): void {
    this.querySelector("details")!.open = false;
    this.querySelector("summary")!.focus();
  }

  private update(): void {
    const summary = this.querySelector("summary");
    if (!summary) return;
    const icon = [...icons, ...portIcons].find(icon => icon.id === this.selected);
    summary.innerHTML = `${preview(this.selected, icon?.viewBox || "-28 -28 56 56")}<span>${icon?.name || "Custom icon"}</span>`;
    for (const button of this.querySelectorAll<HTMLButtonElement>("button[data-icon]")) {
      button.setAttribute("aria-pressed", String(button.dataset.icon === this.selected));
    }
  }
}

customElements.define("burg-icon-picker", BurgIconPicker);
