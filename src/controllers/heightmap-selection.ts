import { drawHeights, ensureEl, generateGrid, generateSeed, shouldRegenerateGrid } from "../utils";

const initialSeed = generateSeed();
let graph = getGraph(grid);

appendStyleSheet();
insertHtml();
addListeners();

function open(): void {
  closeDialogs(".stable");

  const $templateInput = ensureEl<HTMLInputElement>("templateInput");
  setSelected($templateInput.value);
  graph = getGraph(graph);

  $("#heightmapSelection").dialog({
    title: "Select Heightmap",
    resizable: false,
    position: { my: "center", at: "center", of: "svg" },
    buttons: {
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      },
      Select: function (this: HTMLElement) {
        const id = getSelected();
        if (!id) return;
        applyOption($templateInput, id, getName(id));
        lock("template");

        $(this).dialog("close");
      },
      "New Map": function (this: HTMLElement) {
        const id = getSelected();
        if (!id) return;
        applyOption($templateInput, id, getName(id));
        lock("template");

        const seed = getSeed();
        regeneratePrompt({ seed, graph });

        $(this).dialog("close");
      }
    }
  });
}

function appendStyleSheet(): void {
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

function insertHtml(): void {
  const heightmapColorSchemeOptions = Object.keys(heightmapColorSchemes)
    .map(scheme => `<option value="${scheme}">${scheme}</option>`)
    .join("");

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
              <select id="heightmapSelectionColorScheme">${heightmapColorSchemeOptions}</select>
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

  ensureEl("dialogs").insertAdjacentHTML("beforeend", heightmapSelectionHtml);

  const sections = document.getElementsByClassName("heightmap-selection_container");

  sections[0].innerHTML = Object.keys(heightmapTemplates)
    .map(key => {
      const name = heightmapTemplates[key].name;
      Math.random = aleaPRNG(initialSeed);
      const heights = HeightmapGenerator.fromTemplate(graph, key);

      return /* html */ `<article data-id="${key}" data-seed="${initialSeed}">
        <img src="${getHeightmapPreview(heights)}" alt="${name}" />
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

function addListeners(): void {
  ensureEl("heightmapSelection").on("click", event => {
    const target = (event as MouseEvent).target as HTMLElement;
    const article = target.closest<HTMLElement>("#heightmapSelection article");
    if (!article) return;

    const id = article.dataset.id;
    if (!id) return;
    if (target.matches("span.icon-cw")) regeneratePreview(article, id);
    setSelected(id);
  });

  ensureEl("heightmapSelectionRenderOcean").on("change", redrawAll);
  ensureEl("heightmapSelectionColorScheme").on("change", redrawAll);
  ensureEl("heightmapSelectionRedrawPreview").on("click", redrawAll);
  ensureEl("heightmapSelectionEditTemplates").on("click", event =>
    confirmHeightmapEdit(event.currentTarget as HTMLElement)
  );
  ensureEl("heightmapSelectionImportHeightmap").on("click", event =>
    confirmHeightmapEdit(event.currentTarget as HTMLElement)
  );
}

function getSelected(): string | undefined {
  return ensureEl("heightmapSelection").querySelector<HTMLElement>(".selected")?.dataset?.id;
}

function setSelected(id: string): void {
  const $heightmapSelection = ensureEl("heightmapSelection");
  $heightmapSelection.querySelector(".selected")?.classList?.remove("selected");
  $heightmapSelection.querySelector(`[data-id="${id}"]`)?.classList?.add("selected");
}

function getSeed(): string | undefined {
  return ensureEl("heightmapSelection").querySelector<HTMLElement>(".selected")?.dataset?.seed;
}

function getName(id: string): string {
  const isTemplate = id in heightmapTemplates;
  return isTemplate ? heightmapTemplates[id].name : precreatedHeightmaps[id].name;
}

function getGraph(currentGraph: any): any {
  const newGraph = shouldRegenerateGrid(currentGraph, seed as unknown as number, graphWidth, graphHeight)
    ? generateGrid(seed, graphWidth, graphHeight)
    : structuredClone(currentGraph);
  delete newGraph.cells.h;
  return newGraph;
}

function drawTemplatePreview(id: string): void {
  const heights = HeightmapGenerator.fromTemplate(graph, id);
  const dataUrl = getHeightmapPreview(heights);
  const article = ensureEl("heightmapSelection").querySelector(`[data-id="${id}"]`);
  article?.querySelector("img")?.setAttribute("src", dataUrl);
}

async function drawPrecreatedHeightmap(id: string): Promise<void> {
  const heights = await HeightmapGenerator.fromPrecreated(graph, id);
  const dataUrl = getHeightmapPreview(heights);
  const article = ensureEl("heightmapSelection").querySelector(`[data-id="${id}"]`);
  article?.querySelector("img")?.setAttribute("src", dataUrl);
}

function regeneratePreview(article: HTMLElement, id: string): void {
  graph = getGraph(graph);
  const seed = generateSeed();
  article.dataset.seed = seed;
  Math.random = aleaPRNG(seed);
  drawTemplatePreview(id);
}

function redrawAll(): void {
  graph = getGraph(graph);
  const articles = ensureEl("heightmapSelection").querySelectorAll<HTMLElement>("article");
  for (const article of articles) {
    const { id, seed } = article.dataset;
    if (!id || !seed) continue;
    Math.random = aleaPRNG(seed);

    const isTemplate = id in heightmapTemplates;
    if (isTemplate) drawTemplatePreview(id);
    else drawPrecreatedHeightmap(id);
  }
}

function confirmHeightmapEdit(el: HTMLElement): void {
  const tool = el.dataset.tool;
  if (!tool) return;

  confirmationDialog({
    title: el.dataset.tip ?? "",
    message: "Opening the tool will erase the current map. Are you sure you want to proceed?",
    confirm: "Continue",
    onConfirm: () => editHeightmap({ mode: "erase", tool })
  });
}

function getHeightmapPreview(heights: Uint8Array | null): string {
  const scheme = getColorScheme(ensureEl<HTMLSelectElement>("heightmapSelectionColorScheme").value);
  const renderOcean = ensureEl<HTMLInputElement>("heightmapSelectionRenderOcean").checked;
  const dataUrl = drawHeights({
    heights: heights as unknown as number[],
    width: graph.cellsX,
    height: graph.cellsY,
    scheme,
    renderOcean
  });
  return dataUrl;
}

export const HeightmapSelection = { open };
