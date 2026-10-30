// The Living World HUD: a seasonal clock, a live news ticker and a god-mode inspector.
// See docs/plans/living-world.md (slice 5)
import { select } from "d3";
import { currentContent } from "@/conquest/content/store";
import { Controllers } from "@/controllers";
import { ALIGNMENT_COLORS } from "@/data/culture-traits";
import { getLairDef, isLairStateCapable } from "@/data/living-lairs";
import { getTroubleDef, isTroubleStatePromotable, SAVE_KIND_LABELS, UNIT_ROLE_LABELS } from "@/data/living-troubles";
import { Pack } from "@/model/graph/pack-generator";
import { Living } from "@/model/physical/living-generator";
import { getCellPoint } from "@/model/story/journeys/journey-places";
import { drawLivingOverlay, removeLivingOverlay } from "@/renderers/draw-living-overlay";
import { Layers } from "@/renderers/layers";
import type { HistoricalFigure } from "@/types/history";
import { type LivingNewsItem, type ProvinceSimState, SEASON_NAMES, type StatePolitySim } from "@/types/living";
import { zoomTo } from "@/ui/map/zoom";
import { escapeHtml, findEl, getPointer } from "@/utils";

const HUD_ID = "livingWorldHud";
const INSPECTOR_ID = "livingInspector";
const MAX_NEWS = 8;

const TEMPLATE = /* html */ `
  <style>
    #${HUD_ID} {
      position: fixed;
      left: 50%;
      bottom: 8px;
      transform: translateX(-50%);
      z-index: 60;
      width: min(780px, calc(100vw - 20px));
      border: 1px solid #5e4fa2;
      border-radius: 4px;
      background: var(--bg-light, #f7f7f7);
      font-family: var(--monospace);
      font-size: 0.85em;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      user-select: none;
    }
    #${HUD_ID} .livingHudTop { display: flex; align-items: center; gap: 0.3em; padding: 0.3em 0.4em 0; }
    #${HUD_ID} .livingHudDrag { cursor: move; padding: 0 0.35em; opacity: 0.55; }
    #${HUD_ID} button {
      font-family: var(--monospace);
      font-size: 1em;
      padding: 0.15em 0.5em;
      cursor: pointer;
    }
    #${HUD_ID} button.pressed { background: var(--header, #5e4fa2); color: #fff; }
    #${HUD_ID} #livingHudDate { margin-left: auto; font-weight: bold; }
    #${HUD_ID} .livingHudWallet { color: #6a4c93; font-weight: bold; }
    #${HUD_ID} #livingHudClose { padding: 0 0.45em; }
    #${HUD_ID} .livingHudNews {
      display: flex;
      flex-direction: column;
      gap: 0.05em;
      max-height: 6.4em;
      overflow-y: auto;
      padding: 0.25em 0.45em;
    }
    #${HUD_ID} .livingNewsItem {
      display: block;
      width: 100%;
      text-align: left;
      border: none;
      background: transparent;
      padding: 0.1em 0.2em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #${HUD_ID} .livingNewsItem:hover { background: rgba(94, 79, 162, 0.12); }
    #${HUD_ID} .livingNewsDate { font-weight: bold; color: #5e4fa2; }
    #${HUD_ID} .livingNewsEmpty,
    #${HUD_ID} .livingHudStatus { color: #666; font-style: italic; padding: 0 0.45em 0.25em; }
    #${INSPECTOR_ID} {
      position: fixed;
      right: 10px;
      top: 60px;
      z-index: 60;
      width: 21em;
      max-height: calc(100vh - 190px);
      overflow-y: auto;
      border: 1px solid #5e4fa2;
      border-radius: 4px;
      background: var(--bg-light, #f7f7f7);
      font-family: var(--monospace);
      font-size: 0.82em;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      padding: 0.4em 0.55em;
    }
    #${INSPECTOR_ID} .livingInspectorTitle { font-weight: bold; font-size: 1.15em; margin-bottom: 0.25em; }
    #${INSPECTOR_ID} .livingSection { border-top: 1px solid rgba(0, 0, 0, 0.12); padding: 0.3em 0; }
    #${INSPECTOR_ID} .livingSectionTitle { font-weight: bold; margin-bottom: 0.15em; }
    #${INSPECTOR_ID} .livingMuted { color: #777; font-style: italic; }
    #${INSPECTOR_ID} .livingBar { height: 0.4em; background: rgba(0, 0, 0, 0.12); border-radius: 2px; overflow: hidden; }
    #${INSPECTOR_ID} .livingBar > i { display: block; height: 100%; background: #5e4fa2; }
    #${INSPECTOR_ID} .livingBar.danger > i { background: #a33d3d; }
    #${INSPECTOR_ID} .livingPool { display: grid; grid-template-columns: 3.4em 1fr auto; gap: 0.2em 0.35em; align-items: center; }
    #${INSPECTOR_ID} .livingPool.over { color: #a33d3d; }
    #${INSPECTOR_ID} .livingPool .livingBar { grid-column: 2 / 4; }
    #${INSPECTOR_ID} .livingRuler { display: flex; gap: 0.4em; align-items: baseline; flex-wrap: wrap; }
    #${INSPECTOR_ID} .livingAge { color: #666; }
    #${INSPECTOR_ID} .livingBadge { border-radius: 2px; padding: 0 0.25em; color: #fff; }
    #${INSPECTOR_ID} .livingTraits { color: #444; }
    #${INSPECTOR_ID} ul { margin: 0.15em 0 0; padding-left: 1.1em; }
    #${INSPECTOR_ID} li { margin-bottom: 0.1em; }
    #${INSPECTOR_ID} .livingButtons { display: flex; flex-wrap: wrap; gap: 0.25em; margin-top: 0.3em; }
    #${INSPECTOR_ID} .livingButtons button { font-size: 1em; padding: 0.12em 0.4em; cursor: pointer; }
    #${INSPECTOR_ID} .livingGodTitle { color: #a33d3d; font-weight: bold; margin: 0.3em 0 0.1em; }
    #${INSPECTOR_ID} .livingPlaceholder { color: #666; font-style: italic; padding: 0.5em 0; }
  </style>
  <div id="${HUD_ID}">
    <div class="livingHudTop">
      <span class="livingHudDrag" title="Drag to move">â˜°</span>
      <button id="livingHudPause" type="button">Pause</button>
      <button id="livingHudStepSeason" type="button">Step +1 Season</button>
      <button id="livingHudStepYear" type="button">Step +1 Year</button>
      <button id="livingHudPlay" type="button">Play 1Ã—</button>
      <button id="livingHudPlay4" type="button">Play 4Ã—</button>
      <button id="livingHudDate" type="button"></button>
      <span id="livingHudWallet" class="livingHudWallet" title="Guild gold and renown"></span>
      <button id="livingHudClose" type="button" title="Close Living World">Ã—</button>
    </div>
    <div id="livingHudStatus" class="livingHudStatus"></div>
    <div id="livingHudNews" class="livingHudNews"></div>
  </div>
`;

