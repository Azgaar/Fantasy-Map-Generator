// src/viewer/main.js

import '../engine/utils/polyfills.js';

import { generate as generateMapEngine } from '../engine/main.js';
// We will create the renderer and UI modules later
// import { renderMap } from './render.js'; 
// import { initializeUI } from './ui.js';

// This function is the heart of the Viewer. It reads ALL UI inputs.
function buildConfigFromUI() {
    // This is where you consolidate ALL the config properties
    // identified in your markdown files.
    const graphWidth = +byId("mapWidthInput").value || 1920;
    const graphHeight = +byId("mapHeightInput").value || 1080;
    const cellsDesired = +byId("pointsInput").dataset.cells || 10000;
    
    return {
        seed: byId("optionsSeed").value,
        graphWidth,
        graphHeight,
        graph: {
            cellsDesired,
            graphWidth,
            graphHeight
        },
        heightmap: {
            templateId: byId("templateInput").value,
            graphWidth,
            graphHeight
        },
        map: {
            template: byId("templateInput").value,
            graphWidth,
            graphHeight
        },
        temperature: {
            temperatureEquator: +(byId("temperatureEquatorOutput")?.value || 30),
            temperatureNorthPole: +(byId("temperatureNorthPoleOutput")?.value || -10),
            temperatureSouthPole: +(byId("temperatureSouthPoleOutput")?.value || -15),
            heightExponent: +(byId("heightExponentInput")?.value || 1.8),
            graphHeight
        },
        precipitation: {
            cellsDesired,
            precipitation: +(byId("precInput")?.value || 100),
            winds: window.options?.winds || [225, 225, 225, 225, 225, 225] // default wind angles
        },
        lakes: {
            elevationLimit: +(byId("lakeElevationLimitOutput")?.value || 80),
            openLakeLimit: 22,
            template: byId("templateInput").value
        },
        biomes: {
            // No config for biomes
        },
        burgs: {
            statesNumber: +byId("statesNumber").value,
            sizeVariety: +byId("sizeVariety").value,
            manorsInput: byId("manorsInput").valueAsNumber,
            growthRate: byId("growthRate").valueAsNumber || 1,
            statesGrowthRate: byId("statesGrowthRate")?.valueAsNumber || 1
        },
        cultures: {
            culturesInput: +byId("culturesInput").value,
            culturesSet: byId("culturesSet").value,
            culturesInSetNumber: +byId("culturesSet").selectedOptions[0].dataset.max,
            sizeVariety: +byId("sizeVariety").value, // Note: some configs are shared
            neutralRate: byId("neutralRate")?.valueAsNumber || 1,
            emblemShape: byId("emblemShape").value
        },
        coa: {
             emblemShape: byId("emblemShape").value,
             emblemShapeGroup: byId("emblemShape").selectedOptions[0]?.parentNode.label || "Diversiform"
        },
        rivers: {
            resolveDepressionsSteps: +byId("resolveDepressionsStepsOutput").value,
            cellsCount: cellsDesired
        },
        // ... and so on for every other module ...
    };
}

function handleGenerateClick() {
    console.log("Building config from UI and calling engine...");
    const config = buildConfigFromUI();
    
    // Single, clean call to the engine
    const mapData = generateMapEngine(config);

    console.log("Engine finished. Handing data to renderer...");
    // The renderer will take over from here
    // renderMap(mapData);
}

// This will be the main entry point for the viewer application
window.addEventListener('DOMContentLoaded', () => {
    // initializeUI(handleGenerateClick); // Wire up the "Generate" button, etc.
    
    // For now, let's just add a listener to the existing button
    byId("newMapButton").addEventListener("click", handleGenerateClick);
});