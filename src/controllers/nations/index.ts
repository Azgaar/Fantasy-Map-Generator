// AI Nations: the referee's table. Chosen states are run by AI models; each turn they send orders and letters, the
// user rules on them, and the rulings become map changes the user applies. See docs/ai-nations.md
import { confirmationDialog, destroyDialog } from "@/components/dialog/dialog-helpers";
import { AssistantMap } from "@/controllers/assistant/map";
import { ProposalCard } from "@/controllers/assistant/proposal-card";
import { type Action, Proposals } from "@/controllers/assistant/proposals";
import type { Chat, TranscriptItem } from "@/services/assistant/chats";
import { askProvider } from "@/services/assistant/provider/answerer";
import { get as getConnection, save as saveConnection } from "@/services/assistant/provider/connection";
import { listModels } from "@/services/assistant/provider/models";
import { providerById } from "@/services/assistant/provider/providers";
import { type BriefState, buildBriefing, type World } from "@/services/nations/briefing";
import { clerkBrief } from "@/services/nations/clerk";
import * as Games from "@/services/nations/game";
import { type Game, type Letter, type Order, REFEREE, type Submission, type TurnRecord } from "@/services/nations/game";
import { playTurn } from "@/services/nations/turn";
import { createFileInput, downloadFile, ensureEl, uploadFile } from "@/utils";
import { capitalize, errorText, escapeHtml } from "@/utils/stringUtils";
import { formatPrice, getArea, getAreaUnit, getPeople, si } from "@/utils/unitUtils";

const DIALOG_ID = "nationsPanel";
const PARALLEL_TURNS = 4;
const KNOWN_MODELS = ["claude-opus-5-5", "claude-fable-5-1", "claude-sonnet-5-5", "claude-haiku-4-5-20251001"];

type View = "turn" | "setup" | "history";
type Progress = "waiting" | "thinking";

let game: Game | undefined;
let view: View = "turn";
let models: string[] = [];
let keyStatus = "";
let notice = "";
let clerkStatus = "";
let abort: AbortController | null = null;
const progress = new Map<number, Progress>();

