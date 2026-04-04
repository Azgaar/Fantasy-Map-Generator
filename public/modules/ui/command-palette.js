"use strict";

// Command palette (Ctrl+K) — quick access to all tools, layers, and actions
(function () {
  const commands = [
    // Editors
    {label: "Edit Heightmap", category: "Editors", action: () => editHeightmap(), shortcut: "Shift+H"},
    {label: "Edit Biomes", category: "Editors", action: () => editBiomes(), shortcut: "Shift+B"},
    {label: "Edit States", category: "Editors", action: () => editStates(), shortcut: "Shift+S"},
    {label: "Edit Provinces", category: "Editors", action: () => editProvinces(), shortcut: "Shift+P"},
    {label: "Edit Diplomacy", category: "Editors", action: () => editDiplomacy(), shortcut: "Shift+D"},
    {label: "Edit Cultures", category: "Editors", action: () => editCultures(), shortcut: "Shift+C"},
    {label: "Edit Religions", category: "Editors", action: () => editReligions(), shortcut: "Shift+R"},
    {label: "Edit Emblems", category: "Editors", action: () => openEmblemEditor(), shortcut: "Shift+Y"},
    {label: "Edit Names", category: "Editors", action: () => editNamesbase(), shortcut: "Shift+N"},
    {label: "Edit Units", category: "Editors", action: () => editUnits(), shortcut: "Shift+Q"},
    {label: "Edit Notes", category: "Editors", action: () => editNotes(), shortcut: "Shift+O"},
    {label: "Edit Zones", category: "Editors", action: () => editZones(), shortcut: "Shift+Z"},

    // Overviews
    {label: "Overview Charts", category: "Overviews", action: () => overviewCharts(), shortcut: "Shift+A"},
    {label: "Overview Burgs", category: "Overviews", action: () => overviewBurgs(), shortcut: "Shift+T"},
    {label: "Overview Routes", category: "Overviews", action: () => overviewRoutes(), shortcut: "Shift+U"},
    {label: "Overview Rivers", category: "Overviews", action: () => overviewRivers(), shortcut: "Shift+V"},
    {label: "Overview Military", category: "Overviews", action: () => overviewMilitary(), shortcut: "Shift+M"},
    {label: "Overview Markers", category: "Overviews", action: () => overviewMarkers(), shortcut: "Shift+K"},
    {label: "View Cell Details", category: "Overviews", action: () => viewCellDetails(), shortcut: "Shift+E"},

    // Add features
    {label: "Add Label", category: "Add", action: () => toggleAddLabel(), shortcut: "@"},
    {label: "Add Burg", category: "Add", action: () => toggleAddBurg(), shortcut: "!"},
    {label: "Add River", category: "Add", action: () => toggleAddRiver(), shortcut: "#"},
    {label: "Create Route", category: "Add", action: () => createRoute(), shortcut: "$"},
    {label: "Add Marker", category: "Add", action: () => toggleAddMarker(), shortcut: "%"},

    // Layers
    {label: "Toggle Texture", category: "Layers", action: () => toggleTexture(), shortcut: "X"},
    {label: "Toggle Height", category: "Layers", action: () => toggleHeight(), shortcut: "H"},
    {label: "Toggle Biomes", category: "Layers", action: () => toggleBiomes(), shortcut: "B"},
    {label: "Toggle Cells", category: "Layers", action: () => toggleCells(), shortcut: "E"},
    {label: "Toggle Grid", category: "Layers", action: () => toggleGrid(), shortcut: "G"},
    {label: "Toggle Coordinates", category: "Layers", action: () => toggleCoordinates(), shortcut: "O"},
    {label: "Toggle Compass", category: "Layers", action: () => toggleCompass(), shortcut: "W"},
    {label: "Toggle Rivers", category: "Layers", action: () => toggleRivers(), shortcut: "V"},
    {label: "Toggle Relief", category: "Layers", action: () => toggleRelief(), shortcut: "F"},
    {label: "Toggle Cultures", category: "Layers", action: () => toggleCultures(), shortcut: "C"},
    {label: "Toggle States", category: "Layers", action: () => toggleStates(), shortcut: "S"},
    {label: "Toggle Provinces", category: "Layers", action: () => toggleProvinces(), shortcut: "P"},
    {label: "Toggle Zones", category: "Layers", action: () => toggleZones(), shortcut: "Z"},
    {label: "Toggle Borders", category: "Layers", action: () => toggleBorders(), shortcut: "D"},
    {label: "Toggle Religions", category: "Layers", action: () => toggleReligions(), shortcut: "R"},
    {label: "Toggle Routes", category: "Layers", action: () => toggleRoutes(), shortcut: "U"},
    {label: "Toggle Temperature", category: "Layers", action: () => toggleTemperature(), shortcut: "T"},
    {label: "Toggle Population", category: "Layers", action: () => togglePopulation(), shortcut: "N"},

    // Actions
    {label: "Generate New Map", category: "Actions", action: () => regeneratePrompt(), shortcut: "F2"},
    {label: "Save Map", category: "Actions", action: () => saveMap("machine"), shortcut: "Ctrl+S"},
    {label: "Quick Save", category: "Actions", action: () => saveMap("storage"), shortcut: "F6"},
    {label: "Quick Load", category: "Actions", action: () => quickLoad(), shortcut: "F9"},
    {label: "Undo", category: "Actions", action: () => undo?.click(), shortcut: "Ctrl+Z"},
    {label: "Redo", category: "Actions", action: () => redo?.click(), shortcut: "Ctrl+Y"},

    // Presets
    {label: "Preset: Political Map", category: "Presets", action: () => handleLayersPresetChange("political")},
    {label: "Preset: Cultural Map", category: "Presets", action: () => handleLayersPresetChange("cultural")},
    {label: "Preset: Religions Map", category: "Presets", action: () => handleLayersPresetChange("religions")},
    {label: "Preset: Provinces Map", category: "Presets", action: () => handleLayersPresetChange("provinces")},
    {label: "Preset: Biomes Map", category: "Presets", action: () => handleLayersPresetChange("biomes")},
    {label: "Preset: Heightmap", category: "Presets", action: () => handleLayersPresetChange("heightmap")},
    {label: "Preset: Physical Map", category: "Presets", action: () => handleLayersPresetChange("physical")},

    // UI
    {label: "Toggle Menu", category: "UI", action: () => toggleOptions(), shortcut: "Tab"},
    {label: "Theme: Light", category: "UI", action: () => setThemeMode("light")},
    {label: "Theme: Dark", category: "UI", action: () => setThemeMode("dark")},
    {label: "Theme: Auto", category: "UI", action: () => setThemeMode("auto")}
  ];

  let selectedIndex = 0;

  function getFilteredCommands(query) {
    if (!query) return commands;
    const lower = query.toLowerCase();
    return commands.filter(cmd => {
      const haystack = (cmd.label + " " + cmd.category).toLowerCase();
      return lower.split(/\s+/).every(word => haystack.includes(word));
    });
  }

  function render(filtered) {
    const results = byId("commandPaletteResults");
    if (!results) return;

    results.innerHTML = "";
    let lastCategory = "";

    filtered.forEach((cmd, i) => {
      if (cmd.category !== lastCategory) {
        lastCategory = cmd.category;
        const cat = document.createElement("div");
        cat.className = "cmd-category";
        cat.textContent = cmd.category;
        results.appendChild(cat);
      }

      const row = document.createElement("div");
      row.className = "cmd-result" + (i === selectedIndex ? " selected" : "");
      row.dataset.index = i;

      const icon = document.createElement("span");
      icon.className = "cmd-icon";
      icon.textContent = getCategoryIcon(cmd.category);

      const label = document.createElement("span");
      label.className = "cmd-label";
      label.textContent = cmd.label;

      row.appendChild(icon);
      row.appendChild(label);

      if (cmd.shortcut) {
        const shortcut = document.createElement("span");
        shortcut.className = "cmd-shortcut";
        shortcut.textContent = cmd.shortcut;
        row.appendChild(shortcut);
      }

      row.addEventListener("click", () => execute(cmd));
      row.addEventListener("mouseenter", () => {
        selectedIndex = i;
        render(filtered);
      });

      results.appendChild(row);
    });
  }

  function getCategoryIcon(cat) {
    const icons = {
      Editors: "✎",
      Overviews: "◫",
      Add: "+",
      Layers: "◉",
      Actions: "⚡",
      Presets: "☰",
      UI: "◐"
    };
    return icons[cat] || "•";
  }

  function execute(cmd) {
    hide();
    try {
      cmd.action();
    } catch (e) {
      // silently ignore if function doesn't exist yet
    }
  }

  function show() {
    const palette = byId("commandPalette");
    if (!palette) return;
    palette.classList.add("visible");
    const input = byId("commandPaletteInput");
    input.value = "";
    selectedIndex = 0;
    render(commands);
    requestAnimationFrame(() => input.focus());
  }

  function hide() {
    const palette = byId("commandPalette");
    if (palette) palette.classList.remove("visible");
  }

  function isVisible() {
    return byId("commandPalette")?.classList.contains("visible");
  }

  // Event handlers
  document.addEventListener("DOMContentLoaded", () => {
    const input = byId("commandPaletteInput");
    const backdrop = byId("commandPaletteBackdrop");

    if (input) {
      input.addEventListener("input", () => {
        selectedIndex = 0;
        render(getFilteredCommands(input.value));
      });

      input.addEventListener("keydown", (e) => {
        const filtered = getFilteredCommands(input.value);
        if (e.key === "ArrowDown") {
          e.preventDefault();
          selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1);
          render(filtered);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          selectedIndex = Math.max(selectedIndex - 1, 0);
          render(filtered);
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (filtered[selectedIndex]) execute(filtered[selectedIndex]);
        } else if (e.key === "Escape") {
          e.preventDefault();
          hide();
        }
      });
    }

    if (backdrop) {
      backdrop.addEventListener("click", hide);
    }
  });

  // Global toggle function
  window.toggleCommandPalette = function () {
    if (isVisible()) hide();
    else show();
  };
})();
