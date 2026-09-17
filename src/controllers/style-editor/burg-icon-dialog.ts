import { destroyDialog } from "@/components/dialog/dialog-helpers";
import { BURG_ICONS, burgIconPreview, PORT_ICONS } from "@/data/burg-icons";
import { ensureEl, findEl } from "@/utils";

export const BURG_ICON_DIALOG = "burgIconDialog";

const STYLE = /* css */ `
  #burgIconDialog .choices { display: grid; grid-template-columns: repeat(7, 5em); gap: .3em; }
  #burgIconDialog > div { width: 100%; }
  #burgIconDialog h4 { margin: .6em 0 .3em; }
  #burgIconDialog h4:first-child { margin-top: 0; }
  #burgIconDialog button { width: 100%; min-width: 0; margin: 0; padding: .3em .2em; border: 1px solid transparent; border-radius: 0; white-space: normal; }
  #burgIconDialog button:hover { border-color: var(--dark-solid); }
  #burgIconDialog button.pressed { border: 1px solid var(--dark-solid); }
  #burgIconDialog button svg { display: block; width: 100%; height: 42px; overflow: visible; pointer-events: none; }
  #burgIconDialog button span { display: block; font-size: 0.9em; line-height: 1em; opacity: .7; text-transform: capitalize; overflow-wrap: anywhere; }
`;

type Options = {
  anchors: boolean; // the port icons instead of the burg ones
  selected: string;
  fill: string;
  stroke: string;
  onPick: (id: string) => void;
};

/** The dialog's content: the icon sets, the selected one pressed */
export function renderChoices(anchors: boolean, selected: string): string {
  const icons = anchors ? PORT_ICONS : BURG_ICONS;
  return [...new Set(icons.map(icon => icon.group))]
    .map(
      group => /* html */ `
        <h4>${group}</h4>
        <div class="choices">
          ${icons
            .filter(icon => icon.group === group)
            .map(
              icon => /* html */ `
                <button type="button" data-icon="${icon.id}" title="${icon.name}" class="${icon.id === selected ? "pressed" : ""}">
                  ${burgIconPreview(icon)}<span>${icon.name}</span>
                </button>`
            )
            .join("")}
        </div>`
    )
    .join("");
}

export function openBurgIconDialog({ anchors, selected, fill, stroke, onPick }: Options): void {
  destroyDialog(BURG_ICON_DIALOG);
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="${BURG_ICON_DIALOG}" class="dialog">
      <style>${STYLE}</style>
      ${renderChoices(anchors, selected)}
    </div>`
  );
  const dialog = ensureEl(BURG_ICON_DIALOG);
  paintBurgIconDialog(fill, stroke, dialog);
  dialog.addEventListener("click", event => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-icon]");
    if (!button) return;
    for (const pressed of dialog.querySelectorAll(".pressed")) pressed.classList.remove("pressed");
    button.classList.add("pressed");
    onPick(button.dataset.icon!);
  });

  $(dialog).dialog({
    title: anchors ? "Select port icon" : "Select burg icon",
    width: "fit-content",
    position: { my: "center", at: "center", of: "svg" },
    close: () => destroyDialog(BURG_ICON_DIALOG),
    buttons: {
      Close: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

/** Redraw the open dialog's icons in a group's paint as it is edited */
export function paintBurgIconDialog(fill: string, stroke: string, dialog = findEl(BURG_ICON_DIALOG)): void {
  if (!dialog) return;
  dialog.style.fill = fill;
  dialog.style.stroke = stroke;
}
