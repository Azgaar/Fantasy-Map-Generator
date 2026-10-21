/**
 * dialog.ts — the editor's two building blocks: an FMG-native dialog, and a
 * schema-driven form on top of it.
 *
 * D2 asks for editors that feel like FMG's own. The cheapest honest way to get
 * that is to use the same widget FMG does (`#alert`, a jQuery UI dialog) and the
 * same markup habits (`data-tip` for hover text, plain typed inputs), then style
 * only the layout — which is what the `tw-` classes are for.
 *
 * The form layer is *schema-driven* rather than one hand-written dialog per
 * field. Content is data (JSON docs), so the editors are data too: a field says
 * how to read a value and how to write it back, and every editor — roster units,
 * buildings, technology, factions — gets input types, validation and error display
 * for free.
 */
import { escapeHtml, fmg } from "../fmg";

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

export interface DialogOptions {
  /** jQuery UI takes pixels or "auto"; strings allow both. */
  width?: number | string;
  height?: number | string;
  /** the Apply button; omit for a read-only dialog */
  onApply?: () => void;
  applyLabel?: string;
  /** extra buttons, left to right after Apply */
  extra?: { label: string; onClick: () => void }[];
}

/**
 * Open a dialog through FMG's own widget.
 *
 * Going through `#alert` rather than building our own is the point: it inherits
 * FMG's theme, its positioning behaviour and its lifecycle, so our editors cannot
 * drift out of step with the app they live in.
 */
export function openTwDialog(title: string, bodyHtml: string, options: DialogOptions = {}): HTMLElement {
  const host = fmg()?.$;
  if (!host) throw new Error("FMG's dialog widget is not available");
  const message = globalThis.document.getElementById("alertMessage");
  if (!message) throw new Error("FMG's #alertMessage is missing");
  message.innerHTML = bodyHtml;

  const buttons: Record<string, (this: HTMLElement) => void> = {};
  if (options.onApply) {
    buttons[options.applyLabel ?? "Apply"] = function (this: HTMLElement) {
      // Deliberately does NOT close: a rejected edit (validation errors) must
      // leave the dialog open with the errors visible next to the fields.
      options.onApply?.();
    };
  }
  for (const extra of options.extra ?? []) {
    buttons[extra.label] = function (this: HTMLElement) {
      extra.onClick();
    };
  }
  buttons.Close = function (this: HTMLElement) {
    host(this).dialog("close");
  };

  host("#alert").dialog({
    resizable: true,
    width: options.width ?? 640,
    height: options.height ?? "auto",
    title,
    buttons
  });

  const dialog = message.closest(".ui-dialog") as HTMLElement | null;
  message.classList.add("tw-dialog-body");
  if (dialog) {
    dialog.classList.add("tw-dialog");
    dialog.classList.add("tw-dialog-box");
    dialog.style.opacity = "1";
  }
  return dialog ?? message;
}

/** Show validation errors in place, above the fields. */
export function showErrors(root: HTMLElement, errors: string[]): void {
  const host =
    (root.querySelector("#tw-errors") as HTMLElement | null) ??
    (root.parentElement?.querySelector("#tw-errors") as HTMLElement | null);
  if (!host) return;
  host.innerHTML = errors.length
    ? `<p class="tw-errors-title">${errors.length} problem${errors.length === 1 ? "" : "s"} — nothing was changed:</p><ul>${errors
        .map(error => `<li>${escapeHtml(error)}</li>`)
        .join("")}</ul>`
    : "";
  host.classList.toggle("is-shown", errors.length > 0);
}

