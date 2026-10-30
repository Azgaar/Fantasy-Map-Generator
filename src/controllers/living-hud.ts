// The Living World HUD: a seasonal clock, a live news ticker and a god-mode inspector.
// See docs/plans/living-world.md (slice 5)
import { select } from "d3";
import { currentContent } from "@/conquest/content/store";
import { Controllers } from "@/controllers";
import { ALIGNMENT_COLORS } from "@/data/culture-traits";
import { getLairDef, isLairStateCapable } from "@/data/living-lairs";
import { getPetitionDef } from "@/data/living-petitions";
import { describeRelicBonuses, isExcavationMarker, RELIC_CATALOG, vaultRelics } from "@/data/living-relics";
import { getTroubleDef, isTroubleStatePromotable, SAVE_KIND_LABELS, UNIT_ROLE_LABELS } from "@/data/living-troubles";
import { Pack } from "@/model/graph/pack-generator";
import { figureLevel, GUILD_TIER_TITLES, Living, maxHeroesForTier } from "@/model/physical/living-generator";
import { getCellPoint } from "@/model/story/journeys/journey-places";
import { drawLivingOverlay, removeLivingOverlay } from "@/renderers/draw-living-overlay";
import { Layers } from "@/renderers/layers";
import type { HistoricalFigure } from "@/types/history";
import {
  type GuildState,
  type HistoricalRelic,
  type IdleDoctrine,
  type LivingNewsItem,
  type ProvinceSimState,
  SEASON_NAMES,
  type StatePolitySim
} from "@/types/living";
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
    #${HUD_ID} .livingHudGuild {
      display: flex;
      flex-direction: column;
      gap: 0.15em;
      padding: 0.2em 0.45em;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
    }
    #${HUD_ID} .livingGuildRow { display: flex; align-items: center; flex-wrap: wrap; gap: 0.3em; }
    #${HUD_ID} .livingGuildBadge { background: #5e4fa2; color: #fff; border-radius: 2px; padding: 0 0.3em; font-weight: bold; }
    #${HUD_ID} .livingGuildTitle { font-weight: bold; }
    #${HUD_ID} .livingGuildStat { color: #6a4c93; font-weight: bold; }
    #${HUD_ID} .livingGuildMuted { color: #666; font-style: italic; }
    #${HUD_ID} .livingGuildDoctrine { margin-left: auto; display: flex; align-items: center; gap: 0.25em; }
    #${HUD_ID} .livingGuildDoctrine select { font-family: var(--monospace); font-size: 1em; }
    #${HUD_ID} .livingGuildEschaton { display: flex; align-items: center; gap: 0.25em; }
    #${HUD_ID} .livingGuildEschaton button:not([disabled]) { background: var(--header, #5e4fa2); color: #fff; }
    #${HUD_ID} .livingGuildChip {
      border: 1px solid rgba(94, 79, 162, 0.5);
      border-radius: 3px;
      background: transparent;
      padding: 0.05em 0.4em;
    }
    #${HUD_ID} .livingGuildChip.mission { border-color: #b8860b; }
    #${HUD_ID} .livingGuildChip.cooldown { border-color: #a33d3d; opacity: 0.7; }
    #${HUD_ID} .livingGuildChip.relic { border-color: #b8860b; }
    #${HUD_ID} .livingGuildChip.site { border-color: #3d6b35; }
    #${HUD_ID} .livingGuildChip.petition { border-color: #444a8a; }
    #${HUD_ID} .livingGuildChipStatus { color: #777; }
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
    #${INSPECTOR_ID} .livingPetitionChoice { display: block; width: 100%; text-align: left; }
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
    <div id="livingHudGuild" class="livingHudGuild"></div>
    <div id="livingHudNews" class="livingHudNews"></div>
  </div>
