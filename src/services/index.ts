import { loadingTip } from "@/ui/tooltips";
import { createRegistry, eager } from "@/utils/registry";
import { Save } from "./io/save";

export const Services = createRegistry(
  {
    AppOffer: () => import("@/services/app-offer").then(m => m.AppOffer),
    Cloud: () => import("@/services/io/cloud").then(m => m.CloudStorage),
    ExportJson: () => import("@/services/io/export-json").then(m => m.ExportJson),
    ExportMap: () => import("@/services/io/export").then(m => m.ExportMap),
    Load: () => import("@/services/io/load").then(m => m.Load),
    ReleaseNotes: () => import("@/services/release-notes").then(m => m.ReleaseNotes),
    Save: eager(Save), // the picker must not wait for a module download after a click
    UiTour: () => import("@/services/ui-tour").then(m => m.UiTour)
  },
  loadingTip
);