export function clearErrors(root: HTMLElement): void {
  showErrors(root, []);
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

export type Field =
  | { kind: "text"; label: string; tip?: string; read: () => string; write: (value: string) => void }
  | {
      kind: "number";
      label: string;
      tip?: string;
      min?: number;
      max?: number;
      step?: number;
      read: () => number;
      write: (value: number) => void;
    }
  | { kind: "checkbox"; label: string; tip?: string; read: () => boolean; write: (value: boolean) => void }
  | {
      kind: "select";
      label: string;
      tip?: string;
      /** options are recomputed on every render, so they follow the live ruleset */
      options: () => { value: string; label: string }[];
      read: () => string;
      write: (value: string) => void;
    }
  | {
      kind: "tags";
      label: string;
      tip?: string;
      /** checkbox per candidate, in a stable order */
      candidates: () => { value: string; label: string }[];
      read: () => string[];
      write: (values: string[]) => void;
    };

const fieldId = (index: number): string => `tw-field-${index}`;

/** Render a field group as HTML. Values are escaped; nothing here is trusted. */
export function renderFields(fields: Field[]): string {
  return `<div class="tw-fields">${fields
    .map((field, index) => {
      const id = fieldId(index);
      const tip = field.tip ? ` data-tip="${escapeHtml(field.tip)}"` : "";
      switch (field.kind) {
        case "text":
          return (
            `<label class="tw-field" for="${id}"><span>${escapeHtml(field.label)}</span>` +
            `<input id="${id}" class="tw-input" type="text" autocomplete="off"${tip} value="${escapeHtml(field.read())}" /></label>`
          );
        case "number": {
          const attrs = [
            `min="${field.min ?? ""}"`,
            `max="${field.max ?? ""}"`,
            field.step !== undefined ? `step="${field.step}"` : ""
          ]
            .filter(Boolean)
            .join(" ");
          return (
            `<label class="tw-field" for="${id}"><span>${escapeHtml(field.label)}</span>` +
            `<input id="${id}" class="tw-input tw-input--number" type="number"${tip} ${attrs} value="${field.read()}" /></label>`
          );
        }
        case "checkbox":
          return (
            `<label class="tw-field tw-field--check" for="${id}"><input id="${id}" class="native" type="checkbox"${tip}` +
            `${field.read() ? " checked" : ""} /><span>${escapeHtml(field.label)}</span></label>`
          );
        case "select": {
          const current = field.read();
          const options = field
            .options()
            .map(
              option =>
                `<option value="${escapeHtml(option.value)}"${option.value === current ? " selected" : ""}>${escapeHtml(option.label)}</option>`
            )
            .join("");
          return (
            `<label class="tw-field" for="${id}"><span>${escapeHtml(field.label)}</span>` +
            `<select id="${id}" class="tw-select"${tip}>${options}</select></label>`
          );
        }
        case "tags": {
          const current = new Set(field.read());
          const boxes = field
            .candidates()
            .map(
              candidate =>
                `<label class="tw-tag"><input class="native" type="checkbox" name="${id}" value="${escapeHtml(candidate.value)}"` +
                `${current.has(candidate.value) ? " checked" : ""} /><span>${escapeHtml(candidate.label)}</span></label>`
            )
            .join("");
          return `<div class="tw-field tw-field--tags"><span>${escapeHtml(field.label)}</span><div class="tw-tags">${boxes}</div></div>`;
        }
      }
      return ""; // every Field kind is handled above
    })
    .join("")}</div>`;
}

/**
 * Read a rendered form back into values, reporting the ones that will not parse.
 *
 * Nothing is written to the target here — the caller decides when the whole form
 * is valid, which is what makes "apply" all-or-nothing.
 */
export function readFields(root: HTMLElement, fields: Field[]): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  fields.forEach((field, index) => {
    const id = fieldId(index);
    switch (field.kind) {
      case "text": {
        const input = root.querySelector<HTMLInputElement>(`#${id}`);
        if (input) field.write(input.value.trim());
        break;
      }
      case "number": {
        const input = root.querySelector<HTMLInputElement>(`#${id}`);
        if (!input) break;
        const value = Number(input.value);
        if (!Number.isFinite(value)) {
          errors.push(`${field.label} must be a number (got "${input.value}")`);
          break;
        }
        if (field.min !== undefined && value < field.min) {
          errors.push(`${field.label} must be at least ${field.min}`);
          break;
        }
        if (field.max !== undefined && value > field.max) {
          errors.push(`${field.label} must be at most ${field.max}`);
          break;
        }
        field.write(value);
        break;
      }
      case "checkbox": {
        const input = root.querySelector<HTMLInputElement>(`#${id}`);
        if (input) field.write(input.checked);
        break;
      }
      case "select": {
        const select = root.querySelector<HTMLSelectElement>(`#${id}`);
        if (select) field.write(select.value);
        break;
      }
      case "tags": {
        const boxes = [...root.querySelectorAll<HTMLInputElement>(`input[name="${id}"]`)];
        field.write(boxes.filter(box => box.checked).map(box => box.value));
        break;
      }
    }
  });
  return { ok: errors.length === 0, errors };
}