type Selection = { kind: "state"; id: number } | { kind: "burg"; id: number };

let playing = 0;
let timer: number | null = null;
let selected: Selection | null = null;
let dragOrigin: { x: number; y: number; left: number; top: number } | null = null;

function open(): void {
  if (findEl(HUD_ID)) {
    refresh();
    drawLivingOverlay();
    bindOverlayClicks();
    return;
  }

  Living.getState();
  document.body.insertAdjacentHTML("beforeend", TEMPLATE);
  if (!findEl(INSPECTOR_ID)) {
    document.body.insertAdjacentHTML("beforeend", `<aside id="${INSPECTOR_ID}"></aside>`);
  }

  bindControls();
  attachMapSelection();
  refresh();
  drawLivingOverlay();
  bindOverlayClicks();
}

function close(): void {
  pause();
  selected = null;
  findEl(HUD_ID)?.remove();
  findEl(INSPECTOR_ID)?.remove();
  removeLivingOverlay();
  window.removeEventListener("pointermove", moveDrag);
  window.removeEventListener("pointerup", endDrag);
  select<SVGElement, unknown>("#viewbox").on("click.livingHud", null).style("cursor", null);
}

function toggle(): void {
  if (findEl(HUD_ID)) close();
  else open();
}

function refresh(): void {
  if (!findEl(HUD_ID)) return;

  const living = Living.getState();
  const date = findEl("livingHudDate");
  if (date) date.textContent = Living.formatSeasonDate(living);

  renderControls();
  renderWallet();
  renderNews(living.recentNews ?? []);
  validateSelection();
  renderInspector();
}

function bindControls(): void {
  findEl("livingHudPause")?.addEventListener("click", pause);
  findEl("livingHudStepSeason")?.addEventListener("click", () => step(1));
  findEl("livingHudStepYear")?.addEventListener("click", () => step(4));
  findEl("livingHudPlay")?.addEventListener("click", () => play(1));
  findEl("livingHudPlay4")?.addEventListener("click", () => play(4));
  findEl("livingHudDate")?.addEventListener("click", () => void Controllers.LegendsOverview.open());
  findEl("livingHudClose")?.addEventListener("click", close);

  const drag = document.querySelector<HTMLElement>(`#${HUD_ID} .livingHudDrag`);
  drag?.addEventListener("pointerdown", startDrag);
  window.addEventListener("pointermove", moveDrag);
  window.addEventListener("pointerup", endDrag);
}

function startDrag(event: PointerEvent): void {
  const hud = findEl(HUD_ID);
  if (!hud) return;

  const rect = hud.getBoundingClientRect();
  dragOrigin = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
  event.preventDefault();
}

function moveDrag(event: PointerEvent): void {
  if (!dragOrigin) return;
  const hud = findEl(HUD_ID);
  if (!hud) return;

  hud.style.left = `${dragOrigin.left + event.clientX - dragOrigin.x}px`;
  hud.style.top = `${dragOrigin.top + event.clientY - dragOrigin.y}px`;
  hud.style.bottom = "auto";
  hud.style.transform = "none";
}

function endDrag(): void {
  dragOrigin = null;
}

function step(seasons: number): void {
  pause();
  Living.tick(seasons);
  afterTick();
}

function play(speed: number): void {
  stopTimer();
  playing = speed;
  timer = window.setInterval(
    () => {
      Living.tick(1);
      afterTick();
    },
    speed === 4 ? 350 : 1400
  );
  renderControls();
}

