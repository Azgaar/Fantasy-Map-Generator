import { destroyDialog } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import type { Alliance, AllianceType } from "@/generators/alliances-generator";
import {
  cleanupAllianceMembers,
  createAlliance,
  dissolveAlliance,
  normalizeAlliances,
  setAllianceMembers
} from "@/generators/alliances-generator";
import { ensureEl, findEl } from "@/utils";
import { t } from "@/utils/i18n";

type AllianceMapOptions = typeof options.map & { alliances?: Alliance[] };
const dialogId = "alliancesEditor";
const getAlliances = (): Alliance[] => {
  const mapOptions = options.map as AllianceMapOptions;
  mapOptions.alliances = normalizeAlliances(mapOptions.alliances, pack.states);
  cleanupAllianceMembers(mapOptions.alliances, pack.states);
  return mapOptions.alliances;
};
const escape = (value: string): string => value.replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]!);

function render(): void {
  const alliances = getAlliances();
  const states = pack.states.filter(state => state.i && !state.removed).toSorted((a, b) => a.name.localeCompare(b.name));
  const stateOptions = states.map(state => `<option value="${state.i}">${escape(state.name)}</option>`).join("");
  const rows = alliances.map(alliance => {
    const memberNames = alliance.members.map(id => pack.states[id]?.name).filter(Boolean).map(escape).join(", ");
    const members = states.map(state => `<option value="${state.i}" ${alliance.members.includes(state.i) ? "selected" : ""}>${escape(state.name)}</option>`).join("");
    return `<section style="border:1px solid #aaa;padding:.5em;margin:.4em 0">
      <div style="display:flex;align-items:center;gap:.4em">
        <span style="display:inline-block;width:1em;height:1em;background:${alliance.color};border:1px solid #555"></span>
        <strong>${escape(alliance.name)}</strong><span>· ${alliance.status}</span><span style="margin-left:auto">${alliance.members.length} members</span>
      </div>
      <div style="margin:.25em 0;font-size:.9em">${memberNames || t("No members")}</div>
      <label>${t("Members")} <select multiple size="3" data-members="${alliance.id}" style="min-width:15em;max-width:100%">${members}</select></label>
      <button data-save-members="${alliance.id}">${t("Save members")}</button>
      <button data-dissolve="${alliance.id}" ${alliance.status === "dissolved" ? "disabled" : ""}>${t("Dissolve")}</button>
      <button data-delete="${alliance.id}">${t("Delete")}</button>
    </section>`;
  }).join("");

  const inner = `<p>${t("Countries can belong to multiple alliances. Membership is edited manually; the first active alliance listed controls the map color when memberships overlap.")}</p>
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:.4em">
      <label>${t("Alliance name")}<input id="allianceName" type="text" maxlength="80" /></label>
      <label>${t("Color")}<input id="allianceColor" type="color" value="#4778c7" /></label>
      <label>${t("Type")}<select id="allianceType"><option value="political">${t("Political")}</option><option value="defensive">${t("Defensive")}</option><option value="military">${t("Military")}</option><option value="economic">${t("Economic")}</option></select></label>
      <label>${t("Initial members")}<select id="allianceMembers" multiple size="4" style="min-width:12em">${stateOptions}</select></label>
    </div>
    <button id="allianceCreate">${t("Create alliance")}</button>
    <hr /><h3>${t("Existing alliances")}</h3>
    ${rows || `<p>${t("No alliances yet")}</p>`}`;
  let dialog = findEl(dialogId);
  if (dialog) dialog.innerHTML = inner;
  else {
    ensureEl("dialogs").insertAdjacentHTML("beforeend", `<div id="${dialogId}" class="dialog" style="display:flex;flex-direction:column;gap:.4em;max-height:75vh;overflow:auto;min-width:26em">${inner}</div>`);
    dialog = ensureEl(dialogId);
  }

  dialog.querySelector("#allianceCreate")?.addEventListener("click", () => {
    try {
      const name = ensureEl<HTMLInputElement>("allianceName").value;
      const color = ensureEl<HTMLInputElement>("allianceColor").value;
      const type = ensureEl<HTMLSelectElement>("allianceType").value as AllianceType;
      const members = [...ensureEl<HTMLSelectElement>("allianceMembers").selectedOptions].map(option => Number(option.value));
      createAlliance(getAlliances(), pack.states, { name, color, type, members });
      refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    }
  });
  dialog.querySelectorAll<HTMLButtonElement>("[data-save-members]").forEach(button => button.addEventListener("click", () => {
    const alliance = getAlliances().find(item => item.id === button.dataset.saveMembers);
    const select = dialog!.querySelector<HTMLSelectElement>(`[data-members="${button.dataset.saveMembers}"]`);
    if (!alliance || !select) return;
    setAllianceMembers(alliance, [...select.selectedOptions].map(option => Number(option.value)), pack.states);
    refresh();
  }));
  dialog.querySelectorAll<HTMLButtonElement>("[data-dissolve]").forEach(button => button.addEventListener("click", () => {
    const alliance = getAlliances().find(item => item.id === button.dataset.dissolve);
    if (alliance && confirm(t("Dissolve this alliance?"))) { dissolveAlliance(alliance); refresh(); }
  }));
  dialog.querySelectorAll<HTMLButtonElement>("[data-delete]").forEach(button => button.addEventListener("click", () => {
    const mapOptions = options.map as AllianceMapOptions;
    mapOptions.alliances = getAlliances().filter(item => item.id !== button.dataset.delete);
    refresh();
  }));
}

function refresh(): void {
  render();
  if (Layers.isOn("alliances")) Layers.draw("alliances");
}

function open(): void {
  if (customization) return;
  if (!findEl(dialogId)) {
    render();
    $(`#${dialogId}`).dialog({
      title: t("Alliances Editor"),
      resizable: true,
      width: "fit-content",
      maxHeight: window.innerHeight * 0.8,
      close: () => destroyDialog(dialogId)
    });
  } else {
    render();
  }
}

export const AlliancesEditor = { open };
