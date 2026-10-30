// The State Economy Overview's full tables: goods, trading partners and prosperity, as sortable editor tables

import { Goods } from "@/model/economy/goods-generator";
import { Prosperity } from "@/model/economy/prosperity";
import { StateEconomy } from "@/model/economy/state-economy";
import { formatPrice } from "@/model/units";
import { goodBadge } from "@/renderers/draw-goods";
import { Csv } from "@/services/io/csv";
import { Dialog } from "@/ui/dialog/dialog";
import { bindColumnSorting, sortDataByColumns } from "@/ui/dialog/sorting";
import {
  type EditorColumn,
  initColumnVisibility,
  initEditorTable,
  renderEditorHeader,
  renderEditorPagination,
  type TableView
} from "@/ui/dialog/table";
import {
  bindEconomyWiki,
  ECONOMY_COLORS,
  economyWikiButton,
  prosperityLevel,
  renderProsperityPercent,
  tone
} from "@/ui/economy-view";
import { t } from "@/utils/i18n";
import { ensureEl } from "@/utils/node-utils";
import { rn, si } from "@/utils/number-utils";

type TableSpec<T> = {
  id: string;
  title: string;
  columns: EditorColumn<T>[];
  rows: () => T[];
  row: (item: T) => string; // the line's cells, each with its data-col
  csv: { headers: string[]; row: (item: T) => (string | number)[] };
};

/** A sortable table in its own dialog, with refresh, CSV download and the wiki */
function open<T>(spec: TableSpec<T>): void {
  const { id, title, columns, rows, row } = spec;
  const table = initEditorTable<T>({
    getData: () => sortDataByColumns(id, rows(), columns),
    onUpdate: (view: TableView<T>) => {
      ensureEl(`${id}Body`).innerHTML = view.rows.map(item => `<div class="states">${row(item)}</div>`).join("");
      renderEditorPagination(ensureEl(`${id}Footer`), view, table.goto);
    }
  });

  renderDialog(spec);
  addListeners(spec, table);
  table.reset();

  Dialog.open(id, { title, width: "fit-content", onClose: () => cleanup(id) });
}