function pause(): void {
  stopTimer();
  playing = 0;
  renderControls();
}

function stopTimer(): void {
  if (timer === null) return;
  window.clearInterval(timer);
  timer = null;
}

function afterTick(): void {
  Living.syncWorld();
  redrawMap();
  refresh();
  drawLivingOverlay();
}

function redrawMap(): void {
  Layers.draw("states", "borders", "provinces", "labels", "burgIcons", "military", "markers");
}

function renderControls(): void {
  findEl("livingHudPause")?.classList.toggle("pressed", playing === 0);
  findEl("livingHudPlay")?.classList.toggle("pressed", playing === 1);
  findEl("livingHudPlay4")?.classList.toggle("pressed", playing === 4);
}

function renderWallet(): void {
  const wallet = findEl("livingHudWallet");
  if (!wallet) return;

  const guild = Living.getGuild?.();
  wallet.textContent = guild ? `⚜ ${guild.gold}g · ${guild.renown}r` : "";
  wallet.title = guild ? `Guild Tier ${guild.tier} — Gold ${guild.gold}, Renown ${guild.renown}` : "";
}

function renderNews(news: LivingNewsItem[]): void {
  const wrap = findEl("livingHudNews");
  if (!wrap) return;

  const items = news.slice(0, MAX_NEWS);
  if (items.length === 0) {
    wrap.innerHTML = `<span class="livingNewsEmpty">No dispatches yet â€” step a season.</span>`;
    return;
  }

  wrap.innerHTML = items
    .map(item => {
      const date = `${item.year} ${SEASON_NAMES[item.season] ?? ""}`.trim();
      const attrs = [
        item.cell !== undefined ? `data-cell="${item.cell}"` : "",
        item.stateId ? `data-state="${item.stateId}"` : "",
        item.burgId ? `data-burg="${item.burgId}"` : ""
      ]
        .filter(Boolean)
        .join(" ");
      return `<button type="button" class="livingNewsItem" ${attrs}><span class="livingNewsDate">[${date}]</span> ${escapeHtml(item.text)}</button>`;
    })
    .join("");

  for (const button of wrap.querySelectorAll<HTMLElement>("button.livingNewsItem")) {
    button.addEventListener("click", focusNews);
  }
}

function focusNews(this: HTMLElement): void {
  const burgId = Number(this.dataset.burg ?? 0);
  const stateId = Number(this.dataset.state ?? 0);
  if (burgId && pack.burgs[burgId] && !pack.burgs[burgId].removed) selectBurg(burgId);
  else if (stateId && pack.states[stateId] && !pack.states[stateId].removed) selectState(stateId);

  const cell = Number(this.dataset.cell ?? Number.NaN);
  if (!Number.isFinite(cell)) return;
  const point = getCellPoint(cell);
  if (point) zoomTo(point[0], point[1], 8, 800);
}

function attachMapSelection(): void {
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click.livingHud", onMapClick);
}

function onMapClick(this: SVGElement, event: MouseEvent): void {
  const [x, y] = getPointer(event, this);
  const cell = Pack.findCell(x, y);
  if (cell === undefined) return;

  const burgId = pack.cells.burg?.[cell] ?? 0;
  if (burgId && pack.burgs[burgId] && !pack.burgs[burgId].removed) {
    selectBurg(burgId);
    return;
  }

  const stateId = pack.cells.state?.[cell] ?? 0;
  if (stateId && pack.states[stateId] && !pack.states[stateId].removed) selectState(stateId);
}

function bindOverlayClicks(): void {
  const overlay = document.getElementById("livingOverlay");
  if (!overlay || overlay.getAttribute("data-bound") === "1") return;
  overlay.setAttribute("data-bound", "1");
  overlay.addEventListener("click", onOverlayClick);
}

function onOverlayClick(event: Event): void {
  const target = event.target as Element | null;
  const popupElement = target?.closest?.(".livingPopup") as HTMLElement | null;
  if (!popupElement) return;

  event.stopPropagation();
  event.preventDefault();
  const id = Number(popupElement.getAttribute("data-popup-id") ?? 0);
  if (!id) return;

  const claimed = Living.claimPopup(id);
  drawLivingOverlay();
  refresh();
  if (claimed) {
    setStatus(`Bounty claimed: ${claimed.title} (+${claimed.rewardGold}g, +${claimed.rewardRenown} renown).`);
  }
}

function selectState(stateId: number): void {
  selected = { kind: "state", id: stateId };
  renderInspector();
}

function selectBurg(burgId: number): void {
  selected = { kind: "burg", id: burgId };
  renderInspector();
}

function validateSelection(): void {
  if (!selected) return;
  const current = selected;
  const alive =
    current.kind === "state"
      ? Boolean(pack.states[current.id] && !pack.states[current.id].removed)
      : Boolean(pack.burgs[current.id] && !pack.burgs[current.id].removed);
  if (!alive) selected = null;
}

function renderInspector(): void {
  const panel = findEl(INSPECTOR_ID);
  if (!panel) return;

  if (!selected) {
    panel.innerHTML = `<div class="livingPlaceholder">Click a state or burg on the map to inspect it.</div>`;
    return;
  }

  panel.innerHTML = selected.kind === "state" ? renderStateCard(selected.id) : renderBurgCard(selected.id);
  bindInspectorButtons(panel);
}

