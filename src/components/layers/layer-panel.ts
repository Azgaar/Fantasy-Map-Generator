type LayerDefinition = {
  className?: string;
  id: string;
  label: string;
  shortcut?: string;
  tip: string;
};

const LAYER_TIP_SUFFIX = "click to toggle, drag to raise or lower the layer. Ctrl + click to edit layer style";

const LAYERS: readonly LayerDefinition[] = [
  { id: "toggleHeight", label: "Heightmap", shortcut: "H", tip: `Heightmap: ${LAYER_TIP_SUFFIX}` },
  { id: "toggleLakes", label: "Lakes", shortcut: "Q", tip: `Lakes: ${LAYER_TIP_SUFFIX}` },
  { id: "toggleBiomes", label: "Biomes", shortcut: "B", tip: `Biomes: ${LAYER_TIP_SUFFIX}` },
  { id: "toggleCells", label: "Cells", shortcut: "E", tip: `Cells structure: ${LAYER_TIP_SUFFIX}` },
  {
    id: "toggleGrid",
    label: "Grid",
    shortcut: "; (semicolon)",
    tip: "Grid: click to toggle, drag to raise or lower. Ctrl + click to edit layer style and select type"
  },
  { id: "toggleCoordinates", label: "Coordinates", shortcut: "O", tip: `Coordinate grid: ${LAYER_TIP_SUFFIX}` },
  { id: "toggleCompass", label: "Wind Rose", shortcut: "W", tip: `Wind (Compass) Rose: ${LAYER_TIP_SUFFIX}` },
  { id: "toggleRelief", label: "Relief", shortcut: "F", tip: `Relief and biome icons: ${LAYER_TIP_SUFFIX}` },
  { id: "toggleReligions", label: "Religions", shortcut: "R", tip: `Religions: ${LAYER_TIP_SUFFIX}` },
  { id: "toggleCultures", label: "Cultures", shortcut: "C", tip: `Cultures: ${LAYER_TIP_SUFFIX}` },
  { id: "toggleStates", label: "States", shortcut: "S", tip: `States: ${LAYER_TIP_SUFFIX}` },
  { id: "toggleProvinces", label: "Provinces", shortcut: "P", tip: `Provinces: ${LAYER_TIP_SUFFIX}` },
  { id: "toggleZones", label: "Zones", shortcut: "Z", tip: `Zones: ${LAYER_TIP_SUFFIX}` },
  { id: "toggleBorders", label: "Borders", shortcut: "D", tip: `State borders: ${LAYER_TIP_SUFFIX}` },
  { id: "toggleRivers", label: "Rivers", shortcut: "V", tip: `Rivers: ${LAYER_TIP_SUFFIX}` },
  { id: "toggleRoutes", label: "Routes", shortcut: "U", tip: `Trade routes: ${LAYER_TIP_SUFFIX}` },
  { id: "toggleTemperature", label: "Temperature", shortcut: "T", tip: `Temperature map: ${LAYER_TIP_SUFFIX}` },
  { id: "toggleIce", label: "Ice", shortcut: "J", tip: `Icebergs and glaciers: ${LAYER_TIP_SUFFIX}` },
  {
    id: "toggleGoods",
    label: "Goods",
    shortcut: "G",
    className: "buttonoff",
    tip: `Goods and Production: ${LAYER_TIP_SUFFIX}`
  },
  { id: "toggleMarketsLayer", label: "Markets", className: "buttonoff", tip: `Markets: ${LAYER_TIP_SUFFIX}` },
  {
    id: "toggleTrade",
    label: "Trade",
    shortcut: "` (backtick)",
    className: "buttonoff",
    tip: "Trade: animated trade deal flows. Click to toggle, drag to raise or lower the layer. Ctrl + click to edit layer style"
  },
  { id: "togglePrecipitation", label: "Precipitation", shortcut: "A", tip: `Precipitation map: ${LAYER_TIP_SUFFIX}` },
  { id: "togglePopulation", label: "Population", shortcut: "N", tip: `Population map: ${LAYER_TIP_SUFFIX}` },
  { id: "toggleEmblems", label: "Emblems", shortcut: "Y", tip: `Emblems: ${LAYER_TIP_SUFFIX}` },
  { id: "toggleBurgIcons", label: "Icons", shortcut: "I", tip: `Burg icons: ${LAYER_TIP_SUFFIX}` },
  { id: "toggleLabels", label: "Labels", shortcut: "L", tip: `Labels: ${LAYER_TIP_SUFFIX}` },
  { id: "toggleMilitary", label: "Military", shortcut: "M", tip: `Military forces: ${LAYER_TIP_SUFFIX}` },
  { id: "toggleMarkers", label: "Markers", shortcut: "K", tip: `Markers: ${LAYER_TIP_SUFFIX}` },
  {
    id: "toggleRulers",
    label: "Rulers",
    shortcut: "= (equal sign)",
    tip: "Rulers: click to toggle, drag to move, click on label to delete. Ctrl + click to edit layer style"
  },
  {
    id: "toggleScaleBar",
    label: "Scale Bar",
    shortcut: "/ (slash sign)",
    className: "solid",
    tip: "Scale Bar: click to toggle. Ctrl + click to edit style"
  },
  {
    id: "toggleVignette",
    label: "Vignette",
    shortcut: "[ (left square bracket)",
    className: "solid",
    tip: "Vignette (border fading): click to toggle. Ctrl + click to edit style"
  }
];

