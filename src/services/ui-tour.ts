import { driver } from "driver.js";
import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { ensureEl } from "@/utils/nodeUtils";
import "driver.js/dist/driver.css";
import { showExportPane } from "@/components/options/io-panes";
import { t } from "@/utils/i18n";

function closeOptionsPanel() {
  const options = ensureEl("options");
  if (options && options.style.display !== "none") {
    ensureEl("optionsHide")?.click();
  }
}

let activeTour: ReturnType<typeof driver> | null = null;

function start() {
  if (activeTour?.isActive()) return;
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
    onDestroyed: () => {
      activeTour = null;
      document.removeEventListener("keydown", handleKeydown);
      hideHeightmapCustomizationPanel();
      closeDialogs();
      closeOptionsPanel();
    },
    steps: [
      {
        element: "#map",
        popover: {
          title: t("Welcome to Fantasy Map Generator"),
          description: t(
            "This quick tour covers the essential controls. Use Next/Previous to navigate, or press Esc to exit at any time."
          ),
          side: "over",
          align: "center"
        }
      },
      {
        element: "#map",
        popover: {
          title: t("Navigate the Map"),
          description: t(
            "Scroll the mouse wheel to zoom in and out. Click and drag on the map to pan. Double-click a location to center on it."
          ),
          onNextClick: () => {
            document.body.classList.add("tour-free-roam");
            advanceTour(tour);
          }
        }
      },
      {
        element: "#tooltip",
        onHighlightStarted: () => {
          document.body.classList.add("tour-free-roam");
        },
        popover: {
          title: t("Hover Tooltips"),
          description: t(
            "Move your mouse over the map (when the tour is over), the tooltip bar at the bottom updates with information about cells, burgs, states, and more. Click Next when you're ready to continue."
          ),
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
          title: t("Open the Options Menu"),
          description: t("Click this arrow button to open the main options panel where all configuration tabs live."),
          side: "right",
          onNextClick: () => {
            const options = ensureEl("options");
            if (options.style.display === "none") ensureEl("optionsTrigger").click();
            advanceTour(tour);
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
          title: t("Layers Tab"),
          description: t("The Layers tab controls which map elements are visible on the map."),
          side: "bottom"
        }
      },
      {
        element: "#layersPreset",
        onHighlightStarted: () => {
          ensureEl("layersTab")?.click();
        },
        popover: {
          title: t("Layer Presets"),
          description: t(
            "Choose a preset to instantly show or hide common layer combinations: Political, Physical, Religions, and more."
          ),
          side: "bottom"
        }
      },
      {
        element: "#mapLayers",
        onHighlightStarted: () => {
          ensureEl("layersTab")?.click();
        },
        popover: {
          title: t("Toggle Individual Layers"),
          description: t(
            "Click any layer name to toggle it on or off. Layers can be reordered by dragging and dropping them."
          ),
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
          title: t("Style Tab"),
          description: t(
            "The Style tab controls the visual appearance of the map — color schemes, opacity, line weights, and other properties for each map element."
          ),
          side: "bottom"
        }
      },
      {
        element: "#stylePreset",
        onHighlightStarted: () => {
          ensureEl("styleTab")?.click();
        },
        popover: {
          title: t("Style Presets"),
          description: t(
            "Click to open the preset gallery and pick a color scheme for the map. The entire map's color palette updates instantly."
          ),
          side: "bottom"
        }
      },
      {
        element: "#styleElementSelect",
        onHighlightStarted: () => {
          ensureEl("styleTab")?.click();
        },
        popover: {
          title: t("Individual Style Settings"),
          description: t(
            "Select a specific map element from this dropdown to adjust its colors, opacity, stroke width, and other visual properties."
          ),
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
          title: t("Options Tab"),
          description: t(
            "The Options tab lets you configure world generation parameters like the number of states, cultures, religions, and other settings that shape the generated world."
          ),
          side: "bottom"
        }
      },
      {
        element: "#optionsContent",
        onHighlightStarted: () => {
          ensureEl("optionsTab")?.click();
        },
        popover: {
          title: t("Generation Options"),
          description: t(
            "Set world parameters like the number of cultures, states, and religions before generating a new map. UI preferences like tooltips and autosave are also here."
          ),
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
          title: t("Configure World"),
          description: t(
            "This button opens the World Configurator where you can set the map's position on the globe, adjust equatorial and polar temperatures, and configure precipitation to shape the world's climate."
          ),
          side: "right",
          onNextClick: () => {
            advanceTour(tour);
          }
        }
      },
      {
        element: "#worldConfigurator",
        disableActiveInteraction: false,
        onHighlightStarted: () => {
          void Controllers.WorldConfigurator.open();
        },
        popover: {
          title: t("World Configurator"),
          description: t(
            "Here you can set temperatures at the equator and poles, control wind direction and precipitation, and position the map on the globe. Changes affect biome and climate generation."
          ),
          side: "right",
          onNextClick: () => {
            closeDialogs();
            ensureEl("toolsTab")?.click();
            advanceTour(tour);
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
          title: t("Tools Tab"),
          description: t(
            "The Tools tab gives you direct access to all of the map's editors: terrain, biomes, states, cultures, religions, routes, and more."
          ),
          side: "bottom"
        }
      },
      {
        element: "#editHeightmapButton",
        onHighlightStarted: () => {
          ensureEl("toolsTab")?.click();
        },
        popover: {
          title: t("Edit Heightmap"),
          description: t(
            "Open the Heightmap editor to manually sculpt terrain by raising or lowering elevation. Changes here reshape coastlines, rivers, and biomes."
          ),
          side: "right",
          onNextClick: () => {
            advanceTour(tour);
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
          title: t("Heightmap Editor"),
          description: t(
            "The Heightmap editor panel lets you paint terrain directly on the map. You can raise or lower land, apply templates, convert an image into a heightmap, or preview the terrain in 3D."
          ),
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
          title: t("About Tab"),
          description: t(
            "The About tab has links to documentation, video tutorials, the community Discord, and version information."
          ),
          side: "bottom"
        }
      },
      {
        element: "#aboutContent",
        onHighlightStarted: () => {
          ensureEl("aboutTab")?.click();
        },
        popover: {
          title: t("About & Resources"),
          description: t(
            "Find the Quick Start guide, video tutorials, hotkey reference, Discord community, and changelog here. The project is open source and actively maintained."
          ),
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
          title: t("Export"),
          description: t(
            "Click Export to open the export dialog where you can download the map as an SVG, PNG, or JPEG image, split it into tiles, or export the world data as JSON."
          ),
          side: "top",
          onNextClick: () => {
            advanceTour(tour);
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
          title: t("Export Options"),
          description: t(
            "Download the map as a vector SVG, raster PNG or JPEG, or tiled PNG set. You can also export the full world data as JSON for use in other tools."
          ),
          side: "top",
          onNextClick: () => {
            closeDialogs();
            advanceTour(tour);
          }
        }
      },
      {
        element: "#saveButton",
        popover: {
          title: t("Save and Load Maps"),
          description: t(
            "Click Save to download a .map file preserving your entire world. Click Load to open a previously saved file and continue where you left off."
          ),
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

  activeTour = tour;
  document.addEventListener("keydown", handleKeydown);
  tour.drive();
}

function hideHeightmapCustomizationPanel() {
  const customizationMenu = ensureEl("customizationMenu");
  if (customizationMenu.style.display !== "block") return;
  customizationMenu.style.display = "none";
  ensureEl("toolsContent").style.display = "block";
}

// Let the browser finish the click before Driver.js replaces its popover. Several tour steps
// open or close panels in their callback, and replacing the clicked button during dispatch can
// leave Playwright (and real pointer users) waiting on a moving target.
function advanceTour(tour: ReturnType<typeof driver>): void {
  setTimeout(() => {
    if (tour.isActive()) tour.moveNext();
  });
}

export const UiTour = { start };
