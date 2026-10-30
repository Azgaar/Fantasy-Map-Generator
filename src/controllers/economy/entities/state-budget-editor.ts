// A state's budget editor: its taxes, how it spends them, and its tariffs and embargoes

import { sum } from "d3";
import { Controllers } from "@/controllers";
import { EXPENSE_LABELS } from "@/data/id-labels";
import { Goods } from "@/model/economy/goods-generator";
import { Production } from "@/model/economy/production-generator";
import { StateEconomy } from "@/model/economy/state-economy";
import { Districts } from "@/model/political/districts";
import { Military } from "@/model/political/military-generator";
import {
  EXPENSES,
  type Expense,
  type State,
  type StateBudget,
  type StateFinance,
  States,
  type TariffRule
} from "@/model/political/states-generator";
import { formatPrice } from "@/model/units";
import { goodBadge } from "@/renderers/draw-goods";
import { Layers } from "@/renderers/layers";
import { Dialog } from "@/ui/dialog/dialog";
import {
  bindEconomyWiki,
  budgetBackground,
  EconomyTerms,
  economyWikiButton,
  mountAdjustments,
  tone
} from "@/ui/economy-view";
import { tip } from "@/ui/tooltips";
import { sentences, t } from "@/utils/i18n";
import { ensureEl, findEl } from "@/utils/node-utils";
import { minmax, rn } from "@/utils/number-utils";

const STYLE = /* css */ `
  #stateBudgetForm { width: auto; max-height: 70vh; overflow: auto; margin: 0.2em 0 0.4em }
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
  #stateBudgetForm tr.total td { font-weight: bold; border-top: 1px solid #ccc }
  #stateBudgetForm tr.minor td { color: #666; }
  #stateBudgetForm input[type="range"] { appearance: none; width: 100%; height: 0.7em; margin: 0; padding: 0; border: 0; border-radius: 2px; vertical-align: middle }
  #stateBudgetForm input[type="range"]::-webkit-slider-thumb { appearance: none; width: 0.6em; height: 1.2em; border-radius: 2px; background: var(--light-solid); border: 1px solid var(--dark-solid); cursor: pointer }
  #stateBudgetForm input[type="range"]::-moz-range-thumb { width: 0.5em; height: 1.1em; border-radius: 2px; background: var(--light-solid); border: 1px solid var(--dark-solid); cursor: pointer }
  #stateBudgetForm input[type="range"]::-moz-range-track { background: transparent }
  #stateBudgetForm select { width: 100%; margin: 0 }
  #stateBudgetForm .scroll { max-height: 13em; overflow-y: auto }
  #stateBudgetForm .pick { width: 100%; text-align: left; overflow: hidden; text-overflow: ellipsis }
`;

const dialogId = "stateBudgetEditor";

let stateId = 0;
let onApplied: (() => void) | undefined;
let edit: {
  budget: StateBudget;
  rules: TariffRule[];
  adjustments: StateFinance["adjustments"];
  collected: number; // the taxes collected in the last run, before adjustments
}; // what the form holds, read on Apply

/** Opens the state's budget; Apply sets the changes, regenerates production and shows the outcome in place */
function open(id: number, onApply?: () => void): void {
  const state = pack.states[id];
  if (!id || !state || state.removed) return;
  stateId = id;
  onApplied = onApply;

  renderDialog();
  addListeners();
  render();

  Dialog.open(dialogId, {
    title: t("Budget: {{- state}}", { state: state.name }),
    width: "32em",
    position: { my: "center", at: "center", of: "svg" },
    footer: economyWikiButton("stateTaxesWiki"),
    buttons: [
      { label: t("Apply"), tip: t("Set the changes and regenerate production to see their effect"), onClick: apply },
      { label: t("Close"), onClick: () => Dialog.close(dialogId) }
    ],
    onClose: cleanup
  });
  bindEconomyWiki("stateTaxesWiki");
}