/**
 * Builds the legacy-compatible layer controls from controller-owned data. The
 * list remains in the document because sorting and keyboard bindings expose
 * its stable element IDs to the established map runtime.
 */
export function mountLayerPanel(): HTMLElement {
  const existing = document.getElementById("layersContent");
  if (existing) return existing;

  const panel = document.createElement("div");
  panel.id = "layersContent";
  panel.className = "tabcontent";
  panel.style.display = "none";
  panel.setAttribute("aria-hidden", "true");

  panel.append(
    createButton("savePresetButton", "Click to save displayed layers as a new preset", "icon-plus sideButton"),
    createButton("removePresetButton", "Click to remove current custom preset", "icon-minus sideButton"),
    createTextElement("p", "Displayed layers"),
    createSearch(),
    createLayerList(),
    createTextElement("div", "Click to toggle, drag to raise or lower the layer", "tip"),
    createTextElement("div", "Ctrl + click to edit layer style", "tip")
  );

  const options = document.getElementById("options");
  const styleContent = document.getElementById("styleContent");
  if (!options || !styleContent) throw new Error("Cannot mount layer controls without the persistent workspace host");
  options.insertBefore(panel, styleContent);
  return panel;
}

function createButton(id: string, tip: string, className: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.id = id;
  button.className = className;
  button.dataset.tip = tip;
  button.style.display = "none";
  return button;
}

function createLayerList(): HTMLUListElement {
  const list = document.createElement("ul");
  list.id = "mapLayers";
  list.dataset.tip = "Click to toggle a layer, drag to raise or lower a layer. Ctrl + click to edit layer style";
  for (const definition of LAYERS) {
    const item = document.createElement("li");
    item.id = definition.id;
    item.textContent = definition.label;
    item.dataset.tip = definition.tip;
    if (definition.shortcut) item.dataset.shortcut = definition.shortcut;
    if (definition.className) item.className = definition.className;
    list.appendChild(item);
  }
  return list;
}

function createSearch(): HTMLLabelElement {
  const label = document.createElement("label");
  label.id = "layersSearch";
  label.htmlFor = "layersSearchInput";
  label.append(createTextElement("span", "", "icon-search"));

  const input = document.createElement("input");
  input.id = "layersSearchInput";
  input.type = "search";
  input.placeholder = "Search layers";
  input.autocomplete = "off";
  label.append(input, createTextElement("kbd", "Ctrl+F"));
  return label;
}

function createTextElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  text: string,
  className?: string
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}
