import { Accounts, type ProvinceAccounts } from "@/model/economy/accounts";
import { Corruption } from "@/model/economy/corruption";
import { StateOrders } from "@/model/economy/state-orders";
import { Stability } from "@/model/political/stability";
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
import {
  card,
  economyDialog,
  getStackOffset,
  line,
  rank,
  renderGoods,
  renderLiving,
  renderSectors
} from "./economy-parts";

const DIALOG_CLASS = "provinceEconomyDialog";

type ProvinceFigures = { corruption: number; infrastructure: number; stability: number | null };

const dialogId = (provinceId: number) => `provinceEconomy${provinceId}`;

/** Opens one dialog per province, so provinces can be compared side by side */
function open(provinceId: number): void {
  const province = pack.provinces[provinceId];
  if (!province || province.removed) return;
  if (!Accounts.ofProvince(provinceId)) {
    tip(EconomyTerms.noData(), true, "error", 5000);
    return;
  }

  renderDialog(provinceId);
  addListeners(provinceId);
  refresh(provinceId);

  const offset = getStackOffset(DIALOG_CLASS);
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
  const accounts = Accounts.ofProvince(provinceId);
  const province = pack.provinces[provinceId];
  if (!province) return "";
  const state = Accounts.ofState(province.state);
  if (!accounts || !state) return "";
  return [
    renderCards(provinceId, accounts),
    renderSectors(accounts, state, t("State")),
    renderLiving(accounts),
    `<div class="columns">${renderState(provinceId, accounts)}${renderGoods(t("Most valuable goods made"), accounts.output)}</div>`
  ].join("");
}

const taxesOf = ({ taxes }: ProvinceAccounts) => taxes.salesTax + taxes.tariffs + taxes.pollTax + taxes.marketFees;

/** Each province of the state by id */
function getProvinceFigures(stateId: number): Map<number, ProvinceFigures> {
  const state = pack.states[stateId];
  const figures = new Map<number, ProvinceFigures>();
  if (!stateId || !state || state.removed) return figures;
  const infrastructure = StateOrders.getInfrastructure(state);
  for (const { province, stability } of Stability.getProvinces(stateId)) {
    if (!province.id) continue;
    figures.set(province.id, {
      corruption: Corruption.ofProvince(state, province, state.economy.collected),
      infrastructure: infrastructure.get(province.id) ?? 0,
      stability
    });
  }
  return figures;
}

/** Its figures, each ranked among its state's provinces and set against the state's */
function renderCards(provinceId: number, accounts: ProvinceAccounts): string {
  const stateId = pack.provinces[provinceId].state;
  const state = pack.states[stateId];
  const stateAccounts = Accounts.ofState(stateId)!;
  const ids = pack.provinces
    .filter(p => p.i && !p.removed && p.state === stateId && Accounts.ofProvince(p.i))
    .map(p => p.i);
  const of = (id: number) => Accounts.ofProvince(id)!;
  const ranked = (measure: (accounts: ProvinceAccounts) => number) => rank(ids, provinceId, id => measure(of(id)));

  const { scale, urbanization } = options.map.units.population;
  const urban = accounts.urbanPeople * scale * urbanization.rate;
  const rural = (accounts.people - accounts.urbanPeople) * scale;
  const population = (a: ProvinceAccounts) => (a.people - a.urbanPeople + a.urbanPeople * urbanization.rate) * scale;
  const productShare = stateAccounts.product ? rn((accounts.product / stateAccounts.product) * 100, 1) : 0;
  const prosperity = (value: number | null) => (value === null ? "—" : renderProsperityPercent(value));
  const stateProsperity =
    stateAccounts.prosperity === null
      ? "—"
      : `${rn(stateAccounts.prosperity * 100)}% ${prosperityLevel(stateAccounts.prosperity)}`;
  const taxes = taxesOf(accounts);
  const burden = accounts.product ? rn((taxes / accounts.product) * 100, 1) : 0;

  const figures = getProvinceFigures(stateId);
  const own = figures.get(provinceId);
  const governed = (
    label: string,
    measure: (figures: ProvinceFigures) => number | null,
    format: (value: number) => string,
    stateValue: string,
    tipText: string,
    lowestFirst = false
  ) => {
    const value = own ? measure(own) : null;
    if (!own || value === null) return card(label, "—", [EconomyTerms.noData()], tipText);
    const others = ids.filter(id => figures.has(id));
    const place = rank(others, provinceId, id => measure(figures.get(id)!) ?? 0, lowestFirst);
    return card(label, format(value), [place, `${t("State")}: ${stateValue}`], tipText);
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
      `${rn(Corruption.ofState(state, state.economy.collected))}%`,
      EconomyTerms.corruption(),
      true
    )}
    ${governed(t("Infrastructure"), g => g.infrastructure, percent, percent(StateOrders.getProvision(state, "infrastructure")), t("Infrastructure: how well the state's public works serve the people"))}
    ${governed(t("Stability"), g => g.stability, percent, stateStability === undefined ? "—" : percent(stateStability), EconomyTerms.stability())}
  </div>`;
}

/** Taxes paid by its people and by foreigners at its markets, and the state orders its burgs got */
function renderState(provinceId: number, accounts: ProvinceAccounts): string {
  const { taxes, spent, pocketed } = accounts;
  const total = taxesOf(accounts);
  const stability = Stability.getProvince(provinceId);
  const state = pack.states[pack.provinces[provinceId].state];
  const corruption = stability ? Corruption.ofProvince(state, stability.province, state.economy.collected) : 0;
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
