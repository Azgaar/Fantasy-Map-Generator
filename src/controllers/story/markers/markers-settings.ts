import { Controllers } from "@/controllers";
import { Icons } from "@/model/icons";
import { Markers } from "@/model/story/markers-generator";
import { Layers } from "@/renderers/layers";
import { Dialog } from "@/ui/dialog/dialog";
import { refreshEditors } from "@/ui/dialog/dialog-helpers";
import { t } from "@/utils/i18n";
import { ensureEl } from "@/utils/node-utils";
import { escapeHtml } from "@/utils/string-utils";

const DIALOG_ID = "markersSettings";

function open(): void {
  if (options.app.mode) return;
  Dialog.destroy(DIALOG_ID);
  ensureEl("dialogs").insertAdjacentHTML("beforeend", `<div id="${DIALOG_ID}" class="dialog"></div>`);
  drawConfigTable();

  Dialog.open(DIALOG_ID, {
    title: t("Markers generation settings"),
    maxHeight: 600,
    position: { my: "left top", at: "left+10 top+10", of: "svg" },
    buttons: [
      {
        label: t("Regenerate"),
        tip: t("Apply changes and regenerate markers"),
        onClick: () => {
          applyChanges();
          Markers.regenerate();
          Layers.draw("markers");
          refreshEditors();
          Dialog.close(DIALOG_ID);
        }
      },
      { label: t("Close"), tip: t("Close the window"), onClick: () => Dialog.close(DIALOG_ID) }
    ],
    onClose: cleanup
  });
}

function applyChanges(): void {
  const rows = ensureEl(DIALOG_ID).querySelectorAll<HTMLTableRowElement>("tbody > tr");
  const rowsData = Array.from(rows).map(row => {
    const typeInput = row.querySelector<HTMLInputElement>(".type");
    const iconButton = row.querySelector<HTMLElement>(".changeIcon");
    const multiplierInput = row.querySelector<HTMLInputElement>(".multiplier");
    if (!typeInput || !iconButton || !multiplierInput) throw new Error("Invalid markers configuration row");

    return {
      type: typeInput.value,
      icon: iconButton.dataset.icon ?? "",
      multiplier: multiplierInput.valueAsNumber
    };
  });

  Markers.setConfig(Markers.getConfig().map((markerType, index) => ({ ...markerType, ...rowsData[index] })));
}

function drawConfigTable(): void {
  const headers = /* html */ `<thead style='font-weight:bold'><tr>
    <td data-tip="${t("Name")}">${t("Type")}</td>
    <td data-tip="${t("Marker icon")}">${t("Icon")}</td>
    <td data-tip="${t("Marker number multiplier")}">${t("Multiplier")}</td>
    <td data-tip="${t("Number of markers of that type on the current map")}">${t("Number")}</td>
  </tr></thead>`;

  const lines = Markers.getConfig().map(({ type, icon, multiplier }) => {
    return /* html */ `<tr>
      <td><input class="type" value="${type}" /></td>
      <td>
        <button class="changeIcon" data-icon="${escapeHtml(icon)}" data-tip="${t("Change the icon")}" style="font-size: 1.2em">${Icons.html(icon)}</button>
      </td>
      <td><input class="multiplier" type="number" min="0" max="100" step="0.1" value="${multiplier}" /></td>
      <td style="text-align:center">${pack.markers.filter(marker => marker.type === type).length}</td>
    </tr>`;
  });

  const dialog = ensureEl(DIALOG_ID);
  dialog.innerHTML = `<table class="table">${headers}<tbody>${lines.join("")}</tbody></table>`;
  dialog.querySelectorAll<HTMLButtonElement>("button.changeIcon").forEach(button => {
    button.addEventListener("click", () => {
      Controllers.IconPicker.open({
        current: button.dataset.icon ?? "",
        onPick: icon => {
          button.dataset.icon = icon;
          button.innerHTML = Icons.html(icon);
        }
      });
    });
  });
}

function cleanup(): void {
  Dialog.destroy(DIALOG_ID);
}

export const MarkersSettings = { open };
