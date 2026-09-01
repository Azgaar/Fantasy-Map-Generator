// What the app is running inside: a browser tab, an installed PWA or the Electron desktop shell
export type ElectronBridge = {
  isElectron: true;
  platform: string;
  versions: { electron: string; chrome: string; node: string };
};

export const isElectron = (): boolean => Boolean(window.electron?.isElectron);

export const isLocalhost = (): boolean => location.hostname === "localhost" || location.hostname === "127.0.0.1";

export const isProduction = (): boolean => Boolean(location.hostname) && !isLocalhost();

export const savedMessage = (name: string): string =>
  isElectron() ? `${name} is saved` : `${name} is saved. Open "Downloads" screen (CTRL + J) to check`;

export function registerServiceWorker(): void {
  if (!isProduction() || isElectron() || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(error => {
      console.error("ServiceWorker registration failed: ", error);
    });
  });
}

// read bare by dialogs and editors that lay out differently on a phone
globalThis.MOBILE = window.innerWidth < 600 || Boolean(navigator.userAgentData?.mobile);

declare global {
  var MOBILE: boolean;
  interface Window {
    electron?: ElectronBridge;
  }
  interface Navigator {
    userAgentData?: { mobile?: boolean };
  }
}
