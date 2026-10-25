/**
 * button.ts — the ⚔ Total War button in FMG's top bar, and its menu.
 *
 * It is a native `<button>` inside `#sticked`, so it inherits FMG's button
 * styling, sits in the top bar FMG already owns, and survives everything FMG does
 * to that bar (tips, responsive collapse, save/load round-trips). Only
 * `margin-left: auto` is added, to push it to the right edge (MOD-PLAN §3.4).
 *
 * The menu repeats Total War's five layers as checkboxes because FMG's Layers tab
 * has ~30 entries and ours would be buried at the bottom of it (D7). The tab stays
 * authoritative — both read and write the same registry state, which is what
 * round-trips into the `.map` file.
 *
 * Campaign actions (start / end turn / detach) are present and *disabled*: they
 * need the engine (Phase B) and a stored campaign (Phase C). Their handlers are
 * already written, so those phases switch them on rather than rebuilding this
 * menu. "About Total War" opens an FMG-native dialog, which is the same widget
 * Phase B's decisions will use.
 */

import { currentContent, rulesSummary } from "../content/store";
import { getSlot, setSlot } from "../store/mod-slot";
import {
  currentArchive,
  currentSession,
  detachCampaign,
  dispatchCommand,
  duplicateCampaign,
  exportPayload,
  onSession,
  resetRules,
  restoreFromMirror,
  sessionArchivePayload,
  startCampaign
} from "../store/session";
import { openConfigDialog } from "./content/config";
import { openFactionEditor, openGameConfig } from "./content/editors";
import { openStateForcesDialog } from "./content/state-forces";
import { escapeHtml, type FmgCommand, fmg, twWarn } from "./fmg";
import { twLayerIds } from "./layers/index";
import { showLogDialog } from "./log";
import { openDialog } from "./panels/dialog";
import { applyPreset, currentPreset, PRESETS } from "./presets";
import { lastRebase, showRebaseReport } from "./rebase";

const FALLBACK_ID = "totalWarFallback";
const MENU_ID = "tw-menu";

let menu: HTMLElement | null = null;
let fallback: HTMLButtonElement | null = null;

/** Which trigger the menu should hang from: FMG's top bar when it is on screen,
 *  the compact viewport trigger when it is not. */
function anchor(): HTMLElement | null {
  fallback ??= document.getElementById(FALLBACK_ID) as HTMLButtonElement | null;
  if (fallback && !fallback.hasAttribute("hidden")) return fallback;
  return fallback;
}

/**
 * Park the menu next to its anchor, in viewport coordinates — below it when there
 * is room, above it when there is not (FMG's top bar sits low in its panel, so
 * "below" is often off-screen), and never past either edge.
 */
function placeMenu(): void {
  const host = anchor();
  if (!menu || !host) return;
  if (typeof host.getBoundingClientRect !== "function" || typeof menu.getBoundingClientRect !== "function") return;
  const rect = host.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const gap = 6;
  const below = rect.bottom + gap;
  const fitsBelow = below + menuRect.height <= window.innerHeight - 8;
  menu.style.top = fitsBelow
    ? `${Math.round(below)}px`
    : `${Math.max(8, Math.round(rect.top - gap - menuRect.height))}px`;
  menu.style.left = `${Math.round(Math.max(8, Math.min(window.innerWidth - menuRect.width - 8, rect.right - 232)))}px`;
}

function layerLabel(id: string): string {
  return (
    fmg()
      ?.LAYER_TOGGLES?.get(id)
      ?.label.replace(/<\/?u>/g, "") ?? id
  );
}

function layerHint(id: string): string | undefined {
  return fmg()?.LAYER_TOGGLES?.get(id)?.hint;
}

function toggleMenu(open?: boolean): void {
  if (!menu) return;
  const next = open ?? !menu.classList.contains("is-open");
  menu.classList.toggle("is-open", next);
  fallback?.classList.toggle("is-open", next);
  fallback?.setAttribute("aria-expanded", String(next));
  // Render BEFORE placing: the placement reads the menu's own height to decide
  // whether it fits below its anchor, and an empty menu always "fits".
  if (next) renderMenu();
}

type MenuAction =
  | { kind: "layer"; id: string }
  | { kind: "preset"; id: string }
  | { kind: "campaign"; id: "start" | "end" | "duplicate" | "detach" | "restore" | "export" }
  | {
      kind: "rules";
      id: "configlib" | "rosters" | "buildings" | "tech" | "factions" | "stateforces" | "config" | "reset";
    }
  | { kind: "rebase-report" }
  | { kind: "log" }
  | { kind: "archive-download" }
  | { kind: "about" };

