// The burg icon dialog: every icon of the sets a group may use, drawn in the group's own paint; a click
// picks one and keeps the dialog open so the map shows the choice
import { destroyDialog } from "@/components/dialog/dialog-helpers";
import { BURG_ICONS, type BurgIcon, burgIconPreview, PORT_ICONS } from "@/data/burg-icons";
import { ensureEl, findEl } from "@/utils";

export const BURG_ICON_DIALOG = "burgIconDialog";

const STYLE = /* css */ `
  #burgIconDialog .choices { display: grid; grid-template-columns: repeat(5, 5em); gap: 4px; }
  #burgIconDialog h4 { margin: .6em 0 .3em; }
  #burgIconDialog h4:first-child { margin-top: 0; }
  #burgIconDialog button { width: 100%; min-width: 0; margin: 0; padding: 4px 2px; border: 1px solid transparent; border-radius: 3px; background: #e6dfce; color: #493f32; cursor: pointer; white-space: normal; }
  #burgIconDialog button:hover { background: #f4eddb; border-color: #8a7252; }
  #burgIconDialog button.pressed { background: #fff3cd; border: 2px solid #8a3c32; padding: 3px 1px; }
  #burgIconDialog button svg { display: block; width: 100%; height: 42px; overflow: visible; pointer-events: none; }
  #burgIconDialog button span { display: block; font-size: 9px; line-height: 12px; text-transform: capitalize; overflow-wrap: anywhere; }
`;

type Options = {
  anchors: boolean; // the port icons instead of the burg ones
  selected: string;
  fill: string;
  stroke: string;
  onPick: (id: string) => void;
};

/** The dialog's content: the icon sets, the selected one pressed */
export function renderChoices(anchors: boolean, selected: string): HTMLElement {
  const icons = anchors ? PORT_ICONS : BURG_ICONS;
  const content = document.createElement("div");
  for (const group of new Set(icons.map(icon => icon.group))) {
    const title = document.createElement("h4");
    title.textContent = group;
    const grid = document.createElement("div");
    grid.className = "choices";
    grid.append(...icons.filter(icon => icon.group === group).map(icon => choice(icon, icon.id === selected)));
    content.append(title, grid);
  }
  return content;
}

function choice(icon: BurgIcon, pressed: boolean): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.icon = icon.id;
  button.title = icon.name;
  button.classList.toggle("pressed", pressed);
  button.innerHTML = `${burgIconPreview(icon)}<span>${icon.name}</span>`;
  return button;
}

export function openBurgIconDialog({ anchors, selected, fill, stroke, onPick }: Options): void {
  destroyDialog(BURG_ICON_DIALOG);
  if (!findEl("burgIconDialogStyle")) {
    const style = document.createElement("style");
    style.id = "burgIconDialogStyle";
    style.textContent = STYLE;
    document.head.append(style);
  }

  const dialog = document.createElement("div");
  dialog.id = BURG_ICON_DIALOG;
  dialog.className = "dialog";
  dialog.style.display = "none";
  dialog.append(renderChoices(anchors, selected));
  paintBurgIconDialog(fill, stroke, dialog);
  dialog.addEventListener("click", event => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-icon]");
    if (!button) return;
    for (const pressed of dialog.querySelectorAll(".pressed")) pressed.classList.remove("pressed");
    button.classList.add("pressed");
    onPick(button.dataset.icon!);
  });
  ensureEl("dialogs").append(dialog);

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
