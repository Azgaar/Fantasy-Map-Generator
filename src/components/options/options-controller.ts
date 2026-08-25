export interface RegenerateOptions {
  fromSetup?: boolean;
  graph?: unknown;
  seed?: string;
}

export type ExportJsonType = "Full" | "GridCells" | "Minimal" | "PackCells";

export interface OptionsControllerApi {
  applyGraphSize: () => void;
  applyStoredOptions: () => void;
  changeCellsDensity: (value: string | number) => void;
  connectToDropbox: () => Promise<void>;
  copyLinkToClickboard: () => void;
  exportToJson: (type: ExportJsonType) => Promise<void>;
  fitMapToScreen: () => void;
  getCellsDensity: (value: string | number) => number;
  getCellsDensityColor: (cells: number) => string;
  hide: (event?: Event) => void;
  loadURL: () => void;
  openExportToPngTiles: () => void;
  randomize: () => void;
  regenerate: (options?: RegenerateOptions) => void;
  restoreSeed: (id: number) => void;
  show: (event?: Event) => void;
  showSupporters: () => Promise<void>;
  toggle: (event?: Event) => void;
}

let target: OptionsControllerApi | null = null;

export const bindOptionsController = (nextTarget: OptionsControllerApi): (() => void) => {
  target = nextTarget;
  return () => {
    if (target === nextTarget) target = null;
  };
};

export const OptionsController: OptionsControllerApi = {
  applyGraphSize: () => target?.applyGraphSize(),
  applyStoredOptions: () => target?.applyStoredOptions(),
  changeCellsDensity: value => target?.changeCellsDensity(value),
  connectToDropbox: () => target?.connectToDropbox() ?? Promise.resolve(),
  copyLinkToClickboard: () => target?.copyLinkToClickboard(),
  exportToJson: type => target?.exportToJson(type) ?? Promise.resolve(),
  fitMapToScreen: () => target?.fitMapToScreen(),
  getCellsDensity: value => target?.getCellsDensity(value) ?? 0,
  getCellsDensityColor: cells => target?.getCellsDensityColor(cells) ?? "#053305",
  hide: event => target?.hide(event),
  loadURL: () => target?.loadURL(),
  openExportToPngTiles: () => target?.openExportToPngTiles(),
  randomize: () => target?.randomize(),
  regenerate: options => target?.regenerate(options),
  restoreSeed: id => target?.restoreSeed(id),
  show: event => target?.show(event),
  showSupporters: () => target?.showSupporters() ?? Promise.resolve(),
  toggle: event => target?.toggle(event)
};