function renderStateCard(stateId: number): string {
  const living = Living.getState();
  const state = pack.states[stateId];
  const sSim = living.states[stateId];
  if (!state?.i || state.removed || !sSim) return `<div class="livingPlaceholder">This state is gone.</div>`;

  const year = options.map?.lore?.calendar?.year ?? 1000;
  const ruler = pack.history?.figures?.find(figure => figure.i === sSim.rulerId);
  const age = ruler ? Math.max(0, year - ruler.birth) : undefined;
  const hasTroubled = (pack.provinces ?? []).some(
    p => p?.i && !p.removed && p.state === stateId && living.provinces?.[p.i]?.trouble
  );
  const hasPromotableTrouble = (pack.provinces ?? []).some(p => {
    const t = p?.i && !p.removed && p.state === stateId ? living.provinces?.[p.i]?.trouble : undefined;
    return Boolean(t && isTroubleStatePromotable(t.id));
  });
  const hasLairs = (pack.provinces ?? []).some(
    p => p?.i && !p.removed && p.state === stateId && living.provinces?.[p.i]?.lair
  );
  const hasAscendableLair = (pack.provinces ?? []).some(p => {
    const l = p?.i && !p.removed && p.state === stateId ? living.provinces?.[p.i]?.lair : undefined;
    return Boolean(l && isLairStateCapable(l.id));
  });
  const canSpawnStateLair = (pack.provinces ?? []).some(
    p => p?.i && !p.removed && p.state === stateId && !living.provinces?.[p.i]?.lair
  );

  return /* html */ `
    <div class="livingInspectorTitle">${escapeHtml(state.fullName ?? state.name ?? "State")}</div>
    ${renderRuler(ruler, age)}
    ${renderCapacity(sSim)}
    ${renderAgenda(sSim)}
    <div class="livingSection">
      <div class="livingSectionTitle">Stability</div>
      ${renderMeter("Unravel", sSim.unravel, true)}
      ${renderMeter("War exhaustion", sSim.warExhaustion, false)}
    </div>
    <div class="livingSection">
      <div class="livingSectionTitle">Claims & grudges</div>
      ${renderClaims(sSim)}
      ${renderGrudges(sSim)}
      ${renderRestiveBurgs(stateId)}
      ${renderProvincesTroubles(stateId)}
      ${renderProvincesLairs(stateId)}
    </div>
    <div class="livingButtons">
      <button type="button" data-open="state" data-id="${stateId}">States Editor</button>
      <button type="button" data-open="regiments" data-id="${stateId}">Regiments</button>
    </div>
    <div class="livingGodTitle">God Mode</div>
    <div class="livingButtons">
      <button type="button" data-god="spark" data-state="${stateId}">Spark Rebellion</button>
      <button type="button" data-god="smite" data-state="${stateId}">Smite Ruler</button>
      <button type="button" data-god="war" data-state="${stateId}">Force War</button>
      ${hasTroubled ? `<button type="button" data-god="resolve-state-trouble" data-state="${stateId}">Resolve Trouble</button>` : ""}
      ${hasPromotableTrouble ? `<button type="button" data-god="promote-state-trouble" data-state="${stateId}">Promote to State</button>` : ""}
      ${hasLairs ? `<button type="button" data-god="assault-state-lair" data-state="${stateId}">Assault Lair</button>` : ""}
      ${hasLairs ? `<button type="button" data-god="delve-state-lair" data-state="${stateId}">Send Adventurers</button>` : ""}
      ${hasAscendableLair ? `<button type="button" data-god="ascend-state-lair" data-state="${stateId}">Ascend Lair</button>` : ""}
      ${hasLairs ? `<button type="button" data-god="smite-state-lair" data-state="${stateId}">Smite Lair</button>` : ""}
      ${canSpawnStateLair ? `<button type="button" data-god="spawn-state-lair" data-state="${stateId}">Spawn Lair</button>` : ""}
    </div>`;
}

function renderRuler(ruler: HistoricalFigure | undefined, age: number | undefined): string {
  if (!ruler)
    return `<div class="livingSection"><div class="livingSectionTitle">Ruler</div><span class="livingMuted">No ruler</span></div>`;

  const culture = pack.cultures?.[ruler.culture]?.name;
  const alignment = ruler.alignment
    ? `<span class="livingBadge" style="background:${ALIGNMENT_COLORS[ruler.alignment]}">${ruler.alignment}</span>`
    : "";
  const virtues = (ruler.virtues ?? []).map(escapeHtml).join(", ");
  const vices = (ruler.vices ?? []).map(escapeHtml).join(", ");
  const traits = [virtues, vices].filter(Boolean).join(" Â· ");

  return /* html */ `
    <div class="livingSection">
      <div class="livingSectionTitle">Ruler</div>
      <div class="livingRuler">
        <span>${escapeHtml(ruler.name)}</span>
        ${age !== undefined ? `<span class="livingAge">age ${age}</span>` : ""}
        ${alignment}
      </div>
      ${culture ? `<div class="livingMuted">${escapeHtml(culture)}</div>` : ""}
      ${traits ? `<div class="livingTraits">${traits}</div>` : ""}
    </div>`;
}

