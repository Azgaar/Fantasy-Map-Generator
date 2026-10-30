import { EXPENSE_LABELS } from "@/data/id-labels";
import { Districts } from "@/model/political/districts";
import { STABILITY_PARTS, Stability, type StabilityPart } from "@/model/political/stability";
import { Dialog } from "@/ui/dialog/dialog";
import { ECONOMY_COLORS, EconomyTerms, tone } from "@/ui/economy-view";
import { tip } from "@/ui/tooltips";
import { t } from "@/utils/i18n";
import { ensureEl } from "@/utils/node-utils";
import { rn } from "@/utils/number-utils";

const dialogPrefix = "stabilityOverview";

const STYLE = /* html */ `<style>
  .stabilityDialog > div { width: auto }
  .stabilityDialog h4 { margin: 0.4em 0 0.3em; border-bottom: 1px solid var(--dark-solid) }
  .stabilityDialog .row { display: grid; grid-template-columns: 9em auto 2.5em; align-items: center; column-gap: 0.4em; line-height: 1.5; white-space: nowrap }
  .stabilityDialog .row.plain { grid-template-columns: 1fr auto }
  .stabilityDialog .bar { height: 0.7em; background: #eee }
  .stabilityDialog .bar > div { height: 100% }
  .stabilityDialog .right { text-align: right; white-space: nowrap }
  .stabilityDialog .total { font-weight: bold; border-top: 1px solid #ccc }
  .stabilityDialog .scroll { max-height: 18em; overflow-y: auto }
  .stabilityDialog table.districts { width: 100%; border-collapse: collapse }
  .stabilityDialog table.districts th { text-align: right; font-weight: normal; color: #666; padding: 0 0.3em }
  .stabilityDialog table.districts td { text-align: right; padding: 0 0.3em; line-height: 1.5 }
  .stabilityDialog table.districts th:first-child, .stabilityDialog table.districts td:first-child { text-align: left }
</style>`;

/** Opens one dialog per state, so states can be compared side by side */
function open(stateId: number): void {
  const state = pack.states[stateId];
  if (!stateId || !state || state.removed) return;
  if (!Stability.get(stateId)) {
    tip(EconomyTerms.noData(), true, "error", 5000);
    return;
  }

  const id = `${dialogPrefix}${stateId}`;
  Dialog.destroy(id);
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="${id}" class="dialog stable stabilityDialog">${STYLE}${renderParts(stateId)} ${renderDistricts(stateId)}</div>`
  );
  Dialog.open(id, {
    title: t("Stability of {{- state}}", { state: state.fullName || state.name }),
    width: "fit-content",
    onClose: () => Dialog.destroy(id),
    position: { my: "right top", at: "right-10 top+10", of: "svg" }
  });
}

/** Each part of the state's stability, supporting or undermining it; the base is the same for all */
function renderParts(stateId: number): string {
  const stability = Stability.get(stateId)!;
  const labels: Record<StabilityPart, string> = {
    base: t("Base"),
    prosperity: t("Prosperity"),
    court: EXPENSE_LABELS.court,
    army: t("Army"),
    remoteness: t("Remoteness"),
    diversity: t("Minorities"),
    corruption: t("Corruption"),
    burden: t("Tax burden")
  };
  const signed = (value: number) => `${value >= 0 ? "+" : "−"}${rn(Math.abs(value) * 100)}`;
  const rows = STABILITY_PARTS.map(part => {
    const value = stability.parts[part];
    const color = value >= 0 ? ECONOMY_COLORS.positive : ECONOMY_COLORS.negative;
    const bar =
      part === "base"
        ? "<span></span>"
        : `<div class="bar"><div style="width: ${Math.min(100, Math.abs(value) * 200)}%; background: ${color}"></div></div>`;
    return `<div class="row"><span>${labels[part]}</span>${bar}<span class="right ${tone(value)}">${signed(value)}</span></div>`;
  }).join("");
  const total = `<div class="row plain total"><span>${t("Stability")}</span><span class="right">${rn(stability.stability * 100)}%</span></div>`;
  return `<div><h4>${t("Stability")}</h4>${rows}${total}</div>`;
}

/** Each province governed through its own seat, and the crown lands the capital governs, least stable first */
function renderDistricts(stateId: number): string {
  const state = pack.states[stateId];
  const districts = Stability.getDistricts(stateId);
  if (districts.length < 2) return "";
  const infrastructure = Districts.getInfrastructure(state);
  const percent = (value: number) => `${rn(value * 100)}%`;
  const rows = districts
    .map((stability, k) => ({ ...stability, infrastructure: infrastructure[k] }))
    .sort((a, b) => a.stability - b.stability)
    .map(({ district, stability, infrastructure }) => {
      const name = district.province ? (pack.provinces[district.province]?.name ?? "—") : t("Crown lands");
      const corruption = Districts.getCorruption(state, district, state.economy.collected);
      return `<tr><td>${name}</td><td>${percent(district.share)}</td><td>${percent(district.remoteness)}</td><td>${percent(district.diversity)}</td><td>${rn(corruption)}%</td><td>${percent(infrastructure)}</td><td><b>${percent(stability)}</b></td></tr>`;
    })
    .join("");
  const header = [
    [t("Province"), t("Province, or the crown lands governed from the capital")],
    [t("People"), t("Share of the state's people")],
    [t("Remoteness"), t("Distance from the capital")],
    [t("Minorities"), t("Share of other cultures and faiths")],
    [t("Corruption"), t("Share of state spending officials pocket")],
    [t("Infrastructure"), t("How well the state's public works serve the people")],
    [t("Stability"), EconomyTerms.stability()]
  ]
    .map(([label, tipText]) => `<th data-tip="${tipText}">${label}</th>`)
    .join("");
  return `<h4>${t("Provinces")}</h4><div class="scroll"><table class="districts"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

export const StabilityOverview = { open };
