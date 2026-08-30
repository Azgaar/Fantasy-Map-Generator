import { createRegistry } from "@/utils/registry";
import "./app-shell";
import "./autosave";
import "./fonts";
import "./versioning";

export const Services = createRegistry({
  AppOffer: () => import("@/services/app-offer").then(m => m.AppOffer),
  Cloud: () => import("@/services/io/cloud").then(m => m.CloudStorage),
  ExportJson: () => import("@/services/io/export-json").then(m => m.ExportJson),
  ExportMap: () => import("@/services/io/export").then(m => m.ExportMap),
  Load: () => import("@/services/io/load").then(m => m.Load),
  Save: () => import("@/services/io/save").then(m => m.Save),
  UiTour: () => import("@/services/ui-tour").then(m => m.UiTour)
});

type ServicesRegistry = typeof Services;
declare global {
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var Services: ServicesRegistry;
}
window.Services = Services;
