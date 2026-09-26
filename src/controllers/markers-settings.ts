import { destroyDialog, refreshEditors } from "@/components/dialog/dialog-helpers";
import { Icons } from "@/components/icons";
import { Layers } from "@/components/layers";
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import { ensureEl, escapeHtml } from "@/utils";

const DIALOG_ID = "markersSettings";

function open(): void {
  if (customization) return;
  destroyDialog(DIALOG_ID);
  ensureEl("dialogs").insertAdjacentHTML("beforeend", `<div id="${DIALOG_ID}" class="dialog"></div>`);
  drawConfigTable();

  $(`#${DIALOG_ID}`).dialog({
    resizable: false,
    title: "Markers generation settings",
    maxHeight: 600,
    position: { my: "left top", at: "left+10 top+10", of: "svg", collision: "fit" },
    buttons: {
      Regenerate: () => {
        applyChanges();
        Markers.regenerate();
        Layers.draw("markers");
        refreshEditors();
        drawConfigTable();
      },
      Close: function () {
        $(this).dialog("close");
      }
    },
    open: function () {
      const buttons = $(this).dialog("widget").find(".ui-dialog-buttonset > button");
      buttons[0].addEventListener("mousemove", () => tip("Apply changes and regenerate markers"));
      buttons[1].addEventListener("mousemove", () => tip("Close the window"));
    },
    close: cleanup
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
    <td data-tip="Marker type name">Type</td>
    <td data-tip="Marker icon">Icon</td>
    <td data-tip="Marker number multiplier">Multiplier</td>
    <td data-tip="Number of markers of that type on the current map">Number</td>
  </tr></thead>`;

  const lines = Markers.getConfig().map(({ type, icon, multiplier }) => {
    return /* html */ `<tr>
      <td><input class="type" value="${type}" /></td>
      <td>
        <button class="changeIcon" data-icon="${escapeHtml(icon)}" data-tip="Change the icon" style="font-size: 1.2em">${Icons.html(icon)}</button>
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
  destroyDialog(DIALOG_ID);
}

export const MarkersSettings = { open };
