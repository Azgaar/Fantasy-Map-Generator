import { Provinces } from "@/model/political/provinces-generator";
import { EmblemRenderer } from "@/renderers/emblems/renderer";
import { Layers } from "@/renderers/layers";
import { unfog } from "@/renderers/overlays/fogging";
import { Dialog } from "@/ui/dialog/dialog";
import { refreshEditors } from "@/ui/dialog/dialog-helpers";
import { tip } from "@/ui/tooltips";
import { t } from "@/utils/i18n";
import { ensureEl } from "@/utils/node-utils";

const DIALOG_ID = "provincesRegeneration";

function open(): void {
  if (options.app.mode) return;
  Dialog.destroy(DIALOG_ID);
  ensureEl("dialogs").insertAdjacentHTML("beforeend", `<div id="${DIALOG_ID}" class="dialog"></div>`);
  render();

  Dialog.open(DIALOG_ID, {
    title: t("Regenerate Provinces"),
    width: "32em",
    maxHeight: 600,
    position: { my: "center", at: "center", of: "svg" },
    buttons: [
      { label: t("Regenerate"), onClick: regenerate },
      {
        label: t("Close"),
        onClick: () => {
          Dialog.close(DIALOG_ID);
        }
      }
    ]
  });
}

function render(): void {
  const states = pack.states.filter(state => state.i && !state.removed).sort((a, b) => a.name.localeCompare(b.name));
  const provinces = (stateId: number) => pack.provinces.filter(p => p.i && !p.removed && p.state === stateId).length;

  for (const { i, coa } of states) if (coa) EmblemRenderer.trigger(`stateCOA${i}`, coa);
  const rows = states.map(
    ({ i, name, fullName, color }) => /* html */ `<div data-tip="${fullName || name}">
      <input id="${DIALOG_ID}State${i}" class="checkbox" type="checkbox" value="${i}" checked />
      <label for="${DIALOG_ID}State${i}" class="checkbox-label">
        <fill-box fill="${color}" disabled></fill-box>
        <svg class="coaIcon" viewBox="0 0 200 200"><use href="#stateCOA${i}"></use></svg>${name} (${provinces(i)})
      </label>
    </div>`
  );

  const dialog = ensureEl(DIALOG_ID);
  dialog.innerHTML = /* html */ `
    <p style="margin-top: 0">${t("Select states to regenerate provinces for. Locked provinces will remain as they are")}</p>
    <div style="margin-bottom: 0.4em">
      <input id="${DIALOG_ID}All" class="checkbox" type="checkbox" />
      <label for="${DIALOG_ID}All" class="checkbox-label"><b>${t("All states")}</b></label>
    </div>
    <div class="stateList" style="width: auto; display: grid; grid-template-columns: 1fr 1fr; gap: 0.3em">
      ${rows.join("") || t("No states to regenerate provinces for")}
    </div>`;

  const all = ensureEl<HTMLInputElement>(`${DIALOG_ID}All`);
  const boxes = Array.from(dialog.querySelectorAll<HTMLInputElement>(".stateList input"));
  const syncAll = () => {
    const checked = boxes.filter(box => box.checked).length;
    all.checked = checked === boxes.length;
    all.indeterminate = checked > 0 && checked < boxes.length;
  };
  syncAll();
  all.addEventListener("change", () => {
    for (const box of boxes) box.checked = all.checked;
  });
  for (const box of boxes) box.addEventListener("change", syncAll);
}

function regenerate(): void {
  const boxes = ensureEl(DIALOG_ID).querySelectorAll<HTMLInputElement>(".stateList input:checked");
  const stateIds = Array.from(boxes, box => Number(box.value));
  if (!stateIds.length) return void tip(t("Please select at least one state"), false, "error");

  Provinces.regenerate(true, stateIds);
  unfog();
  Layers.draw("borders", "provinces", "labels", "emblems");
  refreshEditors();
  Dialog.close(DIALOG_ID);
}

export const ProvincesRegeneration = { open };
