import { type ProvinceAccounts, ProvinceEconomy } from "@/model/economy/province-economy";
import { StateEconomy } from "@/model/economy/state-economy";
import { Districts } from "@/model/political/districts";
import { Stability } from "@/model/political/stability";
import { States } from "@/model/political/states-generator";
import { formatPrice } from "@/model/units";
import { Dialog } from "@/ui/dialog/dialog";
import {
  bindEconomyWiki,
  ECONOMY_COLORS,
  EconomyTerms,
  prosperityLevel,
  renderProsperityPercent
} from "@/ui/economy-view";
import { tip } from "@/ui/tooltips";
import { t } from "@/utils/i18n";
import { ensureEl } from "@/utils/node-utils";
import { rn, si } from "@/utils/number-utils";
import { card, economyDialog, line, rank, renderGoods, renderLiving, renderSectors } from "./economy-parts";

const DIALOG_CLASS = "provinceEconomyDialog";

/** A province's district's: its own if its seat has a market, else the crown lands' */
type Governance = { crown: boolean; corruption: number; infrastructure: number; stability: number | null };

const dialogId = (provinceId: number) => `provinceEconomy${provinceId}`;

/** Opens one dialog per province, so provinces can be compared side by side */
function open(provinceId: number): void {
  const province = pack.provinces[provinceId];
  if (!province || province.removed) return;
  if (!ProvinceEconomy.get(provinceId)) {
    tip(EconomyTerms.noData(), true, "error", 5000);
    return;
  }

  renderDialog(provinceId);
  addListeners(provinceId);
  refresh(provinceId);

  const offset = 10 + 660 * (document.querySelectorAll(`.${DIALOG_CLASS}`).length - 1); // each next one to the left of the last
  Dialog.open(dialogId(provinceId), {
    title: t("Economy of {{- province}}", { province: province.fullName || province.name }),
    width: "46em",
    resizable: true,
    onClose: () => cleanup(provinceId),
    position: { my: "right top", at: `right-${offset} top+10`, of: "svg" }
  });
}

function renderDialog(provinceId: number): void {
  Dialog.destroy(dialogId(provinceId));
  ensureEl("dialogs").insertAdjacentHTML("beforeend", economyDialog(dialogId(provinceId), DIALOG_CLASS));
}

function addListeners(provinceId: number): void {
  const id = dialogId(provinceId);
  ensureEl(`${id}Refresh`).addEventListener("click", () => refresh(provinceId));
  bindEconomyWiki(`${id}Wiki`);
}

function refresh(provinceId: number): void {
  ensureEl(`${dialogId(provinceId)}Body`).innerHTML = renderBody(provinceId);
}

function cleanup(provinceId: number): void {
  Dialog.destroy(dialogId(provinceId));
}

function renderBody(provinceId: number): string {
  const accounts = ProvinceEconomy.get(provinceId);
  const stateId = pack.provinces[provinceId].state;
  const state = StateEconomy.getAccounts(stateId);
  if (!accounts || !state) return "";
  return [
    renderCards(provinceId, accounts),
    renderSectors(accounts, state, t("State")),
    renderLiving(accounts),
    `<div class="columns">${renderState(provinceId, accounts)}${renderGoods(t("Most valuable goods made"), accounts.output)}</div>`
  ].join("");
}

const taxesOf = ({ taxes }: ProvinceAccounts) => taxes.salesTax + taxes.tariffs + taxes.pollTax + taxes.marketFees;

/** Each province of the state with accounts: its own district's governance or the crown lands' */
function getGovernance(stateId: number): Map<number, Governance> {
  const state = pack.states[stateId];
  const governance = new Map<number, Governance>();
  if (!stateId || !state || state.removed) return governance;
  const districts = Districts.get(stateId);
  const infrastructure = Districts.getInfrastructure(state);
  const stability = Stability.getDistricts(stateId);
  for (const province of pack.provinces) {
    if (!province.i || province.removed || province.state !== stateId) continue;
    const district = Districts.at(province.center);
    const k = district ? districts.indexOf(district) : -1;
    if (!district || k < 0) continue;
    governance.set(province.i, {
      crown: !district.province,
      corruption: Districts.getCorruption(state, district, state.economy.collected),
      infrastructure: infrastructure[k] ?? 0,
      stability: stability[k]?.stability ?? null
    });
  }
  return governance;
}

