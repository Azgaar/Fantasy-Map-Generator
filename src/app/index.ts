// The app's modules, loaded once the interface language's strings are: their markup is translated as they load
import "@/services/logging";
import "@/model/globals";
import "./chrome/tabs";

import "@/utils";
import "@/data/supporters";
import "@/data/heightmap-templates";
import "@/data/precreated-heightmaps";
import "@/model";
import "@/renderers";
import "@/model/options/options-model";
import "@/ui/dialog/system-dialogs";
import "./chrome/app-info";
import "@/ui/tooltips";
import "@/ui/map/map-tooltip";
import "@/ui/map/zoom";
import "@/ui/map/viewbox-events";
import "./hotkeys";
import "@/renderers/layers";
import "./layers-presets";
import "./canvas";
import "./chrome/io-panes";
import "@/renderers/view-mode";
import "./chrome/options-panel";
import "./seed";
import "./lifecycle";
import "@/ui/dialog/dialog-helpers";
import "@/ui/dialog/sorting";
import "@/ui/elements/fill-box";
import "@/ui/elements/slider-input";
import "@/controllers";
import "@/services";
import "@/model/styles/styles-legacy";

export { boot } from "./lifecycle";
