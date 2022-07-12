import * as d3 from "d3";

import {heightmapTemplates} from "config/heightmap-templates";
import {precreatedHeightmaps} from "config/precreated-heightmaps";
import {generateGrid} from "scripts/generation/graph";
import {shouldRegenerateGridPoints} from "scripts/generation/generation";
import {byId} from "utils/shorthands";
import {generateSeed} from "utils/probabilityUtils";
import {getColorScheme} from "utils/colorUtils";
import {aleaPRNG} from "scripts/aleaPRNG";
import {closeDialogs} from "dialogs/utils";
import {regeneratePrompt} from "modules/ui/options";

const initialSeed = generateSeed();
let graph = getGraph(grid);

appendStyleSheet();
insertHtml();
addListeners();

export function open() {
  closeDialogs(".stable");

  const $templateInput = byId("templateInput");
  setSelected($templateInput.value);
  graph = getGraph(graph);

  $("#heightmapSelection").dialog({
    title: "Select Heightmap",
    resizable: false,
    position: {my: "center", at: "center", of: "svg"},
    buttons: {
      Cancel: function () {
        $(this).dialog("close");
      },
      Select: function () {
        const id = getSelected();
        applyDropdownOption($templateInput, id, getName(id));
        lock("template");

        $(this).dialog("close");
      },
      "New Map": function () {
        const id = getSelected();
        applyDropdownOption($templateInput, id, getName(id));
        lock("template");

        const seed = getSeed();
        regeneratePrompt({seed, graph});

        $(this).dialog("close");
      }
    }
  });
}

function appendStyleSheet() {
  const style = document.createElement("style");
  style.textContent = /* css */ `
    div.dialog > div.heightmap-selection {
      width: 70vw;
      height: 70vh;
    }

    .heightmap-selection_container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      grid-gap: 6px;
    }

    @media (max-width: 600px) {
      .heightmap-selection_container {
        grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
        grid-gap: 4px;
      }
    }

    @media (min-width: 2000px) {
      .heightmap-selection_container {
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        grid-gap: 8px;
      }
    }

    .heightmap-selection_options {
      display: grid;
      grid-template-columns: 2fr 1fr;
    }

    .heightmap-selection_options > div:first-child {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      align-items: center;
      justify-self: start;
      justify-items: start;
    }

    @media (max-width: 600px) {
      .heightmap-selection_options {
        grid-template-columns: 3fr 1fr;
      }

      .heightmap-selection_options > div:first-child {
        display: block;
      }
    }

    .heightmap-selection_options > div:last-child {
      justify-self: end;
    }

    .heightmap-selection article {
      padding: 4px;
      border-radius: 8px;
      transition: all 0.1s ease-in-out;
      filter: drop-shadow(1px 1px 4px #999);
    }

    .heightmap-selection article:hover {
      background-color: #ddd;
      filter: drop-shadow(1px 1px 8px #999);
      cursor: pointer;
    }

    .heightmap-selection article.selected {
      background-color: #ccc;
      outline: 1px solid var(--dark-solid);
      filter: drop-shadow(1px 1px 8px #999);
    }

    .heightmap-selection article > div {
      display: flex;
      justify-content: space-between;
      padding: 2px 1px;
    }

    .heightmap-selection article > img {
      width: 100%;
      aspect-ratio: ${graphWidth}/${graphHeight};
      border-radius: 8px;
      object-fit: fill;
    }

    .heightmap-selection article .regeneratePreview {
      outline: 1px solid #bbb;
      padding: 1px 3px;
      border-radius: 4px;
      transition: all 0.1s ease-in-out;
    }

    .heightmap-selection article .regeneratePreview:hover {
      outline: 1px solid #666;
    }

    .heightmap-selection article .regeneratePreview:active {
      outline: 1px solid #333;
      color: #000;
      transform: rotate(45deg);
    }
  `;

  document.head.appendChild(style);
}

function insertHtml() {
  const heightmapSelectionHtml = /* html */ `<div id="heightmapSelection" class="dialog stable">
    <div class="heightmap-selection">
      <section data-tip="Select heightmap template – template provides unique, but similar-looking maps on generation">
        <header><h1>Heightmap templates</h1></header>
        <div class="heightmap-selection_container"></div>
      </section>
      <section data-tip="Select precreated heightmap – it will be the same for each map">
        <header><h1>Precreated heightmaps</h1></header>
        <div class="heightmap-selection_container"></div>
      </section>
      <section>
        <header><h1>Options</h1></header>
        <div class="heightmap-selection_options">
          <div>
            <label data-tip="Rerender all preview images" class="checkbox-label" id="heightmapSelectionRedrawPreview">
              <i class="icon-cw"></i>
              Redraw preview
            </label>
            <div>
              <input id="heightmapSelectionRenderOcean" class="checkbox" type="checkbox" />
              <label data-tip="Draw heights of water cells" for="heightmapSelectionRenderOcean" class="checkbox-label">Render ocean heights</label>
            </div>
            <div data-tip="Color scheme used for heightmap preview">
              Color scheme
              <select id="heightmapSelectionColorScheme">
                <option value="bright" selected>Bright</option>
                <option value="light">Light</option>
                <option value="green">Green</option>
                <option value="monochrome">Monochrome</option>
              </select>
            </div>
          </div>
          <div>
            <button data-tip="Open Template Editor" data-tool="templateEditor" id="heightmapSelectionEditTemplates">Edit Templates</button>
            <button data-tip="Open Image Converter" data-tool="imageConverter" id="heightmapSelectionImportHeightmap">Import Heightmap</button>
          </div>
        </div>
      </section>
    </div>
  </div>`;

  byId("dialogs").insertAdjacentHTML("beforeend", heightmapSelectionHtml);

  const sections = document.getElementsByClassName("heightmap-selection_container");

  sections[0].innerHTML = Object.keys(heightmapTemplates)
    .map(key => {
      const name = heightmapTemplates[key].name;
      Math.random = aleaPRNG(initialSeed);
      const heights = HeightmapGenerator.fromTemplate(graph, key);
      const dataUrl = drawHeights(heights);

      return /* html */ `<article data-id="${key}" data-seed="${initialSeed}">
        <img src="${dataUrl}" alt="${name}" />
        <div>
          ${name}
          <span data-tip="Regenerate preview" class="icon-cw regeneratePreview"></span>
        </div>
      </article>`;
    })
    .join("");

  sections[1].innerHTML = Object.keys(precreatedHeightmaps)
    .map(key => {
      const name = precreatedHeightmaps[key].name;
      drawPrecreatedHeightmap(key);

      return /* html */ `<article data-id="${key}" data-seed="${initialSeed}">
        <img alt="${name}" />
        <div>${name}</div>
      </article>`;
    })
    .join("");
}

