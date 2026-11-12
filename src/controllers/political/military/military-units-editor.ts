import { Controllers } from "@/controllers";
import { Goods } from "@/model/economy/goods-generator";
import { Icons } from "@/model/icons";
import { Options } from "@/model/options/options-model";
import { Military } from "@/model/political/military-generator";
import { FOOT_SPEED, getDefaultMilitaryUnits, getUnitPower } from "@/model/political/military-units";
import { stateEmblemIcon } from "@/renderers/draw-emblems";
import { goodBadge } from "@/renderers/draw-goods";
import { Layers } from "@/renderers/layers";
import type { Good } from "@/types/economy";
import type { MilitaryUnit } from "@/types/military";
import { App } from "@/ui/app-commands";
import { Dialog } from "@/ui/dialog/dialog";
import { type LimitationItem, limitationTip, pickLimitation } from "@/ui/dialog/limitation-picker";
import { bindColumnSorting, sortDataByColumns } from "@/ui/dialog/sorting";
import {
  type EditorColumn,
  getRowId,
  initColumnVisibility,
  initEditorTable,
  renderEditorHeader,
  renderEditorPagination,
  type TableView
} from "@/ui/dialog/table";
import { tip } from "@/ui/tooltips";
import { sentences, t } from "@/utils/i18n";
import { ensureEl } from "@/utils/node-utils";
import { rn } from "@/utils/number-utils";
import { escapeHtml, sanitizeId } from "@/utils/string-utils";

const dialogId = "militaryOptions" as const;
const position = { my: "center", at: "center", of: "svg" };
const TYPES = ["levies", "melee", "ranged", "mounted", "machinery", "naval", "armored", "aviation", "magical"];
const TRAITS = ["attack", "defense", "speed", "range", "morale"] as const; // what a unit is in battle
const NUMBERS = ["rural", "urban", "crew", ...TRAITS] as const;
const LIMITS = ["biomes", "states", "cultures", "religions"] as const;
type NumberField = (typeof NUMBERS)[number];
type Limit = (typeof LIMITS)[number];

// a unit as edited: saved on Apply, `origin` is the name of the saved unit it changes
type UnitRow = { id: number; unit: MilitaryUnit; origin: string | null };

let rows: UnitRow[] = [];
let nextId = 1;
let columns: EditorColumn<UnitRow>[] = [];
let onApplied: VoidFunction = () => {};

const unitsTable = initEditorTable<UnitRow>({
  dialogId,
  getData: () => sortDataByColumns(dialogId, [...rows], columns), // sorting is of the view, not of the roster
  onUpdate: renderUnitsPage
});

export function openMilitaryUnitsEditor(onApply: VoidFunction): void {
  onApplied = onApply;
  rows = options.map.military.units.map(toRow);
  renderDialog();
  unitsTable.reset();

  Dialog.open(dialogId, {
    title: t("Edit Military Units"),
    width: "fit-content",
    position,
    onClose: closeEditor,
    buttons: [
      { label: t("Apply"), onClick: applyUnits, tip: t("Apply military units settings.") },
      { label: t("Add"), onClick: addUnit, tip: t("Add") },
      { label: t("Restore"), onClick: restoreDefaultUnits, tip: t("Restore default military units and settings") },
      { label: t("Close"), onClick: () => Dialog.close(dialogId), tip: t("Close") }
    ]
  });
}

function renderDialog(): void {
  columns = getColumns();
  Dialog.destroy(dialogId);
  const html = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog">
      <div id="militaryOptionsBody" class="table">${renderEditorHeader({ dialogId, columns })}</div>
      <div id="militaryOptionsFooter" class="totalLine">
        <div data-tip="${t("Units number")}" style="margin-left: 4px">
          ${t("Units")}:&nbsp;<span id="militaryOptionsFooterNumber">0</span>
        </div>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  bindColumnSorting(dialogId, unitsTable.reset);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => Dialog.update(dialogId, { width: "fit-content", position })
  });

  const body = ensureEl("militaryOptionsBody");
  body.addEventListener("input", onFieldInput);
  body.addEventListener("click", onCellClick);
}

