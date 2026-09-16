// Style tab shell: the preset row, the element and group selects and the form container. The rows are
// rendered by Controllers.StyleEditor from the styles schema; the preset row is wired by StylePresetsEditor
import { ensureEl } from "@/utils/nodeUtils";

const TEMPLATE = /* html */ `
  <div class="head">
    <p data-tip="Select a style preset. State labels may required regeneration if font is changed">Preset:</p>
    <select data-tip="Select a style preset" id="stylePreset" style="text-transform: capitalize"></select>
    <button id="addStyleButton" data-tip="Click to save current style as a new preset" class="icon-plus sideButton"></button>
    <button id="removeStyleButton" data-tip="Click to remove current custom style preset" class="icon-minus sideButton" style="display: none"></button>
    <button id="stylePresetGalleryButton" data-tip="Open the preset gallery: every preset as a screenshot" class="icon-brush sideButton"></button>
  </div>
  <div class="head">
    <p data-tip="Select an element to edit its style">Element:</p>
    <select data-tip="Select an element to edit its style (list is ordered alphabetically)" id="styleElementSelect"></select>
    <button id="styleElementTreeButton" data-tip="Browse all elements and their groups" class="icon-sitemap sideButton"></button>
  </div>
  <div class="head group-row" style="display: none">
    <p data-tip="Select element group">Group:</p>
    <select data-tip="Select element group" id="styleGroupSelect"></select>
  </div>
  <div id="styleForm"></div>
`;

const STYLE = /* css */ `
  :root {
    --style-change: #c0392b;
    --style-reset: #7a2e2e;
    --style-pick: #f5c542;
    --style-card-fill: rgba(255, 255, 255, .1);
    --style-card-head: rgba(255, 255, 255, .2);
  }
  #styleContent .head { display: flex; align-items: center; gap: .4em; margin: .3em 0; }
  #styleContent .head > p { flex: 0 0 8.5em; margin: 0; }
  #styleContent .head > select { flex: 1 1 auto; min-width: 0; }
  #styleContent .head > button.sideButton { flex: none; margin-block: 0; }
  #styleForm { margin-top: .4em; }
  #styleForm .banner { color: darkred; font-weight: 700; margin: .3em 0; }
  #styleForm .banner a { cursor: pointer; text-decoration: underline; }
  #styleForm .whiteButton { padding: 0 .8em; border: 0; background-color: #ffffff !important; }
  #styleForm .reset { flex: none; visibility: hidden; border: 0; background: none; box-shadow: none; color: var(--style-reset); padding: 0 .2em; margin: 0; cursor: pointer; }
  #styleForm .changed > .ctl > .reset, #styleForm .gate.changed > .reset { visibility: visible; }
  #styleForm details[data-section] > summary:has(> .gate.changed) { box-shadow: inset 3px 0 0 var(--style-change); }
  #styleForm summary > .preview > .sample { font-size: 1.25em; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #styleForm summary > .preview > .sw { width: 2.6em; height: 1.3em; border: 1px solid #333; border-radius: 3px; position: relative; overflow: hidden; background: repeating-conic-gradient(#bbb 0 25%, #fff 0 50%) 0 0 / 8px 8px; }
  #styleForm summary > .preview > .sw > i { position: absolute; inset: 0; }
  #styleForm summary > .preview > .ln { flex: none; }
  #styleForm summary > .preview > .fx { font-size: .9em; opacity: .75; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;

ensureEl("styleContent").innerHTML = TEMPLATE;
const style = document.createElement("style");
style.textContent = STYLE;
document.head.append(style);