function renderCapacity(sSim: StatePolitySim): string {
  const pools = [
    ["m", "Military"],
    ["w", "Wealth"],
    ["s", "Stability"],
    ["c", "Culture"]
  ] as const;

  const rows = pools
    .map(([key, label]) => {
      const pool = sSim.capacity[key];
      const over = pool.load > pool.gen;
      const ratio = pool.gen > 0 ? Math.min(100, Math.round((pool.load / pool.gen) * 100)) : 0;
      return `<div class="livingPool${over ? " over" : ""}">
        <span>${label}</span>
        <span>${pool.gen} / ${pool.load}</span>
        <span>${over ? "over" : ""}</span>
        <div class="livingBar${over ? " danger" : ""}"><i style="width:${ratio}%"></i></div>
      </div>`;
    })
    .join("");

  return `<div class="livingSection"><div class="livingSectionTitle">Capacity (gen / load)</div>${rows}</div>`;
}

function renderAgenda(sSim: StatePolitySim): string {
  const agenda = sSim.agenda;
  if (!agenda)
    return `<div class="livingSection"><div class="livingSectionTitle">Agenda</div><span class="livingMuted">No active agenda</span></div>`;

  const ratio = agenda.required > 0 ? Math.min(100, Math.round((agenda.progress / agenda.required) * 100)) : 0;
  return /* html */ `
    <div class="livingSection">
      <div class="livingSectionTitle">Agenda</div>
      <div>${escapeHtml(agenda.label)} <span class="livingMuted">${agenda.progress} / ${agenda.required}</span></div>
      <div class="livingBar"><i style="width:${ratio}%"></i></div>
    </div>`;
}

function renderMeter(label: string, value: number, danger: boolean): string {
  const width = Math.max(0, Math.min(100, Math.round(value)));
  return `<div class="livingPool"><span>${label}</span><span>${width}%</span><span></span>
    <div class="livingBar${danger ? " danger" : ""}"><i style="width:${width}%"></i></div></div>`;
}

function renderClaims(sSim: StatePolitySim): string {
  const claims = sSim.claims
    .map(claim => {
      const burg = pack.burgs[claim.burgId];
      if (!burg?.i || burg.removed) return "";
      const holder = pack.states[claim.heldByStateId];
      return `<li>${escapeHtml(burg.name ?? "Burg")} â€” held by ${escapeHtml(holder?.name ?? "no one")} since ${claim.lostYear}</li>`;
    })
    .filter(Boolean);

  return claims.length > 0
    ? `<div class="livingMuted">Casus belli</div><ul>${claims.join("")}</ul>`
    : `<div class="livingMuted">No outstanding claims</div>`;
}

function renderGrudges(sSim: StatePolitySim): string {
  if (sSim.grudges.length === 0) return "";

  const rows = sSim.grudges
    .slice(-4)
    .map(grudge => `<li>${escapeHtml(grudge.summary)} <span class="livingMuted">(${grudge.weight})</span></li>`)
    .join("");
  return `<div class="livingMuted">Grudges</div><ul>${rows}</ul>`;
}

function renderRestiveBurgs(stateId: number): string {
  const living = Living.getState();
  const restive = Object.values(living.burgs)
    .map(bSim => ({ bSim, burg: pack.burgs[bSim.burgId] }))
    .filter(({ bSim, burg }) => burg?.state === stateId && !burg.removed && bSim.unrest > 0);

  if (restive.length === 0) return `<div class="livingMuted">No restive burgs</div>`;

  const rows = restive
    .map(({ bSim, burg }) => `<li>${escapeHtml(burg.name ?? "Burg")} â€” unrest ${Math.round(bSim.unrest)}</li>`)
    .join("");
  return `<div class="livingMuted">Restive burgs</div><ul>${rows}</ul>`;
}

function renderProvincesTroubles(stateId: number): string {
  const living = Living.getState();
  const ownedProvinces = (pack.provinces ?? []).filter(p => p?.i && !p.removed && p.state === stateId);
  const troubled = ownedProvinces
    .map(p => ({ province: p, pSim: living.provinces?.[p.i] }))
    .filter((entry): entry is { province: (typeof pack.provinces)[number]; pSim: ProvinceSimState } =>
      Boolean(entry.pSim?.trouble)
    );

  if (troubled.length === 0) return `<div class="livingMuted">No provincial troubles</div>`;

  const rows = troubled
    .map(({ province, pSim }) => {
      const t = pSim.trouble!;
      const def = getTroubleDef(t.id);
      const badge = isTroubleStatePromotable(t.id)
        ? ` Â· <span class="livingBadge" style="background:#8b2635" title="Can promote to sovereign state">${escapeHtml(def.stateForm ?? "State-Capable")}</span>`
        : "";
      return `<li>${escapeHtml(province.name ?? "Province")} â€” <strong>${escapeHtml(def.name)}</strong> (Lv ${t.level}, ${t.theme}, Save: ${SAVE_KIND_LABELS[def.save]}, Unit: ${UNIT_ROLE_LABELS[def.requiredRole]}${badge})</li>`;
    })
    .join("");
  return `<div class="livingMuted">Troubles</div><ul>${rows}</ul>`;
}