function getColumns(): EditorColumn<UnitRow>[] {
  const tips = getTips();
  const sortable = (tip: string) => sentences(tip, t("Click to sort"));
  const number = (key: NumberField, label: string, width: string): EditorColumn<UnitRow> => ({
    key,
    label,
    width,
    tip: sortable(tips[key]),
    mobileHidden: key !== "rural" && key !== "urban",
    sortBy: row => row.unit[key]
  });
  const limit = (key: Limit, label: string): EditorColumn<UnitRow> => ({
    key,
    label,
    width: "5em",
    tip: sortable(tips[key]),
    mobileHidden: true,
    sortBy: row => row.unit[key]?.length ?? 0
  });

  return [
    { key: "icon", width: "2em", tip: t("Unit icon"), permanent: true },
    {
      key: "name",
      label: t("Name"),
      width: "8em",
      permanent: true,
      sortBy: row => row.unit.name.toLowerCase(),
      sortType: "alpha"
    },
    {
      key: "goods",
      label: t("Goods"),
      width: "5em",
      tip: sortable(tips.goods),
      sortBy: row => row.unit.goods?.length ?? 0
    },
    limit("biomes", t("Biomes")),
    limit("states", t("States")),
    limit("cultures", t("Cultures")),
    limit("religions", t("Religions")),
    number("rural", t("Rural"), "4em"),
    number("urban", t("Urban"), "4em"),
    number("crew", t("Crew"), "3.5em"),
    number("attack", t("Attack"), "4em"),
    number("defense", t("Defense"), "4.5em"),
    number("speed", t("Speed"), "4em"),
    number("range", t("Range"), "4em"),
    number("morale", t("Morale"), "4em"),
    {
      key: "power",
      label: t("Power"),
      width: "4.5em",
      tip: sortable(tips.power),
      mobileHidden: true,
      sortBy: row => getUnitPower(row.unit)
    },
    {
      key: "type",
      label: t("Type"),
      width: "6em",
      tip: sortable(tips.type),
      sortBy: row => row.unit.type,
      sortType: "alpha"
    },
    {
      key: "separate",
      label: t("Separate"),
      width: "5em",
      tip: sortable(tips.separate),
      mobileHidden: true,
      sortBy: row => row.unit.separate
    },
    { key: "remove", width: "1.4em", permanent: true }
  ];
}

function renderUnitsPage(view: TableView<UnitRow>): void {
  const body = ensureEl("militaryOptionsBody");
  body.querySelectorAll(":scope > .states").forEach(line => {
    line.remove();
  });
  const tips = getTips();
  body.insertAdjacentHTML("beforeend", view.rows.map(row => getUnitLine(row, tips)).join(""));
  ensureEl("militaryOptionsFooterNumber").textContent = String(view.total);
  renderEditorPagination(ensureEl("militaryOptionsFooter"), view, unitsTable.goto);
  Dialog.update(dialogId, { position }); // a longer list stays on screen
}

function getUnitLine({ id, unit }: UnitRow, tips: ReturnType<typeof getTips>): string {
  const number = (key: NumberField, attributes: string): string =>
    `<div data-col="${key}"><input data-field="${key}" data-tip="${tips[key]}" type="number" ${attributes} value="${unit[key]}" /></div>`;
  const limit = (key: Limit): string => {
    const title = unit[key]?.length ? escapeHtml(limitationTip(unit[key], pack[key] as LimitationItem[])) : "";
    return `<div data-col="${key}" data-tip="${tips[key]}" title="${title}" class="pointer">${getLimitText(unit[key], key)}</div>`;
  };
  const types = TYPES.map(type => `<option ${unit.type === type ? "selected" : ""} value="${type}">${type}</option>`);

  return /* html */ `<div class="states" data-id="${id}">
      <div data-col="icon" data-tip="${t("Click to select unit icon")}" class="pointer" translate="no">${Icons.html(unit.icon || "")}</div>
      <div data-col="name"><input data-field="name" data-tip="${t("Name")}" value="${escapeHtml(unit.name)}" /></div>
      <div data-col="goods" data-tip="${tips.goods}" title="${escapeHtml(getGoodsTitle(unit.goods))}" class="pointer">${getGoodsBadges(unit.goods)}</div>
      ${LIMITS.map(limit).join("")}
      ${number("rural", `min="0" max="100" step=".01"`)}
      ${number("urban", `min="0" max="100" step=".01"`)}
      ${number("crew", `min="1" step="1"`)}
      ${number("attack", `min="0" step=".1"`)}
      ${number("defense", `min="0" step=".1"`)}
      ${number("speed", `min="0" step="1"`)}
      ${number("range", `min="0" step="10"`)}
      ${number("morale", `min="0" step=".1"`)}
      <div data-col="power" data-tip="${tips.power}">${showPower(unit)}</div>
      <div data-col="type"><select data-field="type" data-tip="${tips.type}">${types.join("")}</select></div>
      <div data-col="separate" data-tip="${tips.separate}">
        <input data-field="separate" type="checkbox" class="native" ${unit.separate ? "checked" : ""} />
      </div>
      <span data-col="remove" data-tip="${t("Remove")}" class="icon-trash-empty pointer"></span>
    </div>`;
}

