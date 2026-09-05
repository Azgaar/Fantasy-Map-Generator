import "./app-info";
import "./tooltips";
import "./map-tooltip";
import "./zoom";
import "./viewbox-events";
import "./tools";
import "./hotkeys";
import "./layers";
import "./layers-presets";
import "./layers-tab";
import "./dialog/dialog-helpers";
import "./dialog/sorting";
import "./fill-box";
import "./slider-input";

// PROTOTYPE — Map Wheel right-click menu variants. Dev-only; Vite drops this from prod builds.
// See ./map-wheel-prototype/README.md. Remove together with that directory once a variant wins.
if (import.meta.env.DEV) void import("./map-wheel-prototype");
