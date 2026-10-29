// The map layers, the topmost first, one per row: drag a row to raise or lower its layer
import { LAYER_TOGGLES } from "@/data/layer-labels";
import { Layers } from "@/renderers/layers";
import { Dialog } from "@/ui/dialog/dialog";
import { sortableList } from "@/ui/sortable-list";
import { t } from "@/utils/i18n";
import { ensureEl, findEl } from "@/utils/node-utils";

const DIALOG_ID = "layersOrder";
const STYLE = /* css */ `
  #${DIALOG_ID} { padding: .4em .5em; }
  #${DIALOG_ID} > .rows { width: auto; }
  #${DIALOG_ID} .row { display: grid; grid-template-columns: 1em 1fr 1.2em; align-items: center; gap: .4em; height: 1.9em; padding: 0 .4em; border-radius: 3px; white-space: nowrap; }
  #${DIALOG_ID} .row:hover { background: rgba(0, 0, 0, .06); }
  #${DIALOG_ID} .row.off :is(.name, .eye) { opacity: .5; }
  #${DIALOG_ID} .row .icon-resize-vertical { cursor: row-resize; opacity: .6; touch-action: none; }
  #${DIALOG_ID} .row .eye { cursor: pointer; text-align: center; }
`;

let unsubscribe: (() => void) | undefined;

function open(): void {
  if (findEl(DIALOG_ID)) return void Dialog.open(DIALOG_ID);

  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="${DIALOG_ID}" class="dialog"><style>${STYLE}</style><div class="rows"></div></div>`
  );
  const rows = ensureEl(DIALOG_ID).querySelector<HTMLElement>(".rows")!;
  rows.addEventListener("click", event => {
    const eye = (event.target as HTMLElement).closest<HTMLElement>(".eye");
    const id = eye?.closest<HTMLElement>(".row")?.dataset.layer;
    if (id && Layers.has(id)) Layers.toggle(id);
  });
  sortableList(rows, { items: ".row", handle: ".icon-resize-vertical", onReorder: move });
  unsubscribe = Layers.subscribe(render);

  Dialog.open(DIALOG_ID, {
    title: t("Layers Order"),
    width: "16em",
    maxHeight: Math.round(window.innerHeight * 0.8),
    position: { my: "left top", at: "right+10 top", of: "#options" },
    buttons: [{ label: t("Restore"), tip: t("Restore the default layer order"), onClick: () => Layers.resetOrder() }],
    onClose: close
  });
  render();
}

function close(): void {
  unsubscribe?.();
  unsubscribe = undefined;
}

/** Only the layers drawn in the map's viewbox take part: the others are fixed above or below it. The topmost is listed first */
function render(): void {
  const rows = findEl(DIALOG_ID)?.querySelector(".rows");
  if (!rows) return;
  rows.innerHTML = Layers.all
    .filter(layer => layer.params.parent === "viewbox" && LAYER_TOGGLES.has(layer.id))
    .reverse()
    .map(layer => {
      const { label } = LAYER_TOGGLES.get(layer.id)!;
      const on = Layers.isOn(layer.id);
      return /* html */ `<div class="row${on ? "" : " off"}" data-layer="${layer.id}">
        <span class="icon-resize-vertical" data-tip="${t("Drag to reorder")}"></span>
        <span class="name">${label}</span>
        <span class="eye ${on ? "icon-eye" : "icon-eye-off"}" data-tip="${t("Toggle {{- layer}}", { layer: label })}"></span>
      </div>`;
    })
    .join("");
}

/** The row above is drawn right over the moved layer; none means the moved layer goes on top */
function move(row: HTMLElement): void {
  const id = row.dataset.layer;
  const before = (row.previousElementSibling as HTMLElement | null)?.dataset.layer;
  if (id && Layers.has(id)) Layers.move(id, before && Layers.has(before) ? before : undefined);
}

export const LayersOrder = { open };
