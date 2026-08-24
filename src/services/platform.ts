// What the app is running inside: a browser tab, an installed PWA or the Electron desktop shell
export type ElectronBridge = {
  isElectron: true;
  platform: string;
  versions: { electron: string; chrome: string; node: string };
};

export const isElectron = (): boolean => Boolean(window.electron?.isElectron);

declare global {
  interface Window {
    electron?: ElectronBridge;
  }
}
