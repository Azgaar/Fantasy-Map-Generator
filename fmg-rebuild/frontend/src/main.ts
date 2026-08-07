import { generateJitteredGrid } from "../../simulation/grid/grid-generator";
import { HeightmapGenerator } from "../../simulation/heightmap/heightmap-generator";
import { generateClimate } from "../../simulation/climate/climate-generator";
import { generateHydrology } from "../../simulation/hydrology/hydrology-generator";
import { generateBiomes } from "../../simulation/biomes/biomes-generator";
import { generateCultures } from "../../simulation/civilization/culture-generator";
import { generateBurgs } from "../../simulation/civilization/burg-generator";
import { generateStates } from "../../simulation/civilization/state-generator";
import { generateRoutes } from "../../simulation/civilization/route-generator";
import { generateProvinces } from "../../simulation/civilization/province-generator";
import { generateMilitary } from "../../simulation/civilization/military-generator";
import { generateReligions } from "../../simulation/civilization/religions-generator";
import { generateZones } from "../../simulation/civilization/zones-generator";
import { generateMarkers } from "../../simulation/civilization/markers-generator";
import { bakeErosion } from "../../simulation/heightmap/erosion-bake";
import { generateGoods } from "../../simulation/civilization/goods-generator";
import { generateMarkets } from "../../simulation/civilization/markets-generator";
import { runProductionCycles } from "../../simulation/civilization/production-generator";
import { serializeMapState, deserializeMapState } from "../../core/serialization";
import { store } from "../../state/store";
import { renderMap } from "../../renderer/canvas-renderer";
import { drawMinimap } from "../../renderer/minimap-renderer";
import { ThreeRenderer } from "../../renderer/three-renderer";
import { mountBurgEditor } from "../../ui/burg-editor";
import { mountStateEditor } from "../../ui/state-editor";
import { mountConfigurator, SetupConfig } from "../../ui/configurator-dialogs";
import { mountStyleAndBiomeEditor } from "../../ui/dialogs-sections";
import { mountHeightBrush } from "../../ui/heightmap-brush";
import { mountImageImporter } from "../../ui/image-importer";
import { mountLabelEditor } from "../../ui/label-editor";
import { mountExportOptions } from "../../ui/export-options";
import { mountLanguageEditor } from "../../ui/language-editor";
import { mountBurgTypeEditor } from "../../ui/burg-type-editor";
import { mountMilitaryUnitEditor } from "../../ui/military-unit-editor";

console.log("FMG Full-Stack Rebuild Frontend Initialized.");

const app = document.getElementById("app");
let currentLayer: "heightmap" | "biomes" | "temp" | "prec" | "cultures" | "states" | "provinces" | "religions" | "goods" = "states";
let socket: WebSocket | null = null;
let currentSessionId = "session-" + Math.floor(Math.random() * 100000);
let is3DMode = false;
let threeRenderer: ThreeRenderer | null = null;

(window as any).triggerLayerSelect = (layer: any) => {
  currentLayer = layer;
  const btns = document.querySelectorAll(".layerBtn");
  btns.forEach(b => {
    const button = b as HTMLButtonElement;
    if (button.getAttribute("data-layer") === layer) {
      button.style.background = "#4f46e5";
      button.style.borderColor = "#4f46e5";
      button.style.color = "white";
    } else {
      button.style.background = "transparent";
      button.style.borderColor = "rgba(255, 255, 255, 0.15)";
      button.style.color = "#94a3b8";
    }
  });
};

(window as any).store = store;

function findClosestCellIndex(x: number, y: number, points: [number, number][]): number {
  let minDist = Infinity;
  let closestIdx = 0;
  for (let i = 0; i < points.length; i++) {
    const [px, py] = points[i];
    const dist = Math.pow(x - px, 2) + Math.pow(y - py, 2);
    if (dist < minDist) {
      minDist = dist;
      closestIdx = i;
    }
  }
  return closestIdx;
}

