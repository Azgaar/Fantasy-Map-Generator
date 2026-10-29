// A state's budget editor: its taxes, how it spends them, and its tariffs and embargoes

import { sum } from "d3";
import { Goods } from "@/model/economy/goods-generator";
import { StateEconomy } from "@/model/economy/state-economy";
import { EXPENSES, type Expense, type StateBudget, States, type TariffRule } from "@/model/political/states-generator";
import { formatPrice } from "@/model/units";
import { goodBadge } from "@/renderers/draw-goods";
import { Dialog } from "@/ui/dialog/dialog";
import { tip } from "@/ui/tooltips";
import { sentences, t } from "@/utils/i18n";
import { ensureEl } from "@/utils/node-utils";
import { minmax, rn } from "@/utils/number-utils";
import { budgetBackground, tone, toneStyle } from "./economy-config";
import { EconomyTerms } from "./economy-terms";
import { bindEconomyWiki, economyWikiButton } from "./economy-wiki";

const STYLE = /* css */ `
  #stateBudgetForm { margin: 0.2em 0 0.4em }
  #stateBudgetForm table { width: 100%; border-collapse: collapse; table-layout: fixed }
  #stateBudgetForm td, #stateBudgetForm th { padding: 0.15em 0; vertical-align: middle; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
  #stateBudgetForm th { text-align: left; border-bottom: 1px solid var(--dark-solid); padding-top: 0.7em }
  #stateBudgetForm tbody:first-child th { padding-top: 0 }
  #stateBudgetForm th.actions, #stateBudgetForm td.amount { text-align: right }
  #stateBudgetForm td.amount { font-variant-numeric: tabular-nums }
  #stateBudgetForm td.amount input { width: 100%; text-align: right }
  #stateBudgetForm input[type="number"] { width: 4em; margin: 0 }
  #stateBudgetForm button { font-size: 0.8em; padding: 0 0.4em; }
  #stateBudgetForm button::before { margin-right: 0.2em; }
  #stateBudgetForm .muted { color: #666 }
  ${toneStyle("#stateBudgetForm")}
  #stateBudgetForm tr.total td { font-weight: bold; border-top: 1px solid #ccc }
  #stateBudgetForm tr.minor td { font-size: 0.9em; color: #666; border-top: 1px dashed #ccc }
  #stateBudgetForm input[type="range"] { appearance: none; width: 100%; height: 0.7em; margin: 0; padding: 0; border: 0; border-radius: 2px; vertical-align: middle }
  #stateBudgetForm input[type="range"]::-webkit-slider-thumb { appearance: none; width: 0.6em; height: 1.2em; border-radius: 2px; background: var(--light-solid); border: 1px solid var(--dark-solid); cursor: pointer }
  #stateBudgetForm input[type="range"]::-moz-range-thumb { width: 0.5em; height: 1.1em; border-radius: 2px; background: var(--light-solid); border: 1px solid var(--dark-solid); cursor: pointer }
  #stateBudgetForm input[type="range"]::-moz-range-track { background: transparent }
  #stateBudgetForm select { width: 100%; margin: 0 }
  #stateBudgetForm .scroll { max-height: 13em; overflow-y: auto }
  #stateBudgetForm .pick { width: 100%; text-align: left; overflow: hidden; text-overflow: ellipsis }
`;