const STYLES = /* html */ `<style>
  #${DIALOG_ID} { display: flex; flex-direction: column; gap: .6em; font-size: .95em; }
  #${DIALOG_ID} > div { width: auto; }
  #${DIALOG_ID} .nTabs { display: flex; align-items: center; gap: .3em; }
  #${DIALOG_ID} .nTabs > span { margin-left: auto; opacity: .7; }
  #${DIALOG_ID} .nTab[aria-pressed="true"] { background: var(--header); color: #fff; }
  #${DIALOG_ID} .nBody { overflow: hidden auto; flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: .8em; align-content: start; padding-right: .3em; }
  #${DIALOG_ID} h4 { margin: 0 0 .3em; font-size: 1em; }
  #${DIALOG_ID} :is(section, .nCard, .nOrder) { display: grid; grid-template-columns: minmax(0, 1fr); gap: .4em; }
  #${DIALOG_ID} :is(textarea, input[type="text"], input[type="password"], select) { box-sizing: border-box; font: inherit; }
  #${DIALOG_ID} textarea { width: 100%; resize: vertical; }
  #${DIALOG_ID} .nRow { display: flex; flex-wrap: wrap; align-items: center; gap: .4em; }
  #${DIALOG_ID} .nGrow { flex: 1; min-width: 8em; }
  #${DIALOG_ID} .nHint { opacity: .65; font-size: .92em; }
  #${DIALOG_ID} .nNotice { padding: .4em .6em; border-radius: .35em; background: rgb(200 120 0 / 14%); }
  #${DIALOG_ID} .nError { color: #9a2a2a; }
  #${DIALOG_ID} .nCard { padding: .55em .7em; border: 1px solid rgb(0 0 0 / 14%); border-radius: .5em; background: rgb(255 255 255 / 55%); }
  #${DIALOG_ID} .nCardHead { display: flex; align-items: center; gap: .5em; font-weight: 600; }
  #${DIALOG_ID} .nCardHead > :last-child { margin-left: auto; font-weight: normal; }
  #${DIALOG_ID} .nSwatch { width: .9em; height: .9em; border-radius: 50%; border: 1px solid rgb(0 0 0 / 30%); flex: none; }
  #${DIALOG_ID} .nOrder { padding: .4em .5em; border-left: 3px solid rgb(0 0 0 / 20%); background: rgb(0 0 0 / 3%); }
  #${DIALOG_ID} .nOrder.approved { border-left-color: #3d7a3a; }
  #${DIALOG_ID} .nOrder.rejected { border-left-color: #9a2a2a; opacity: .75; }
  #${DIALOG_ID} .nTag { padding: 0 .5em; border-radius: 1em; background: rgb(0 0 0 / 10%); font-size: .8em; }
  #${DIALOG_ID} .nText { white-space: pre-wrap; overflow-wrap: anywhere; }
  #${DIALOG_ID} .nRuling[aria-pressed="true"] { background: var(--header); color: #fff; }
  #${DIALOG_ID} table { width: 100%; border-collapse: collapse; }
  #${DIALOG_ID} td { padding: .2em .3em; vertical-align: top; }
  #${DIALOG_ID} details > summary { cursor: pointer; }
  #${DIALOG_ID} .assistantProposal { overflow: hidden; border: 1px solid rgb(0 0 0 / 14%); border-radius: .55em; background: rgb(255 255 255 / 60%); }
  #${DIALOG_ID} .assistantProposalHeader { display: flex; align-items: center; gap: .55em; padding: .5em .7em; border-bottom: 1px solid rgb(0 0 0 / 8%); background: rgb(0 0 0 / 3%); }
  #${DIALOG_ID} .assistantProposalState { flex: none; padding: .1em .55em; border-radius: 1em; background: var(--header); color: #fff; font-size: .72em; font-weight: 600; text-transform: uppercase; }
  #${DIALOG_ID} .assistantProposal.applied .assistantProposalState { background: #3d7a3a; }
  #${DIALOG_ID} .assistantProposal:is(.undone, .discarded) .assistantProposalState { background: rgb(0 0 0 / 40%); }
  #${DIALOG_ID} .assistantProposalSummary { flex: 1; font-weight: 600; }
  #${DIALOG_ID} .assistantProposalBody { display: grid; gap: .55em; padding: .55em .7em; }
  #${DIALOG_ID} .assistantChangeName { display: flex; align-items: center; gap: .35em; font-weight: 600; }
  #${DIALOG_ID} .assistantChangeTag { margin-left: auto; padding: 0 .5em; border-radius: 1em; font-size: .75em; }
  #${DIALOG_ID} .assistantChangeField { display: grid; grid-template-columns: 5.5em minmax(0, 1fr); gap: 0 .6em; padding-left: .6em; font-size: .92em; }
  #${DIALOG_ID} .assistantChangeField > span:first-child { opacity: .6; }
  #${DIALOG_ID} .assistantChangeField del { opacity: .55; }
  #${DIALOG_ID} .assistantChangeField i { margin: 0 .35em; font-style: normal; opacity: .45; }
  #${DIALOG_ID} .assistantChangeField ins { font-weight: 600; text-decoration: none; }
  #${DIALOG_ID} .assistantChangeMore { opacity: .6; font-size: .9em; }
  #${DIALOG_ID} .assistantProposalFooter { display: flex; align-items: center; justify-content: space-between; gap: .4em; padding: .4em .7em; border-top: 1px solid rgb(0 0 0 / 8%); }
  #${DIALOG_ID} .assistantProposalActions { display: flex; gap: .4em; }
</style>`;

const mapId = (): number => AssistantMap.id();
const busy = (): boolean => abort !== null;
const el = <T extends HTMLElement = HTMLElement>(id: string): T => ensureEl<T>(id);
const states = (): BriefState[] => pack.states.filter(state => state.i && !state.removed);
const stateName = (id: number): string => (id === REFEREE ? "The referee" : (pack.states[id]?.name ?? `State ${id}`));
const date = (): string => {
  const { year, eraShort } = options.map.lore.calendar;
  return `${year} ${eraShort}`.trim();
};