if (app) {
  app.innerHTML = `
    <div style="font-family: 'Outfit', 'Inter', sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: #0f0f12; color: #e2e8f0; padding: 1.5rem; box-sizing: border-box;">
      <div style="display: flex; gap: 1.5rem; width: 100%; max-width: 1400px; flex-wrap: wrap;">
        
        <!-- Left Panel: Configurations & Editors -->
        <div style="flex: 1; min-width: 280px; display: flex; flex-direction: column; gap: 1rem;">
          <div id="configuratorMount"></div>
          <div id="brushMount"></div>
          <div id="importerMount"></div>
          <div id="languageMount"></div>
        </div>

        <!-- Center Panel: Map Viewport -->
        <div style="background: rgba(30, 30, 38, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.08); padding: 1.5rem 2rem; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); flex: 2.2; min-width: 500px; display: flex; flex-direction: column; gap: 1rem;">
          
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 0.75rem;">
            <div style="display: flex; flex-direction: column;">
              <h1 style="font-size: 1.8rem; margin: 0; background: linear-gradient(135deg, #6366f1, #3b82f6, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 700;">
                FMG Viewport
              </h1>
              <span id="connectionStatus" style="font-size: 0.75rem; color: #f87171; font-weight: 600;">Disconnected from Multiplayer</span>
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <button id="saveBtn" style="background: #10b981; border: none; color: white; padding: 0.5rem 0.8rem; border-radius: 8px; font-weight: 600; cursor: pointer;">Save JSON</button>
              <button id="loadBtn" style="background: #eab308; border: none; color: white; padding: 0.5rem 0.8rem; border-radius: 8px; font-weight: 600; cursor: pointer;">Load JSON</button>
              <input id="fileInput" type="file" accept=".json" style="display: none;" />
              <button id="toggle3DBtn" style="background: #3b82f6; border: none; color: white; padding: 0.5rem 1rem; border-radius: 8px; font-weight: 600; cursor: pointer;">Toggle 3D View</button>
            </div>
          </div>

          <!-- Controls -->
          <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; justify-content: space-between; font-size: 0.9rem;">
            <div style="display: flex; gap: 0.3rem; flex-wrap: wrap;">
              <button class="layerBtn" data-layer="states" style="padding: 0.4rem 0.8rem; border-radius: 6px; border: 1px solid #4f46e5; background: #4f46e5; color: white; font-weight: 600; cursor: pointer;">States</button>
              <button class="layerBtn" data-layer="provinces" style="padding: 0.4rem 0.8rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.15); background: transparent; color: #94a3b8; font-weight: 600; cursor: pointer;">Provinces</button>
              <button class="layerBtn" data-layer="cultures" style="padding: 0.4rem 0.8rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.15); background: transparent; color: #94a3b8; font-weight: 600; cursor: pointer;">Cultures</button>
              <button class="layerBtn" data-layer="religions" style="padding: 0.4rem 0.8rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.15); background: transparent; color: #94a3b8; font-weight: 600; cursor: pointer;">Religions</button>
              <button class="layerBtn" data-layer="goods" style="padding: 0.4rem 0.8rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.15); background: transparent; color: #94a3b8; font-weight: 600; cursor: pointer;">Goods</button>
              <button class="layerBtn" data-layer="biomes" style="padding: 0.4rem 0.8rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.15); background: transparent; color: #94a3b8; font-weight: 600; cursor: pointer;">Biomes</button>
              <button class="layerBtn" data-layer="heightmap" style="padding: 0.4rem 0.8rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.15); background: transparent; color: #94a3b8; font-weight: 600; cursor: pointer;">Heightmap</button>
              <button class="layerBtn" data-layer="temp" style="padding: 0.4rem 0.8rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.15); background: transparent; color: #94a3b8; font-weight: 600; cursor: pointer;">Temperature</button>
              <button class="layerBtn" data-layer="prec" style="padding: 0.4rem 0.8rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.15); background: transparent; color: #94a3b8; font-weight: 600; cursor: pointer;">Precipitation</button>
            </div>
            <div id="stats" style="color: #94a3b8; font-size: 0.85rem;"></div>
          </div>

          <!-- Canvas Wrap -->
          <div style="position: relative; width: 100%; aspect-ratio: 16 / 10; background: #08080a; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.05); display: flex; align-items: center; justify-content: center;">
            <canvas id="mapCanvas" style="width: 100%; height: 100%; display: block; cursor: crosshair;"></canvas>
            <div id="threeContainer" style="position: absolute; inset: 0; display: none;"></div>
            <div id="loadingOverlay" style="position: absolute; inset: 0; background: rgba(8, 8, 10, 0.8); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 600; color: #94a3b8; display: none;">
              Generating Map Simulation...
            </div>
          </div>

        </div>

        <!-- Right Panel: Sidebar Editors, Minimap & Customizers -->
        <div style="flex: 1; min-width: 280px; display: flex; flex-direction: column; gap: 1rem;">
          
          <!-- Minimap Card -->
          <div style="background: rgba(30, 30, 38, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); padding: 1rem; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); display: flex; flex-direction: column; align-items: center;">
            <h3 style="margin: 0 0 0.5rem 0; font-size: 0.9rem; color: #94a3b8;">Radar Minimap</h3>
            <canvas id="minimapCanvas" width="180" height="120" style="background: #08080a; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; display: block;"></canvas>
          </div>

          <div id="styleBiomesMount"></div>
          <div id="labelMount"></div>
          <div id="exporterMount"></div>
          <div id="burgTypeMount"></div>
          <div id="militaryUnitMount"></div>

          <!-- Editors Mounting Targets -->
          <div id="burgEditorMount"></div>
          <div id="stateEditorMount"></div>

        </div>

      </div>
    </div>
  `;

  const canvas = document.getElementById("mapCanvas") as HTMLCanvasElement;
  const minimapCanvas = document.getElementById("minimapCanvas") as HTMLCanvasElement;
  const threeContainer = document.getElementById("threeContainer") as HTMLDivElement;
  const loadingOverlay = document.getElementById("loadingOverlay") as HTMLDivElement;
  const toggle3DBtn = document.getElementById("toggle3DBtn") as HTMLButtonElement;
  const saveBtn = document.getElementById("saveBtn") as HTMLButtonElement;
  const loadBtn = document.getElementById("loadBtn") as HTMLButtonElement;
  const fileInput = document.getElementById("fileInput") as HTMLInputElement;
  const statsEl = document.getElementById("stats") as HTMLDivElement;
  const statusEl = document.getElementById("connectionStatus") as HTMLSpanElement;

  // Mount Editors & Panels
  mountBurgEditor("burgEditorMount", () => renderCurrentLayer());
  mountStateEditor("stateEditorMount", () => {
    renderCurrentLayer();
    if (minimapCanvas) drawMinimap(minimapCanvas, store.getState());
  });

  mountHeightBrush("brushMount");
  mountImageImporter("importerMount", () => {
    renderCurrentLayer();
    if (minimapCanvas) drawMinimap(minimapCanvas, store.getState());
  });

  mountLabelEditor("labelMount", () => renderCurrentLayer());
  mountExportOptions("exporterMount", canvas);

  mountStyleAndBiomeEditor("styleBiomesMount", () => renderCurrentLayer());

  mountLanguageEditor("languageMount");
  mountBurgTypeEditor("burgTypeMount");
  mountMilitaryUnitEditor("militaryUnitMount");

  const updateCanvasSize = () => {
    if (!canvas) return;
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      canvas.width = rect.width;
      canvas.height = rect.width * 0.625;
      if (threeRenderer) {
        threeRenderer.resize(rect.width, rect.width * 0.625);
      }
    }
  };

  const connectWebSocket = () => {
    if (socket) {
      socket.close();
    }
    socket = new WebSocket(`ws://localhost:8000/ws/map/${currentSessionId}`);
    socket.onopen = () => {
      if (statusEl) {
        statusEl.innerHTML = "● Connected to Collaborative Server";
        statusEl.style.color = "#4ade80";
      }
    };
    socket.onclose = () => {
      if (statusEl) {
        statusEl.innerHTML = "Disconnected from Multiplayer";
        statusEl.style.color = "#f87171";
      }
    };
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.op === "CELL_MUTATED") {
          const { cellId, changes } = data;
          const state = store.getState();
          if (state.heights && state.grid) {
            if (changes.height !== undefined) {
              state.heights[cellId] = Math.min(Math.max(Math.round(changes.height * 100), 0), 100);
            }
            renderCurrentLayer();
            if (threeRenderer && is3DMode) {
              threeRenderer.updateTerrain(store.getState());
            }
          }
        }
      } catch (err) {
        console.error("WS parse error:", err);
      }
    };
  };

  const runSimulation = (config: SetupConfig) => {
    if (!canvas || !loadingOverlay) return;
    loadingOverlay.style.display = "flex";

    setTimeout(() => {
      try {
        const t0 = performance.now();
        const width = canvas.width;
        const height = canvas.height;
        const seed = "map-" + Math.floor(Math.random() * 1000000);

        const grid = generateJitteredGrid(width, height, config.cellsCount, seed);
        const hg = new HeightmapGenerator(grid, width, height, seed);
        let rawHeights = hg.executeTemplate(`
          Hill 1 80-85 60-80 40-60
          Hill 1 80-85 20-30 40-60
          Hill 6-7 15-30 25-75 15-85
          Multiply 0.6 land 0 0
          Hill 8-10 5-10 15-85 20-80
          Range 1-2 35-55 5-95 20-80
          Strait 1 vertical 0 0
          Smooth 3 0 0 0
          Mask 3 0 0 0
        `);

        const climateOpts = {
          temperatureEquator: config.tempEquator,
          temperatureNorthPole: -30,
          temperatureSouthPole: -15,
          winds: [config.windsAngle, 45, 225, 315, 135, 315],
          precInput: config.precipitationInput
        };
        const { temp, prec } = generateClimate(grid, rawHeights, width, height, climateOpts);
        const hydro = generateHydrology(grid, rawHeights, prec);
        const heights = bakeErosion(grid, hydro.heights, hydro.flowDirections, 3);
        const biomes = generateBiomes(grid, heights, temp, prec, hydro.rivers);
        const { cultures, cellCultures } = generateCultures(grid, heights, biomes, 6, seed);
        const burgs = generateBurgs(grid, heights, biomes, hydro.rivers, hydro.flux, config.burgsCount);
        const { states, cellStates } = generateStates(grid, heights, cellCultures, burgs, config.statesCount, biomes);
        const routes = generateRoutes(grid, heights, burgs);
        const { provinces, cellProvinces } = generateProvinces(grid, heights, cellStates, burgs, states);
        const military = generateMilitary(grid, heights, cellStates, states, burgs);
        const { religions, cellReligions } = generateReligions(grid, heights, cellCultures, config.religionsCount, seed);
        const zones = generateZones(grid, heights, seed);
        const markers = generateMarkers(grid, heights, biomes, seed);

        const cellGoods = generateGoods(grid, heights, biomes);
        const markets = generateMarkets(grid, burgs, cellGoods);
        const production = runProductionCycles(markets);

        const t1 = performance.now();

        store.updateState({
          width,
          height,
          seed,
          grid,
          heights,
          temp,
          prec,
          flowDirections: hydro.flowDirections,
          flux: hydro.flux,
          rivers: hydro.rivers,
          biomes,
          cellCultures,
          cellStates,
          cellProvinces,
          cellReligions,
          cellGoods,
          burgs,
          routes,
          provinces,
          military,
          religions,
          zones,
          markers,
          markets,
          production,
          labels: []
        } as any);

        if (statsEl) {
          statsEl.innerHTML = `Generated ${grid.points.length} cells in <strong style="color: #fbbf24;">${(t1 - t0).toFixed(1)}ms</strong>`;
        }

        connectWebSocket();
        renderCurrentLayer();
        if (minimapCanvas) drawMinimap(minimapCanvas, store.getState());
        
        if ((window as any).refreshBiomesList) {
          (window as any).refreshBiomesList();
        }

        if (threeRenderer) {
          threeRenderer.updateTerrain(store.getState());
        }
      } catch (err: any) {
        console.error("Simulation error:", err);
      } finally {
        loadingOverlay.style.display = "none";
      }
    }, 50);
  };

  mountConfigurator("configuratorMount", (config) => runSimulation(config));

  const renderCurrentLayer = () => {
    if (!canvas || is3DMode) return;
    renderMap(canvas, store.getState(), currentLayer);
  };

  canvas.addEventListener("mousedown", (e) => {
    if (is3DMode) return;
    const state = store.getState() as any;
    if (!state.grid || !state.heights) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const clickY = ((e.clientY - rect.top) / rect.height) * canvas.height;

    if (state.burgs) {
      for (const b of state.burgs) {
        const dist = Math.hypot(b.x - clickX, b.y - clickY);
        if (dist < 12) {
          (window as any).openBurgEditor(b);
          return;
        }
      }
    }

    const cellId = findClosestCellIndex(clickX, clickY, state.grid.points);
    const sId = state.cellStates ? state.cellStates[cellId] : 0;
    if (sId > 0 && state.states) {
      const activeState = state.states.find((s: any) => s.id === sId);
      if (activeState) {
        (window as any).openStateEditor(activeState);
        return;
      }
    }

    const brush = (window as any).getCurrentBrushConfig();
    const originalHeight = state.heights[cellId];
    let newHeight = originalHeight;

    if (brush.mode === "add") {
      newHeight = Math.min(originalHeight + 15, 100);
    } else if (brush.mode === "sub") {
      newHeight = Math.max(originalHeight - 15, 0);
    } else if (brush.mode === "set") {
      newHeight = brush.value;
    } else if (brush.mode === "smooth") {
      const neighbors = state.grid.cells.c[cellId] || [];
      const sum = neighbors.reduce((acc: number, n: number) => acc + state.heights[n], originalHeight);
      newHeight = Math.round(sum / (neighbors.length + 1));
    }

    state.heights[cellId] = newHeight;
    renderCurrentLayer();
    if (minimapCanvas) drawMinimap(minimapCanvas, store.getState());

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        op: "MUTATE_CELL",
        cellId,
        changes: { height: newHeight / 100.0 }
      }));
    }
  });

  const layerButtons = document.querySelectorAll(".layerBtn");
  layerButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const layer = target.getAttribute("data-layer") as any;
      if (!layer) return;

      currentLayer = layer;
      
      layerButtons.forEach(b => {
        const button = b as HTMLButtonElement;
        if (button.getAttribute("data-layer") === currentLayer) {
          button.style.background = "#4f46e5";
          button.style.borderColor = "#4f46e5";
          button.style.color = "white";
        } else {
          button.style.background = "transparent";
          button.style.borderColor = "rgba(255, 255, 255, 0.15)";
          button.style.color = "#94a3b8";
        }
      });

      renderCurrentLayer();
    });
  });

  if (toggle3DBtn && threeContainer) {
    toggle3DBtn.addEventListener("click", () => {
      is3DMode = !is3DMode;
      if (is3DMode) {
        canvas.style.display = "none";
        threeContainer.style.display = "block";
        if (!threeRenderer) {
          threeRenderer = new ThreeRenderer(threeContainer);
        }
        threeRenderer.updateTerrain(store.getState());
        threeRenderer.startAnimation();
        layerButtons.forEach(b => ((b as HTMLButtonElement).disabled = true));
      } else {
        canvas.style.display = "block";
        threeContainer.style.display = "none";
        if (threeRenderer) {
          threeRenderer.stopAnimation();
        }
        layerButtons.forEach(b => ((b as HTMLButtonElement).disabled = false));
        renderCurrentLayer();
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const state = store.getState();
      const serialized = serializeMapState(state);
      const blob = new Blob([serialized], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${state.seed || "map"}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  if (loadBtn && fileInput) {
    loadBtn.addEventListener("click", () => {
      fileInput.click();
    });
    fileInput.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const contents = event.target?.result as string;
          const reloadedState = deserializeMapState(contents);
          store.updateState(reloadedState);
          renderCurrentLayer();
          if (minimapCanvas) drawMinimap(minimapCanvas, store.getState());
          if (threeRenderer && is3DMode) {
            threeRenderer.updateTerrain(store.getState());
          }
        } catch (err) {
          alert("Error parsing loaded map file.");
          console.error(err);
        }
      };
      reader.readAsText(file);
    });
  }

  updateCanvasSize();
  if ((window as any).getCurrentSetupConfig) {
    runSimulation((window as any).getCurrentSetupConfig());
  }

  window.addEventListener("resize", () => {
    updateCanvasSize();
    renderCurrentLayer();
  });
}

export {};