interface MenuRow {
  label: string;
  action?: MenuAction;
  hint?: string;
  key?: string;
  checked?: boolean;
  active?: boolean;
  disabled?: boolean;
  title?: string;
}

function rowHtml(row: MenuRow): string {
  const check = row.checked === undefined ? "" : `<span class="tw-menu-check">${row.checked ? "✓" : ""}</span>`;
  const classes = row.active ? "tw-menu-button is-active" : "tw-menu-button";
  const actionId = row.action && "id" in row.action ? row.action.id : "";
  const action = row.action ? ` data-tw-action="${row.action.kind}" data-tw-id="${actionId}"` : "";
  return (
    `<button class="${classes}"${action}${row.disabled ? " disabled" : ""}` +
    `${row.title ? ` title="${row.title.replace(/"/g, "&quot;")}"` : ""}>` +
    `${check}<span class="tw-menu-label">${row.label}</span>` +
    `${row.key ? `<span class="tw-menu-key">${row.key}</span>` : ""}</button>`
  );
}

/** Rebuild the menu body. Cheap, and only while the menu is actually open. */
function renderMenu(): void {
  if (!menu) return;
  const registry = fmg()?.Layers;
  const preset = currentPreset();

  // Campaign actions are live as of Phase B: the engine runs in the page, so
  // start/end/detach are real. They are enabled by what is actually loaded —
  // a disabled button here would be a lie about the engine's state.
  const live = currentSession();
  const attached = !!live?.store.state;
  const factionNames = live?.factionNames ?? [];
  const edited = currentContent().edited;
  const rebased = lastRebase() != null;
  const archived = currentArchive() != null;

  // Phase C: the campaign's lifecycle. The campaign id and turn are in the menu
  // header, because a campaign that lives in a file needs to be identifiable —
  // that is what "continue" and "duplicate" operate on.
  const campaignRows: MenuRow[] = [
    {
      label: attached ? "New campaign" : "Start campaign",
      action: { kind: "campaign", id: "start" },
      disabled: !live || factionNames.length === 0,
      title: !live ? "Compiling this world…" : `${factionNames.length} factions available`
    },
    {
      label: "End turn",
      action: { kind: "campaign", id: "end" },
      disabled: !attached,
      title: attached ? "Resolve the turn in the in-page engine" : "No campaign attached"
    },
    {
      label: "Duplicate campaign",
      action: { kind: "campaign", id: "duplicate" },
      disabled: !live || factionNames.length === 0,
      title: "Same world and faction, a fresh log from turn 1"
    },
    {
      label: "Detach campaign",
      action: { kind: "campaign", id: "detach" },
      disabled: !attached,
      title: "Leaves the pack loaded; the campaign log is discarded from this map"
    },
    {
      label: "Restore from mirror",
      action: { kind: "campaign", id: "restore" },
      disabled: !live,
      title: "IndexedDB copy, for when the file's campaign was lost"
    },
    { label: "Export campaign…", action: { kind: "campaign", id: "export" }, disabled: !attached },
    // What has happened so far, read out. A dialog, not a layer: nothing is drawn
    // on the map, so it has no business in the Layers tab or the `.map` file.
    {
      label: "Campaign log…",
      action: { kind: "log" },
      disabled: !attached,
      title: attached ? "Every event of this campaign, as it happens" : "No campaign attached"
    },
    // Phase D: the ruleset is page state now, so it gets editors of its own. They
    // are grouped under a header rather than listed flat — five rows of "Rules ·"
    // in the main menu would drown the campaign ones. The defaults live in one
    // Config dialog (culture groups, units, buildings, tech); the state rows edit
    // what an individual empire fields, builds and researches.
    { label: "— Rules —", action: undefined, disabled: true, title: rulesSummary() },
    {
      label: "Game config",
      action: { kind: "rules", id: "config" },
      title: "Turns, movement, battle, economy, military"
    },
    {
      label: "Faction Forces",
      action: { kind: "rules", id: "configlib" },
      title: "Faction forces and the game's defaults: units, buildings, tech (saved in this browser)"
    },
    {
      label: "Reset All Rules",
      action: { kind: "rules", id: "reset" },
      disabled: !edited,
      title: edited
        ? "Throw this map's rule edits away and reset to shipped"
        : "This map already plays by the shipped rules"
    },
    { label: "— States —", action: undefined, disabled: true, title: "Edit the individual active states" },
    {
      label: "Factions",
      action: { kind: "rules", id: "factions" },
      title: "State assignments, faction forces, player control, and traits"
    },
    {
      label: "State Forces",
      action: { kind: "rules", id: "stateforces" },
      title: "Armies, buildings, and technology for individual states"
    },
    // Phase E: what a structural edit did to the live campaign, and the archive
    // a failed rebase left behind. Both rows are quiet until there is something
    // to say — E6's rule is that the map, not our chrome, is the product.
    {
      label: "Rebase report…",
      action: { kind: "rebase-report" },
      disabled: !rebased,
      title: rebased ? "What the last map edit did to the campaign" : "No map edit has touched a campaign yet"
    },
    {
      label: "Download archived campaign",
      action: { kind: "archive-download" },
      disabled: !archived,
      title: archived ? "The log of the campaign a rebase could not carry" : "Nothing is archived"
    },
    { label: "About OpenConquest", action: { kind: "about" } }
  ];

  const layerRows: MenuRow[] = twLayerIds().map(id => ({
    label: layerLabel(id),
    action: { kind: "layer", id },
    checked: registry?.isOn(id) ?? false,
    key: layerHint(id)
  }));

  const presetRows: MenuRow[] = PRESETS.map(p => ({
    label: p.label,
    action: { kind: "preset", id: p.id },
    active: preset === p.id,
    title: p.hint
  }));

  menu.innerHTML =
    `<div class="tw-menu-head">Campaign</div>` +
    campaignRows.map(rowHtml).join("") +
    `<div class="tw-menu-sep"></div><div class="tw-menu-head">Layers</div>` +
    layerRows.map(rowHtml).join("") +
    `<div class="tw-menu-sep"></div><div class="tw-menu-head">Presets</div>` +
    presetRows.map(rowHtml).join("") +
    `<div class="tw-menu-sep"></div>` +
    `<div class="tw-menu-note">Every layer here is also in FMG's Layers tab, and its state round-trips in the .map file.</div>`;
  placeMenu();
}