/** Opens the state's budget; onApply runs after the changes are set */
export function openStateBudget(stateId: number, onApply: () => void): void {
  const state = pack.states[stateId];
  if (!stateId || !state || state.removed) return;

  const { salesTax, tariffs, pollTax, pollTaxOwed, marketFees, markets, otherRevenue, corruption } =
    StateEconomy.getBudget(stateId);
  let budget = { ...state.economy.budget };
  let rules = copyRules(state.economy.tariffs);

  const amount = (value: number, tone = "", tipText = "") =>
    `<td class="amount ${tone}" data-tip="${tipText}">${formatPrice(value)}</td>`;
  const percent = (id: string, value: number, step = 1, max = 100) =>
    `<td><input id="${id}" type="number" min="0" max="${max}" step="${step}" value="${value}"/> %</td>`;
  const shareRow = (key: Expense | "corruption", label: string, tipText: string, value: number, last: string) =>
    `<tr class="${key === "corruption" ? "minor" : ""}"><td data-tip="${tipText}">${label}</td>
      <td><input class="share" data-key="${key}" type="range" min="0" max="100" step="1" value="${value}"/></td>
      <td><input class="share" data-key="${key}" type="number" min="0" max="100" step="1" value="${value}"/> %</td>${last}</tr>`;
  const columns = `<colgroup><col style="width: 8.5em"/><col/><col style="width: 5.2em"/><col style="width: 6.5em"/></colgroup>`;

  Dialog.message({
    message: /* html */ `<div id="stateBudgetForm"><style>${STYLE}</style>
    <table>${columns}
      <tbody>
        <tr><th colspan="4" data-tip="${t("State taxes. Changes apply on regeneration")}">${t("Revenue")}</th></tr>
        <tr><td>${t("Sales Tax")}</td><td></td>${percent("stateSalesTax", rn(state.economy.salesTax * 100, 2), 0.5)}${amount(salesTax, "positive")}</tr>
        <tr><td>${t("Poll Tax")}</td><td></td><td><input id="statePollTax" type="number" min="0" max="10" step="0.01" value="${state.economy.pollTax}"/></td>${amount(pollTax, "positive", pollTaxOwed ? EconomyTerms.collected(pollTax, pollTaxOwed) : "")}</tr>
        <tr><td data-tip="${t("Paid a day by each market centered in the state, from its margin")}">${t("Market License")}</td><td class="muted">${t("{{count}} markets", { count: markets })}</td><td><input id="stateMarketFee" type="number" min="0" step="1" value="${state.economy.marketFee || 0}"/></td>${amount(marketFees, "positive")}</tr>
        <tr><td>${t("Import Tariffs")}</td><td></td><td></td>${amount(tariffs, "positive")}</tr>
        <tr><td data-tip="${EconomyTerms.otherRevenue()}">${t("Other revenue")}</td><td></td><td></td><td class="amount"><input id="stateOtherRevenue" type="number" step="1" value="${state.economy.otherRevenue}" data-tip="${EconomyTerms.otherRevenue()}"/></td></tr>
        <tr class="total"><td colspan="3">${t("Collected")}</td>${amount(salesTax + tariffs + pollTax + marketFees + otherRevenue)}</tr>
      </tbody>
      <tbody id="stateBudget">
        <tr><th colspan="3" data-tip="${EconomyTerms.budget()}">${t("Expenses")}</th><th class="actions"><button id="stateBudgetReset" type="button" class="icon-arrows-cw" data-tip="${t("Reset the budget to the state's defaults")}">${t("Reset")}</button></th></tr>
        ${EXPENSES.map(expense => shareRow(expense, EconomyTerms.expense(expense), EconomyTerms.expenseTip(expense), budget[expense], amount(-state.economy.spent[expense], "negative"))).join("")}
        <tr class="total"><td data-tip="${EconomyTerms.stateTreasury()}">${t("Balance")}</td><td></td><td id="stateBudgetBalance"></td>${amount(state.economy.treasury, tone(state.economy.treasury), EconomyTerms.stateTreasury())}</tr>
        ${shareRow("corruption", t("Corruption"), EconomyTerms.corruption(), budget.corruption, amount(-corruption, "negative"))}
      </tbody>
    </table>
    <table>
      <colgroup><col/><col/><col style="width: 6.5em"/><col style="width: 5.2em"/><col style="width: 1.4em"/></colgroup>
      <tbody><tr><th colspan="2" data-tip="${t("Specific rules override general ones")}">${t("Tariffs and Embargoes")}</th><th class="actions" colspan="3"><button id="stateTariffReset" type="button" class="icon-arrows-cw" data-tip="${t("Reset tariffs based on current diplomatic relations")}">${t("Reset")}</button> <button id="stateTariffAdd" type="button" class="icon-plus" data-tip="${t("Add tariff or embargo rule")}">${t("Add")}</button></th></tr></tbody>
    </table>
    <div class="scroll"><table><colgroup><col/><col/><col style="width: 6.5em"/><col style="width: 5.2em"/><col style="width: 1.4em"/></colgroup><tbody id="stateTariffRules"></tbody></table></div>
    </div>`,
    title: t("Budget: {{- state}}", { state: state.name }),
    width: "32em",
    footer: economyWikiButton("stateTaxesWiki"),
    buttons: [
      {
        label: t("Apply"),
        onClick: () => {
          const read = (id: string) => ensureEl<HTMLInputElement>(id).valueAsNumber;
          const sales = minmax(read("stateSalesTax") / 100, 0, 1);
          const poll = Math.max(0, read("statePollTax"));
          const fee = Math.max(0, read("stateMarketFee"));
          const other = read("stateOtherRevenue");
          States.setTaxes(
            stateId,
            Number.isFinite(sales) ? sales : state.economy.salesTax,
            Number.isFinite(poll) ? poll : state.economy.pollTax
          );
          if (Number.isFinite(fee)) States.setMarketFee(stateId, fee);
          const { corruption: pocketed, ...expenses } = budget;
          States.setCorruption(stateId, pocketed);
          States.setBudget(stateId, expenses);
          States.setTariffs(stateId, rules);
          if (Number.isFinite(other)) States.setOtherRevenue(stateId, other);
          onApply();
        }
      },
      { label: t("Cancel") }
    ]
  });
  bindEconomyWiki("stateTaxesWiki");

  // ---- expenses: each a share of the taxes, corruption grays the part officials pocket; the balance is what is left or lacking
  const budgetEl = ensureEl("stateBudget");
  const drawBudget = () => {
    for (const input of budgetEl.querySelectorAll<HTMLInputElement>("input.share")) {
      const key = input.dataset.key as keyof StateBudget;
      input.value = String(budget[key]);
      if (input.type === "range")
        input.style.background = budgetBackground(budget[key], key === "corruption" ? 100 : budget.corruption);
    }
    const balance = 100 - sum(EXPENSES.map(expense => budget[expense]));
    ensureEl("stateBudgetBalance").innerHTML = `<span class="${tone(balance)}">${balance}%</span>`;
  };
  budgetEl.addEventListener("input", event => {
    const input = event.target as HTMLInputElement;
    if (!input.matches("input.share")) return;
    budget[input.dataset.key as keyof StateBudget] = minmax(Math.round(input.valueAsNumber || 0), 0, 100);
    drawBudget();
  });
  ensureEl("stateBudgetReset").addEventListener("click", () => {
    budget = { ...States.defineExpenses(state), corruption: States.defineCorruption(state) };
    drawBudget();
  });
  drawBudget();

  // ---- tariffs: rules by states and goods, the most specific winning
  const rulesEl = ensureEl("stateTariffRules");
  const renderRules = () => {
    rulesEl.innerHTML =
      rules
        .map((rule, index) => {
          const states = listLabel(rule.states, id => pack.states[id]?.name, t("All states"));
          const goods = listLabel(rule.goods, id => Goods.get(id)?.name, t("All goods"));
          const isEmbargo = rule.rate === "embargo";
          const rate = rn((rule.rate === "embargo" ? 0.1 : rule.rate) * 100, 2);
          return `<tr data-index="${index}">
            <td><button type="button" class="pick states" data-tip="${sentences(states.tip, t("Click to select"))}">${states.label}</button></td>
            <td><button type="button" class="pick goods" data-tip="${sentences(goods.tip, t("Click to select"))}">${goods.label}</button></td>
            <td><select class="policy"><option value="tariff" ${isEmbargo ? "" : "selected"}>${t("Tariff")}</option><option value="embargo" ${isEmbargo ? "selected" : ""}>${t("Embargo")}</option></select></td>
            <td>${isEmbargo ? "" : `<input class="rate" type="number" min="0" max="1000" step="1" value="${rate}" data-tip="${t("Import tariff rate")}"/> %`}</td>
            <td><span class="icon-trash-empty pointer remove" data-tip="${t("Remove rule")}"></span></td></tr>`;
        })
        .join("") || `<tr><td colspan="5" class="muted"><i>${t("None")}</i></td></tr>`;
  };
  renderRules();

  rulesEl.addEventListener("change", event => {
    const row = (event.target as HTMLElement).closest<HTMLElement>("tr[data-index]");
    const rule = row && rules[+row.dataset.index!];
    if (!rule) return;
    const rate = row.querySelector<HTMLInputElement>("input.rate")?.valueAsNumber;
    const embargo = row.querySelector<HTMLSelectElement>("select.policy")!.value === "embargo";
    rule.rate = embargo ? "embargo" : minmax(Number.isFinite(rate) ? rn(rate! / 100, 4) : 0.1, 0, 10);
    renderRules();
  });
  rulesEl.addEventListener("click", event => {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>("tr[data-index]");
    const rule = row && rules[+row.dataset.index!];
    if (!rule) return;
    if (target.classList.contains("remove")) {
      rules.splice(+row.dataset.index!, 1);
      renderRules();
    } else if (target.classList.contains("states")) pickStates(stateId, rule, renderRules);
    else if (target.classList.contains("goods")) pickGoods(rule, renderRules);
  });
  ensureEl("stateTariffAdd").addEventListener("click", () => {
    rules.push({ states: "all", goods: "all", rate: 0.1 });
    renderRules();
  });
  ensureEl("stateTariffReset").addEventListener("click", () => {
    rules = copyRules(States.defineTariffs(state));
    renderRules();
  });
}