function renderProvincesLairs(stateId: number): string {
  const living = Living.getState();
  const ownedProvinces = (pack.provinces ?? []).filter(p => p?.i && !p.removed && p.state === stateId);
  const laired = ownedProvinces
    .map(p => ({ province: p, pSim: living.provinces?.[p.i] }))
    .filter((entry): entry is { province: (typeof pack.provinces)[number]; pSim: ProvinceSimState } =>
      Boolean(entry.pSim?.lair)
    );

  if (laired.length === 0) return `<div class="livingMuted">No provincial lairs</div>`;

  const rows = laired
    .map(({ province, pSim }) => {
      const lair = pSim.lair!;
      const def = getLairDef(lair.id);
      const defenderCount = lair.defenders.reduce((sum, u) => sum + (u.count ?? 0), 0);
      const statusFlags = [
        lair.fortified ? "ðŸ° Fortified" : "",
        lair.raidPending ? "âš ï¸ Raid Imminent" : "",
        isLairStateCapable(lair.id)
          ? `<span class="livingBadge" style="background:#5e3c6e" title="Can ascend to sovereign state">${escapeHtml(def.stateForm ?? "State-Capable")}</span>`
          : ""
      ]
        .filter(Boolean)
        .join(" ");
      return `<li>${escapeHtml(province.name ?? "Province")} â€” <strong>${escapeHtml(lair.name)}</strong> (Lv ${lair.level}, Raid: ${lair.raidThreshold}+, Defenders: ${defenderCount}${statusFlags ? ` Â· ${statusFlags}` : ""})</li>`;
    })
    .join("");
  return `<div class="livingMuted">Lairs</div><ul>${rows}</ul>`;
}

function renderBurgCard(burgId: number): string {
  const living = Living.getState();
  const burg = pack.burgs[burgId];
  const bSim = living.burgs[burgId];
  if (!burg?.i || burg.removed || !bSim) return `<div class="livingPlaceholder">This burg is gone.</div>`;

  const stateId = burg.state ?? 0;
  const state = stateId ? pack.states[stateId] : undefined;
  const owner = state && !state.removed ? state.name : "Free Burg";
  const building = bSim.construction ? currentBuildingName(bSim.construction.buildingId) : "No construction";

  const provId = pack.cells.province?.[burg.cell] ?? 0;
  const province = provId ? pack.provinces?.[provId] : undefined;
  const pSim = provId ? living.provinces?.[provId] : undefined;
  const trouble = pSim?.trouble;
  const tDef = trouble ? getTroubleDef(trouble.id) : undefined;
  const troublePromotable = Boolean(trouble && isTroubleStatePromotable(trouble.id));
  const lair = pSim?.lair;
  const lairDef = lair ? getLairDef(lair.id) : undefined;
  const lairCapable = Boolean(lair && isLairStateCapable(lair.id));

  return /* html */ `
    <div class="livingInspectorTitle">${escapeHtml(burg.name ?? "Burg")}</div>
    <div class="livingMuted">${escapeHtml(owner ?? "")} Â· tier ${bSim.baseTier} Â· pop ${burg.population ?? 0}</div>
    <div class="livingSection">
      <div class="livingSectionTitle">Unrest</div>
      ${renderMeter("Unrest", bSim.unrest, true)}
    </div>
    <div class="livingSection">
      <div class="livingSectionTitle">Asset</div>
      <div>${escapeHtml(building)}</div>
      ${bSim.construction ? `<div class="livingMuted">${bSim.construction.turnsLeft} turns left</div>` : ""}
      <div class="livingMuted">${bSim.buildings.length} standing structures</div>
    </div>
    ${
      province && pSim
        ? `<div class="livingSection">
            <div class="livingSectionTitle">Province: ${escapeHtml(province.name ?? "Province")}</div>
            <div class="livingMuted">Order ${Math.round(pSim.order)}% Â· Stability ${pSim.stability} Â· Dev ${pSim.development}</div>
            ${
              trouble && tDef
                ? `<div style="margin-top:0.3em;color:#a33d3d;"><strong>Trouble:</strong> ${escapeHtml(tDef.name)} (Lv ${trouble.level}, ${trouble.theme}) ${troublePromotable ? `<span class="livingBadge" style="background:#8b2635">${escapeHtml(tDef.stateForm ?? "State-Capable")}</span>` : ""}</div>
                   <div class="livingMuted">Save: ${SAVE_KIND_LABELS[tDef.save]} Â· Specialist: ${UNIT_ROLE_LABELS[tDef.requiredRole]}</div>`
                : `<div class="livingMuted" style="margin-top:0.2em;">No active trouble</div>`
            }
            ${
              lair
                ? `<div style="margin-top:0.3em;color:#8b0000;"><strong>Lair:</strong> ${escapeHtml(lair.name)} (Lv ${lair.level}, ${lair.theme}) ${lairCapable ? `<span class="livingBadge" style="background:#5e3c6e">${escapeHtml(lairDef?.stateForm ?? "State-Capable")}</span>` : ""}</div>
                   <div class="livingMuted">Raid: ${lair.raidThreshold}+ Â· Defenders: ${lair.defenders.reduce((sum, u) => sum + (u.count ?? 0), 0)} men${lair.fortified ? "ðŸ° Fortified" : ""}${lair.raidPending ? "âš ï¸ Raid Imminent" : ""}</div>`
                : `<div class="livingMuted" style="margin-top:0.2em;">No active lair</div>`
            }
          </div>`
        : ""
    }
    <div class="livingButtons">
      <button type="button" data-open="burg" data-id="${burgId}">Burg Editor</button>
      ${stateId ? `<button type="button" data-open="regiments" data-id="${stateId}">Regiments</button>` : ""}
    </div>
    <div class="livingGodTitle">God Mode</div>
    <div class="livingButtons">
      ${stateId ? `<button type="button" data-god="spark" data-state="${stateId}" data-burg="${burgId}">Spark Rebellion</button>` : ""}
      <button type="button" data-god="pacify" data-burg="${burgId}">Pacify Unrest</button>
      <button type="button" data-god="complete" data-burg="${burgId}">Complete Asset</button>
      ${
        provId && trouble
          ? `<button type="button" data-god="quell-trouble" data-province="${provId}">Quell Trouble</button>
             ${stateId ? `<button type="button" data-god="resolve-trouble" data-state="${stateId}" data-province="${provId}">Resolve Trouble</button>` : ""}
             ${troublePromotable ? `<button type="button" data-god="promote-trouble" data-province="${provId}" data-burg="${burgId}">Promote to State</button>` : ""}`
          : provId && !lair
            ? `<button type="button" data-god="spawn-trouble" data-province="${provId}">Spawn Trouble</button>`
            : ""
      }
      ${
        provId && lair
          ? `${stateId ? `<button type="button" data-god="assault-lair" data-state="${stateId}" data-province="${provId}">Assault Lair</button>` : ""}
             ${stateId ? `<button type="button" data-god="delve-lair" data-state="${stateId}" data-province="${provId}">Send Adventurers</button>` : ""}
             ${lairCapable ? `<button type="button" data-god="ascend-lair" data-province="${provId}" data-burg="${burgId}">Ascend Lair</button>` : ""}
             <button type="button" data-god="smite-lair" data-province="${provId}">Smite Lair</button>`
          : provId
            ? `<button type="button" data-god="spawn-lair" data-province="${provId}">Spawn Lair</button>`
            : ""
      }
    </div>`;
}

