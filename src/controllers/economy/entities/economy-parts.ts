// Parts the state and province economy overviews share: their style, cards, sectors, living and goods lists

import { Goods } from "@/model/economy/goods-generator";
import { PROSPERITY_LEVELS } from "@/model/economy/prosperity";
import type { GroupLiving } from "@/model/economy/state-economy";
import { formatPrice } from "@/model/units";
import { goodBadge } from "@/renderers/draw-goods";
import {
  economyWikiButton,
  prosperityColor,
  prosperityLevel,
  renderProsperity,
  renderProsperityParts
} from "@/ui/economy-view";
import { t } from "@/utils/i18n";
import { rn } from "@/utils/number-utils";

const TOP_ROWS = 6;

export const SECTORS = ["rural", "manufacturing", "trade"] as const;
export type Sector = (typeof SECTORS)[number];
const SECTOR_COLORS: Record<Sector, string> = { rural: "#6a9a3a", manufacturing: "#d98a32", trade: "#4a7ac0" };

type Sectors = Record<Sector | "product", number>;
type Living = { towns: GroupLiving | null; country: GroupLiving | null; levels: Record<"towns" | "country", number[]> };

const economyStyle = (dialog: string) => /* html */ `<style>
  .${dialog} > div { width: auto }
  .${dialog} .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.4em; margin-bottom: 0.8em }
  .${dialog} .card { border: 1px solid #ccc; border-top: 3px solid var(--header); padding: 0.3em 0.5em; line-height: 1.3 }
  .${dialog} .card .label { font-size: 0.8em; text-transform: uppercase; color: #666 }
  .${dialog} .card .value { font-size: 1.25em; font-weight: bold; white-space: nowrap }
  .${dialog} .card .note { font-size: 0.8em; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
  .${dialog} h4 { margin: 0.8em 0 0.3em; border-bottom: 1px solid var(--dark-solid) }
  .${dialog} .columns { display: grid; grid-template-columns: 1fr 1fr; column-gap: 1.2em }
  .${dialog} .stack { display: flex; height: 1em }
  .${dialog} .stack.small { display: flex; height: 0.85em; opacity: 0.8 }
  .${dialog} .legend { display: flex; justify-content: space-between; }
  .${dialog} .legend span { font-size: 0.9em; white-space: nowrap }
  .${dialog} .swatch { display: inline-block; width: 0.8em; height: 0.8em; margin-right: 0.25em; vertical-align: middle }
  .${dialog} .row { display: grid; grid-template-columns: 8em 1fr 5em; align-items: center; column-gap: 0.4em; line-height: 1.5 }
  .${dialog} .row.plain { grid-template-columns: 1fr 6em }
  .${dialog} .row.budget { grid-template-columns: 2fr 2em 1fr 5em }
  .${dialog} .row .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-flex; align-items: center; gap: 0.2em }
  .${dialog} .bar { height: 0.7em; background: #eee }
  .${dialog} .bar > div { height: 100% }
  .${dialog} .bar.stack { display: flex }
  .${dialog} .right { text-align: right }
  .${dialog} .total { font-weight: bold; border-top: 1px solid #ccc }
  .${dialog} .muted { font-size: 0.85em; color: #666 }
  .${dialog} h4 { display: flex; justify-content: space-between; align-items: center }
  .${dialog} h4 button[class^="icon-"] { padding: 0 3px; font-size: 0.75em; line-height: 1; margin: 2px 0; }
  .${dialog} .group { line-height: 1.6 }
</style>`;

/** A state's or province's economy dialog: the body, refreshed in place, and the wiki */
export const economyDialog = (
  id: string,
  className: string
) => /* html */ `<div id="${id}" class="dialog stable ${className}">
  ${economyStyle(className)}
  <div id="${id}Body"></div>
  <div style="margin-top: 3px">
    <button id="${id}Refresh" type="button" data-tip="${t("Refresh")}" class="icon-cw"></button>
    ${economyWikiButton(`${id}Wiki`)}
  </div>
</div>`;

export function card(label: string, value: string, notes: string[], tipText: string): string {
  const lines = notes.map(note => `<div class="note">${note}</div>`).join("");
  return `<div class="card" data-tip="${tipText}"><div class="label">${label}</div><div class="value">${value}</div>${lines}</div>`;
}

/** "Rank: 2 of 20" among the ids, the highest value first unless the lowest is the best */
export function rank(ids: number[], own: number, measure: (id: number) => number, lowestFirst = false): string {
  const value = measure(own);
  const place = ids.filter(id => (lowestFirst ? measure(id) < value : measure(id) > value)).length + 1;
  return t("Rank: {{rank}} of {{total}}", { rank: place, total: ids.length });
}

export const line = (name: string, value: number, tip = "", tone = "") =>
  `<div data-tip="${tip}" class="row plain"><span class="name">${name}</span><span class="right ${tone}">${formatPrice(value)}</span></div>`;