const copyRules = (rules: TariffRule[]): TariffRule[] =>
  (rules ?? []).map(rule => ({ ...rule, states: copy(rule.states), goods: copy(rule.goods) }));

const copy = <T>(list: T[] | "all"): T[] | "all" => (Array.isArray(list) ? [...list] : "all");

/** A short label for a list of states or goods, and all of them for the tip */
function listLabel(ids: number[] | "all", name: (id: number) => string | undefined, allLabel: string) {
  if (!Array.isArray(ids)) return { label: allLabel, tip: allLabel };
  const names = ids.map(id => name(id) || String(id));
  const label = names.length <= 2 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  return { label: label || t("None"), tip: names.join(", ") || t("None") };
}

function pickStates(stateId: number, rule: TariffRule, onApply: () => void): void {
  const foreign = pack.states.filter(s => s.i && !s.removed && s.i !== stateId);
  const isAll = rule.states === "all";
  const selected = new Set(Array.isArray(rule.states) ? rule.states : []);
  openChecklist({
    title: t("Select States"),
    allLabel: t("All states"),
    isAll,
    items: foreign.map(s => ({
      id: s.i,
      name: s.name,
      badgeHtml: `<fill-box fill="${s.color || "#ccc"}" size=".8em" disabled></fill-box>`,
      checked: isAll || selected.has(s.i)
    })),
    emptyWarning: t("Select at least one state"),
    onSave: result => {
      rule.states = result;
      onApply();
    }
  });
}