function currentBuildingName(buildingId: string): string {
  return currentContent().content.buildings.find(building => building.id === buildingId)?.name ?? buildingId;
}

function bindInspectorButtons(panel: HTMLElement): void {
  for (const button of panel.querySelectorAll<HTMLElement>("[data-open]")) {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.id ?? 0);
      switch (button.dataset.open) {
        case "state":
          void Controllers.StatesEditor.open();
          break;
        case "burg":
          void Controllers.BurgEditor.open(id);
          break;
        case "regiments":
          void Controllers.RegimentsOverview.open(id);
          break;
      }
    });
  }

  for (const button of panel.querySelectorAll<HTMLElement>("[data-god]")) {
    button.addEventListener("click", () => runIntervention(button));
  }
}

function runIntervention(button: HTMLElement): void {
  const stateId = Number(button.dataset.state ?? 0);
  const burgId = Number(button.dataset.burg ?? 0);
  const provId = Number(button.dataset.province ?? 0);
  let ok = false;
  let message = "";

  switch (button.dataset.god) {
    case "spark":
      ok = Living.sparkRebellion(stateId, burgId || undefined);
      message = ok ? "A rebellion has been sparked." : "No burg could be stirred to revolt.";
      break;
    case "smite":
      ok = Living.smiteRuler(stateId);
      message = ok ? "The ruler has been struck down." : "There is no living ruler to smite.";
      break;
    case "war":
      ok = Living.forceWar(stateId);
      message = ok ? "War has been declared." : "No rival could be found.";
      break;
    case "pacify":
      ok = Living.pacifyBurg(burgId);
      message = ok ? "The burg has been pacified." : "There is no unrest to pacify.";
      break;
    case "complete":
      ok = Living.completeAsset(burgId);
      message = ok ? "The asset has been completed." : "No asset can be completed here.";
      break;
    case "spawn-trouble": {
      const res = Living.spawnTrouble(provId);
      ok = Boolean(res);
      message = ok ? "Trouble has arisen in the province." : "Failed to spawn trouble.";
      break;
    }
    case "quell-trouble":
      ok = Living.quellTrouble(provId);
      message = ok ? "The provincial trouble has been quelled." : "No trouble to quell.";
      break;
    case "resolve-trouble":
      ok = Living.resolveTrouble(stateId, provId);
      message = ok ? "The domain quashed the trouble!" : "The domain's effort failed.";
      break;
    case "resolve-state-trouble": {
      const living = Living.getState();
      const prov = (pack.provinces ?? []).find(
        p => p?.i && !p.removed && p.state === stateId && living.provinces?.[p.i]?.trouble
      );
      if (prov) {
        ok = Living.resolveTrouble(stateId, prov.i);
        message = ok
          ? `The domain quashed the trouble in ${prov.name}!`
          : `The domain's effort in ${prov.name} failed.`;
      } else {
        ok = false;
        message = "No active trouble in the state.";
      }
      break;
    }
    case "promote-trouble": {
      const newStateId = Living.promoteTroubleToState(provId, burgId || undefined);
      ok = newStateId !== null;
      const newState = newStateId ? pack.states[newStateId] : undefined;
      message = ok
        ? `Trouble promoted to sovereign state: ${newState?.fullName ?? newState?.name ?? "New Realm"}!`
        : "This trouble cannot promote to a state.";
      break;
    }
    case "promote-state-trouble": {
      const living = Living.getState();
      const prov = (pack.provinces ?? []).find(p => {
        const t = p?.i && !p.removed && p.state === stateId ? living.provinces?.[p.i]?.trouble : undefined;
        return Boolean(t && isTroubleStatePromotable(t.id));
      });
      if (prov) {
        const newStateId = Living.promoteTroubleToState(prov.i);
        ok = newStateId !== null;
        const newState = newStateId ? pack.states[newStateId] : undefined;
        message = ok
          ? `Trouble in ${prov.name} proclaimed ${newState?.fullName ?? newState?.name ?? "a new state"}!`
          : `Trouble in ${prov.name} could not form a state.`;
      } else {
        ok = false;
        message = "No promotable trouble in the state.";
      }
      break;
    }
    case "spawn-lair": {
      const res = Living.spawnLair(provId);
      ok = Boolean(res);
      message = ok ? "A lair has arisen in the province." : "Failed to spawn lair.";
      break;
    }
    case "smite-lair":
      ok = Living.smiteLair(provId);
      message = ok ? "The lair was smitten by divine wrath." : "No lair to smite.";
      break;
    case "assault-lair":
      ok = Living.assaultLair(stateId, provId);
      message = ok ? "The military expedition destroyed the lair!" : "The expedition failed to destroy the lair.";
      break;
    case "delve-lair":
      ok = Living.sendAdventurersToLair(stateId, provId);
      message = ok ? "The adventuring party vanquished the lair!" : "The adventuring party failed to destroy the lair.";
      break;
    case "ascend-lair": {
      const newStateId = Living.ascendLairToState(provId, burgId || undefined);
      ok = newStateId !== null;
      const newState = newStateId ? pack.states[newStateId] : undefined;
      message = ok
        ? `The lair ascended into ${newState?.fullName ?? newState?.name ?? "a sovereign state"}!`
        : "This lair cannot form a state.";
      break;
    }
    case "ascend-state-lair": {
      const living = Living.getState();
      const prov = (pack.provinces ?? []).find(p => {
        const l = p?.i && !p.removed && p.state === stateId ? living.provinces?.[p.i]?.lair : undefined;
        return Boolean(l && isLairStateCapable(l.id));
      });
      if (prov) {
        const newStateId = Living.ascendLairToState(prov.i);
        ok = newStateId !== null;
        const newState = newStateId ? pack.states[newStateId] : undefined;
        message = ok
          ? `The lair in ${prov.name} ascended into ${newState?.fullName ?? newState?.name ?? "a sovereign state"}!`
          : `The lair in ${prov.name} could not form a state.`;
      } else {
        ok = false;
        message = "No state-capable lair in the state.";
      }
      break;
    }
    case "spawn-state-lair": {
      const living = Living.getState();
      const prov = (pack.provinces ?? []).find(
        p => p?.i && !p.removed && p.state === stateId && !living.provinces?.[p.i]?.lair
      );
      if (prov) {
        const res = Living.spawnLair(prov.i);
        ok = Boolean(res);
        message = ok ? `A lair arose in ${prov.name}!` : `Failed to spawn lair in ${prov.name}.`;
      } else {
        ok = false;
        message = "All provinces already harbor lairs.";
      }
      break;
    }
    case "assault-state-lair": {
      const living = Living.getState();
      const prov = (pack.provinces ?? []).find(
        p => p?.i && !p.removed && p.state === stateId && living.provinces?.[p.i]?.lair
      );
      if (prov) {
        ok = Living.assaultLair(stateId, prov.i);
        message = ok
          ? `The expedition destroyed the lair in ${prov.name}!`
          : `The expedition against the lair in ${prov.name} failed.`;
      } else {
        ok = false;
        message = "No active lair in the state.";
      }
      break;
    }
    case "delve-state-lair": {
      const living = Living.getState();
      const prov = (pack.provinces ?? []).find(
        p => p?.i && !p.removed && p.state === stateId && living.provinces?.[p.i]?.lair
      );
      if (prov) {
        ok = Living.sendAdventurersToLair(stateId, prov.i);
        message = ok
          ? `The adventuring party vanquished the lair in ${prov.name}!`
          : `The adventurers in ${prov.name} failed to destroy the lair.`;
      } else {
        ok = false;
        message = "No active lair in the state.";
      }
      break;
    }
    case "smite-state-lair": {
      const living = Living.getState();
      const prov = (pack.provinces ?? []).find(
        p => p?.i && !p.removed && p.state === stateId && living.provinces?.[p.i]?.lair
      );
      if (prov) {
        ok = Living.smiteLair(prov.i);
        message = ok ? `The lair in ${prov.name} was smitten!` : `Failed to smite lair in ${prov.name}.`;
      } else {
        ok = false;
        message = "No active lair in the state.";
      }
      break;
    }
    default:
      return;
  }

  afterTick();
  setStatus(message);
}

function setStatus(message: string): void {
  const status = findEl("livingHudStatus");
  if (status) status.textContent = message;
}

export const LivingHud = { open, close, toggle, refresh };