export const sectorShare = (accounts: Sectors, sector: Sector) =>
  accounts.product ? accounts[sector] / accounts.product : 0;

/** The sectors' bar and legend, each against the share of what it is compared with */
export function renderSectors(accounts: Sectors, compared: Sectors, comparedLabel: string): string {
  const labels: Record<Sector, string> = { rural: t("Rural"), manufacturing: t("Manufacturing"), trade: t("Trade") };
  const hints: Record<Sector, string> = {
    rural: t("Rural people's earnings from their produce"),
    manufacturing: t("The product of its burgs"),
    trade: t("Margins its market centers took")
  };
  const bar = SECTORS.map(sector => {
    const width = sectorShare(accounts, sector) * 100;
    return `<div data-tip="${hints[sector]}" style="width: ${width}%; background: ${SECTOR_COLORS[sector]}"></div>`;
  }).join("");
  const legend = SECTORS.map(sector => {
    const value = `${formatPrice(accounts[sector])} (${rn(sectorShare(accounts, sector) * 100, 1)}%)`;
    const share = `${comparedLabel}: ${rn(sectorShare(compared, sector) * 100, 1)}%`;
    return `<span data-tip="${hints[sector]}. ${share}"><span class="swatch" style="background: ${SECTOR_COLORS[sector]}"></span>${labels[sector]}: ${value}</span>`;
  }).join("");
  return `<h4>${t("Economic sectors")}</h4><div class="stack" style="margin: 0.3em 0">${bar}</div><div class="legend">${legend}</div>`;
}

/** How urban and rural people live, each with a bar of its people by prosperity level */
export function renderLiving(accounts: Living, button = ""): string {
  const level = (index: number) => {
    const middle = index / 10 + 0.05; // a prosperity within the level, for its name and color
    return { name: prosperityLevel(middle), color: prosperityColor(middle) };
  };
  const stack = (counts: number[]) => {
    const total = counts.reduce((sum, count) => sum + count, 0) || 1;
    const parts = PROSPERITY_LEVELS.map((_, index) => {
      const share = (counts[index] / total) * 100;
      if (!share) return "";
      const { name, color } = level(index);
      return `<div data-tip="${name}: ${rn(share, 1)}%" style="width: ${share}%; background: ${color}"></div>`;
    }).join("");
    return `<div class="stack small">${parts}</div>`;
  };
  const group = (label: string, living: GroupLiving | null, counts: number[]) =>
    living
      ? `<div data-tip="${renderProsperityParts(living)}" class="group">${label}: ${renderProsperity(living.prosperity)}${stack(counts)}</div>`
      : "";

  const people = PROSPERITY_LEVELS.map((_, index) => accounts.levels.towns[index] + accounts.levels.country[index]);
  return `<div><h4 data-tip="${t("Prosperity of urban and rural people")}"><span>${t("Prosperity")}</span>${button}</h4>
    ${group(t("Total population"), combine(accounts.towns, accounts.country), people)}
    ${group(t("Urban population"), accounts.towns, accounts.levels.towns)}
    ${group(t("Rural population"), accounts.country, accounts.levels.country)}
    ${accounts.towns || accounts.country ? "" : `<i>${t("None")}</i>`}
  </div>`;
}

/** Two groups' living averaged by their people */
function combine(...groups: (GroupLiving | null)[]): GroupLiving | null {
  const lived = groups.filter(group => group !== null);
  const people = lived.reduce((sum, group) => sum + group.people, 0);
  if (!people) return null;
  const average = (key: "needs" | "comfort" | "variety" | "infrastructure" | "prosperity") =>
    lived.reduce((sum, group) => sum + group[key] * group.people, 0) / people;
  return {
    people,
    needs: average("needs"),
    comfort: average("comfort"),
    variety: average("variety"),
    infrastructure: average("infrastructure"),
    prosperity: average("prosperity")
  };
}

/** The most valuable goods, by value; values by good id */
export function renderGoods(title: string, values: number[], button = ""): string {
  const top = values
    .flatMap((value, goodId) => (value > 0 ? [[goodId, value] as [number, number]] : []))
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_ROWS);
  const most = top[0]?.[1] || 1;
  const html = top
    .map(([goodId, value]) => {
      const good = Goods.get(goodId);
      if (!good) return "";
      const name = `<svg width="1.4em" height="1.4em">${goodBadge(good)}</svg>${good.name}`;
      const bar = `<div class="bar"><div style="width: ${(value / most) * 100}%; background: var(--header)"></div></div>`;
      return `<div class="row"><span class="name">${name}</span>${bar}<span class="right">${formatPrice(value)}</span></div>`;
    })
    .join("");
  return `<div><h4><span>${title}</span>${top.length ? button : ""}</h4>${html || `<i>${t("None")}</i>`}</div>`;
}