function open(): void {
  if (document.getElementById(DIALOG_ID)) return void $(`#${DIALOG_ID}`).dialog("moveToTop");
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="${DIALOG_ID}" class="dialog stable">${STYLES}
      <div class="nTabs">
        ${(["turn", "setup", "history"] as View[]).map(name => `<button type="button" class="nTab" data-action="view" data-view="${name}">${capitalize(name)}</button>`).join("")}
        <span id="nationsUsage"></span>
      </div>
      <div id="nationsNotice" class="nNotice" hidden></div>
      <div id="nationsBody" class="nBody"></div>
    </div>`
  );
  const dialog = el(DIALOG_ID);
  dialog.addEventListener("click", onClick);
  dialog.addEventListener("input", onInput);
  dialog.addEventListener("change", onChange);
  $(`#${DIALOG_ID}`).dialog({
    title: "AI Nations",
    width: 620,
    height: 640,
    minWidth: 420,
    position: { my: "left top", at: "left+10 top+10", of: "svg", collision: "fit" },
    close: close
  });
  void start();
}

function close(): void {
  abort?.abort();
  destroyDialog(DIALOG_ID);
}

async function start(): Promise<void> {
  game = undefined;
  render();
  try {
    game = await Games.load(mapId(), AssistantMap.name());
    view = game.nations.length ? "turn" : "setup";
  } catch (error) {
    notice = errorText(error);
  }
  render();
  if (getConnection("anthropic").key) void discoverModels();
}

// Rendering

function render(): void {
  if (!document.getElementById(DIALOG_ID)) return;
  for (const tab of el(DIALOG_ID).querySelectorAll<HTMLElement>(".nTab"))
    tab.setAttribute("aria-pressed", String(tab.dataset.view === view));
  const noticeEl = el("nationsNotice");
  noticeEl.hidden = !notice;
  noticeEl.textContent = notice;
  const body = el("nationsBody");
  const scroll = body.scrollTop;
  if (!game) body.innerHTML = "Loading the game…";
  else body.innerHTML = view === "setup" ? setupHtml(game) : view === "history" ? historyHtml(game) : turnHtml(game);
  body.scrollTop = scroll;
  const { input = 0, output = 0, cached = 0 } = game?.usage ?? {};
  el("nationsUsage").textContent = game
    ? `Turn ${game.current.turn} · ${si(input + cached)} tokens in, ${si(output)} out`
    : "";
}

const modelOptions = (selected: string): string =>
  [...new Set([selected, ...models, ...KNOWN_MODELS])]
    .filter(Boolean)
    .map(id => `<option value="${escapeHtml(id)}" ${id === selected ? "selected" : ""}>${escapeHtml(id)}</option>`)
    .join("");