`;

type Selection =
  | { kind: "state"; id: number }
  | { kind: "burg"; id: number }
  | { kind: "figure"; id: number }
  | { kind: "marker"; id: number }
  | { kind: "relic"; id: number }
  | { kind: "petition"; id: number };

const DOCTRINE_LABELS: Record<IdleDoctrine, string> = {
  auto_bounties: "Hunt Troubles",
  auto_lairs: "Hunt Lairs",
  auto_excavate: "Excavate Ruins",
  auto_patron: "Guard Favored State",
  manual: "Manual Dispatch"
};

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
  renderGuildBar();
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

function heroStatus(guild: GuildState, figureId: number): { label: string; className: string } {
  const mission = (guild.missions ?? []).find(entry => entry.figureId === figureId);
  if (mission) return { label: `${mission.kind} ${mission.progress}/${mission.required}`, className: "mission" };
  const until = guild.cooldowns?.[figureId];
  if (until !== undefined && until > Living.getState().tick) return { label: "recovering", className: "cooldown" };
  if ((guild.candidates ?? []).includes(figureId)) return { label: "seeker", className: "" };
  if ((guild.roster ?? []).includes(figureId)) return { label: "idle", className: "" };
  return { label: "free", className: "" };
}

function renderHeroChip(guild: GuildState, figureId: number): string {
  const figure = pack.history?.figures?.find(entry => entry.i === figureId);
  if (!figure) return "";
  const status = heroStatus(guild, figureId);
  const selectedClass = selected?.kind === "figure" && selected.id === figureId ? " pressed" : "";
  return `<button type="button" class="livingGuildChip ${status.className}${selectedClass}" data-guild="inspect" data-figure="${figureId}" title="${escapeHtml(figure.name)} — level ${figureLevel(figure.xp ?? 0)}, ${status.label}">
    ${escapeHtml(figure.name)} <span class="livingGuildChipStatus">Lv${figureLevel(figure.xp ?? 0)} · ${status.label}</span>
  </button>`;
}

function relicHolderLabel(relic: HistoricalRelic): string {
  const holder = relic.holder;
  switch (holder.kind) {
    case "vault":
      return "vault";
    case "figure":
      return pack.history?.figures?.find(figure => figure.i === holder.id)?.name ?? "hero";
    case "state":
      return pack.states[holder.id]?.name ?? "leased";
    case "ruin":
      return "lost";
  }
}

function renderRelicChip(relic: HistoricalRelic): string {
  const def = RELIC_CATALOG[relic.category];
  const selectedClass = selected?.kind === "relic" && selected.id === relic.id ? " pressed" : "";
  return `<button type="button" class="livingGuildChip relic${selectedClass}" data-guild="inspect-relic" data-relic="${relic.id}" title="${escapeHtml(relic.name)} — ${describeRelicBonuses(relic)}">
    ${def.icon} ${escapeHtml(relic.name)} <span class="livingGuildChipStatus">· ${escapeHtml(relicHolderLabel(relic))}</span>
  </button>`;
}

const MAX_GUILD_CHIPS = 6;

function renderGuildBar(): void {
  const bar = findEl("livingHudGuild");
  if (!bar) return;

  const guild = Living.getGuild?.();
  if (!guild) {
    bar.innerHTML = "";
    return;
  }

  const tier = guild.tier ?? 1;
  const roster = guild.roster ?? [];
  const candidates = guild.candidates ?? [];
  const relics = guild.relics ?? [];
  const doctrine = guild.doctrine ?? "auto_bounties";
  const sandbox = Boolean(guild.sandboxGodMode);
  const favored = guild.favoredStateId !== undefined ? pack.states[guild.favoredStateId]?.name : undefined;
  const eschaton = Living.getEschaton?.() ?? 0;
  const wheelReady = eschaton >= 100 || tier >= 5;
  const doctrineOptions = (Object.keys(DOCTRINE_LABELS) as IdleDoctrine[])
    .map(key => `<option value="${key}"${key === doctrine ? " selected" : ""}>${DOCTRINE_LABELS[key]}</option>`)
    .join("");

  const siteChips = (pack.markers ?? [])
    .filter(marker => isExcavationMarker(marker) && !(guild.excavatedMarkers ?? []).includes(marker.i))
    .slice(0, MAX_GUILD_CHIPS)
    .map(marker => {
      const selectedClass = selected?.kind === "marker" && selected.id === marker.i ? " pressed" : "";
      return `<button type="button" class="livingGuildChip site${selectedClass}" data-guild="inspect-marker" data-marker="${marker.i}" title="${escapeHtml(marker.name ?? "Landmark")} — DC ${13 + tier} dig">
        ⛏ ${escapeHtml(marker.name ?? `Landmark ${marker.i}`)}
      </button>`;
    })
    .join("");

  const petitionChips = (guild.popups ?? [])
    .filter(popup => popup.kind === "guild_petition")
    .map(popup => {
      const selectedClass = selected?.kind === "petition" && selected.id === popup.id ? " pressed" : "";
      return `<button type="button" class="livingGuildChip petition${selectedClass}" data-guild="inspect-petition" data-popup="${popup.id}" title="${escapeHtml(popup.subtitle)}">
        ⚖️ ${escapeHtml(popup.title)}
      </button>`;
    })
    .join("");

  bar.innerHTML = /* html */ `
    <div class="livingGuildRow">
      <span class="livingGuildBadge" title="Guild tier">⚜ T${tier}</span>
      <span class="livingGuildTitle">${escapeHtml(GUILD_TIER_TITLES[tier - 1] ?? GUILD_TIER_TITLES[0]!)}</span>
      <span class="livingGuildStat" title="Guild gold">${guild.gold ?? 0}g</span>
      <span class="livingGuildStat" title="Guild renown">${guild.renown ?? 0}r</span>
      <span class="livingGuildMuted">${roster.length}/${maxHeroesForTier(tier)} heroes · ${relics.length} relics</span>
      <label class="livingGuildDoctrine">Doctrine
        <select id="livingHudDoctrine">${doctrineOptions}</select>
      </label>
      <span class="livingGuildModes">
        <button type="button" data-mode="guild" class="${sandbox ? "" : "pressed"}">Guild Mode</button>
        <button type="button" data-mode="sandbox" class="${sandbox ? "pressed" : ""}">Sandbox God Mode</button>
      </span>
      <span class="livingGuildEschaton" title="The eschaton clock: how close this age is to its finale (${eschaton}/100).${
        wheelReady ? " The Wheel of Ages may be turned!" : " Reach eschaton 100 or Guild tier 5 to turn it."
      }">
        ⏳ ${eschaton}
        <button type="button" data-wheel="turn"${wheelReady ? "" : " disabled"}>Turn the Wheel of Ages</button>
      </span>
    </div>
    <div class="livingGuildRow">
      <span class="livingGuildMuted">Heroes:</span>
      ${roster.length > 0 ? roster.map(id => renderHeroChip(guild, id)).join("") : `<span class="livingGuildMuted">none — recruit from the tavern</span>`}
    </div>
    <div class="livingGuildRow">
      <span class="livingGuildMuted">Tavern${favored ? ` · patron: ${escapeHtml(favored)}` : ""}:</span>
      ${candidates.length > 0 ? candidates.map(id => renderHeroChip(guild, id)).join("") : `<span class="livingGuildMuted">no seekers this year</span>`}
    </div>
    ${
      relics.length > 0
        ? `<div class="livingGuildRow">
            <span class="livingGuildMuted">Vault (${vaultRelics(relics).length}/${tier}):</span>
            ${relics
              .slice(0, MAX_GUILD_CHIPS)
              .map(relic => renderRelicChip(relic))
              .join("")}
            ${relics.length > MAX_GUILD_CHIPS ? `<span class="livingGuildMuted">+${relics.length - MAX_GUILD_CHIPS} more</span>` : ""}
          </div>`
        : ""
    }
    ${
      siteChips
        ? `<div class="livingGuildRow">
            <span class="livingGuildMuted">Excavation sites:</span>
            ${siteChips}
          </div>`
        : ""
    }
    ${
      petitionChips
        ? `<div class="livingGuildRow">
            <span class="livingGuildMuted">Petitions:</span>
            ${petitionChips}
          </div>`
        : ""
    }`;

  bar.querySelector<HTMLSelectElement>("#livingHudDoctrine")?.addEventListener("change", event => {
    const value = (event.target as HTMLSelectElement).value as IdleDoctrine;
    Living.setDoctrine(value);
    refresh();
    setStatus(`The Guild now follows ${DOCTRINE_LABELS[value]}.`);
  });

  for (const button of bar.querySelectorAll<HTMLElement>("[data-mode]")) {
    button.addEventListener("click", () => {
      const sandboxMode = button.dataset.mode === "sandbox";
      Living.setSandboxGodMode(sandboxMode);
      refresh();
      setStatus(
        sandboxMode
          ? "Sandbox God Mode: interventions are free and instant."
          : "Guild Mode: operations cost gold and heroes."
      );
    });
  }

  for (const button of bar.querySelectorAll<HTMLElement>("[data-guild='inspect']")) {
    button.addEventListener("click", () => {
      selected = { kind: "figure", id: Number(button.dataset.figure ?? 0) };
      renderInspector();
    });
  }

  for (const button of bar.querySelectorAll<HTMLElement>("[data-guild='inspect-relic']")) {
    button.addEventListener("click", () => {
      selected = { kind: "relic", id: Number(button.dataset.relic ?? 0) };
      renderInspector();
    });
  }

  for (const button of bar.querySelectorAll<HTMLElement>("[data-guild='inspect-marker']")) {
    button.addEventListener("click", () => {
      selected = { kind: "marker", id: Number(button.dataset.marker ?? 0) };
      renderInspector();
    });
  }

  for (const button of bar.querySelectorAll<HTMLElement>("[data-guild='inspect-petition']")) {
    button.addEventListener("click", () => {
      selected = { kind: "petition", id: Number(button.dataset.popup ?? 0) };
      renderInspector();
    });
  }

  for (const button of bar.querySelectorAll<HTMLElement>("[data-wheel]")) {
    button.addEventListener("click", () => {
      const result = Living.turnAge();
      afterTick();
      setStatus(
        result
          ? `${result.era} dawns — ${result.realms} ${result.realms === 1 ? "realm" : "realms"} fell, ${
              result.successorStates
            } provinces broke away, and the Guild enters a new age.`
          : "The Wheel refuses to turn."
      );
    });
  }
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
  if (stateId && pack.states[stateId] && !pack.states[stateId].removed) {
    selectState(stateId);
    return;
  }

  const marker = (pack.markers ?? []).find(entry => entry?.cell === cell);
  if (marker) {
    selected = { kind: "marker", id: marker.i };
    renderInspector();
  }
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

  // petitions open a 2-choice dilemma card instead of banking a claim bonus
  if (popupElement.getAttribute("data-kind") === "guild_petition") {
    selected = { kind: "petition", id };
    renderInspector();
    drawLivingOverlay();
    return;
  }

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
  const guild = Living.getGuild?.();
  const alive =
    current.kind === "state"
      ? Boolean(pack.states[current.id] && !pack.states[current.id].removed)
      : current.kind === "burg"
        ? Boolean(pack.burgs[current.id] && !pack.burgs[current.id].removed)
        : current.kind === "marker"
          ? (pack.markers ?? []).some(marker => marker?.i === current.id)
          : current.kind === "relic"
            ? (guild?.relics ?? []).some(relic => relic.id === current.id)
            : current.kind === "petition"
              ? (guild?.popups ?? []).some(popup => popup.id === current.id && popup.kind === "guild_petition")
              : Boolean(pack.history?.figures?.some(figure => figure.i === current.id));
  if (!alive) selected = null;
}

function renderInspector(): void {
  const panel = findEl(INSPECTOR_ID);
  if (!panel) return;

  if (!selected) {
    panel.innerHTML = `<div class="livingPlaceholder">Click a state, burg, hero, landmark or relic to inspect it.</div>`;
    return;
  }

  panel.innerHTML =
    selected.kind === "state"
      ? renderStateCard(selected.id)
      : selected.kind === "burg"
        ? renderBurgCard(selected.id)
        : selected.kind === "marker"
          ? renderMarkerCard(selected.id)
          : selected.kind === "relic"
            ? renderRelicCard(selected.id)
            : selected.kind === "petition"
              ? renderPetitionCard(selected.id)
              : renderFigureCard(selected.id);
  bindInspectorButtons(panel);
}

/** The 2-choice dilemma card for an awaiting guild petition */
function renderPetitionCard(popupId: number): string {
  const guild = Living.getGuild?.();
  const popup = (guild?.popups ?? []).find(entry => entry.id === popupId && entry.kind === "guild_petition");
  if (!popup) return `<div class="livingPlaceholder">The petitioners have moved on.</div>`;

  const def = getPetitionDef(popup.petitionId);
  if (!def) return `<div class="livingPlaceholder">This petition no longer has meaning.</div>`;

  const remaining = Math.max(0, popup.expiresAtTick - Living.getState().tick);
  const choices = def.choices
    .map(
      (choice, index) =>
        `<button type="button" class="livingPetitionChoice" data-guild="petition" data-popup="${popupId}" data-choice="${index}" title="${escapeHtml(choice.tooltip)}">
          ${escapeHtml(choice.label)} <span class="livingGuildChipStatus">${choice.gold >= 0 ? "+" : ""}${choice.gold}g · ${choice.renown >= 0 ? "+" : ""}${choice.renown}r</span>
        </button>`
    )
    .join("");

  return /* html */ `
    <div class="livingInspectorTitle">⚖️ ${escapeHtml(popup.title)}</div>
    <div class="livingMuted">${escapeHtml(popup.subtitle)}</div>
    <div class="livingSection">
      <div class="livingSectionTitle">The Dilemma</div>
      <div class="livingMuted">Decide within ${remaining} season${remaining === 1 ? "" : "s"} or the matter resolves itself.</div>
    </div>
    <div class="livingButtons">${choices}</div>`;
}

function relicHolderText(relic: HistoricalRelic): string {
  const holder = relic.holder;
  switch (holder.kind) {
    case "vault":
      return "Held in the Guild Vault";
    case "figure":
      return `Carried by ${pack.history?.figures?.find(figure => figure.i === holder.id)?.name ?? "a hero"}`;
    case "state":
      return `Leased to ${pack.states[holder.id]?.name ?? "a state"} (+gen, -1 unravel, +10g tribute per season)`;
    case "ruin":
      return `Buried in ${(pack.markers ?? []).find(marker => marker?.i === holder.markerId)?.name ?? "a ruin"} — excavate to recover`;
  }
}

function renderRelicCard(relicId: number): string {
  const guild = Living.getGuild?.();
  const relic = (guild?.relics ?? []).find(entry => entry.id === relicId);
  if (!relic) return `<div class="livingPlaceholder">This relic has crumbled to dust.</div>`;

  const def = RELIC_CATALOG[relic.category];
  const realm =
    relic.originRealmId !== undefined
      ? pack.history?.realms?.find(entry => entry.i === relic.originRealmId)?.name
      : undefined;
  const figure =
    relic.originFigureId !== undefined
      ? pack.history?.figures?.find(entry => entry.i === relic.originFigureId)?.name
      : undefined;
  const origin = [realm, figure]
    .filter((entry): entry is string => Boolean(entry))
    .map(escapeHtml)
    .join(" · ");

  let actions = "";
  if (relic.holder.kind === "ruin") {
    actions = `<button type="button" data-guild="dispatch-marker" data-marker="${relic.holder.markerId}">Send Expedition</button>`;
  } else if (relic.holder.kind !== "vault") {
    actions = `<button type="button" data-guild="recall" data-relic="${relic.id}">Return to Vault</button>`;
  } else {
    const stored = vaultRelics(guild?.relics ?? []).length;
    actions = `<div class="livingMuted">Enshrined in the Guild Vault (${stored}/${guild?.tier ?? 1})</div>`;
  }

  return /* html */ `
    <div class="livingInspectorTitle">${def.icon} ${escapeHtml(relic.name)}</div>
    <div class="livingMuted">${def.label} · origin year ${relic.originYear}${origin ? ` · ${origin}` : ""}${
      relic.cursed ? " · 🩸 Cursed" : ""
    }</div>
    <div class="livingSection">
      <div class="livingSectionTitle">Powers</div>
      <div>${describeRelicBonuses(relic)}</div>
      <div class="livingMuted">${escapeHtml(relic.lore)}</div>
      <div class="livingMuted">${relicHolderText(relic)}</div>
    </div>
    ${actions ? `<div class="livingButtons">${actions}</div>` : ""}`;
}

function renderMarkerCard(markerId: number): string {
  const guild = Living.getGuild?.();
  const marker = (pack.markers ?? []).find(entry => entry?.i === markerId);
  if (!marker) return `<div class="livingPlaceholder">This landmark is gone.</div>`;

  const excavated = (guild?.excavatedMarkers ?? []).includes(markerId);
  const targeted = (guild?.missions ?? []).some(
    mission => mission.kind === "excavate" && mission.markerId === markerId
  );
  const buried = (guild?.relics ?? []).filter(
    relic => relic.holder.kind === "ruin" && relic.holder.markerId === markerId
  );
  const buriedChips = buried
    .map(
      relic =>
        `<button type="button" class="livingGuildChip" data-guild="inspect-relic" data-relic="${relic.id}">${RELIC_CATALOG[relic.category].icon} ${escapeHtml(relic.name)}</button>`
    )
    .join("");

  let actions: string;
  if (excavated) {
    actions = `<div class="livingMuted">Already excavated by the Guild.</div>`;
  } else {
    actions = `<button type="button" data-guild="dispatch-marker" data-marker="${markerId}"${targeted ? " disabled" : ""}>${
      targeted ? "Excavation Underway" : "Dispatch Hero"
    }</button>`;
    if (guild?.sandboxGodMode) {
      actions += `<button type="button" data-god="excavate-marker" data-marker="${markerId}">Excavate Now</button>`;
    }
  }

  return /* html */ `
    <div class="livingInspectorTitle">${escapeHtml(marker.name ?? "Landmark")}</div>
    <div class="livingMuted">${escapeHtml(marker.type.replaceAll("-", " "))} · cell ${marker.cell}${
      marker.chronicle ? " · chronicle site" : ""
    }</div>
    <div class="livingSection">
      <div class="livingSectionTitle">Excavation</div>
      ${
        excavated
          ? `<div class="livingMuted">Site dug</div>`
          : `<div class="livingMuted">DC ${13 + (guild?.tier ?? 1)} · chronicle sites always yield a named relic</div>`
      }
      ${buriedChips ? `<div class="livingMuted">Buried relics:</div><div>${buriedChips}</div>` : ""}
    </div>
    <div class="livingButtons">${actions}</div>`;
}

function renderFigureCard(figureId: number): string {
  const living = Living.getState();
  const guild = Living.getGuild?.();
  const figure = pack.history?.figures?.find(entry => entry.i === figureId);
  if (!figure) return `<div class="livingPlaceholder">This figure has passed from the chronicle.</div>`;

  const year = options.map?.lore?.calendar?.year ?? 1000;
  const age = Math.max(0, year - figure.birth);
  const level = figureLevel(figure.xp ?? 0);
  const roster = guild?.roster ?? [];
  const candidates = guild?.candidates ?? [];
  const mission = (guild?.missions ?? []).find(entry => entry.figureId === figureId);
  const cooldownUntil = guild?.cooldowns?.[figureId];
  const onCooldown = cooldownUntil !== undefined && cooldownUntil > living.tick;
  const isCandidate = candidates.includes(figureId);
  const isHero = roster.includes(figureId);
  const culture = pack.cultures?.[figure.culture]?.name;
  const alignment = figure.alignment
    ? `<span class="livingBadge" style="background:${ALIGNMENT_COLORS[figure.alignment]}">${figure.alignment}</span>`
    : "";
  const virtues = (figure.virtues ?? []).map(escapeHtml).join(", ");
  const vices = (figure.vices ?? []).map(escapeHtml).join(", ");
  const traits = [virtues, vices].filter(Boolean).join(" · ");
  const skills = figure.skills
    ? `<div class="livingMuted">Skills: M ${figure.skills.m} · W ${figure.skills.w} · S ${figure.skills.s} · C ${figure.skills.c}</div>`
    : `<div class="livingMuted">No skills recorded</div>`;

  let status = `<div class="livingMuted">Free agent</div>`;
  if (figure.death !== undefined) status = `<div class="livingMuted">Died ${figure.death}</div>`;
  else if (mission)
    status = `<div class="livingMuted">On a ${mission.kind} mission — ${mission.progress}/${mission.required} seasons</div>`;
  else if (onCooldown) status = `<div class="livingMuted">Recovering until tick ${cooldownUntil}</div>`;
  else if (isHero) status = `<div class="livingMuted">At the Guild Hall</div>`;
  else if (isCandidate) status = `<div class="livingMuted">Seeking a contract</div>`;

  const recruitCost = Living.recruitCost?.() ?? 40 + (guild?.tier ?? 1) * 20;
  const carried = (guild?.relics ?? []).find(relic => relic.holder.kind === "figure" && relic.holder.id === figureId);
  let actions = "";
  if (isCandidate && figure.death === undefined) {
    const affordable = (guild?.gold ?? 0) >= recruitCost;
    actions = `<button type="button" data-guild="recruit" data-figure="${figureId}"${affordable ? "" : " disabled"}>Recruit — ${recruitCost}g</button>`;
  } else if (isHero && figure.death === undefined) {
    if (age >= 55)
      actions = `<button type="button" data-guild="retire" data-figure="${figureId}">Retire & Mentor</button>`;
    if (!mission && !onCooldown)
      actions += `<div class="livingMuted">Select a province, state or excavation site and dispatch a hero.</div>`;
    if (carried)
      actions += `<button type="button" data-guild="recall" data-relic="${carried.id}">Return ${escapeHtml(carried.name)} to Vault</button>`;
    else
      for (const relic of vaultRelics(guild?.relics ?? []).slice(0, 3)) {
        actions += `<button type="button" data-guild="equip" data-relic="${relic.id}" data-figure="${figureId}">Equip ${escapeHtml(relic.name)}</button>`;
      }
  }

  return /* html */ `
    <div class="livingInspectorTitle">${escapeHtml(figure.name)}</div>
    <div class="livingRuler">
      <span class="livingAge">age ${age}</span>
      ${alignment}
      ${isHero ? `<span class="livingBadge" style="background:#5e4fa2">Guild Hero</span>` : ""}
      ${isCandidate ? `<span class="livingBadge" style="background:#3d6b35">Seeker</span>` : ""}
    </div>
    ${culture ? `<div class="livingMuted">${escapeHtml(culture)}</div>` : ""}
    ${traits ? `<div class="livingTraits">${traits}</div>` : ""}
    <div class="livingSection">
      <div class="livingSectionTitle">Progression</div>
      <div>Level ${level} <span class="livingMuted">· ${figure.xp ?? 0} xp</span></div>
      ${skills}
      ${carried ? `<div class="livingMuted">Carries ${RELIC_CATALOG[carried.category].icon} ${escapeHtml(carried.name)}</div>` : ""}
      ${status}
    </div>
    ${actions ? `<div class="livingButtons">${actions}</div>` : ""}`;
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
  const guild = Living.getGuild?.();
  const sandbox = Boolean(guild?.sandboxGodMode);
  const isPatron = guild?.favoredStateId === stateId;

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
    ${renderStateRelics(stateId, guild)}
    ${
      sandbox
        ? `<div class="livingGodTitle">Sandbox God Mode</div>
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
           </div>`
        : `<div class="livingGodTitle">Guild Operations</div>
           <div class="livingButtons">
             ${hasTroubled || hasLairs ? `<button type="button" data-guild="dispatch-state" data-state="${stateId}">Dispatch Hero</button>` : ""}
             <button type="button" data-guild="patron" data-state="${stateId}" title="Restrict auto_patron contracts to this state">${isPatron ? "Current Patron State" : "Make Patron State"}</button>
           </div>`
    }`;
}