function renderDialog<T>({ id, columns }: TableSpec<T>): void {
  Dialog.destroy(id);
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="${id}" class="dialog editorDialog">
      ${renderEditorHeader({ dialogId: id, columns })}
      <div id="${id}Body" class="table" style="max-height: 40em"></div>
      <div id="${id}Footer" class="totalLine"></div>
      <div>
        <button id="${id}Refresh" data-tip="${t("Refresh")}" class="icon-cw"></button>
        <button id="${id}Export" data-tip="${t("Save data as a CSV file")}" class="icon-download"></button>
        ${economyWikiButton(`${id}Wiki`)}
      </div>
    </div>`
  );
}

function addListeners<T>(
  { id, title, columns, rows, csv }: TableSpec<T>,
  table: ReturnType<typeof initEditorTable>
): void {
  bindColumnSorting(id, table.reset);
  initColumnVisibility({ dialogId: id, columns, onUpdate: () => Dialog.update(id, { width: "fit-content" }) });
  ensureEl(`${id}Refresh`).addEventListener("click", table.refresh);
  ensureEl(`${id}Export`).addEventListener("click", () =>
    Csv.download(title.replace(/[:\s]+/g, "_"), csv.headers, rows().map(csv.row))
  );
  bindEconomyWiki(`${id}Wiki`);
}

function cleanup(id: string): void {
  Dialog.destroy(id);
}

const stateName = (stateId: number) => (stateId ? pack.states[stateId].name : t("Neutrals"));
const money = (value: number) => formatPrice(rn(value, 2));

export type GoodsKind = "exports" | "imports" | "made";
type GoodRow = { goodId: number; units: number; value: number; share: number };

/** Every good the state exports, imports or makes, with its units, value and share */
function openGoods(stateId: number, kind: GoodsKind): void {
  const rows = (): GoodRow[] => {
    const trade = StateEconomy.getTrade(stateId);
    const values = { exports: trade.exported, imports: trade.imported, made: StateEconomy.getOutput(stateId) }[kind];
    const units = { exports: trade.exportedUnits, imports: trade.importedUnits, made: [] as number[] }[kind];
    const total = values.reduce((sum, value) => sum + (value || 0), 0) || 1;
    return values.flatMap((value, goodId) => {
      const good = Goods.get(goodId);
      if (!value || !good) return [];
      const count = kind === "made" ? value / (good.value || 1) : units[goodId] || 0;
      return [{ goodId, units: count, value, share: (value / total) * 100 }];
    });
  };
  const name = (row: GoodRow) => Goods.get(row.goodId)?.name ?? "";
  const columns: EditorColumn<GoodRow>[] = [
    { key: "good", label: t("Good"), width: "11em", permanent: true, sortBy: name, sortType: "alpha" },
    { key: "units", label: t("Units"), width: "5em", sortBy: row => row.units },
    { key: "value", label: t("Value"), width: "6em", sortBy: row => row.value, defaultSort: "desc" },
    { key: "share", label: t("Share"), width: "4em", sortBy: row => row.share },
    { key: "actions", width: "1.4em", permanent: true }
  ];
  const title = { exports: t("Exports"), imports: t("Imports"), made: t("Goods made") }[kind];
  open({
    id: `stateEconomy${kind}Table`,
    title: `${title}: ${stateName(stateId)}`,
    columns,
    rows,
    row: row => {
      const good = Goods.get(row.goodId)!;
      const badge = `<svg width="1.4em" height="1.4em">${goodBadge(good)}</svg>`;
      return `<div data-col="good" style="display: flex; align-items: center; gap: 0.2em">${badge}${good.name}</div>
        <div data-col="units">${rn(row.units, 2)}</div>
        <div data-col="value">${money(row.value)}</div>
        <div data-col="share">${rn(row.share, 1)}%</div>`;
    },
    csv: {
      headers: ["Good", "Units", "Value", "Share"],
      row: row => [name(row), rn(row.units, 2), rn(row.value, 2), rn(row.share, 2)]
    }
  });
}

type PartnerRow = { stateId: number; exports: number; imports: number; balance: number; share: number };

/** Every state the state trades with, what it sells them and buys from them */
function openPartners(stateId: number): void {
  const rows = (): PartnerRow[] => {
    const { partners } = StateEconomy.getTrade(stateId);
    const volume = [...partners.values()].reduce((sum, row) => sum + row.exports + row.imports, 0) || 1;
    return [...partners].map(([partnerId, row]) => ({
      stateId: partnerId,
      exports: row.exports,
      imports: row.imports,
      balance: row.exports - row.imports,
      share: ((row.exports + row.imports) / volume) * 100
    }));
  };
  const name = (row: PartnerRow) => stateName(row.stateId);
  const columns: EditorColumn<PartnerRow>[] = [
    { key: "color", width: "1.2em", permanent: true },
    { key: "state", label: t("State"), width: "9em", permanent: true, sortBy: name, sortType: "alpha" },
    { key: "exports", label: t("Exports"), width: "6em", sortBy: row => row.exports },
    { key: "imports", label: t("Imports"), width: "6em", sortBy: row => row.imports },
    { key: "balance", label: t("Balance"), width: "6em", sortBy: row => row.balance },
    { key: "share", label: t("Share"), width: "4em", sortBy: row => row.share, defaultSort: "desc" },
    { key: "actions", width: "1.4em", permanent: true }
  ];
  open({
    id: "stateEconomyPartnersTable",
    title: `${t("Foreign trade")}: ${stateName(stateId)}`,
    columns,
    rows,
    row: row => `<fill-box data-col="color" fill="${pack.states[row.stateId]?.color || "#ccc"}"></fill-box>
      <div data-col="state">${name(row)}</div>
      <div data-col="exports">${money(row.exports)}</div>
      <div data-col="imports">${money(row.imports)}</div>
      <div data-col="balance" style="color: ${ECONOMY_COLORS[tone(row.balance)]}">${money(row.balance)}</div>
      <div data-col="share">${rn(row.share, 1)}%</div>`,
    csv: {
      headers: ["State", "Exports", "Imports", "Balance", "Share"],
      row: row => [name(row), rn(row.exports, 2), rn(row.imports, 2), rn(row.balance, 2), rn(row.share, 2)]
    }
  });
}

type LivingRow = { name: string; people: number; prosperity: number; needs: number; comfort: number; variety: number };

/** How each burg of the state lives, and its rural people together */
function openProsperity(stateId: number): void {
  const { scale, urbanization } = options.map.units.population;
  const rows = (): LivingRow[] => {
    const burgs = pack.burgs.flatMap(burg => {
      if (!burg.i || burg.removed || (burg.state || 0) !== stateId) return [];
      const living = Prosperity.getBurg(burg.i);
      if (!living || !burg.population) return [];
      return [{ name: burg.name!, people: burg.population * scale * urbanization.rate, ...living }];
    });
    const country = StateEconomy.getAccounts(stateId)?.country;
    const rural = country ? [{ name: t("Rural population"), ...country, people: country.people * scale }] : [];
    return [...rural, ...burgs];
  };
  open({
    id: "stateEconomyProsperityTable",
    title: `${t("Prosperity")}: ${stateName(stateId)}`,
    columns: [
      { key: "name", label: t("Burg"), width: "9em", permanent: true, sortBy: row => row.name, sortType: "alpha" },
      { key: "people", label: t("Population"), width: "6em", sortBy: row => row.people },
      { key: "prosperity", label: t("Prosperity"), width: "6em", sortBy: row => row.prosperity, defaultSort: "desc" },
      { key: "level", label: t("Level"), width: "6em", sortBy: row => row.prosperity },
      { key: "needs", label: t("Needs met"), width: "6em", sortBy: row => row.needs },
      { key: "comfort", label: t("Comfort"), width: "6em", sortBy: row => row.comfort },
      { key: "variety", label: t("Goods"), width: "3.5em", sortBy: row => row.variety },
      { key: "actions", width: "1.4em", permanent: true }
    ],
    rows,
    row: row => `<div data-col="name">${row.name}</div>
      <div data-col="people">${si(row.people)}</div>
      <div data-col="prosperity">${renderProsperityPercent(row.prosperity)}</div>
      <div data-col="level">${prosperityLevel(row.prosperity)}</div>
      <div data-col="needs">${rn(row.needs * 100)}%</div>
      <div data-col="comfort">×${rn(row.comfort, 1)}</div>
      <div data-col="variety">${rn(row.variety, 1)}</div>`,
    csv: {
      headers: ["Name", "Population", "Prosperity", "Level", "Needs met", "Comfort", "Goods"],
      row: row => [
        row.name,
        rn(row.people),
        rn(row.prosperity * 100),
        prosperityLevel(row.prosperity),
        rn(row.needs * 100),
        rn(row.comfort, 2),
        rn(row.variety, 2)
      ]
    }
  });
}

export const StateEconomyTables = { openGoods, openPartners, openProsperity };