function pickGoods(rule: TariffRule, onApply: () => void): void {
  const goods = pack.goods ?? [];
  const isAll = rule.goods === "all";
  const selected = new Set(Array.isArray(rule.goods) ? rule.goods : []);
  openChecklist({
    title: t("Select Goods"),
    allLabel: t("All goods"),
    isAll,
    items: goods.map(g => ({
      id: g.i,
      name: g.name,
      badgeHtml: g.icon
        ? `<svg width="1.2em" height="1.2em" class="goodIcon" style="min-width: 1.2em; min-height: 1.2em; flex-shrink: 0;">${goodBadge(g)}</svg>`
        : `<fill-box fill="${g.color || "#ccc"}" size=".8em" disabled></fill-box>`,
      checked: isAll || selected.has(g.i)
    })),
    emptyWarning: t("Select at least one good"),
    onSave: result => {
      rule.goods = result;
      onApply();
    }
  });
}

function openChecklist({
  title,
  allLabel,
  isAll,
  items,
  emptyWarning,
  onSave
}: {
  title: string;
  allLabel: string;
  isAll: boolean;
  items: { id: number; name: string; badgeHtml?: string; checked: boolean }[];
  emptyWarning: string;
  onSave: (value: number[] | "all") => void;
}): void {
  Dialog.destroy("tariffSelectorDialog");
  const dialogEl = document.createElement("div");
  dialogEl.id = "tariffSelectorDialog";
  dialogEl.className = "dialog";
  document.body.appendChild(dialogEl);

  const itemsHtml = items
    .map(
      item =>
        `<label style="display: flex; align-items: center; column-gap: 0.35em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><input type="checkbox" class="native tariffItemCheck" value="${item.id}" ${item.checked ? "checked" : ""} />${item.badgeHtml ?? ""}<span>${item.name}</span></label>`
    )
    .join("");

  dialogEl.innerHTML = /* html */ `
    <div style="margin-bottom: 0.4em; padding-bottom: 0.3em; border-bottom: 1px solid #ccc;">
      <label style="display: flex; align-items: center; column-gap: 0.3em;">
        <input id="tariffAllCheck" type="checkbox" class="native" ${isAll ? "checked" : ""} />
        <b>${allLabel}</b>
      </label>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.25em 0.5em; max-height: 16em; overflow-y: auto;">
      ${itemsHtml}
    </div>
  `;

  const allCheck = ensureEl<HTMLInputElement>("tariffAllCheck");
  const itemChecks = Array.from(dialogEl.querySelectorAll<HTMLInputElement>(".tariffItemCheck"));
  allCheck.addEventListener("change", () => {
    for (const check of itemChecks) check.checked = allCheck.checked;
  });
  dialogEl.addEventListener("change", event => {
    const target = event.target as HTMLInputElement;
    if (!target.classList.contains("tariffItemCheck")) return;
    allCheck.checked = itemChecks.length > 0 && itemChecks.every(c => c.checked);
  });

  const close = () => Dialog.close("tariffSelectorDialog");
  Dialog.open("tariffSelectorDialog", {
    resizable: false,
    title,
    width: "24em",
    buttons: [
      {
        label: t("Apply"),
        onClick: () => {
          if (allCheck.checked) {
            onSave("all");
            return close();
          }
          const checkedIds = itemChecks.filter(c => c.checked).map(c => +c.value);
          if (!checkedIds.length) return tip(emptyWarning, false, "error");
          onSave(checkedIds.length === itemChecks.length ? "all" : checkedIds);
          close();
        }
      },
      { label: t("Cancel"), onClick: close }
    ]
  });
}
