// Reusable UI building blocks: web components, shared widgets, and the persistent map chrome.
// Importing registers the custom elements and mounts the chrome
import "./app-info";
import "./tooltips";
import "./map-tooltip";
import "./zoom";
import "./viewbox-events";
import "./tools";
import "./hotkeys";
import { destroyDialog, updateDialog } from "./dialog/dialog-helpers";
import "./dialog/sorting";
import { enableVerticalSortable } from "./dialog/vertical-sortable";
import { enableElementDragging } from "./element-dragging";
import "./fill-box";
import "./slider-input";

Object.assign(window, {
  destroyDialog,
  enableElementDragging,
  enableVerticalSortable,
  showDomDialog: (options: import("./ui/dom-dialog").DomDialogOptions) =>
    import("./ui/dom-dialog").then(({ showDomDialog }) => showDomDialog(options)),
  showMessageDialog: (options: import("./ui/message-dialog").MessageDialogOptions) =>
    import("./ui/message-dialog").then(({ showMessageDialog }) => showMessageDialog(options)),
  updateDialog
});

// Keep React and the workspace UI out of the map generation startup path.
const loadWorkspace = () => void import("./workspace-sidebar");
if (document.readyState === "complete") loadWorkspace();
else window.addEventListener("load", loadWorkspace, { once: true });