/** Vault lease offer and currently leased relics for one state */
function renderStateRelics(stateId: number, guild: GuildState | undefined): string {
  const relics = guild?.relics ?? [];
  const leased = relics.filter(relic => relic.holder.kind === "state" && relic.holder.id === stateId);
  const offer = vaultRelics(relics)[0];

  const rows = leased
    .map(relic => {
      const def = RELIC_CATALOG[relic.category];
      return `<li><button type="button" class="livingGuildChip" data-guild="inspect-relic" data-relic="${relic.id}">${def.icon} ${escapeHtml(relic.name)}</button></li>`;
    })
    .join("");

  const buttons = [
    offer
      ? `<button type="button" data-guild="lease" data-relic="${offer.id}" data-state="${stateId}" title="Lease ${escapeHtml(offer.name)}: +gen, -1 unravel, ${10}g tribute per season">Lease ${escapeHtml(offer.name)}</button>`
      : "",
    leased.length > 0
      ? `<button type="button" data-guild="recall" data-relic="${leased[0]!.id}">Recall ${escapeHtml(leased[0]!.name)}</button>`
      : ""
  ]
    .filter(Boolean)
    .join("");

  return `<div class="livingSection">
    <div class="livingSectionTitle">Relics</div>
    ${leased.length > 0 ? `<ul>${rows}</ul>` : `<div class="livingMuted">No relics leased</div>`}
  </div>
  ${buttons ? `<div class="livingButtons">${buttons}</div>` : ""}`;
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
  const guild = Living.getGuild?.();
  const sandbox = Boolean(guild?.sandboxGodMode);
  const canDispatch = Boolean(provId && (trouble || lair));

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
    ${
      sandbox
        ? `<div class="livingGodTitle">Sandbox God Mode</div>
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
           </div>`
        : `<div class="livingGodTitle">Guild Operations</div>
           <div class="livingButtons">
             ${canDispatch ? `<button type="button" data-guild="dispatch" data-province="${provId}">Dispatch Hero</button>` : ""}
             ${stateId ? `<button type="button" data-guild="dispatch-state" data-state="${stateId}">Dispatch to State</button>` : ""}
             ${stateId ? `<button type="button" data-guild="patron" data-state="${stateId}">Make Patron State</button>` : ""}
           </div>`
    }`;
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

  for (const button of panel.querySelectorAll<HTMLElement>("[data-guild]")) {
    button.addEventListener("click", () => runGuildOperation(button));
  }
}

function runGuildOperation(button: HTMLElement): void {
  const stateId = Number(button.dataset.state ?? 0);
  const provId = Number(button.dataset.province ?? 0);
  const figureId = Number(button.dataset.figure ?? 0);
  let ok = false;
  let message = "";

  switch (button.dataset.guild) {
    case "dispatch":
      ok = Living.dispatchBestHero(provId);
      message = ok ? "A guild hero set out on a mission." : "No idle hero or target is available.";
      break;
    case "dispatch-state": {
      const living = Living.getState();
      const prov = (pack.provinces ?? []).find(p => {
        if (!p?.i || p.removed || p.state !== stateId) return false;
        const sim = living.provinces?.[p.i];
        return Boolean(sim?.trouble || sim?.lair);
      });
      if (prov) {
        ok = Living.dispatchBestHero(prov.i);
        message = ok ? `A guild hero set out for ${prov.name}.` : "No idle hero is available.";
      } else {
        message = "No trouble or lair to dispatch against.";
      }
      break;
    }
    case "patron":
      Living.setFavoredState(stateId);
      ok = true;
      message = `${pack.states[stateId]?.name ?? "The state"} is now the Guild's patron.`;
      break;
    case "recruit":
      ok = Living.recruitCandidate(figureId);
      message = ok ? "A new hero joins the Guild." : "Recruitment failed: not enough gold or the roster is full.";
      break;
    case "retire": {
      const protegeId = Living.retireHero(figureId);
      ok = protegeId !== null;
      message = ok ? "The veteran retired and passed the torch to a protege." : "This hero cannot retire yet.";
      if (ok && protegeId !== null) selected = { kind: "figure", id: protegeId };
      break;
    }
    case "dispatch-marker":
      ok = Living.dispatchBestHeroToMarker(Number(button.dataset.marker ?? 0));
      message = ok ? "A guild hero set out to excavate the site." : "No idle hero is available for the dig.";
      break;
    case "equip": {
      const relicId = Number(button.dataset.relic ?? 0);
      ok = Living.equipRelic(relicId, figureId);
      const name = (Living.getRelics?.() ?? []).find(relic => relic.id === relicId)?.name;
      message = ok ? `${name ?? "The relic"} is now carried by the hero.` : "The relic could not be equipped.";
      break;
    }
    case "recall": {
      ok = Living.recallRelic(Number(button.dataset.relic ?? 0));
      message = ok ? "The relic was returned to the Guild Vault." : "The relic could not be recalled.";
      break;
    }
    case "lease":
      ok = Living.leaseRelic(Number(button.dataset.relic ?? 0), stateId);
      message = ok
        ? `${pack.states[stateId]?.name ?? "The state"} now leases the relic from the Guild.`
        : "The lease failed: no vault relic or valid state.";
      break;
    case "petition": {
      const popupId = Number(button.dataset.popup ?? 0);
      const choice = Number(button.dataset.choice ?? 0);
      const outcome = Living.resolvePetition(popupId, choice);
      ok = outcome !== null;
      message = outcome?.summary ?? "The petition could not be resolved.";
      if (ok) selected = null;
      break;
    }
    default:
      return;
  }

  afterTick();
  setStatus(message);
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
    case "excavate-marker": {
      const markerId = Number(button.dataset.marker ?? 0);
      ok = Living.excavateMarker(markerId);
      message = ok ? "The site was excavated instantly." : "Nothing left to excavate here.";
      if (ok) selected = { kind: "marker", id: markerId };
      break;
    }
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