/** Its figures, each ranked among its state's provinces and set against the state's */
function renderCards(provinceId: number, accounts: ProvinceAccounts): string {
  const stateId = pack.provinces[provinceId].state;
  const state = pack.states[stateId];
  const stateAccounts = StateEconomy.getAccounts(stateId)!;
  const ids = pack.provinces
    .filter(p => p.i && !p.removed && p.state === stateId && ProvinceEconomy.get(p.i))
    .map(p => p.i);
  const of = (id: number) => ProvinceEconomy.get(id)!;
  const ranked = (measure: (accounts: ProvinceAccounts) => number) => rank(ids, provinceId, id => measure(of(id)));

  const { scale, urbanization } = options.map.units.population;
  const urban = accounts.townspeople * scale * urbanization.rate;
  const rural = (accounts.people - accounts.townspeople) * scale;
  const population = (a: ProvinceAccounts) => (a.people - a.townspeople + a.townspeople * urbanization.rate) * scale;
  const productShare = stateAccounts.product ? rn((accounts.product / stateAccounts.product) * 100, 1) : 0;
  const prosperity = (value: number | null) => (value === null ? "—" : renderProsperityPercent(value));
  const stateProsperity =
    stateAccounts.prosperity === null
      ? "—"
      : `${rn(stateAccounts.prosperity * 100)}% ${prosperityLevel(stateAccounts.prosperity)}`;
  const taxes = taxesOf(accounts);
  const burden = accounts.product ? rn((taxes / accounts.product) * 100, 1) : 0;

  const governance = getGovernance(stateId);
  const own = governance.get(provinceId);
  const governed = (
    label: string,
    measure: (governance: Governance) => number | null,
    format: (value: number) => string,
    stateValue: string,
    tipText: string,
    lowestFirst = false
  ) => {
    const value = own ? measure(own) : null;
    if (!own || value === null) return card(label, "—", [EconomyTerms.noData()], tipText);
    const others = ids.filter(id => governance.has(id));
    const place = rank(others, provinceId, id => measure(governance.get(id)!) ?? 0, lowestFirst);
    return card(label, format(value), [place, own.crown ? t("Crown lands") : `${t("State")}: ${stateValue}`], tipText);
  };
  const percent = (value: number) => `${rn(value * 100)}%`;
  const stateStability = Stability.get(stateId)?.stability;

  return `<div class="cards">
    ${card(t("Population"), si(urban + rural), [ranked(population), t("Rural: {{rural}}, urban: {{urban}}", { rural: si(rural), urban: si(urban) })], t("Population: rural and urban people"))}
    ${card(t("Product"), formatPrice(accounts.product), [ranked(a => a.product), t("{{share}}% of the state", { share: productShare })], EconomyTerms.stateProduct())}
    ${card(t("Wealth"), formatPrice(accounts.wealth), [ranked(a => a.wealth), `${t("State")}: ${formatPrice(stateAccounts.wealth)}`], EconomyTerms.wealth())}
    ${card(t("Prosperity"), prosperity(accounts.prosperity), [ranked(a => a.prosperity ?? 0), `${t("State")}: ${stateProsperity}`], EconomyTerms.prosperity())}
    ${card(t("Taxes collected"), formatPrice(taxes), [ranked(taxesOf), t("Tax burden: {{burden}}%", { burden })], t("Taxes paid to the state"))}
    ${governed(
      t("Corruption"),
      g => g.corruption,
      value => `${rn(value)}%`,
      `${rn(Districts.getStateCorruption(state, state.economy.collected))}%`,
      EconomyTerms.corruption(),
      true
    )}
    ${governed(t("Infrastructure"), g => g.infrastructure, percent, percent(States.getProvision(state, "infrastructure")), t("Infrastructure: how well the state's public works serve the people"))}
    ${governed(t("Stability"), g => g.stability, percent, stateStability === undefined ? "—" : percent(stateStability), EconomyTerms.stability())}
  </div>`;
}

/** The province and its state: the taxes its people and foreigners at its markets paid, and the state orders its burgs received */
function renderState(provinceId: number, accounts: ProvinceAccounts): string {
  const { taxes, spent, pocketed } = accounts;
  const total = taxesOf(accounts);
  const stability = Stability.getProvince(provinceId);
  const state = pack.states[pack.provinces[provinceId].state];
  const corruption = stability ? Districts.getCorruption(state, stability.district, state.economy.collected) : 0;
  const swatch = `<span class="swatch" style="background: ${ECONOMY_COLORS.pocketed}"></span>`;
  return `<div><h4 data-tip="${t("Taxes paid to the state and its spending in the province")}"><span>${t("Taxes and state spending")}</span></h4>
    ${line(t("Sales tax"), -taxes.salesTax, "", "negative")}
    ${line(t("Import tariffs"), -taxes.tariffs, "", "negative")}
    ${line(t("Poll tax"), -taxes.pollTax, "", "negative")}
    ${line(t("Market licenses"), -taxes.marketFees, "", "negative")}
    <div class="total">${line(t("Taxes collected"), -total, t("Taxes paid to the state"), "negative")}</div>
    <div class="total">${line(t("State orders"), spent, t("Goods the state bought at the province's burgs"), "positive")}</div>
    <div data-tip="${t("State spending pocketed by officials")}" class="row plain muted"><span class="name">${swatch}${t("Corruption: {{rate}}%", { rate: rn(corruption) })}</span><span class="right negative">${formatPrice(-pocketed)}</span></div>
  </div>`;
}

export const ProvinceEconomyOverview = { open };