function setupHtml(game: Game): string {
  const connection = getConnection("anthropic");
  const keyLink = providerById("anthropic")?.keyLink ?? "";
  const rows = states()
    .map(state => {
      const nation = Games.nationOf(game, state.i);
      const swatch = `<span class="nSwatch" style="background:${escapeHtml(pack.states[state.i].color ?? "#ccc")}"></span>`;
      return /* html */ `<tr>
        <td><label class="nRow"><input type="checkbox" class="native" data-field="controlled" data-state="${state.i}" ${nation ? "checked" : ""} />${swatch}${escapeHtml(state.fullName || state.name)}</label></td>
        <td>${nation ? `<select data-field="model" data-state="${state.i}">${modelOptions(nation.model)}</select>` : ""}</td>
      </tr>${
        nation
          ? `<tr><td colspan="2"><textarea rows="2" data-field="persona" data-state="${state.i}" placeholder="Who rules ${escapeHtml(state.name)}? Character, goals, grudges, what they would never do.">${escapeHtml(nation.persona)}</textarea></td></tr>`
          : ""
      }`;
    })
    .join("");
  return /* html */ `
    <section>
      <h4>1. Anthropic API key</h4>
      <div class="nRow">
        <input id="nationsKey" class="nGrow" type="password" autocomplete="off" placeholder="sk-ant-…" value="${escapeHtml(connection.key)}" />
        <button type="button" data-action="save-key">Save and check</button>
        <a href="${keyLink}" target="_blank" rel="noopener">Where to get one</a>
      </div>
      <div class="nHint">The key stays in this browser and is sent only to Anthropic. The Assistant uses the same key.</div>
      <div id="nationsKeyStatus" class="nHint">${escapeHtml(keyStatus)}</div>
    </section>
    <section>
      <h4>2. Which states do AI models rule?</h4>
      <table>${rows}</table>
    </section>
    <section>
      <h4>3. Rules of the game</h4>
      <label class="nRow">Model for new nations <select data-field="defaultModel">${modelOptions(game.settings.defaultModel)}</select></label>
      <label class="nRow">Model that drafts map changes <select data-field="clerkModel">${modelOptions(connection.model)}</select></label>
      <label class="nRow">Each turn covers <input type="text" data-field="turnLength" value="${escapeHtml(game.settings.turnLength)}" /></label>
      <label class="nRow">Nations see
        <select data-field="fog">
          <option value="known" ${game.settings.fog === "known" ? "selected" : ""}>neighbors and states they have relations with</option>
          <option value="full" ${game.settings.fog === "full" ? "selected" : ""}>every state</option>
        </select>
      </label>
      <textarea rows="3" data-field="rules" placeholder="House rules every nation reads, e.g. how far an army marches in a turn, what recruiting costs.">${escapeHtml(game.settings.rules)}</textarea>
    </section>
    <section>
      <h4>Game file</h4>
      <div class="nHint">The game is kept in this browser, apart from the .map file. Export it to back it up or move it.</div>
      <div class="nRow">
        <button type="button" data-action="export">Export game</button>
        <button type="button" data-action="import">Import game</button>
        <button type="button" data-action="reset">Start over</button>
      </div>
    </section>`;
}

function turnHtml(game: Game): string {
  const turn = game.current;
  if (!game.nations.length) return `<div>No state is run by a model yet. Choose them in <b>Setup</b>.</div>`;
  const working = busy();
  const senders = [
    REFEREE,
    ...states()
      .filter(state => !Games.nationOf(game, state.i))
      .map(state => state.i)
  ];
  const option = (id: number) => `<option value="${id}">${escapeHtml(stateName(id))}</option>`;
  const queued = turn.letters
    .map(
      (letter, index) =>
        `<div class="nRow"><span class="nGrow nText"><b>${escapeHtml(stateName(letter.from))} → ${escapeHtml(stateName(letter.to))}:</b> ${escapeHtml(letter.text)}</span><button type="button" data-action="drop-letter" data-index="${index}">Remove</button></div>`
    )
    .join("");
  const collected = turn.submissions.length > 0;
  const chips = game.nations
    .map(nation => {
      const state = progress.get(nation.state);
      const done = turn.submissions.find(item => item.state === nation.state);
      const status = state ?? (done ? (done.error ? "problem" : "sent") : "not asked");
      return `<span class="nTag">${escapeHtml(stateName(nation.state))}: ${status}</span>`;
    })
    .join(" ");
  const proposals = turn.proposals.map((proposal, index) => ProposalCard.html(proposal, index, mapId())).join("");
  const clerkNotes = turn.clerkNotes.map(note => `<div class="nText nHint">${escapeHtml(note)}</div>`).join("");
  const pending = Games.pendingOrders(turn);
  return /* html */ `
    <section>
      <h4>1. Tell the world what happened</h4>
      <textarea rows="3" data-field="news" placeholder="News every nation hears this turn: events, results of battles, the weather, a plague. Optional.">${escapeHtml(turn.news)}</textarea>
      <div class="nRow">
        <select id="nationsLetterFrom">${senders.map(option).join("")}</select> writes to
        <select id="nationsLetterTo">${game.nations.map(nation => option(nation.state)).join("")}</select>
      </div>
      <div class="nRow">
        <textarea id="nationsLetterText" class="nGrow" rows="2" placeholder="A private letter, from you or from a state you play yourself."></textarea>
        <button type="button" data-action="add-letter">Add letter</button>
      </div>
      ${queued}
    </section>
    <section>
      <h4>2. Collect orders</h4>
      <div class="nRow">
        ${
          working
            ? `<button type="button" data-action="stop">Stop</button>`
            : `<button type="button" data-action="collect">${collected ? "Ask every nation again" : `Ask ${game.nations.length} nation${game.nations.length === 1 ? "" : "s"} for orders`}</button>`
        }
        ${chips}
      </div>
    </section>
    ${
      collected
        ? `<section><h4>3. Rule on what they sent</h4>${turn.submissions
            .slice()
            .sort((a, b) => a.state - b.state)
            .map(item => submissionHtml(game, item, true))
            .join("")}</section>
    <section>
      <h4>4. Put the rulings on the map</h4>
      <div class="nHint">A model drafts the changes your approved orders call for. Nothing changes until you press Apply, and you can undo it. You can also edit the map by hand instead.</div>
      <div class="nRow">
        <button type="button" data-action="draft" ${working ? "disabled" : ""}>Draft map changes</button>
        <span class="nHint">${escapeHtml(clerkStatus)}</span>
      </div>
      ${proposals}${clerkNotes}
    </section>
    <section>
      <h4>5. End the turn</h4>
      <div class="nRow">
        <button type="button" data-action="end-turn" ${working ? "disabled" : ""}>End turn ${turn.turn}</button>
        <span class="nHint">${pending ? `${pending} order${pending === 1 ? " has" : "s have"} no ruling yet.` : "Every order is ruled on."} Nations read your rulings next turn.</span>
      </div>
    </section>`
        : ""
    }`;
}