function onFieldInput(event: Event): void {
  const el = event.target as HTMLInputElement | HTMLSelectElement;
  const row = getRow(el);
  const field = el.dataset.field;
  if (!row || !field) return;

  if (field === "name" || field === "type") row.unit[field] = el.value;
  else if (field === "separate") row.unit.separate = +(el as HTMLInputElement).checked;
  else row.unit[field as NumberField] = +el.value || 0;

  el.closest(".states")!.querySelector('[data-col="power"]')!.textContent = showPower(row.unit);
}

function onCellClick(event: Event): void {
  const cell = (event.target as HTMLElement).closest<HTMLElement>(".states > [data-col]");
  const row = cell && getRow(cell);
  if (!row) return;
  const column = cell.dataset.col as string;

  if (column === "remove") {
    rows = rows.filter(other => other !== row);
    unitsTable.refresh();
  } else if (column === "icon") {
    Controllers.IconPicker.open({ current: row.unit.icon || "", onPick: icon => updateUnit(row, { icon }) });
  } else if (column === "goods") {
    pickLimitation({
      title: t("Unit goods"),
      heading: t("Goods that equip the unit"),
      items: options.map.goods,
      allowed: row.unit.goods ?? [],
      exact: true,
      badge: item => getGoodBadge(item as Good),
      onApply: goods => updateUnit(row, { goods })
    });
  } else if (LIMITS.includes(column as Limit)) {
    const type = column as Limit;
    const items =
      type === "biomes"
        ? pack.biomes.filter(biome => !biome.removed).map(({ i, name, color }) => ({ i, name, color }))
        : (pack[type] as LimitationItem[]);
    pickLimitation({
      title: t("Limit unit"),
      heading: t("Limit unit by {{type}}", { type }),
      items,
      allowed: row.unit[type] ?? [],
      badge:
        type === "states"
          ? item => `<span style="color:${escapeHtml(item.color ?? "")}">⬤</span>${stateEmblemIcon(item.i)}`
          : undefined,
      onApply: allowed => updateUnit(row, { [type]: allowed })
    });
  }
}

// redraw the line in place: the table is not sorted anew while it is edited
function updateUnit(row: UnitRow, changes: Partial<MilitaryUnit>): void {
  Object.assign(row.unit, changes);
  const line = ensureEl("militaryOptionsBody").querySelector(`:scope > .states[data-id="${row.id}"]`);
  if (line) line.outerHTML = getUnitLine(row, getTips());
}

function addUnit(): void {
  const taken = new Set(rows.map(row => row.unit.name));
  let number = rows.length + 1;
  while (taken.has(`custom${number}`)) number++;

  const row: UnitRow = {
    id: nextId++,
    origin: null,
    unit: {
      icon: Icons.glyph("🛡️"),
      name: `custom${number}`,
      rural: 0.2,
      urban: 0.5,
      crew: 1,
      attack: 1,
      defense: 1,
      speed: FOOT_SPEED,
      range: 0,
      morale: 1,
      type: "melee",
      separate: 0
    }
  };
  rows.push(row);
  unitsTable.reveal(row);

  const input = ensureEl("militaryOptionsBody").querySelector<HTMLInputElement>(`[data-id="${row.id}"] input`);
  input?.scrollIntoView({ block: "nearest" });
  input?.select();
}

