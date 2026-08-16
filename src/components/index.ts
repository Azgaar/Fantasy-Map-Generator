// Reusable UI building blocks: web components, shared widgets, and the persistent map chrome.
// Importing registers the custom elements and mounts the chrome
import "./app-info";
import "./tooltips";
import "./map-tooltip";
import "./zoom";
import "./viewbox-events";
import "./tools";
import "./hotkeys";
import "./dialog/dialog-helpers";
import "./dialog/sorting";
import "./fill-box";
import "./slider-input";

// Keep React and the workspace UI out of the map generation startup path.
const loadWorkspace = () => void import("./workspace-sidebar");
if (document.readyState === "complete") loadWorkspace();
else window.addEventListener("load", loadWorkspace, { once: true });