function submissionHtml(game: Game, item: Submission, editable: boolean): string {
  const state = pack.states[item.state];
  const swatch = `<span class="nSwatch" style="background:${escapeHtml(state?.color ?? "#ccc")}"></span>`;
  const tokens = `${si(item.usage.input + item.usage.cached)} in, ${si(item.usage.output)} out`;
  const retry = editable
    ? `<button type="button" data-action="ask-again" data-state="${item.state}" ${busy() ? "disabled" : ""}>Ask again</button>`
    : "";
  const orders = item.orders.map((order, index) => orderHtml(item.state, order, index, editable)).join("");
  const letters = item.letters.map((letter, index) => letterHtml(game, item.state, letter, index, editable)).join("");
  return /* html */ `<div class="nCard">
    <div class="nCardHead">${swatch}${escapeHtml(state?.fullName || stateName(item.state))}<span class="nHint">${escapeHtml(item.model)} · ${tokens} ${retry}</span></div>
    ${item.error ? `<div class="nError">${escapeHtml(item.error)}</div>` : ""}
    ${item.statement ? `<div class="nText"><b>Proclaims:</b> ${escapeHtml(item.statement)}</div>` : ""}
    ${item.assessment ? `<details><summary>Private assessment</summary><div class="nText">${escapeHtml(item.assessment)}</div></details>` : ""}
    ${orders || (item.error ? "" : `<div class="nHint">No orders this turn.</div>`)}
    ${letters}
  </div>`;
}

function orderHtml(state: number, order: Order, index: number, editable: boolean): string {
  const ruling = (value: Order["ruling"], label: string) =>
    `<button type="button" class="nRuling" data-action="rule" data-state="${state}" data-index="${index}" data-ruling="${value}" aria-pressed="${order.ruling === value}">${label}</button>`;
  const verdict = editable
    ? `<div class="nRow">${ruling("approved", "Approve")}${ruling("rejected", "Reject")}
        <textarea class="nGrow" rows="1" data-field="outcome" data-state="${state}" data-index="${index}" placeholder="What actually happens, if not exactly as ordered. The nation reads this.">${escapeHtml(order.outcome)}</textarea></div>`
    : `<div class="nHint">${capitalize(order.ruling)}${order.outcome ? `: ${escapeHtml(order.outcome)}` : ""}</div>`;
  return /* html */ `<div class="nOrder ${order.ruling}">
    <div class="nRow"><span class="nTag">${order.category}</span><b>${escapeHtml(order.title)}</b></div>
    <div class="nText">${escapeHtml(order.text)}</div>
    ${verdict}
  </div>`;
}

