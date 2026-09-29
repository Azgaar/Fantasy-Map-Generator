import { createRegistry, eager } from "@/utils/registry";
import { Save } from "./io/save";
import "./platform";
import "./assistant/bubble";
import "./autosave";
import "./fonts";
import "./url-params";
import "./versioning";

export const Services = createRegistry({
  AppOffer: () => import("@/services/app-offer").then(m => m.AppOffer),
  Cloud: () => import("@/services/io/cloud").then(m => m.CloudStorage),
  ExportJson: () => import("@/services/io/export-json").then(m => m.ExportJson),
  ExportMap: () => import("@/services/io/export").then(m => m.ExportMap),
  Load: () => import("@/services/io/load").then(m => m.Load),
  Save: eager(Save), // the picker must not wait for a module download after a click
  UiTour: () => import("@/services/ui-tour").then(m => m.UiTour)
});

type ServicesRegistry = typeof Services;
declare global {
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var Services: ServicesRegistry;
}
window.Services = Services;
