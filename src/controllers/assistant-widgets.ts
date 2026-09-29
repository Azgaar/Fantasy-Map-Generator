import { schemeTableau10 } from "d3";
import { isLinkable, MAP_COMMANDS } from "@/components/map-commands";
import { type EntityRef, type EntityType, isEntityType, MapEntities } from "@/components/map-entities";
import { clearEntityMarks, markEntities, reveal, revealEntity } from "@/components/reveal";
import { tip } from "@/components/tooltips";
import type { State } from "@/generators/states-generator";
import type { ChartRow, Widget } from "@/services/assistant/chats";
import type { Region } from "@/services/io/export";
import type { Emblem } from "@/types/emblems";
import type { Point } from "@/types/global";
import type { LinkResolver } from "@/utils/markdown";
import { rn } from "@/utils/numberUtils";
import { escapeHtml } from "@/utils/stringUtils";
import { getArea, getAreaUnit, getPeople, si } from "@/utils/unitUtils";

// Widgets: links in answers and the items the show tool places. See docs/prd/assistant.md

type Of<T extends Widget["type"]> = Extract<Widget, { type: T }>;

/** Where a widget is drawn: its transcript index, whether its map is open, whether the chat takes a question */
export interface WidgetContext {
  index: number;
  live: boolean;
  canAsk: boolean;
}

const NOTE_PREVIEW = 240;
const INSET = { width: 480, height: 300 };
const INSET_MIN_SPAN = 80; // map units shown around a point-like entity

// Inset pictures are drawn once per widget and session; a chat keeps only the reference
interface Inset {
  id: string;
  region?: Region;
  image?: string;
  failed?: boolean;
}
const insets = new WeakMap<Of<"inset">, Inset>();
let insetCount = 0;

let marked: Of<"entities"> | null = null;

/** The Assistant panel over the map: what it reveals is centred beside it */
const panel = () => document.getElementById("assistant")?.closest(".ui-dialog")?.getBoundingClientRect();

function entityRef(key: string): EntityRef | undefined {
  const ref = MapEntities.parseKey(key);
  return ref && MapEntities.get(ref) ? ref : undefined;
}

function linkableCommand(id: string) {
  const command = MAP_COMMANDS.find(command => command.id === id);
  return command && isLinkable(command) ? command : undefined;
}

/** A key the model could not fill in (`religion:?`) still links when exactly one entity of its type bears the label */
function byName(type: EntityType, label: string): EntityRef | undefined {
  const matches = MapEntities.collect(type).filter(({ ref, entity }) =>
    [entity.name, MapEntities.getName(ref)].some(name => name && escapeHtml(name) === label)
  );
  return matches.length === 1 ? matches[0].ref : undefined;
}

const entityButton = (ref: EntityRef, label: string) =>
  `<button type="button" class="assistantEntity" data-action="entity" data-id="${MapEntities.key(ref)}" data-tip="Show on the map"><span class="${MapEntities.getDisplay(ref).icon}" aria-hidden="true"></span>${label}</button>`;

/** A live entity as a link named after it, otherwise its fallback as text */
function entityLink(key: string | undefined, live: boolean, fallback = ""): string {
  const ref = live && key ? entityRef(key) : undefined;
  return ref ? entityButton(ref, escapeHtml(MapEntities.getName(ref) || fallback)) : escapeHtml(fallback);
}

/** Entity links resolve only while the chat's map is open; a link that cannot resolve keeps just its label */
function links(live: boolean): LinkResolver {
  return (label, href) => {
    if (href.startsWith("command:")) {
      const command = linkableCommand(href.slice("command:".length));
      return command ? commandButton(command.id, label) : label;
    }
    const type = href.split(":")[0];
    if (!href.includes(":") || !isEntityType(type)) return null;
    const ref = live ? (entityRef(href) ?? byName(type, label)) : undefined;
    return ref ? entityButton(ref, label) : label;
  };
}

const commandButton = (id: string, label: string, className = "assistantCommand") =>
  `<button type="button" class="${className}" data-action="command" data-id="${id}" data-tip="${escapeHtml(linkableCommand(id)?.name ?? "")}">${label}</button>`;

const frame = (header: string, body: string, live: boolean) => /* html */ `<div class="assistantItem assistantWidget">
    <div class="assistantWidgetHeader">${header}</div>
    ${live ? "" : `<div class="assistantWidgetNote">Its map is not open</div>`}
    ${body}
  </div>`;

