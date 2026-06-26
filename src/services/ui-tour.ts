import { driver } from "driver.js";
import { ensureEl } from "@/utils/nodeUtils";
import "driver.js/dist/driver.css";

function closeOptionsPanel() {
  const options = ensureEl("options");
  if (options && options.style.display !== "none") {
    ensureEl("optionsHide")?.click();
  }
}

function start() {
  closeOptionsPanel();

  const tour = driver({
    showProgress: true,
    allowClose: true,
    popoverClass: "fmg-tour",
    overlayColor: "rgb(0,0,0)",
    overlayOpacity: 0.75,
    stagePadding: 4,
    stageRadius: 4,
    onPopoverRender: popover => {
      Object.assign(popover.wrapper.style, {
        backgroundColor: "#ffffff",
        color: "#000000",
        border: "1px solid #cccccc",
        fontFamily: "Georgia, serif"
      });
      popover.title.style.color = "#000000";
      popover.title.style.borderBottomColor = "#cccccc";
      popover.progress.style.color = "#666666";
      popover.closeButton.style.color = "#000000";
      for (const btn of [popover.previousButton, popover.nextButton]) {
        Object.assign(btn.style, {
          backgroundColor: "#f0f0f0",
          border: "1px solid #cccccc",
          color: "#000000"
        });
      }
    },
    onDestroyStarted: () => {
      document.removeEventListener("keydown", handleKeydown);
      hideHeightmapCustomizationPanel();
      closeDialogs();
      tour.destroy();
      closeOptionsPanel();
    },
    steps: [
      {
        element: "#map",
        popover: {
          title: "Welcome to Fantasy Map Generator",
          description:
            "This quick tour covers the essential controls. Use Next/Previous to navigate, or press Esc to exit at any time.",
          side: "over",
          align: "center"
        }
      },
      {
        element: "#map",
        popover: {
          title: "Navigate the Map",
          description:
            "Scroll the mouse wheel to zoom in and out. Click and drag on the map to pan. Double-click a location to center on it.",
          onNextClick: () => {
            document.body.classList.add("tour-free-roam");
            tour.moveNext();
          }
        }
      },
      {
        element: "#tooltip",
        onHighlightStarted: () => {
          document.body.classList.add("tour-free-roam");
        },
        popover: {
          title: "Hover Tooltips",
          description:
            "Move your mouse over the map (when the tour is over), the tooltip bar at the bottom updates with information about cells, burgs, states, and more. Click Next when you're ready to continue.",
          side: "top",
          align: "center"
        }
      },
      {
        element: "#optionsTrigger",
        onHighlightStarted: () => {
          document.body.classList.remove("tour-free-roam");
          closeOptionsPanel();
        },
        popover: {
          title: "Open the Options Menu",
          description: "Click this arrow button to open the main options panel where all configuration tabs live.",
          side: "right",
          onNextClick: () => {
            const options = ensureEl("options");
            if (options.style.display === "none") ensureEl("optionsTrigger").click();
            tour.moveNext();
          }
        }
      },

      // ── Layers tab ──────────────────────────────────────────────────────────
      {
        element: "#layersTab",
        onHighlightStarted: () => {
          ensureEl("layersTab")?.click();
        },
        popover: {
          title: "Layers Tab",
          description: "The Layers tab controls which map elements are visible on the map.",
          side: "bottom"
        }
      },
      {
        element: "#layersPreset",
        onHighlightStarted: () => {
          ensureEl("layersTab")?.click();
        },
        popover: {
          title: "Layer Presets",
          description:
            "Choose a preset to instantly show or hide common layer combinations: Political, Physical, Religions, and more.",
          side: "bottom"
        }
      },
      {
        element: "#mapLayers",
        onHighlightStarted: () => {
          ensureEl("layersTab")?.click();
        },
        popover: {
          title: "Toggle Individual Layers",
          description:
            "Click any layer name to toggle it on or off. Layers can be reordered by dragging and dropping them.",
          side: "right"
        }
      },

      // ── Style tab ────────────────────────────────────────────────────────────
      {
        element: "#styleTab",
        onHighlightStarted: () => {
          ensureEl("styleTab")?.click();
        },
        popover: {
          title: "Style Tab",
          description:
            "The Style tab controls the visual appearance of the map — color schemes, opacity, line weights, and other properties for each map element.",
          side: "bottom"
        }
      },
      {
        element: "#stylePreset",
        onHighlightStarted: () => {
          ensureEl("styleTab")?.click();
        },
        popover: {
          title: "Style Presets",
          description:
            "Pick a color scheme preset for the map including Default, Ancient, Pale, and others. The entire map's color palette updates instantly.",
          side: "bottom"
        }
      },
      {
        element: "#styleElementSelect",
        onHighlightStarted: () => {
          ensureEl("styleTab")?.click();
        },
        popover: {
          title: "Individual Style Settings",
          description:
            "Select a specific map element from this dropdown to adjust its colors, opacity, stroke width, and other visual properties.",
          side: "bottom"
        }
      },

      // ── Options tab ──────────────────────────────────────────────────────────
      {
        element: "#optionsTab",
        onHighlightStarted: () => {
          ensureEl("optionsTab")?.click();
        },
        popover: {
          title: "Options Tab",
          description:
            "The Options tab lets you configure world generation parameters like the number of states, cultures, religions, and other settings that shape the generated world.",
          side: "bottom"
        }
      },
      {
        element: "#optionsContent",
        onHighlightStarted: () => {
          ensureEl("optionsTab")?.click();
        },
        popover: {
          title: "Generation Options",
          description:
            "Set world parameters like the number of cultures, states, and religions before generating a new map. UI preferences like tooltips and autosave are also here.",
          side: "right"
        }
      },
      {
        element: "#configureWorld",
        onHighlightStarted: () => {
          closeDialogs();
          ensureEl("optionsTab")?.click();
        },
        popover: {
          title: "Configure World",
          description:
            "This button opens the World Configurator where you can set the map's position on the globe, adjust equatorial and polar temperatures, and configure precipitation to shape the world's climate.",
          side: "right",
          onNextClick: () => {
            tour.moveNext();
          }
        }
      },
      {
        element: "#worldConfigurator",
        disableActiveInteraction: false,
        onHighlightStarted: () => {
          editWorld();
        },
        popover: {
          title: "World Configurator",
          description:
            "Here you can set temperatures at the equator and poles, control wind direction and precipitation, and position the map on the globe. Changes affect biome and climate generation.",
          side: "right",
          onNextClick: () => {
            closeDialogs();
            ensureEl("toolsTab")?.click();
            tour.moveNext();
          }
        }
      },

      // ── Tools tab ────────────────────────────────────────────────────────────
      {
        element: "#toolsTab",
        onHighlightStarted: () => {
          ensureEl("toolsTab")?.click();
        },
        popover: {
          title: "Tools Tab",
          description:
            "The Tools tab gives you direct access to all of the map's editors: terrain, biomes, states, cultures, religions, routes, and more.",
          side: "bottom"
        }
      },
      {
        element: "#editHeightmapButton",
        onHighlightStarted: () => {
          ensureEl("toolsTab")?.click();
        },
        popover: {
          title: "Edit the Heightmap",
          description:
            "Open the Heightmap editor to manually sculpt terrain by raising or lowering elevation. Changes here reshape coastlines, rivers, and biomes.",
          side: "right",
          onNextClick: () => {
            tour.moveNext();
          }
        }
      },
      {
        element: "#customizationMenu",
        disableActiveInteraction: false,
        onHighlightStarted: () => {
          const toolsContent = ensureEl("toolsContent");
          const customizationMenu = ensureEl("customizationMenu");
          toolsContent.style.display = "none";
          customizationMenu.style.display = "block";
        },
        onDeselected: () => {
          hideHeightmapCustomizationPanel();
        },
        popover: {
          title: "Heightmap Editor",
          description:
            "The Heightmap editor panel lets you paint terrain directly on the map. You can raise or lower land, apply templates, convert an image into a heightmap, or preview the terrain in 3D.",
          side: "right"
        }
      },

      // ── About tab ────────────────────────────────────────────────────────────
      {
        element: "#aboutTab",
        onHighlightStarted: () => {
          ensureEl("aboutTab")?.click();
        },
        popover: {
          title: "About Tab",
          description:
            "The About tab has links to documentation, video tutorials, the community Discord, and version information.",
          side: "bottom"
        }
      },
      {
        element: "#aboutContent",
        onHighlightStarted: () => {
          ensureEl("aboutTab")?.click();
        },
        popover: {
          title: "About & Resources",
          description:
            "Find the Quick Start guide, video tutorials, hotkey reference, Discord community, and changelog here. The project is open source and actively maintained.",
          side: "right"
        }
      },

      // ── Export / Save / Load ─────────────────────────────────────────────────
      {
        element: "#exportButton",
        onHighlightStarted: () => {
          closeDialogs();
        },
        popover: {
          title: "Export",
          description:
            "Click Export to open the export dialog where you can download the map as an SVG, PNG, or JPEG image, split it into tiles, or export the world data as JSON.",
          side: "top",
          onNextClick: () => {
            tour.moveNext();
          }
        }
      },
      {
        element: "#exportMapData",
        disableActiveInteraction: false,
        onHighlightStarted: () => {
          showExportPane();
        },
        popover: {
          title: "Export Options",
          description:
            "Download the map as a vector SVG, raster PNG or JPEG, or tiled PNG set. You can also export the full world data as JSON for use in other tools.",
          side: "top",
          onNextClick: () => {
            closeDialogs();
            tour.moveNext();
          }
        }
      },
      {
        element: "#saveButton",
        popover: {
          title: "Save and Load Maps",
          description:
            "Click Save to download a .map file preserving your entire world. Click Load to open a previously saved file and continue where you left off.",
          side: "top",
          onNextClick: () => {
            tour.destroy();
            closeOptionsPanel();
          }
        }
      }
    ]
  });

  function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    return !!target.closest("input, textarea, select, [contenteditable], [contenteditable='plaintext-only']");
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (!tour.isActive() || isEditableTarget(e.target)) return;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      document.querySelector<HTMLElement>(".driver-popover-next-btn")?.click();
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      e.stopPropagation();
      document.querySelector<HTMLElement>(".driver-popover-prev-btn")?.click();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      tour.destroy();
    }
  }

  document.addEventListener("keydown", handleKeydown);
  tour.drive();
}

function hideHeightmapCustomizationPanel() {
  const customizationMenu = ensureEl("customizationMenu");
  if (customizationMenu.style.display !== "block") return;
  customizationMenu.style.display = "none";
  ensureEl("toolsContent").style.display = "block";
}

export const UiTour = { start };
