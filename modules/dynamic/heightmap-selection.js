const templates = [
  {id: "volcano", name: "Volcano"},
  {id: "highIsland", name: "High Island"},
  {id: "lowIsland", name: "Low Island"},
  {id: "continents", name: "Continents"},
  {id: "archipelago", name: "Archipelago"},
  {id: "atoll", name: "Atoll"},
  {id: "mediterranean", name: "Mediterranean"},
  {id: "peninsula", name: "Peninsula"},
  {id: "pangea", name: "Pangea"},
  {id: "isthmus", name: "Isthmus"},
  {id: "shattered", name: "Shattered"},
  {id: "taklamakan", name: "Taklamakan"},
  {id: "oldWorld", name: "Old World"},
  {id: "fractious", name: "Fractious"}
];

const heightmaps = [
  {id: "africa-centric", name: "Africa Centric"},
  {id: "arabia", name: "Arabia"},
  {id: "atlantics", name: "Atlantics"},
  {id: "britain", name: "Britain"},
  {id: "caribbean", name: "Caribbean"},
  {id: "east-asia", name: "East Asia"},
  {id: "eurasia", name: "Eurasia"},
  {id: "europe", name: "Europe"},
  {id: "europe-accented", name: "Europe Accented"},
  {id: "europe-and-central-asia", name: "Europe and Central Asia"},
  {id: "europe-central", name: "Europe Central"},
  {id: "europe-north", name: "Europe North"},
  {id: "greenland", name: "Greenland"},
  {id: "hellenica", name: "Hellenica"},
  {id: "iceland", name: "Iceland"},
  {id: "indian-ocean", name: "Indian Ocean"},
  {id: "mediterranean-sea", name: "Mediterranean Sea"},
  {id: "middle-east", name: "Middle East"},
  {id: "north-america", name: "North America"},
  {id: "us-centric", name: "US-centric"},
  {id: "us-mainland", name: "US Mainland"},
  {id: "world", name: "World"},
  {id: "world-from-pacific", name: "World from Pacific"}
];

appendStyleSheet();
insertEditorHtml();
addListeners();

export function open() {
  closeDialogs(".stable");

  const $templateInput = byId("templateInput");
  setSelected($templateInput.value);

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
        $templateInput.value = id;
        lock("template");
        $(this).dialog("close");
      },
      "New Map": function () {
        const id = getSelected();
        $templateInput.value = id;
        lock("template");

        const seed = getSeed();
        Math.random = aleaPRNG(seed);

        regeneratePrompt({seed});
        $(this).dialog("close");
      }
    }
  });
}

function appendStyleSheet() {
  const styles = /* css */ `
    .heightmap-selection {
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

    .heightmap-selection article > div > span.icon-cw:hover {
      color: #000;
    }

    .heightmap-selection article > div > span.icon-cw:active {
      color: #666;
    }

    .heightmap-selection article > img {
      width: 100%;
      aspect-ratio: ${graphWidth}/${graphHeight};
      border-radius: 8px;
      object-fit: fill;
    }
  `;

  const style = document.createElement("style");
  style.appendChild(document.createTextNode(styles));
  document.head.appendChild(style);
}

function insertEditorHtml() {
  const seed = generateSeed();

  const templatesHtml = templates
    .map(({id, name}) => {
      Math.random = aleaPRNG(seed);
      const heights = generateHeightmap(id);
      const dataUrl = drawHeights(heights);

      return /* html */ `<article data-id="${id}" data-seed="${seed}">
        <img src="${dataUrl}" alt="${name}" />
        <div>
          ${name}
          <span data-tip="Regenerate preview" class="icon-cw"></span>
        </div>
      </article>`;
    })
    .join("");

  const heightmapsHtml = heightmaps
    .map(({id, name}) => {
      drawPrecreatedHeightmap(id);

      return /* html */ `<article data-id="${id}" data-seed="${seed}">
        <img alt="${name}" />
        <div>${name}</div>
      </article>`;
    })
    .join("");

  const heightmapSelectionHtml = /* html */ `<div id="heightmapSelection" class="dialog stable">
    <div class="heightmap-selection">
      <section>
        <header><h1>Heightmap templates</h1></header>
        <div class="heightmap-selection_container">
          ${templatesHtml}
        </div>
      </section>
      <section>
        <header><h1>Pre-created heightmaps</h1></header>
        <div class="heightmap-selection_container">
          ${heightmapsHtml}
        </div>
      </section>
    </div>
  </div>`;

  byId("dialogs").insertAdjacentHTML("beforeend", heightmapSelectionHtml);
}

function addListeners() {
  byId("heightmapSelection").on("click", event => {
    const article = event.target.closest("#heightmapSelection article");
    if (!article) return;

    const id = article.dataset.id;
    if (event.target.matches("span.icon-cw")) regeneratePreview(article, id);
    else setSelected(id);
  });
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

function drawHeights(heights) {
  const canvas = document.createElement("canvas");
  canvas.width = grid.cellsX;
  canvas.height = grid.cellsY;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(grid.cellsX, grid.cellsY);
  const scheme = getColorScheme();
  const waterColor = scheme(1);

  for (let i = 0; i < heights.length; i++) {
    const color = heights[i] < 20 ? waterColor : scheme(1 - heights[i] / 100);
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

function generateHeightmap(id) {
  HeightmapGenerator.resetHeights();
  const heights = HeightmapGenerator.fromTemplate(id);
  HeightmapGenerator.cleanup();
  return heights;
}

async function drawPrecreatedHeightmap(id) {
  const heights = await HeightmapGenerator.fromPrecreated(id);
  const dataUrl = drawHeights(heights);
  const article = byId("heightmapSelection").querySelector(`[data-id="${id}"]`);
  article.querySelector("img").src = dataUrl;
}

function regeneratePreview(article, id) {
  const seed = generateSeed();
  article.dataset.seed = seed;
  Math.random = aleaPRNG(seed);

  const heights = generateHeightmap(id);
  const dataUrl = drawHeights(heights);
  article.querySelector("img").src = dataUrl;
}
