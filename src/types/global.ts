declare global {
  interface Window {
    tip: typeof import("../components/tooltips").tip;
    clearMainTip: typeof import("../components/tooltips").clearMainTip;
    showElementLockTip: typeof import("../components/tooltips").showElementLockTip;
    fitLegendBox: typeof import("../renderers/draw-legend").fitLegendBox;
    applyOption: typeof import("../utils").applyOption;
    closeDialogs: typeof import("../components/dialog/dialog-helpers").closeDialogs;
    confirmationDialog: typeof import("../components/dialog/dialog-helpers").confirmationDialog;
    downloadFile: typeof import("../utils").downloadFile;
    uploadFile: typeof import("../utils").uploadFile;
    setMapZoom: typeof import("../components/zoom").setMapZoom;
    setZoomExtent: typeof import("../components/zoom").setZoomExtent;
    setTranslateExtent: typeof import("../components/zoom").setTranslateExtent;
    getLabelsData: typeof import("../renderers/labels/label-data").getLabelsData;
  }

  // Elements the browser exposes as globals by their id. New code should use `ensureEl` instead
  var alertMessage: HTMLElement;
  var stylePreset: HTMLSelectElement;

  // Vendored libraries, each loaded by its own <script> tag in index.html
  var $: (selector: any) => any; // jQuery + jQuery UI
  var aleaPRNG: (seed: string | number) => () => number;
  var FlatQueue: any;
  var RgbQuant: any; // image quantization, used by the heightmap image converter
  var THREE: any; // lazy-loaded by the 3d view
  var Dropbox: any; // dropbox-sdk, loaded on demand from libs/dropbox-sdk.min.js
  var ldb: {
    get: (key: string) => Promise<Blob | undefined>;
    set: (key: string, value: Blob) => Promise<void>;
  };
}

export type Point = [number, number];
