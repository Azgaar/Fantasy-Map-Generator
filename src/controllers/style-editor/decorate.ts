// What the form shows beyond its rows: the changed marks with their reset buttons, the per-card previews,
// and which cards the user folded. Edits update all of it in place
import type { PathSelection } from "@/types/styles";
import type { Baseline } from "./baseline";
import { storeValue } from "./baseline";

const folded = new Map<string, boolean>(); // section open state per element, for the session

const fieldsOf = (root: ParentNode): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>("[data-field]"));
const relativeOf = (field: HTMLElement): string[] => field.dataset.field!.split(".");

export class FormDecoration {
  private readonly cards: HTMLDetailsElement[];

  /** Decorate a freshly rendered form and keep it decorated while it is edited; `reset` writes the preset
   * value and re-renders */
  constructor(
    private readonly form: HTMLElement,
    private readonly sel: PathSelection,
    private baseline: Baseline | undefined,
    private readonly reset: (relative: string[], value: unknown) => void
  ) {
    for (const field of fieldsOf(form)) this.addResetButton(field);

    this.cards = Array.from(form.querySelectorAll<HTMLDetailsElement>("details[data-section]"));
    for (const card of this.cards) {
      const key = `${sel.element}/${card.dataset.section}`;
      if (folded.has(key)) card.open = folded.get(key)!;
      card.addEventListener("toggle", () => folded.set(key, card.open));
    }

    // the control has written the store by the time the event bubbles here; a tick later is safe for every widget
    const onEdit = (event: Event) => {
      const field = (event.target as Element | null)?.closest<HTMLElement>("[data-field]");
      if (!field || !form.contains(field)) return;
      window.setTimeout(() => {
        this.mark(field);
        this.updatePreviews();
      }, 0);
    };
    form.addEventListener("input", onEdit);
    form.addEventListener("change", onEdit);

    this.markAll();
  }

  /** The tab renders before the preset is loaded; once it is, the marks appear */
  setBaseline(baseline: Baseline | undefined): void {
    this.baseline = baseline;
    this.markAll();
  }

  private addResetButton(field: HTMLElement): void {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reset icon-ccw";
    button.addEventListener("click", event => {
      event.stopPropagation();
      const diff = this.baseline?.diffAt(this.sel, relativeOf(field));
      if (diff) this.reset(relativeOf(field), diff.presetValue);
    });
    // a composite field's rows: the button sits on the first; a row part or a gate takes it itself
    (field.querySelector(":scope > .ctl, :scope > .row > .ctl") ?? field).append(button);
  }

  private markAll(): void {
    for (const field of fieldsOf(this.form)) this.mark(field);
    this.updatePreviews();
  }

  // a changed field shows its reset button; the button's tip names the value it restores
  private mark(field: HTMLElement): void {
    const diff = this.baseline?.diffAt(this.sel, relativeOf(field));
    field.classList.toggle("changed", diff?.changed ?? false);
    const button = field.querySelector<HTMLElement>(".reset");
    if (button && diff) {
      const value = diff.presetValue;
      const text = value == null ? "unset" : typeof value === "object" ? JSON.stringify(value) : String(value);
      button.dataset.tip = `Reset to preset value: ${text}`;
    }
  }

  private updatePreviews(): void {
    for (const card of this.cards) {
      card.querySelector<HTMLElement>("summary > .preview")!.replaceChildren(...this.preview(card));
    }
  }

  // what the card's own rows (not a nested card's) produce, read from the store: a text sample for a font,
  // else a swatch for a fill and a line for a stroke; the filter's name when one is set
  private preview(card: HTMLDetailsElement): Element[] {
    const attrs: Record<string, unknown> = {};
    for (const field of fieldsOf(card)) {
      if (field.closest("details[data-section]") !== card) continue;
      const relative = relativeOf(field);
      attrs[relative.at(-1)!] = storeValue(this.sel, relative);
    }
    const str = (key: string): string | undefined => (typeof attrs[key] === "string" ? String(attrs[key]) : undefined);
    const num = (key: string, fallback: number): number =>
      typeof attrs[key] === "number" ? Number(attrs[key]) : fallback;

    const font = str("font-family");
    const fill = str("fill") ?? str("color");
    const stroke = str("stroke");
    const filter = str("filter");
    const slot = document.createElement("span");

    if (font) {
      const sample = document.createElement("span");
      sample.className = "sample";
      sample.textContent = "Sample";
      sample.style.fontFamily = font;
      sample.style.fontWeight = String(attrs["font-weight"] ?? "");
      sample.style.fontStyle = str("font-style") ?? "";
      sample.style.color = fill ?? "";
      if (stroke && num("stroke-width", 0) > 0) {
        sample.style.webkitTextStroke = `${Math.min(num("stroke-width", 0), 1)}px ${stroke}`;
      }
      slot.append(sample);
    } else {
      if (fill) {
        slot.innerHTML += /* html */ `<span class="sw"><i style="background: ${fill}; opacity: ${num("fill-opacity", num("opacity", 1))}"></i></span>`;
      }
      if (stroke) {
        const dash = str("stroke-dasharray");
        slot.innerHTML += /* html */ `<svg class="ln" width="60" height="12"><line x1="0" y1="6" x2="60" y2="6" stroke="${stroke}" stroke-width="${Math.min(num("stroke-width", 1), 6)}" opacity="${num("opacity", 1)}" ${dash && dash !== "none" ? `stroke-dasharray="${dash}"` : ""} ${str("stroke-linecap") ? `stroke-linecap="${str("stroke-linecap")}"` : ""}/></svg>`;
      }
    }
    if (filter && filter !== "none") {
      // url(#splotch) → "splotch"; a CSS function list → its function names
      const name =
        filter.match(/^url\(#(.+)\)$/)?.[1] ?? Array.from(filter.matchAll(/([a-z-]+)\(/g), m => m[1]).join(", ");
      const fx = document.createElement("span");
      fx.className = "fx";
      fx.textContent = name;
      slot.append(fx);
    }
    return Array.from(slot.children);
  }
}