function html(widget: Widget, context: WidgetContext): string {
  if (widget.type === "card") return cardHtml(widget, context.live);
  if (widget.type === "chart") return chartHtml(widget, context.live);
  if (widget.type === "choices") return choicesHtml(widget, context);
  if (widget.type === "inset") return insetHtml(widget, context);
  if (widget.type === "emblem") return emblemHtml(widget, context.live);
  return entitiesHtml(widget, context);
}

function entitiesHtml(widget: Of<"entities">, { index, live }: WidgetContext): string {
  const rows = widget.entities
    .map(key => {
      const ref = live ? entityRef(key) : undefined;
      if (!ref) return `<li class="gone">${escapeHtml(key)}</li>`;
      const context = MapEntities.getContext(ref);
      const name = escapeHtml(MapEntities.getName(ref) || MapEntities.getDisplay(ref).kind);
      return `<li>${entityButton(ref, name)}${context ? `<small>${escapeHtml(context)}</small>` : ""}</li>`;
    })
    .join("");
  const on = marked === widget;
  const toggle = `<button type="button" class="assistantButton" data-action="mark" data-index="${index}" aria-pressed="${on}" ${live ? "" : "disabled"}>${on ? "Hide on map" : "Show on map"}</button>`;
  return frame(`<span>${escapeHtml(widget.title)}</span>${toggle}`, `<ul>${rows}</ul>`, live);
}

function plainText(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  return (template.content.textContent ?? "").replace(/\s+/g, " ").trim();
}

