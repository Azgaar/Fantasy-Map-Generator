/**
 * style.ts — Total War's stylesheet, injected at runtime.
 *
 * Two rules govern this file:
 *
 *  1. **It styles only our own elements.** There is no rule here that hides,
 *     dims or restyles anything FMG owns. Phase 0's predecessor had a dozen
 *     `body.tw-game-mode #someFmgControl { display: none }` rules; MOD-PLAN A.3
 *     deletes that behaviour, and deleting it means it must not reappear here.
 *  2. **The one exception is a layout nudge, not a style.** `#sticked` is
 *     `justify-content: space-evenly`; pushing our button to the right edge needs
 *     `margin-left: auto` on our own button, which moves nothing of FMG's.
 */
import { twWarn } from "./fmg";

const STYLE_ID = "tw-style";

const CSS = /* css */ `
/* -- the ⚔ button in FMG's top bar --------------------------------------- */
#sticked #totalWarButton {
  margin-left: auto; /* push to the right edge under space-evenly */
  color: var(--tw-gold);
}
#sticked #totalWarButton:hover { color: #fff; }
#sticked #totalWarButton.is-open { color: #fff; }

/* -- the fallback trigger ------------------------------------------------------
   FMG keeps its top bar inside #options, which is CLOSED at boot (you press Tab
   to open it). So the ⚔ button lives in FMG's bar where it belongs, and this
   compact trigger stands in for it in the viewport's top-right while the bar is
   hidden. Exactly one is ever visible — see ui/button.ts. */
#totalWarFallback {
  position: fixed;
  top: 10px;
  right: 10px;
  z-index: 100;
  padding: 3px 10px;
  background: var(--tw-panel);
  border: 1px solid var(--tw-edge);
  border-radius: 5px;
  color: var(--tw-gold);
  font: bold 13px/1.4 system-ui, sans-serif;
  cursor: pointer;
}
#totalWarFallback:hover { border-color: var(--tw-gold); color: #fff; }
#totalWarFallback[hidden] { display: none; }

/* -- the ⚔ menu ----------------------------------------------------------- */
#tw-menu {
  /* fixed, because its anchor moves: FMG's top bar or the fallback trigger */
  position: fixed;
  z-index: 120;
  min-width: 232px;
  max-height: calc(100vh - 24px);
  overflow-y: auto;
  padding: 6px;
  display: none;
  flex-direction: column;
  gap: 3px;
  background: var(--tw-panel);
  border: 1px solid var(--tw-edge);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  font: 13px/1.4 system-ui, sans-serif;
  color: var(--tw-ink);
  text-align: left;
}
#tw-menu.is-open { display: flex; }
#tw-menu .tw-menu-head {
  padding: 2px 8px 4px;
  color: var(--tw-dim);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
#tw-menu .tw-menu-sep { height: 1px; margin: 3px 0; background: var(--tw-edge); }
#tw-menu button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 5px 8px;
  background: none;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--tw-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
#tw-menu button:hover:not(:disabled) { background: rgba(200, 162, 74, 0.14); border-color: rgba(200, 162, 74, 0.4); }
#tw-menu button:disabled { opacity: 0.45; cursor: default; }
#tw-menu button.is-active { border-color: var(--tw-gold); color: var(--tw-gold); }
#tw-menu .tw-menu-check {
  flex: none;
  width: 14px;
  text-align: center;
  color: var(--tw-gold);
}
#tw-menu .tw-menu-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#tw-menu .tw-menu-key { color: var(--tw-dim); font-size: 11px; }
#tw-menu .tw-menu-note { padding: 2px 8px 4px; color: var(--tw-dim); font-size: 11px; }

/* -- the right-hand rail --------------------------------------------------- */
#tw-rail {
  position: fixed;
  top: 44px;
  right: 10px;
  bottom: 10px;
  z-index: 90;
  width: 244px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font: 13px/1.45 system-ui, sans-serif;
  color: var(--tw-ink);
  pointer-events: none;
}
#tw-rail.is-collapsed { width: auto; }
#tw-rail.is-collapsed .tw-rail-body { display: none; }
#tw-rail > * { pointer-events: auto; }
#tw-rail .tw-panel {
  background: var(--tw-panel);
  border: 1px solid var(--tw-edge);
  border-radius: 6px;
  backdrop-filter: blur(2px);
}
#tw-rail .tw-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 10px;
  border-bottom: 1px solid var(--tw-edge);
  color: var(--tw-dim);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
#tw-rail .tw-panel-head button {
  background: none;
  border: 0;
  color: var(--tw-dim);
  cursor: pointer;
  font-size: 13px;
  padding: 0 2px;
}
#tw-rail .tw-panel-head button:hover { color: var(--tw-ink); }
#tw-rail .tw-rail-body { overflow: auto; padding: 8px 10px; }
#tw-rail .tw-empty { color: var(--tw-dim); padding: 6px 2px; }
#tw-rail .tw-title { font-size: 15px; font-weight: 600; margin: 0 0 2px; }
#tw-rail .tw-title .tw-owner { color: var(--tw-dim); font-weight: 400; }
#tw-rail .tw-sub { color: var(--tw-dim); margin: 0 0 8px; }
/* A settlement name that opens that settlement's stats. FMG's chrome is never
   touched — these are our own rows in our own panel. */
#tw-rail .tw-link {
  background: none;
  border: 0;
  padding: 0;
  margin: 0;
  color: var(--tw-gold);
  font: inherit;
  text-align: left;
  text-decoration: underline dotted;
  text-underline-offset: 2px;
  cursor: pointer;
}
#tw-rail .tw-link:hover { color: var(--tw-ink); }
#tw-rail .tw-back { display: block; margin-bottom: 6px; font-size: 12px; }
#tw-rail .tw-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 2px 0;
  border-bottom: 1px dotted rgba(34, 48, 66, 0.7);
}
#tw-rail .tw-row span:first-child { color: var(--tw-dim); }
#tw-rail .tw-row span:last-child { min-width: 0; text-align: right; }
#tw-rail .tw-chip {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  margin-right: 6px;
  vertical-align: -1px;
}
#tw-rail .tw-turn { font-weight: 600; }
#tw-rail .tw-endturn {
  width: 100%;
  margin-top: 8px;
  padding: 6px;
  background: var(--tw-gold);
  border: 1px solid #a5853a;
  border-radius: 5px;
  color: #20180a;
  font: inherit;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
}
#tw-rail .tw-endturn:disabled { background: var(--tw-panel); border-color: var(--tw-edge); color: var(--tw-dim); cursor: default; }

/* -- the campaign log dialog ----------------------------------------------- */
.tw-log-head { margin-bottom: 8px; }
.tw-log-head-row { display: flex; align-items: baseline; gap: 8px; }
.tw-log-head .tw-log-turn { font-weight: 700; }
.tw-log-head .tw-log-id { color: #666; font-size: 0.85em; font-family: ui-monospace, monospace; }
.tw-log-head .tw-log-sub { color: #666; font-size: 0.85em; margin-top: 2px; }
.tw-log-empty { color: #666; padding: 10px 2px; line-height: 1.5; }
.tw-log {
  overflow-y: auto;
  max-height: 52vh;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 4px 6px;
  background: #fbfbfb;
  font-size: 0.86em;
  line-height: 1.45;
}
.tw-log-turnhead {
  position: sticky;
  top: -4px;
  margin: 6px 0 3px;
  padding: 2px 0;
  background: #fbfbfb;
  border-bottom: 1px solid #ddd;
  font-weight: 700;
  font-size: 0.95em;
  color: #444;
}
.tw-log-row { display: flex; gap: 8px; padding: 1px 0; border-bottom: 1px dotted #eee; }
.tw-log-row .tw-log-n {
  flex: 0 0 2.2em;
  text-align: right;
  color: #999;
  font-family: ui-monospace, monospace;
  font-size: 0.9em;
}
.tw-log-row .tw-log-text { flex: 1; min-width: 0; }
.tw-log-row[data-kind="battle"] .tw-log-text,
.tw-log-row[data-kind="war"] .tw-log-text { font-weight: 600; color: #7a2010; }
.tw-log-row[data-kind="battle"] { background: #fdf3f1; }
.tw-log-row[data-kind="diplomacy"] .tw-log-text { color: #1f4e79; }
.tw-log-row[data-kind="economy"] .tw-log-text { color: #1e5b2a; }
.tw-log-row[data-kind="character"] .tw-log-text { color: #5b3a86; }
.tw-log-row[data-kind="lifecycle"] .tw-log-text { color: #444; }

/* -- our layers ------------------------------------------------------------ */
[data-layer^="tw"] { pointer-events: none; }
.tw-army, .tw-settlement { cursor: pointer; }
.tw-army text, .tw-settlement text { user-select: none; pointer-events: none; }
.tw-army-count {
  fill: #f5f2e8;
  stroke: rgba(8, 10, 14, 0.8);
  stroke-width: 0.6px;
  paint-order: stroke;
  text-anchor: middle;
  font-family: system-ui, sans-serif;
  font-weight: 600;
}

/* -- the dialog boxes & rule editors (Phase D) -----------------------------
   Deliberately sparse: the dialog itself is FMG's, so it inherits FMG's theme,
   spacing and fonts. These rules only lay out the two-column shape (a record list
   beside its fields) and colour the inputs the way our panels do, so an editor
   reads as part of the mod rather than as a page that pasted itself in. */
.ui-dialog,
.dialog,
#tw-dialog,
.tw-dialog,
.tw-dialog-box,
.tw-dialog-body {
  opacity: 1 !important;
}

.tw-dialog,
.tw-dialog-box,
.tw-dialog-body,
#tw-dialog {
  color: #000000;
  box-sizing: border-box;
}

.tw-dialog-body {
  max-height: 70vh;
  overflow: auto;
  color: #000000;
  padding: 8px 12px;
}

.tw-editor-head h3 {
  margin: 0 0 0.2em;
  font-size: 1.1em;
  font-weight: 700;
  color: #000000;
}
.tw-editor-sub {
  margin: 0 0 0.8em;
  color: #333333;
  font-size: 0.85em;
}
.tw-editor-group {
  margin: 1em 0 0.4em;
  color: #000000;
  font-size: 0.95em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #ddd;
  padding-bottom: 2px;
}

.tw-editor { display: flex; gap: 14px; align-items: flex-start; }
/* Config dialog: tabs, group cards, entry toolbars */
.tw-config { display: flex; flex-direction: column; gap: 8px; }
.tw-config-sub { margin: 0; }
.tw-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 2px solid var(--header, #5d4651);
  padding-bottom: 0;
  margin-bottom: 10px;
}
.tw-tab {
  padding: 6px 14px;
  border: 1px solid #c5c5c5;
  border-bottom: none;
  background: #e6e6e6;
  color: #000000;
  cursor: pointer;
  border-radius: 4px 4px 0 0;
  font-size: 13px;
  font-weight: 600;
  line-height: normal;
  transition: background 0.15s, color 0.15s;
}
.tw-tab:hover {
  background: #d8d8d8;
  color: #000000;
}
.tw-tab.is-active {
  background: var(--header, #5d4651);
  color: #ffffff;
  border-color: var(--header, #5d4651);
  font-weight: 700;
}
.tw-config-body { min-height: 220px; }
.tw-groups { display: flex; flex-direction: column; gap: 8px; }
.tw-group-card {
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 8px 10px;
  background: #fafafa;
}
.tw-group-head {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #000000;
  font-weight: 600;
}
.tw-group-meta { color: #444444; font-size: 12px; margin-left: auto; }
.tw-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 8px;
  background: #e0e0e0;
  border: 1px solid #bbb;
  color: #000000;
}
.tw-group-match { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; }
.tw-entry-new {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 10px;
  flex-wrap: wrap;
}
.tw-hint { color: #444444; font-size: 12px; margin: 4px 0 8px; }
.tw-state-picker { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
.tw-avail-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 50vh;
  overflow: auto;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 6px 8px;
  background: #ffffff;
}
.tw-list-count {
  margin-left: auto;
  color: #666666;
  font-size: 11px;
}
.tw-editor-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 150px;
  max-width: 220px;
  max-height: 55vh;
  overflow: auto;
  padding-right: 8px;
  border-right: 1px solid #ccc;
}
.tw-list-item {
  text-align: left;
  padding: 4px 8px;
  border: 1px solid transparent;
  background: transparent;
  color: #000000;
  cursor: pointer;
  border-radius: 3px;
  font-size: 12px;
}
.tw-list-item:hover { background: #e8e8e8; }
.tw-list-item.is-active { background: #dcdcdc; border-color: #999; color: #000000; font-weight: 600; }
.tw-editor-main { flex: 1; min-width: 0; }

/* Roster tree directory */
.tw-roster-tree {
  display: flex;
  flex-direction: column;
  min-width: 220px;
  max-width: 260px;
  max-height: 60vh;
  padding-right: 10px;
  border-right: 1px solid #ccc;
  flex-shrink: 0;
}
.tw-roster-tree-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 8px;
}
.tw-tree-group {
  display: flex;
  flex-direction: column;
}
.tw-tree-head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  color: #000000;
  font-size: 13px;
  font-weight: 600;
  width: 100%;
  text-align: left;
  user-select: none;
}
.tw-tree-head:hover { background: #e8e8e8; color: #000000; }
.tw-tree-head.is-active { background: #dcdcdc; border-color: #999; color: #000000; }
.tw-tree-toggle {
  background: none;
  border: none;
  color: #333333;
  cursor: pointer;
  padding: 0 4px;
  font-size: 10px;
  line-height: 1;
  flex-shrink: 0;
}
.tw-tree-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #000000;
}
.tw-tree-del {
  background: none;
  border: none;
  color: #666666;
  cursor: pointer;
  padding: 0 4px;
  font-size: 11px;
  line-height: 1;
  margin-left: auto;
}
.tw-tree-del:hover { color: #cc0000; }
.tw-tree-children {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-left: 18px;
  margin-top: 1px;
}
.tw-tree-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 6px;
  border-radius: 3px;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  color: #222222;
  font-size: 12px;
  width: 100%;
  text-align: left;
}
.tw-tree-item:hover { background: #ececec; color: #000000; }
.tw-tree-item.is-active { background: #d8d8d8; border-color: #aaa; color: #000000; font-weight: 600; }
.tw-tree-item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #000000;
}
.tw-tree-empty {
  font-size: 11px;
  color: #666666;
  font-style: italic;
  padding: 2px 6px;
}
.tw-roster-tree-footer {
  padding-top: 6px;
  border-top: 1px solid #ccc;
}
.tw-btn,
.tw-dialog button.tw-btn,
.tw-dialog-body button.tw-btn {
  height: 28px;
  line-height: 20px;
  padding: 3px 12px;
  background: #e8e8e8;
  border: 1px solid #767676;
  border-radius: 3px;
  color: #000000;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  font-family: inherit;
}
.tw-btn:hover,
.tw-dialog button.tw-btn:hover,
.tw-dialog-body button.tw-btn:hover {
  background: #d8d8d8;
  border-color: #444444;
  color: #000000;
}
.tw-btn--block {
  width: 100%;
  text-align: center;
  height: 30px;
}
.tw-btn--sm {
  height: 28px !important;
  padding: 2px 8px !important;
  font-size: 11px !important;
  line-height: 18px !important;
}
.tw-btn--danger {
  background: #f8d7da !important;
  border-color: #dc3545 !important;
  color: #721c24 !important;
}
.tw-btn--danger:hover {
  background: #f5c6cb !important;
  border-color: #bd2130 !important;
  color: #721c24 !important;
}
.tw-roster-head-form {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #ccc;
}
.tw-roster-head-form .tw-field { flex: 1; }

.tw-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px 16px;
  margin-bottom: 8px;
}
.tw-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #000000;
}
.tw-field span {
  color: #000000;
  font-weight: 600;
  font-size: 12px;
}
.tw-field--check {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.tw-field--check input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin: 0;
  cursor: pointer;
}
.tw-field--tags { grid-column: 1 / -1; }
.tw-tags { display: flex; flex-wrap: wrap; gap: 6px 14px; }
.tw-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #000000;
  cursor: pointer;
}
.tw-tag span {
  color: #000000;
}
.tw-tag input[type="checkbox"] {
  width: 15px;
  height: 15px;
  margin: 0;
  cursor: pointer;
}

.tw-input,
.tw-select,
.tw-dialog-body input:not([type="checkbox"]):not([type="radio"]),
.tw-dialog-body select,
#tw-dialog input:not([type="checkbox"]):not([type="radio"]),
#tw-dialog select,
.tw-dialog input:not([type="checkbox"]):not([type="radio"]),
.tw-dialog select {
  background-color: #ffffff !important;
  color: #000000 !important;
  border: 1px solid #767676 !important;
  border-radius: 3px !important;
  box-sizing: border-box !important;
  font-size: 13px !important;
  font-family: inherit !important;
  vertical-align: middle;
}

.tw-dialog select,
.tw-dialog-body select,
#tw-dialog select,
.tw-select {
  height: 28px !important;
  min-height: 28px !important;
  line-height: normal !important;
  padding: 2px 24px 2px 8px !important;
}

.tw-dialog input:not([type="checkbox"]):not([type="radio"]),
.tw-dialog-body input:not([type="checkbox"]):not([type="radio"]),
#tw-dialog input:not([type="checkbox"]):not([type="radio"]),
.tw-input {
  height: 28px !important;
  min-height: 28px !important;
  line-height: 20px !important;
  padding: 3px 8px !important;
}

.tw-dialog input:disabled,
.tw-dialog input[readonly],
.tw-dialog-body input:disabled,
.tw-dialog-body input[readonly],
.tw-input:disabled,
.tw-input[readonly] {
  background-color: #f0f0f0 !important;
  color: #555555 !important;
  border-color: #cccccc !important;
  cursor: not-allowed;
}

.tw-dialog select:focus,
.tw-dialog-body select:focus,
#tw-dialog select:focus,
.tw-select:focus,
.tw-dialog input:focus,
.tw-dialog-body input:focus,
#tw-dialog input:focus,
.tw-input:focus {
  border-color: var(--header, #5d4651) !important;
  outline: 1px solid var(--header, #5d4651) !important;
}

.tw-dialog select option,
.tw-dialog-body select option,
#tw-dialog select option,
.tw-select option {
  background-color: #ffffff !important;
  color: #000000 !important;
  font-size: 13px !important;
  padding: 4px 6px !important;
}

.tw-field input:not([type="checkbox"]):not([type="radio"]),
.tw-field select {
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
}

.tw-input--number {
  width: 5.5em !important;
  min-width: 65px !important;
  text-align: right !important;
}

.tw-units-wrap {
  max-width: 100%;
  overflow-x: auto;
  margin-top: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #ffffff;
}
.tw-units {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
  font-size: 12px;
  color: #000000;
}
.tw-units th {
  text-align: left;
  color: #000000;
  font-weight: 700;
  padding: 6px 8px;
  background: #f2f2f2;
  border-bottom: 2px solid #ccc;
  white-space: nowrap;
}
.tw-units td {
  padding: 4px 6px;
  border-bottom: 1px solid #e8e8e8;
  vertical-align: middle;
  color: #000000;
}
.tw-units tr:nth-child(even) td {
  background: #fafafa;
}
.tw-units tr:hover td {
  background: #f0f4f8;
}
.tw-units .tw-input:not(.tw-input--number) {
  width: 100% !important;
  min-width: 110px !important;
}
.tw-units select.tw-select {
  width: 100% !important;
  min-width: 95px !important;
}
.tw-units .tw-input--number {
  width: 5.5em !important;
  min-width: 65px !important;
  text-align: right !important;
}
.tw-unit-id {
  font-family: var(--monospace, monospace);
  color: #000000;
  font-weight: 600;
}
.tw-units .is-patched {
  border: 2px solid var(--header, #5d4651);
}

.tw-factions-wrap {
  max-height: 60vh;
  overflow-y: auto;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #ffffff;
}
.tw-factions-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  color: #000000;
}
.tw-factions-table th {
  position: sticky;
  top: 0;
  background: #f2f2f2;
  color: #000000;
  text-align: left;
  padding: 6px 8px;
  font-weight: 700;
  border-bottom: 2px solid #ccc;
  z-index: 2;
  white-space: nowrap;
}
.tw-factions-table td {
  padding: 6px 8px;
  border-bottom: 1px solid #e8e8e8;
  vertical-align: middle;
  color: #000000;
}
.tw-factions-table tr:nth-child(even) td {
  background: #fafafa;
}
.tw-factions-table tr:hover td {
  background: #f0f4f8;
}
.tw-faction-col { display: flex; align-items: center; gap: 8px; }
.tw-faction-swatch { display: inline-block; width: 14px; height: 14px; border-radius: 3px; border: 1px solid rgba(0, 0, 0, 0.3); flex-shrink: 0; }
.tw-faction-name { font-weight: 600; color: #000000; }
.tw-state-id { color: #333333; font-size: 0.85em; font-family: var(--monospace, monospace); }
.tw-culture-label { color: #000000; font-weight: 500; }
.tw-factions-table select.tw-select {
  width: 100% !important;
  min-width: 110px !important;
  color: #000000 !important;
}
.tw-traits-cell { display: flex; flex-direction: column; gap: 4px; }
.tw-traits-list { display: flex; flex-wrap: wrap; gap: 4px; min-height: 20px; align-items: center; }
.tw-traits-none { color: #333333; font-style: italic; font-size: 0.9em; }
.tw-tag--removable {
  background: #ededed;
  border: 1px solid #ccc;
  border-radius: 3px;
  padding: 2px 6px;
  color: #000000;
  font-size: 0.85em;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.tw-tag-remove {
  background: none;
  border: none;
  color: #333333;
  cursor: pointer;
  padding: 0 2px;
  font-size: 1.1em;
  line-height: 1;
  font-weight: 700;
}
.tw-tag-remove:hover { color: #cc0000; }
.tw-trait-picker { display: flex; align-items: center; gap: 4px; }
.tw-trait-picker .tw-trait-select {
  min-width: 130px !important;
}
.tw-select--sm {
  height: 28px !important;
  min-height: 28px !important;
  font-size: 12px !important;
  padding: 2px 20px 2px 6px !important;
  color: #000000 !important;
  box-sizing: border-box !important;
}
.tw-empty-note { color: #000000; padding: 20px; text-align: center; }

.tw-errors { display: none; }

/* -- Phase E: the rebase badge and report -----------------------------------
   The dot on the ⚔ button is the only chrome a messy rebase adds, and it goes
   out the moment the report is read. */
.tw-rebase { position: relative; }
.tw-rebase::after {
  content: "";
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--tw-gold);
  box-shadow: 0 0 4px rgba(200, 162, 74, 0.9);
  pointer-events: none;
}
.tw-rebase-reason { font-family: ui-monospace, monospace; font-size: 0.85em; margin: 0.4em 0; }
.tw-rebase-archive { margin-top: 0.8em; padding: 8px 10px; border-left: 3px solid var(--tw-gold); background: rgba(200, 162, 74, 0.1); }

.tw-errors { display: none; }
.tw-errors.is-shown {
  display: block; margin-bottom: 10px; padding: 8px 10px;
  border-left: 3px solid #c85a4a; background: rgba(200, 90, 74, 0.12);
}
.tw-errors-title { margin: 0 0 0.3em; font-weight: 600; }
.tw-errors ul { margin: 0; padding-left: 1.2em; }

/* -- State Forces dialog ---------------------------------------------------- */
.tw-state-forces {
  display: flex;
  flex-direction: column;
  min-height: 520px;
  max-height: 72vh;
}
.tw-state-forces-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
  gap: 12px;
  margin-top: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #ffffff;
}
.tw-state-forces-tree {
  width: 270px;
  min-width: 270px;
  border-right: 1px solid #ccc;
  overflow-y: auto;
  padding: 8px;
  background: #fafafa;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tw-state-forces-content {
  flex: 1;
  overflow-y: auto;
  padding: 14px 18px;
  background: #ffffff;
}
.tw-tree-subgroup {
  display: flex;
  flex-direction: column;
  margin-top: 2px;
}
.tw-tree-subhead {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 6px 3px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #222222;
  cursor: pointer;
  border-radius: 3px;
  width: 100%;
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
}
.tw-tree-subhead:hover { background: #e8e8e8; color: #000000; }
.tw-tree-subhead.is-active { background: #dcdcdc; border-color: #aaa; color: #000000; }
.tw-tree-item--indent {
  padding-left: 24px !important;
}
.tw-settlement-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px;
  background: #f8f8f8;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}
.tw-tech-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
  max-height: 48vh;
  overflow-y: auto;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 6px;
  background: #fafafa;
}
.tw-tech-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  background: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: #000000;
}
.tw-tech-item:hover { background: #f0f4f8; border-color: #bbb; }
.tw-tech-item.is-checked { background: #f0f7ff; border-color: #8bb6e8; }
.tw-tech-name { font-weight: 600; color: #000000; flex: 1; }
.tw-tech-era { font-size: 11px; color: #555555; }
.tw-tech-effects { font-size: 12px; color: #222222; }
`;

/** Theme variables, scoped to `:root` so our panels never redefine FMG's. */
const VARS = /* css */ `
:root {
  --tw-panel: rgba(18, 26, 38, 0.92);
  --tw-edge: #223042;
  --tw-ink: #d8d4c8;
  --tw-dim: #8a94a3;
  --tw-gold: #c8a24a;
}
`;

/** Install our stylesheet once. Safe to call again. */
export function installStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  try {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = VARS + CSS;
    document.head.append(style);
  } catch (error) {
    twWarn("failed to install styles", error);
  }
}