function letterHtml(game: Game, state: number, letter: Letter, index: number, editable: boolean): string {
  const played = Games.nationOf(game, letter.to) ? "" : ` <span class="nHint">(no model rules them: you answer)</span>`;
  const hold = editable
    ? `<label class="nRow"><input type="checkbox" class="native" data-field="delivered" data-state="${state}" data-index="${index}" ${letter.delivered ? "checked" : ""} />Deliver</label>`
    : `<span class="nHint">${letter.delivered ? "delivered" : "held back"}</span>`;
  return /* html */ `<div class="nOrder">
    <div class="nRow"><span class="nTag">letter</span><b>To ${escapeHtml(stateName(letter.to))}</b>${played}<span style="margin-left:auto">${hold}</span></div>
    <div class="nText">${escapeHtml(letter.text)}</div>
  </div>`;
}

function historyHtml(game: Game): string {
  if (!game.history.length) return `<div>No turn has ended yet.</div>`;
  return game.history
    .slice()
    .reverse()
    .map(
      turn => /* html */ `<details class="nCard">
        <summary><b>Turn ${turn.turn}</b> · ${escapeHtml(turn.date)} · ${turn.submissions.length} nations</summary>
        ${turn.news ? `<div class="nText"><b>News:</b> ${escapeHtml(turn.news)}</div>` : ""}
        ${turn.letters.map(letter => `<div class="nText"><b>${escapeHtml(stateName(letter.from))} → ${escapeHtml(stateName(letter.to))}:</b> ${escapeHtml(letter.text)}</div>`).join("")}
        ${turn.submissions.map(item => submissionHtml(game, item, false)).join("")}
        ${turn.proposals.map(proposal => `<div class="nHint">Map change ${proposal.state}: ${escapeHtml(proposal.summary)}</div>`).join("")}
      </details>`
    )
    .join("");
}

// Events

function onClick(event: MouseEvent): void {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
  const active = game;
  if (!target || !active) return;
  const { action = "", ruling, view: nextView } = target.dataset;
  const index = Number(target.dataset.index);
  const state = Number(target.dataset.state);
  notice = "";
  const handlers: Record<string, () => unknown> = {
    view: () => {
      view = nextView as View;
      render();
    },
    "save-key": saveKey,
    export: () => exportGame(active),
    import: importGame,
    reset: resetGame,
    "add-letter": () => addLetter(active),
    "drop-letter": () => {
      active.current.letters.splice(index, 1);
      changed();
    },
    collect: () => collect(active.nations.map(nation => nation.state)),
    "ask-again": () => collect([state]),
    stop: () => abort?.abort(),
    rule: () => rule(active, state, index, ruling as Order["ruling"]),
    draft: () => draft(active),
    "end-turn": () => endTurn(active),
    apply: () => decide(active, "apply", index),
    undo: () => decide(active, "undo", index),
    redo: () => decide(active, "redo", index),
    discard: () => decide(active, "discard", index)
  };
  void handlers[action]?.();
}

/** Typing saves without redrawing, so the caret stays where it is */
function onInput(event: Event): void {
  const input = event.target as HTMLTextAreaElement | HTMLInputElement;
  const { field, state, index } = input.dataset;
  if (!game || !field || input.type === "checkbox" || input.tagName === "SELECT") return;
  const nation = Games.nationOf(game, Number(state));
  if (field === "news") game.current.news = input.value;
  else if (field === "rules") game.settings.rules = input.value;
  else if (field === "turnLength") game.settings.turnLength = input.value;
  else if (field === "persona" && nation) nation.persona = input.value;
  else if (field === "outcome") {
    const order = game.current.submissions.find(item => item.state === Number(state))?.orders[Number(index)];
    if (order) order.outcome = input.value;
  } else return;
  Games.save();
}

function onChange(event: Event): void {
  const input = event.target as HTMLInputElement | HTMLSelectElement;
  const { field, state, index } = input.dataset;
  if (!game || !field) return;
  const nation = Games.nationOf(game, Number(state));
  if (field === "controlled") Games.setControlled(game, Number(state), (input as HTMLInputElement).checked);
  else if (field === "model" && nation) nation.model = input.value;
  else if (field === "defaultModel") game.settings.defaultModel = input.value;
  else if (field === "fog") game.settings.fog = input.value === "full" ? "full" : "known";
  else if (field === "clerkModel") saveConnection({ ...getConnection("anthropic"), model: input.value });
  else if (field === "delivered") {
    const letter = game.current.submissions.find(item => item.state === Number(state))?.letters[Number(index)];
    if (letter) letter.delivered = (input as HTMLInputElement).checked;
  } else return;
  Games.save();
  if (field === "controlled") render();
}

