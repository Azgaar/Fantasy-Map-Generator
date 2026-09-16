// Style tab shell: the preset row, the element and group selects and the form container. The rows are
// rendered by Controllers.StyleEditor from the styles schema; the preset row is wired by StylePresetsEditor
import { ensureEl } from "@/utils/nodeUtils";

const TEMPLATE = /* html */ `
  <div class="head">
    <p data-tip="Select a style preset. State labels may required regeneration if font is changed">Preset:</p>
    <select data-tip="Select a style preset" id="stylePreset" style="text-transform: capitalize"></select>
    <button id="addStyleButton" data-tip="Click to save current style as a new preset" class="icon-plus sideButton"></button>
    <button id="removeStyleButton" data-tip="Click to remove current custom style preset" class="icon-minus sideButton" style="display: none"></button>
  </div>
  <div class="head">
    <p data-tip="Select an element to edit its style">Element:</p>
    <select data-tip="Select an element to edit its style (list is ordered alphabetically)" id="styleElementSelect"></select>
  </div>
  <div class="head group-row" style="display: none">
    <p data-tip="Select element group">Group:</p>
    <select data-tip="Select element group" id="styleGroupSelect"></select>
  </div>
  <div id="styleForm"></div>
`;

const STYLE = /* css */ `
  #styleContent .head { display: flex; align-items: center; gap: .4em; margin: .3em 0; }
  #styleContent .head > p { flex: 0 0 8.5em; margin: 0; }
  #styleContent .head > select { flex: 1 1 auto; min-width: 0; }
  #styleContent .head > button.sideButton { flex: none; margin-block: 0; }
  #styleForm { margin-top: .4em; }
  #styleForm .banner { color: darkred; font-weight: 700; margin: .3em 0; }
  #styleForm .banner a { cursor: pointer; text-decoration: underline; margin-left: .3em; }
  #styleForm .whiteButton { padding: 0 .8em; border: 0; background-color: #ffffff !important; }
`;

ensureEl("styleContent").innerHTML = TEMPLATE;
const style = document.createElement("style");
style.textContent = STYLE;
document.head.append(style);