function renderDialog(): void {
  Dialog.destroy(dialogId);
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="${dialogId}" class="dialog"><style>${STYLE}</style><div id="stateBudgetForm"></div></div>`
  );
}

function addListeners(): void {
  const form = ensureEl("stateBudgetForm");
  form.addEventListener("input", onInput);
  form.addEventListener("change", onChange);
  form.addEventListener("click", onClick);
}

/** Fills the form from the state, dropping unapplied edits */
function render(): void {
  const state = pack.states[stateId];
  const taxes = StateEconomy.getBudget(stateId);
  edit = {
    budget: { ...state.economy.budget },
    rules: copyRules(state.economy.tariffs),
    adjustments: [...state.economy.adjustments],
    collected: taxes.salesTax + taxes.tariffs + taxes.pollTax + taxes.marketFees
  };
  ensureEl("stateBudgetForm").innerHTML = renderForm(state);
  mountAdjustments(ensureEl("stateAdjustments"), edit.adjustments, EconomyTerms.adjustments(), adjustments => {
    edit.adjustments = adjustments;
    drawCollected();
  });
  drawCollected();
  drawBudget();
  drawRules();
}

function apply(): void {
  const state = pack.states[stateId];
  const read = (id: string) => ensureEl<HTMLInputElement>(id).valueAsNumber;
  const sales = minmax(read("stateSalesTax") / 100, 0, 1);
  const poll = Math.max(0, read("statePollTax"));
  const fee = Math.max(0, read("stateMarketFee"));
  States.setTaxes(
    stateId,
    Number.isFinite(sales) ? sales : state.economy.salesTax,
    Number.isFinite(poll) ? poll : state.economy.pollTax
  );
  if (Number.isFinite(fee)) States.setMarketFee(stateId, fee);
  const { corruption, ...expenses } = edit.budget;
  States.setCorruption(stateId, corruption);
  States.setBudget(stateId, expenses);
  States.setTariffs(stateId, edit.rules);
  States.setAdjustments(stateId, edit.adjustments);

  Production.regenerate(); // the views read the run, so it spends and taxes as now set
  Layers.draw("goods", "trade");
  if (findEl("statesEditor")) void Controllers.StatesEditor.refresh();
  onApplied?.();
  render();
}

function cleanup(): void {
  Dialog.destroy("tariffSelectorDialog");
  Dialog.destroy(dialogId);
  onApplied = undefined;
}

const amount = (value: number, tone = "", tipText = "", id = "") =>
  `<td ${id ? `id="${id}"` : ""} class="amount ${tone}" data-tip="${tipText}">${formatPrice(value)}</td>`;

/** The form's markup: revenue with adjustments, expenses and what they achieved, then tariffs */
function renderForm(state: State): string {
  const { salesTax, tariffs, pollTax, pollTaxOwed, marketFees, markets, corruption } = StateEconomy.getBudget(state.i);
  const { budget } = state.economy;
  const percent = (id: string, value: number, step = 1, max = 100) =>
    `<td><input id="${id}" type="number" min="0" max="${max}" step="${step}" value="${value}"/> %</td>`;
  const shareRow = (key: Expense | "corruption", label: string, tipText: string, value: number, last: string) =>
    `<tr class="${key === "corruption" ? "minor" : ""}"><td data-tip="${tipText}">${label}</td>
      <td><input class="share" data-key="${key}" type="range" min="0" max="100" step="1" value="${value}"/></td>
      <td><input class="share" data-key="${key}" type="number" min="0" max="100" step="1" value="${value}"/> %</td>${last}</tr>`;
  const columns = `<colgroup><col style="width: 8.5em"/><col/><col style="width: 5.2em"/><col style="width: 6.5em"/></colgroup>`;
  const effect = (label: string, value: string, tipText: string) =>
    `<tr><td colspan="3" data-tip="${tipText}">${label}</td><td class="amount" data-tip="${tipText}">${value}</td></tr>`;
  const share = (value: number) => `${rn(value * 100)}%`;
  const curbed = rn(Districts.getStateCorruption(state, state.economy.collected));

  return /* html */ `<table>${columns}
      <tbody>
        <tr><th colspan="4" data-tip="${t("State taxes. Changes apply on regeneration")}">${t("Revenue")}</th></tr>
        <tr><td>${t("Sales Tax")}</td><td></td>${percent("stateSalesTax", rn(state.economy.salesTax * 100, 2), 0.5)}${amount(salesTax, "positive")}</tr>
        <tr><td>${t("Poll Tax")}</td><td></td><td><input id="statePollTax" type="number" min="0" max="10" step="0.01" value="${state.economy.pollTax}"/></td>${amount(pollTax, "positive", pollTaxOwed ? EconomyTerms.collected(pollTax, pollTaxOwed) : "")}</tr>
        <tr><td data-tip="${t("Paid a day by each market centered in the state, from its margin")}">${t("Market License")}</td><td class="muted">${t("Markets: {{markets}}", { markets })}</td><td><input id="stateMarketFee" type="number" min="0" step="1" value="${state.economy.marketFee || 0}"/></td>${amount(marketFees, "positive")}</tr>
        <tr><td>${t("Import Tariffs")}</td><td></td><td></td>${amount(tariffs, "positive")}</tr>
        <tr><td colspan="4" id="stateAdjustments"></td></tr>
        <tr class="total"><td colspan="3">${t("Collected")}</td>${amount(salesTax + tariffs + pollTax + marketFees, "", "", "stateCollected")}</tr>
      </tbody>
      <tbody id="stateBudget">
        <tr><th colspan="3" data-tip="${EconomyTerms.budget()}">${t("Expenses")}</th><th class="actions"><button id="stateBudgetReset" type="button" class="icon-arrows-cw" data-tip="${t("Reset the budget to the state's defaults")}">${t("Reset")}</button></th></tr>
        ${EXPENSES.map(expense => shareRow(expense, EXPENSE_LABELS[expense], EconomyTerms.expenseTip(expense), budget[expense], amount(-state.economy.spent[expense], "negative"))).join("")}
        <tr class="total"><td data-tip="${EconomyTerms.stateTreasury()}">${t("Balance")}</td><td></td><td id="stateBudgetBalance"></td>${amount(state.economy.treasury, tone(state.economy.treasury), EconomyTerms.stateTreasury())}</tr>
        ${shareRow("corruption", t("Corruption"), EconomyTerms.corruption(), budget.corruption, amount(-corruption, "negative"))}
      </tbody>
      <tbody>
        <tr><th colspan="4" data-tip="${t("What the state's expenses achieved in the last run")}">${t("Effects")}</th></tr>
        ${effect(t("Army upkeep"), share(Military.getUpkeep(state.i)), EconomyTerms.upkeep())}
        ${effect(t("Corruption curbed"), `${budget.corruption}% → ${curbed}%`, EconomyTerms.expenseTip("administration"))}
        ${effect(t("Infrastructure served"), share(States.getProvision(state, "infrastructure")), EconomyTerms.expenseTip("infrastructure"))}
        ${effect(t("Court and clergy served"), share(States.getProvision(state, "court")), EconomyTerms.expenseTip("court"))}
      </tbody>
    </table>
    <table>
      <colgroup><col/><col/><col style="width: 6.5em"/><col style="width: 5.2em"/><col style="width: 1.4em"/></colgroup>
      <tbody><tr><th colspan="2" data-tip="${t("Specific rules override general ones")}">${t("Tariffs and Embargoes")}</th><th class="actions" colspan="3"><button id="stateTariffReset" type="button" class="icon-arrows-cw" data-tip="${t("Reset tariffs based on current diplomatic relations")}">${t("Reset")}</button> <button id="stateTariffAdd" type="button" class="icon-plus" data-tip="${t("Add tariff or embargo rule")}">${t("Add")}</button></th></tr></tbody>
    </table>
    <div class="scroll"><table><colgroup><col/><col/><col style="width: 6.5em"/><col style="width: 5.2em"/><col style="width: 1.4em"/></colgroup><tbody id="stateTariffRules"></tbody></table></div>`;
}

/** Adjustments: the user's own lines, added to what the state collects */
function drawCollected(): void {
  ensureEl("stateCollected").innerHTML = formatPrice(edit.collected + sum(edit.adjustments, line => line.value));
}

/** Expenses: each a share of the taxes, corruption grays the part officials pocket; the balance is what is left or lacking */
function drawBudget(): void {
  for (const input of ensureEl("stateBudget").querySelectorAll<HTMLInputElement>("input.share")) {
    const key = input.dataset.key as keyof StateBudget;
    input.value = String(edit.budget[key]);
    if (input.type === "range")
      input.style.background = budgetBackground(edit.budget[key], key === "corruption" ? 100 : edit.budget.corruption);
  }
  const balance = 100 - sum(EXPENSES.map(expense => edit.budget[expense]));
  ensureEl("stateBudgetBalance").innerHTML = `<span class="${tone(balance)}">${balance}%</span>`;
}

/** Tariffs: rules by states and goods, the most specific winning */
function drawRules(): void {
  ensureEl("stateTariffRules").innerHTML =
    edit.rules
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
}

const ruleRow = (target: HTMLElement) => target.closest<HTMLElement>("#stateTariffRules tr[data-index]");

function onInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (!input.matches("#stateBudget input.share")) return;
  edit.budget[input.dataset.key as keyof StateBudget] = minmax(Math.round(input.valueAsNumber || 0), 0, 100);
  drawBudget();
}

function onChange(event: Event): void {
  const row = ruleRow(event.target as HTMLElement);
  const rule = row && edit.rules[+row.dataset.index!];
  if (!rule) return;
  const rate = row.querySelector<HTMLInputElement>("input.rate")?.valueAsNumber;
  const embargo = row.querySelector<HTMLSelectElement>("select.policy")!.value === "embargo";
  rule.rate = embargo ? "embargo" : minmax(Number.isFinite(rate) ? rn(rate! / 100, 4) : 0.1, 0, 10);
  drawRules();
}

function onClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const state = pack.states[stateId];
  if (target.closest("#stateBudgetReset")) {
    edit.budget = { ...States.defineExpenses(state), corruption: States.defineCorruption(state) };
    drawBudget();
  } else if (target.closest("#stateTariffAdd")) {
    edit.rules.push({ states: "all", goods: "all", rate: 0.1 });
    drawRules();
  } else if (target.closest("#stateTariffReset")) {
    edit.rules = copyRules(States.defineTariffs(state));
    drawRules();
  } else {
    const row = ruleRow(target);
    const rule = row && edit.rules[+row.dataset.index!];
    if (!rule) return;
    if (target.classList.contains("remove")) {
      edit.rules.splice(+row.dataset.index!, 1);
      drawRules();
    } else if (target.classList.contains("states")) pickStates(rule);
    else if (target.classList.contains("goods")) pickGoods(rule);
  }
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

function pickStates(rule: TariffRule): void {
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
      drawRules();
    }
  });
}

function pickGoods(rule: TariffRule): void {
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
      drawRules();
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
  const itemsHtml = items
    .map(
      item =>
        `<label style="display: flex; align-items: center; column-gap: 0.35em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><input type="checkbox" class="native tariffItemCheck" value="${item.id}" ${item.checked ? "checked" : ""} />${item.badgeHtml ?? ""}<span>${item.name}</span></label>`
    )
    .join("");
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="tariffSelectorDialog" class="dialog">
      <div style="margin-bottom: 0.4em; padding-bottom: 0.3em; border-bottom: 1px solid #ccc;">
        <label style="display: flex; align-items: center; column-gap: 0.3em;">
          <input id="tariffAllCheck" type="checkbox" class="native" ${isAll ? "checked" : ""} />
          <b>${allLabel}</b>
        </label>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.25em 0.5em; max-height: 16em; overflow-y: auto;">
        ${itemsHtml}
      </div>
    </div>`
  );

  const dialogEl = ensureEl("tariffSelectorDialog");
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
    onClose: () => Dialog.destroy("tariffSelectorDialog"),
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

export const StateBudgetEditor = { open };
