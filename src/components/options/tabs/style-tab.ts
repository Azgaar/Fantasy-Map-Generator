// Style tab shell: the preset row, the element and group selects and the form container. The rows are
// rendered by Controllers.StyleEditor from the styles schema; the preset row is wired by StylePresetsEditor
import { ensureEl } from "@/utils/nodeUtils";

const TEMPLATE = /* html */ `
  <div class="head">
    <p data-tip="Select a style preset. State labels may required regeneration if font is changed">Preset:</p>
    <button type="button" id="stylePreset" data-tip="Click to select a style preset"></button>
    <button id="addStyleButton" data-tip="Click to save current style as a new preset" class="icon-plus sideButton"></button>
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
    --style-card-fill: rgba(255, 255, 255, .1);
    --style-card-head: rgba(255, 255, 255, .2);
    --style-group-line: rgba(0, 0, 0, .15);
  }
  #styleContent .head { display: flex; align-items: center; gap: .4em; margin: .3em 0; }
  #styleContent .head > p { flex: 0 0 8.5em; margin: 0; }
  #styleContent .head > select { flex: 1 1 auto; min-width: 0; }
  #stylePreset { flex: 1 1 auto; min-width: 0; height: 1.6em; margin: 0; padding: 0 .3em; font-size: smaller; display: flex; align-items: center; gap: .4em; background: #fff; color: #000; border: .5px solid #dbdfe6; border-top-color: #abadb3; border-radius: .5px; text-transform: capitalize; cursor: pointer; }
  #stylePreset > span { flex: 1 1 auto; min-width: 0; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #stylePreset::after { content: "▾"; opacity: .6; }
  #styleContent .head > button.sideButton { flex: none; margin-block: 0; }
  #styleForm { margin-top: .4em; }
  #styleForm .banner { color: darkred; font-weight: 700; margin: .3em 0; }
  #styleForm .banner a { cursor: pointer; text-decoration: underline; }
  #styleForm .pick { margin: 0; flex: 1 1 0; display: flex; align-items: center; gap: .4em; padding: 0.1em .4em; background: #ffffff; font-size: smaller; }
  #styleForm .pick::after { content: "▾"; margin-left: auto; opacity: .6; }
  #styleForm .pick > svg { flex: none; width: 1.4em; height: 1.4em; overflow: visible; }
  #styleForm .reset { flex: none; visibility: hidden; border: 0; background: none; box-shadow: none; color: var(--dark-solid); padding: 0 .2em; margin: 0; cursor: pointer; }
  #styleForm .changed .reset { visibility: visible; }
  #styleForm .reset.blank { visibility: hidden; }
  #styleForm details[data-section] > summary:has(> .gate.changed) { box-shadow: inset 3px 0 0 var(--dark-solid); }
  #styleForm summary > .preview { display: flex; height: 1.6em; } /* reserved, so every header is the same height */
  #styleForm summary > .preview > .sample { font-size: 1.25em; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #styleForm summary > .preview > .chip { flex: none; width: 2.95em; height: 1.6em; overflow: visible; }
  #styleForm summary > .preview > .ramp { flex: none; width: 2.6em; height: .9em; border: 1px solid #333; border-radius: 3px; }
  #styleForm summary > .preview > .tex { flex: none; width: 1.8em; height: 1.5em; border: 1px solid #333; border-radius: 3px; background-size: cover; background-position: center; }
  #styleForm summary > .preview > .icon { flex: none; display: flex; }
  #styleForm summary > .preview > .icon > svg { width: 1.5em; height: 1.5em; overflow: visible; }
  #styleForm summary > .preview > .off { opacity: .45; }
`;

ensureEl("styleContent").innerHTML = TEMPLATE;
const style = document.createElement("style");
style.textContent = STYLE;
document.head.append(style);
