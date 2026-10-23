declare global {
  interface Window {
    tip: typeof import("@/ui/tooltips").tip;
    clearMainTip: typeof import("@/ui/tooltips").clearMainTip;
    showElementLockTip: typeof import("@/ui/tooltips").showElementLockTip;
    fitLegendBox: typeof import("../renderers/draw-legend").fitLegendBox;
    applyOption: typeof import("../utils").applyOption;
    closeDialogs: typeof import("@/ui/dialog/dialog-helpers").closeDialogs;
    confirmationDialog: typeof import("@/ui/dialog/dialog-helpers").confirmationDialog;
    downloadFile: typeof import("../utils").downloadFile;
    uploadFile: typeof import("../utils").uploadFile;
    setMapZoom: typeof import("@/ui/map/zoom").setMapZoom;
    setZoomExtent: typeof import("@/ui/map/zoom").setZoomExtent;
    setTranslateExtent: typeof import("@/ui/map/zoom").setTranslateExtent;
    getLabelsData: typeof import("../renderers/labels/label-data").getLabelsData;
  }

  // Elements the browser exposes as globals by their id. New code should use `ensureEl` instead
  var alertMessage: HTMLElement;

  // Vendored libraries, each loaded by its own <script> tag in index.html
  var $: (selector: any) => any; // jQuery + jQuery UI
  var aleaPRNG: (seed: string | number) => () => number;
  var FlatQueue: any;
  var RgbQuant: any; // image quantization, used by the heightmap image converter
  var THREE: any; // lazy-loaded by the 3d view
  var Dropbox: any; // dropbox-sdk, loaded on demand from libs/dropbox-sdk.min.js
  var ldb: {
    get: <T = Blob>(key: string) => Promise<T | null | undefined>; // any value IndexedDB can clone
    set: (key: string, value: unknown) => Promise<void>;
  };
}

export type Point = [number, number];