function restoreDefaultUnits(): void {
  rows = getDefaultMilitaryUnits().map(toRow);
  unitsTable.reset();
}

function applyUnits(): void {
  if (rows.some(row => !row.unit.name.trim())) return void tip(t("Name cannot be empty"), false, "error");
  const names = rows.map(row => sanitizeId(row.unit.name));
  if (new Set(names).size !== names.length) return void tip(t("All units should have unique names"), false, "error");

  const units = rows.map(({ unit }, i) => {
    const saved: MilitaryUnit = { ...structuredClone(unit), name: names[i] };
    for (const key of [...LIMITS, "goods"] as const) if (!saved[key]?.length) delete saved[key];
    return saved;
  });
  const stale = Military.setRoster(
    units,
    rows.map(row => row.origin)
  );
  Options.save(); // the roster is this map's, and what the next map starts from
  onApplied();
  Layers.draw("military");

  rows.forEach((row, i) => {
    row.unit.name = names[i];
    row.origin = names[i]; // the dialog stays open: a later rename is of the saved unit
  });
  unitsTable.refresh();
  if (!stale.length) return void tip(t("Units are saved"), false, "success");

  App.openMilitaryRegeneration({ units: stale });
}

function closeEditor(): void {
  Dialog.destroy(dialogId);
  rows = [];
  onApplied = () => {};
}

// a unit named as a saved one edits it, and keeps its troops
const toRow = (unit: MilitaryUnit): UnitRow => ({
  id: nextId++,
  unit: structuredClone(unit),
  origin: options.map.military.units.some(saved => saved.name === unit.name) ? unit.name : null
});

const getRow = (el: HTMLElement): UnitRow | undefined => rows.find(row => row.id === getRowId(el));

const getLimitText = (allowed: number[] | undefined, type: Limit): string => {
  if (!allowed?.length) return `<span class="unset">all</span>`;
  return type === "states" ? allowed.map(stateEmblemIcon).join("") : String(allowed.length);
};

const getGoodBadge = (good: Good): string =>
  `<svg width="1.4em" height="1.4em" style="vertical-align: middle">${goodBadge(good)}</svg>`;

const getGoodsBadges = (goods?: number[]): string => {
  const badges = (goods ?? []).flatMap(goodId => Goods.get(goodId) ?? []).map(getGoodBadge);
  return badges.length ? badges.join("") : `<span class="unset">${t("none")}</span>`;
};

const getGoodsTitle = (goods?: number[]): string =>
  goods?.length ? limitationTip(goods, options.map.goods) : t("none");

const showPower = (unit: Parameters<typeof getUnitPower>[0]): string => {
  const power = getUnitPower(unit);
  return String(rn(power, power < 1 ? 2 : 1));
};

const getTips = () => ({
  goods: t(
    "Goods that equip the unit; any of them, adding up. Units share the state's stock. Counts what the state consumes, not what it produces: 1 unit a day equips 365 troops × military coverage. Conscripts left without equipment are raised as levies"
  ),
  biomes: t("Select allowed biomes"),
  states: t("Select allowed states"),
  cultures: t("Select allowed cultures"),
  religions: t("Select allowed religions"),
  rural: t(
    "Most of the rural population that can be raised to the unit, in percent: fewer if the state lacks the unit's goods"
  ),
  urban: t(
    "Most of the urban population that can be raised to the unit, in percent: fewer if the state lacks the unit's goods"
  ),
  crew: t("Average number of people in crew (used for total personnel calculation)"),
  attack: t("What a unit strikes and shoots with in battle"),
  defense: t("What a unit stands blows and shots with in battle"),
  speed: t("How far a unit moves in a battle tick: 7 on foot, 20 mounted. The battle plan is 1000 wide"),
  range: t("How far a unit shoots on the battle plan, which is 1000 wide. Set 0 to fight hand to hand"),
  morale: t("How steady a unit is in battle: 1 is ordinary, lower breaks sooner, at 2 it loses morale half as fast"),
  power: t(
    "Unit military power, worked out from its attack, defense, speed, range and morale. It sets the upkeep and the power of forces"
  ),
  type: t("Unit type to apply special rules on forces recalculation"),
  separate: t("Check if unit is separate and can be stacked only with units of the same type")
});