function cardHtml(widget: Of<"card">, live: boolean): string {
  const ref = live ? entityRef(widget.entity) : undefined;
  const state = ref && (MapEntities.get(ref) as State | undefined);
  if (!ref || !state)
    return frame(
      `<span>${escapeHtml(widget.entity)}</span>`,
      live ? `<div class="assistantWidgetNote">No longer on this map</div>` : "",
      live
    );

  const coaId = `stateCOA${state.i}`;
  if (state.coa) void window.EmblemRenderer?.trigger(coaId, state.coa);
  const people = getPeople(state.rural, state.urban);
  const capital = pack.burgs[state.capital];
  const religion = capital ? pack.cells.religion?.[capital.cell] : undefined;
  const facts: [string, string][] = [
    ["Capital", capital ? entityLink(`burg:${capital.i}`, live, capital.name) : "none"],
    ["Population", si(people)],
    ["Area", `${si(getArea(state.area || 0))} ${getAreaUnit()}`],
    ["Burgs", String(state.burgs ?? 0)],
    ["Culture", entityLink(`culture:${state.culture}`, live)],
    ["Religion", religion ? entityLink(`religion:${religion}`, live) : ""]
  ];
  const note = state.note ? plainText(state.note) : "";
  const excerpt = note.length > NOTE_PREVIEW ? `${note.slice(0, NOTE_PREVIEW)}…` : note;
  return /* html */ `<div class="assistantItem assistantWidget assistantCard">
    <div class="assistantCardHead">
      <svg viewBox="0 0 200 200" aria-hidden="true"><use href="#${coaId}"></use></svg>
      <div>
        <strong>${escapeHtml(state.fullName || state.name)}</strong>
        <small>${escapeHtml(state.formName || state.form || "State")}</small>
      </div>
    </div>
    <dl>${facts
      .filter(([, value]) => value)
      .map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`)
      .join("")}</dl>
    ${excerpt ? `<p class="assistantCardNote">${escapeHtml(excerpt)}</p>` : ""}
    <div class="assistantActions">
      <button type="button" class="assistantButton" data-action="entity" data-id="${widget.entity}">Locate</button>
      ${commandButton("editStatesButton", "Edit", "assistantButton")}
    </div>
  </div>`;
}

/** The emblem the model looked at, so the user sees what it saw */
function emblemHtml(widget: Of<"emblem">, live: boolean): string {
  const ref = live ? entityRef(widget.entity) : undefined;
  const coa = ref && (MapEntities.get(ref) as { coa?: Emblem } | undefined)?.coa;
  if (!ref || !coa) return frame(`<span>${escapeHtml(widget.entity)}</span>`, "", live);
  const id = `${ref.type}COA${ref.id}`;
  void window.EmblemRenderer?.trigger(id, coa);
  return frame(
    entityLink(widget.entity, live),
    `<svg class="assistantEmblem" viewBox="0 0 200 200" aria-hidden="true"><use href="#${id}"></use></svg>`,
    true
  );
}

function formatValue(value: number, unit?: string): string {
  const number = value >= 10_000 ? si(value) : String(rn(value, 2));
  return unit ? `${number} ${escapeHtml(unit)}` : number;
}

function rowLabel(row: ChartRow, live: boolean): string {
  const ref = live && row.entity ? entityRef(row.entity) : undefined;
  return ref ? entityButton(ref, escapeHtml(row.label)) : escapeHtml(row.label);
}

function chartHtml(widget: Of<"chart">, live: boolean): string {
  const header = `<span>${escapeHtml(widget.title)}</span>`;
  if (widget.chart === "pie") return frame(header, pieHtml(widget, live), true);
  const max = Math.max(...widget.rows.map(row => row.value), 0) || 1;
  const bars = widget.rows
    .map(
      row => /* html */ `<div class="assistantBar">
        <span>${rowLabel(row, live)}</span>
        <span class="assistantBarTrack"><i style="width: ${rn((row.value / max) * 100, 2)}%"></i></span>
        <span>${formatValue(row.value, widget.unit)}</span>
      </div>`
    )
    .join("");
  return frame(header, `<div class="assistantChart">${bars}</div>`, true);
}

function pieHtml(widget: Of<"chart">, live: boolean): string {
  const total = widget.rows.reduce((sum, row) => sum + row.value, 0);
  const shareOf = (value: number) => (total ? value / total : 0);
  const color = (index: number) => schemeTableau10[index % schemeTableau10.length];
  let angle = -Math.PI / 2;
  const slices = widget.rows
    .map((row, index) => {
      const share = shareOf(row.value);
      if (share >= 1) return `<circle r="1" fill="${color(index)}"></circle>`;
      const start = angle;
      angle += share * Math.PI * 2;
      const [x0, y0, x1, y1] = [Math.cos(start), Math.sin(start), Math.cos(angle), Math.sin(angle)].map(v => rn(v, 4));
      return `<path d="M0 0L${x0} ${y0}A1 1 0 ${share > 0.5 ? 1 : 0} 1 ${x1} ${y1}Z" fill="${color(index)}"></path>`;
    })
    .join("");
  // the share is what a pie shows; the amount behind it is in the tooltip and summed in the caption
  const percent = widget.unit === "%";
  const legend = widget.rows
    .map(
      (row, index) => /* html */ `<li${percent ? "" : ` data-tip="${formatValue(row.value, widget.unit)}"`}>
        <i style="background: ${color(index)}"></i>${rowLabel(row, live)}
        <small>${rn(shareOf(row.value) * 100, 1)}%</small>
      </li>`
    )
    .join("");
  const caption = percent ? "Share of the total" : `Share of ${formatValue(total, widget.unit)}`;
  return `<div class="assistantPie"><svg viewBox="-1 -1 2 2" aria-hidden="true">${slices}</svg><ul>${legend}</ul></div><div class="assistantChartCaption">${caption}</div>`;
}

function choicesHtml(widget: Of<"choices">, { index, live, canAsk }: WidgetContext): string {
  const buttons = widget.choices
    .map((choice, number) => {
      const picked = widget.picked === number;
      const enabled = widget.picked === undefined && (choice.operations ? live : canAsk);
      const hint = choice.operations ? "Propose this change" : "Ask this";
      return `<button type="button" class="assistantButton${picked ? " assistantPrimary" : ""}" data-action="choose" data-index="${index}" data-choice="${number}" data-tip="${hint}" aria-pressed="${picked}" ${enabled ? "" : "disabled"}>${escapeHtml(choice.label)}</button>`;
    })
    .join("");
  return frame(
    `<span>${escapeHtml(widget.title)}</span>`,
    `<div class="assistantActions assistantChoices">${buttons}</div>`,
    true
  );
}

function insetPoints(widget: Of<"inset">): Point[] {
  if (widget.box) return [widget.box.slice(0, 2) as Point, widget.box.slice(2) as Point];
  const ref = widget.entity ? entityRef(widget.entity) : undefined;
  return ref ? MapEntities.getPoints(ref) : [];
}

/** The inset's box, padded around an entity and widened to the picture's proportions */
function insetRegion(widget: Of<"inset">): Region | undefined {
  const points = insetPoints(widget);
  if (!points.length) return undefined;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const [x0, y0, x1, y1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const pad = widget.box ? 1 : 1.3;
  let span = [
    Math.max(x1 - x0, widget.box ? 1 : INSET_MIN_SPAN) * pad,
    Math.max(y1 - y0, widget.box ? 1 : INSET_MIN_SPAN) * pad
  ];
  const ratio = INSET.width / INSET.height;
  span = span[0] / span[1] < ratio ? [span[1] * ratio, span[1]] : [span[0], span[0] / ratio];
  // kept inside the map where it fits, so an entity by the edge is not framed by emptiness
  const within = (center: number, size: number, limit: number) =>
    size >= limit ? limit / 2 : Math.min(Math.max(center, size / 2), limit - size / 2);
  const cx = within((x0 + x1) / 2, span[0], options.map.graph.width);
  const cy = within((y0 + y1) / 2, span[1], options.map.graph.height);
  return { x0: cx - span[0] / 2, y0: cy - span[1] / 2, x1: cx + span[0] / 2, y1: cy + span[1] / 2, ...INSET };
}

/** A ring on the entity: the picture shows the map's current layers, which may not include it */
function insetMark(widget: Of<"inset">, { x0, y0, x1, y1 }: Region): string {
  const ref = widget.entity ? entityRef(widget.entity) : undefined;
  const position = ref && (MapEntities.getPosition(ref) ?? MapEntities.getPoints(ref)[0]);
  if (!position) return "";
  const r = (x1 - x0) / 40;
  return `<svg viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" aria-hidden="true"><circle cx="${position[0]}" cy="${position[1]}" r="${r}" fill="none" stroke="#d0240f" stroke-width="${r / 4}"></circle></svg>`;
}