function addListeners() {
  byId("heightmapSelection").on("click", event => {
    const article = event.target.closest("#heightmapSelection article");
    if (!article) return;

    const id = article.dataset.id;
    if (event.target.matches("span.icon-cw")) regeneratePreview(article, id);
    setSelected(id);
  });

  byId("heightmapSelectionRenderOcean").on("change", redrawAll);
  byId("heightmapSelectionColorScheme").on("change", redrawAll);
  byId("heightmapSelectionRedrawPreview").on("click", redrawAll);
  byId("heightmapSelectionEditTemplates").on("click", confirmHeightmapEdit);
  byId("heightmapSelectionImportHeightmap").on("click", confirmHeightmapEdit);
}

function getSelected() {
  return byId("heightmapSelection").querySelector(".selected")?.dataset?.id;
}

function setSelected(id) {
  const $heightmapSelection = byId("heightmapSelection");
  $heightmapSelection.querySelector(".selected")?.classList?.remove("selected");
  $heightmapSelection.querySelector(`[data-id="${id}"]`)?.classList?.add("selected");
}

function getSeed() {
  return byId("heightmapSelection").querySelector(".selected")?.dataset?.seed;
}

function getName(id) {
  const isTemplate = id in heightmapTemplates;
  return isTemplate ? heightmapTemplates[id].name : precreatedHeightmaps[id].name;
}

function getGraph(currentGraph) {
  const newGraph = shouldRegenerateGridPoints(currentGraph) ? generateGrid() : structuredClone(currentGraph);
  delete newGraph.cells.h;
  return newGraph;
}

function drawHeights(heights) {
  const canvas = document.createElement("canvas");
  canvas.width = graph.cellsX;
  canvas.height = graph.cellsY;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(graph.cellsX, graph.cellsY);

  const schemeId = byId("heightmapSelectionColorScheme").value;
  const scheme = getColorScheme(schemeId);
  const renderOcean = byId("heightmapSelectionRenderOcean").checked;
  const getHeight = height => (height < 20 ? (renderOcean ? height : 0) : height);

  for (let i = 0; i < heights.length; i++) {
    const color = scheme(1 - getHeight(heights[i]) / 100);
    const {r, g, b} = d3.color(color);

    const n = i * 4;
    imageData.data[n] = r;
    imageData.data[n + 1] = g;
    imageData.data[n + 2] = b;
    imageData.data[n + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

function drawTemplatePreview(id) {
  const heights = HeightmapGenerator.fromTemplate(graph, id);
  const dataUrl = drawHeights(heights);
  const article = byId("heightmapSelection").querySelector(`[data-id="${id}"]`);
  article.querySelector("img").src = dataUrl;
}

async function drawPrecreatedHeightmap(id) {
  const heights = await HeightmapGenerator.fromPrecreated(graph, id);
  const dataUrl = drawHeights(heights);
  const article = byId("heightmapSelection").querySelector(`[data-id="${id}"]`);
  article.querySelector("img").src = dataUrl;
}

function regeneratePreview(article, id) {
  graph = getGraph(graph);
  const seed = generateSeed();
  article.dataset.seed = seed;
  Math.random = aleaPRNG(seed);
  drawTemplatePreview(id);
}

function redrawAll() {
  graph = getGraph(graph);
  const articles = byId("heightmapSelection").querySelectorAll(`article`);
  for (const article of articles) {
    const {id, seed} = article.dataset;
    Math.random = aleaPRNG(seed);

    const isTemplate = id in heightmapTemplates;
    if (isTemplate) drawTemplatePreview(id);
    else drawPrecreatedHeightmap(id);
  }
}

function confirmHeightmapEdit() {
  const tool = this.dataset.tool;

  confirmationDialog({
    title: this.dataset.tip,
    message: "Opening the tool will erase the current map. Are you sure you want to proceed?",
    confirm: "Continue",
    onConfirm: () => openDialog("heightmapEditor", null, {mode: "erase", tool})
  });
}