function changed(): void {
  Games.save();
  render();
}

// Setup

async function saveKey(): Promise<void> {
  const key = el<HTMLInputElement>("nationsKey").value.trim();
  const connection = getConnection("anthropic");
  saveConnection({ ...connection, key });
  await discoverModels();
}

async function discoverModels(): Promise<void> {
  const { key } = getConnection("anthropic");
  if (!key) {
    keyStatus = "Enter a key first.";
    return render();
  }
  keyStatus = "Checking the key…";
  if (view === "setup") render();
  try {
    models = await listModels("anthropic", key);
    keyStatus = `The key works: ${models.length} models available.`;
  } catch (error) {
    keyStatus = `Anthropic rejected the key: ${errorText(error)}`;
  }
  if (view === "setup") render();
}

function exportGame(game: Game): void {
  const name = `ai-nations-${game.mapName || "map"}-turn-${game.current.turn}.json`.replace(/[^\w.-]+/g, "-");
  downloadFile(JSON.stringify(game, null, 1), name, "application/json");
}

function importGame(): void {
  const input = createFileInput(".json");
  input.onchange = () =>
    uploadFile(input, data => {
      input.remove();
      let parsed: Game | string;
      try {
        parsed = Games.parse(JSON.parse(data));
      } catch {
        parsed = "The file is not valid JSON";
      }
      if (typeof parsed === "string") {
        notice = parsed;
        return render();
      }
      const imported = parsed;
      const adopt = () => {
        imported.mapId = mapId();
        imported.mapName = AssistantMap.name();
        game = imported;
        view = "turn";
        void Games.replace(imported).then(render);
      };
      if (imported.mapId === mapId()) return adopt();
      confirmationDialog({
        title: "Import game",
        message: `This game was played on another map (${escapeHtml(imported.mapName || "unnamed")}). Use it on the open map anyway?`,
        confirm: "Import",
        onConfirm: adopt
      });
    });
  input.click();
}

function resetGame(): void {
  confirmationDialog({
    title: "Start over",
    message: "Forget this map's game: its nations, turns and history? <br>Export it first to keep a copy",
    confirm: "Start over",
    onConfirm: () => {
      game = Games.create(mapId(), AssistantMap.name());
      void Games.replace(game).then(render);
    }
  });
}

// Turn

function addLetter(game: Game): void {
  const text = el<HTMLTextAreaElement>("nationsLetterText").value.trim();
  const from = Number(el<HTMLSelectElement>("nationsLetterFrom").value);
  const to = Number(el<HTMLSelectElement>("nationsLetterTo").value);
  if (!text || !to) return;
  game.current.letters.push({ from, to, text, delivered: true });
  changed();
}

function world(): World {
  const { year, eraShort, era } = options.map.lore.calendar;
  return {
    states: pack.states,
    burgs: pack.burgs,
    provinces: pack.provinces,
    cultures: pack.cultures,
    chronicle: (pack.states[0]?.diplomacy ?? []) as unknown as string[][],
    year,
    era: eraShort || era,
    stateAt: (x, y) => {
      const cell = Pack.findCell(x, y);
      return cell === undefined ? undefined : pack.cells.state[cell];
    },
    people: getPeople,
    area: raw => `${si(getArea(raw))} ${getAreaUnit()}`,
    money: formatPrice
  };
}