const insetBody = (widget: Of<"inset">, { region, image, failed }: Inset) =>
  image && region
    ? `<img src="${image}" alt="" />${insetMark(widget, region)}`
    : `<span>${failed ? "Could not draw this part of the map" : "Drawing the map…"}</span>`;

async function drawInset(widget: Of<"inset">, inset: Inset): Promise<void> {
  try {
    if (!inset.region) throw new Error("No region");
    const { ExportMap } = await import("@/services/io/export");
    inset.image = await ExportMap.getRegionImage(inset.region);
  } catch {
    inset.failed = true;
  }
  const button = document.getElementById(inset.id);
  if (button) button.innerHTML = insetBody(widget, inset);
}

function insetHtml(widget: Of<"inset">, { index, live }: WidgetContext): string {
  const header = `<span>${escapeHtml(widget.title)}</span>`;
  if (!live) return frame(header, "", false);
  let inset = insets.get(widget);
  if (!inset) {
    inset = { id: `assistantInset${++insetCount}`, region: insetRegion(widget) };
    insets.set(widget, inset);
    void drawInset(widget, inset);
  }
  return frame(
    header,
    `<button type="button" id="${inset.id}" class="assistantInset" data-action="inset" data-index="${index}" data-tip="Show on the map">${insetBody(widget, inset)}</button>`,
    true
  );
}

/** Zoom the map to the inset: its entity, or its box */
function revealInset(widget: Of<"inset">): void {
  const ref = widget.entity ? entityRef(widget.entity) : undefined;
  if (ref) revealEntity(ref, panel());
  else reveal(insetPoints(widget), { layers: [], maxScale: 20, element: () => null, cover: panel() });
}

/** Reveal the entity on the map, or open its editor when it has no place there */
function openEntity(key: string): void {
  const ref = entityRef(key);
  if (!ref) return;
  if (revealEntity(ref, panel()) || MapEntities.open(ref)) return;
  tip("This element has no map location", false, "warn", 4000);
}

function runCommand(id: string): void {
  void linkableCommand(id)?.run();
}

function toggleMarks(widget: Of<"entities">): void {
  if (marked === widget) {
    clearMarks();
    return;
  }
  const refs = widget.entities.flatMap(key => entityRef(key) ?? []);
  marked = markEntities(refs, panel()) ? widget : null;
  if (!marked) tip("These entities have no map location", false, "warn", 4000);
}

function clearMarks(): void {
  marked = null;
  clearEntityMarks();
}

export const AssistantWidgets = { links, html, openEntity, runCommand, revealInset, toggleMarks, clearMarks };