/** Run a menu action. Pure enough to unit test the mapping, thin enough to read. */
function runAction(action: MenuAction): void {
  const registry = fmg()?.Layers;
  if (action.kind === "layer") {
    registry?.toggle(action.id);
  } else if (action.kind === "preset") {
    applyPreset(action.id);
    setSlot({ ui: { ...getSlot().ui, preset: action.id } });
  } else if (action.kind === "campaign") {
    runCampaignAction(action.id);
  } else if (action.kind === "rules") {
    runRulesAction(action.id);
  } else if (action.kind === "rebase-report") {
    showRebaseReport();
    renderMenu(); // the report has been seen; the badge row goes quiet
  } else if (action.kind === "log") {
    showLogDialog();
  } else if (action.kind === "archive-download") {
    downloadArchive();
  } else if (action.kind === "about") {
    showAbout();
  }
  renderMenu();
}

/**
 * The archive's log, as a download (E5: never silently discard).
 *
 * The archive lives in memory for the session only — the honest thing is to hand
 * the user the bytes before the tab closes, not to pretend it is still a campaign.
 */
function downloadArchive(): void {
  const archived = currentArchive();
  if (!archived) return;
  const payload = JSON.stringify(sessionArchivePayload(), null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${archived.id}.archived.json`;
  link.click();
  // Revoked on the next tick: revoking synchronously can cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The rule editors (Phase D). Each one works on a draft and applies on confirm. */
function runRulesAction(
  id: "configlib" | "stateforces" | "rosters" | "buildings" | "tech" | "factions" | "config" | "reset"
): void {
  if (id === "configlib") openConfigDialog();
  else if (id === "stateforces" || id === "rosters" || id === "buildings" || id === "tech") openStateForcesDialog();
  else if (id === "factions") openFactionEditor();
  else if (id === "config") openGameConfig();
  else {
    const result = resetRules();
    if (result.ok) renderMenu();
    else twWarn(`could not reset the rules: ${result.errors.join("; ")}`);
  }
}

/** The campaign lifecycle: start, end turn, duplicate, detach, restore, export. */
function runCampaignAction(id: "start" | "end" | "duplicate" | "detach" | "restore" | "export"): void {
  const store = currentSession()?.store;
  if (!store) return;
  if (id === "start") {
    const outcome = startCampaign();
    if (outcome && !outcome.ok) twWarn(`campaign did not start: ${outcome.error}`);
  } else if (id === "end") {
    const outcome = dispatchCommand({ type: "EndTurn" });
    if (outcome && !outcome.ok) twWarn(`end turn rejected: ${outcome.error}`);
  } else if (id === "duplicate") {
    const outcome = duplicateCampaign();
    if (outcome && !outcome.ok) twWarn(`could not duplicate: ${outcome.error}`);
  } else if (id === "detach") {
    detachCampaign();
    setSlot({ ui: { ...getSlot().ui, mode: "cartographer" } });
  } else if (id === "restore") {
    // Async: it reads IndexedDB. The menu re-renders when the session changes.
    void restoreFromMirror().then(result => {
      if (!result.adopted) twWarn(`mirror restore skipped: ${result.reason}`);
    });
  } else {
    downloadCampaign();
  }
}

/** Save the campaign as a `.totalwar.json` the player can keep or share. */
function downloadCampaign(): void {
  const payload = exportPayload();
  const id = currentSession()?.store.state?.id ?? "campaign";
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${id}.totalwar.json`;
  link.click();
  // Revoked on the next tick: revoking synchronously can cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * The mod's own modal, in FMG's dialog widget.
 *
 * Phase A has no decisions to raise yet, but this proves the path those decisions
 * will take: the same jQuery UI dialog FMG uses for its own editors, with our
 * styles and FMG's z-order and Escape handling, and no CSS of our own.
 */
function showAbout(): void {
  openDialog({
    title: "⚔ OpenConquest: Atlas Invictus",
    width: 480,
    html:
      `<p style="margin:0 0 8px"><strong>OpenConquest: Atlas Invictus</strong> is a grand-strategy campaign mod running inside Fantasy Map Generator.</p>` +
      `<p style="margin:0 0 8px">Designed as an independent fan-made homage to classic grand strategy and Total War–style campaigns.</p>` +
      `<ul style="margin:0 0 8px;padding-left:18px;line-height:1.6">` +
      `<li><b>${escapeHtml(globalThis.TotalWar?.version ?? "0.1.0")}</b> — Seamless integration with FMG's native layers, tools, and UI.</li>` +
      `<li>Political provinces become regions; burgs become settlements; military forces become strategic armies.</li>` +
      `<li>The campaign, faction forces, and custom rules travel directly inside the <code>.map</code> file.</li>` +
      `<li>Every OpenConquest layer also appears in FMG's own <b>Layers</b> tab.</li>` +
      `<li>FMG keeps every one of its tools: nothing is hidden or overwritten.</li>` +
      `</ul>` +
      `<p style="margin:10px 0 0; font-size: 0.82em; color: #666; line-height: 1.4; border-top: 1px solid #ccc; padding-top: 6px;">` +
      `<strong>Trademark Notice:</strong> OpenConquest is an independent open-source homage. Total War is a registered trademark of SEGA Games Co., Ltd. and/or Creative Assembly. This project is not affiliated with, endorsed by, or sponsored by SEGA or Creative Assembly.` +
      `</p>`,
    buttons: { Close: () => {} }
  });
}

/**
 * Turn a row's data attributes back into a menu action.
 *
 * This exists so adding a kind of menu row cannot leave it inert. It happened
 * twice: campaign rows were dead DOM because the delegated listener listed kinds
 * one by one and forgot one, and the rules editors nearly did the same. Rows
 * declare their action; this reads it; `runAction` decides what it means.
 */
function actionFromDataset(kind: string | undefined, id: string | undefined): MenuAction | null {
  if (!kind) return null;
  switch (kind) {
    case "layer":
      return id ? { kind: "layer", id } : null;
    case "preset":
      return id ? { kind: "preset", id } : null;
    case "campaign":
      return id ? ({ kind: "campaign", id } as MenuAction) : null;
    case "rules":
      return id ? ({ kind: "rules", id } as MenuAction) : null;
    case "rebase-report":
      return { kind: "rebase-report" };
    case "log":
      return { kind: "log" };
    case "archive-download":
      return { kind: "archive-download" };
    case "about":
      return { kind: "about" };
    default:
      return null;
  }
}

/** One delegated listener survives every re-render, via data attributes. */
function wireMenu(): void {
  if (!menu) return;
  menu.addEventListener("click", event => {
    const target = (event.target as Element | null)?.closest<HTMLElement>("[data-tw-action]");
    if (!target || !menu) return;
    const action = actionFromDataset(target.dataset.twAction, target.dataset.twId);
    if (action) runAction(action);
  });
}

/**
 * Exactly one ⚔ trigger is ever on screen.
 *
 * FMG's top bar is inside `#options`, which is hidden until the user presses Tab.
 * When it is hidden the compact viewport trigger stands in; when it is shown, the
 * native button in the bar does. We watch FMG's own show/hide (it sets
 * `display` on `#options`) rather than guessing from layout, and we never touch
 * FMG's own visibility either way.
 */
export function setFallbackVisible(visible: boolean): void {
  fallback ??= document.getElementById(FALLBACK_ID) as HTMLButtonElement | null;
  if (!fallback) return;
  fallback.hidden = !visible;
  if (!fallback.hidden) placeMenu();
}

function syncFallback(): void {
  if (!fallback || fallback.hidden) return;
  placeMenu();
}

function watchFmgPanel(): void {
  const options = document.getElementById("options");
  if (!options || typeof MutationObserver === "undefined") return;
  const observer = new MutationObserver(() => syncFallback());
  observer.observe(options, { attributes: true, attributeFilter: ["style"] });
  window.addEventListener("resize", () => syncFallback());
}

/** Install the ⚔ button and menu. Idempotent. */
export function installButton(): void {
  if (document.getElementById(FALLBACK_ID)) return;

  const fallbackLabel = (): string => {
    const campaign = currentSession()?.store.state;
    return campaign ? `⚔ T${campaign.turn}` : "⚔";
  };
  onSession(() => {
    if (fallback && fallback.textContent !== fallbackLabel()) fallback.textContent = fallbackLabel();
    if (menu?.classList.contains("is-open")) renderMenu();
  });

  menu = document.createElement("div");
  menu.id = MENU_ID;
  menu.setAttribute("role", "menu");
  document.body.append(menu);
  wireMenu();

  fallback = document.createElement("button");
  fallback.id = FALLBACK_ID;
  fallback.textContent = "⚔";
  fallback.setAttribute("data-tip", "OpenConquest: Atlas Invictus — campaign menu, layers and presets");
  fallback.setAttribute("aria-haspopup", "true");
  fallback.setAttribute("aria-expanded", "false");
  fallback.hidden = true;
  document.body.append(fallback);
  fallback.addEventListener("click", event => {
    event.stopPropagation();
    toggleMenu();
  });

  syncFallback();

  document.addEventListener("click", event => {
    if (!menu?.classList.contains("is-open")) return;
    if (fallback?.contains(event.target as Node)) return;
    toggleMenu(false);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && menu?.classList.contains("is-open")) toggleMenu(false);
  });
  watchFmgPanel();
}

/** Open or close the menu from outside (omnibar, hotkeys, tests). */
export function toggleTotalWarMenu(open?: boolean): void {
  toggleMenu(open);
}

/** Publish our actions into FMG's command bus, for omnibar search + the registry. */
export function registerCommands(): string[] {
  const bus = fmg()?.MAP_COMMANDS;
  if (!bus) {
    twWarn("FMG MAP_COMMANDS missing — is patch 0003 applied? Omnibar entries will not appear.");
    return [];
  }
  const registry = fmg()?.Layers;
  const commands: FmgCommand[] = [
    {
      id: "twMenu",
      name: "Open OpenConquest Menu",
      aliases: "openconquest conquest campaign war atlas invictus ⚔",
      run: () => toggleTotalWarMenu()
    },
    {
      // The log is a dialog, not a layer, so it gets its own omnibar entry
      // rather than one of the generated `twLayer:` toggles.
      id: "twLog",
      name: "Open the Campaign Log",
      aliases: "openconquest log journal history events what happened",
      run: () => showLogDialog()
    },
    ...PRESETS.map(preset => ({
      id: `twPreset:${preset.id}`,
      name: `Apply OpenConquest Preset: ${preset.label}`,
      aliases: "openconquest layers preset",
      run: () => applyPreset(preset.id)
    })),
    ...twLayerIds().map(id => ({
      id: `twLayer:${id}`,
      name: `Toggle ${layerLabel(id)}`,
      aliases: "openconquest layer visibility",
      run: () => registry?.toggle(id)
    }))
  ];

  for (const command of commands) {
    const existing = bus.findIndex(candidate => candidate.id === command.id);
    if (existing >= 0) bus[existing] = command;
    else bus.push(command);
  }
  return commands.map(command => command.id);
}