async function collect(stateIds: number[]): Promise<void> {
  const active = game;
  if (!active || busy()) return;
  const connection = getConnection("anthropic");
  if (!connection.key) {
    notice = "Add your Anthropic API key in Setup first.";
    view = "setup";
    return render();
  }
  const request = new AbortController();
  abort = request;
  const queue = active.nations.filter(nation => stateIds.includes(nation.state) && pack.states[nation.state]?.i);
  for (const nation of queue) progress.set(nation.state, "waiting");
  render();
  const recipients = new Set(states().map(state => state.i));
  const snapshot = world();
  const next = async (): Promise<void> => {
    const nation = queue.shift();
    if (!nation || request.signal.aborted) return;
    progress.set(nation.state, "thinking");
    render();
    const result = await playTurn(nation, buildBriefing(active, nation.state, snapshot), {
      connection,
      recipients,
      signal: request.signal
    });
    if (!request.signal.aborted) Games.record(active, result.submission, result.notes);
    progress.delete(nation.state);
    Games.save();
    if (game === active) render();
    return next();
  };
  try {
    await Promise.all(Array.from({ length: PARALLEL_TURNS }, next));
  } finally {
    progress.clear();
    abort = null;
    Games.save();
    if (game === active) render();
  }
}

function rule(game: Game, state: number, index: number, ruling: Order["ruling"]): void {
  const order = game.current.submissions.find(item => item.state === state)?.orders[index];
  if (!order) return;
  order.ruling = order.ruling === ruling ? "pending" : ruling;
  changed();
}

/** The Assistant's own machinery turns the rulings into a proposal: it reads the map and never changes it */
async function draft(game: Game): Promise<void> {
  if (busy()) return;
  const turn = game.current;
  const brief = clerkBrief(turn, stateName);
  if (!brief) {
    notice = "Approve at least one order first.";
    return render();
  }
  if (!getConnection().key && getConnection().provider !== "local") {
    notice = "Add your Anthropic API key in Setup first.";
    return render();
  }
  const request = new AbortController();
  abort = request;
  const chat = clerkChat();
  const onItem = (item: TranscriptItem) => {
    chat.items.push(item);
    if (item.kind === "proposal") turn.proposals.push(item.proposal);
    if (item.kind === "answer" || item.kind === "notice") turn.clerkNotes.push(item.text);
    Games.save();
    render();
  };
  clerkStatus = "Reading the map…";
  render();
  try {
    await askProvider(chat, brief, onItem, request.signal, {
      tools: AssistantMap.tools(chat),
      context: () => AssistantMap.context(chat),
      onStatus: status => {
        clerkStatus = `${status}…`;
        render();
      }
    });
  } catch (error) {
    if (!request.signal.aborted) notice = errorText(error);
  } finally {
    Games.addUsage(game, chat.usage);
    clerkStatus = "";
    abort = null;
    Games.save();
    render();
  }
}

const clerkChat = (): Chat => ({
  id: "nations-clerk",
  title: "AI Nations clerk",
  updated: Date.now(),
  tier: "key",
  mapId: mapId(),
  mapName: AssistantMap.name(),
  items: [],
  messages: [],
  usage: { input: 0, output: 0, cached: 0 }
});

function decide(game: Game, action: Action | "discard", index: number): void {
  const proposal = game.current.proposals[index];
  if (!proposal) return;
  try {
    if (action === "discard") Proposals.discard(proposal);
    else if (!Proposals.run(action, proposal, mapId()))
      notice = `The map changed since; ${capitalize(action)} is unavailable.`;
  } catch (error) {
    notice = errorText(error);
  }
  changed();
}

function endTurn(game: Game): void {
  const finish = () => {
    Games.endTurn(game, date());
    clerkStatus = "";
    changed();
  };
  const turn: TurnRecord = game.current;
  const waiting = turn.proposals.filter(proposal => proposal.state === "proposed").length;
  const pending = Games.pendingOrders(turn);
  if (!pending && !waiting) {
    finish();
    return;
  }
  const warnings = [
    pending
      ? `${pending} order${pending === 1 ? " has" : "s have"} no ruling and will be reported as not happening.`
      : "",
    waiting
      ? `${waiting} drafted map change${waiting === 1 ? " is" : "s are"} not applied and will be left behind.`
      : ""
  ];
  confirmationDialog({
    title: `End turn ${turn.turn}`,
    message: warnings.filter(Boolean).join("<br>"),
    confirm: "End turn",
    onConfirm: finish
  });
}

window.addEventListener("map:generated", () => {
  if (document.getElementById(DIALOG_ID)) void start();
});

export const Nations = { open };
