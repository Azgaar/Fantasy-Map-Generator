export type ElectronBridge = {
  isElectron: true;
  platform: string;
  versions: { electron: string; chrome: string; node: string };
};

export const isElectron = (): boolean => Boolean(window.electron?.isElectron);

export const isLocalhost = (): boolean => location.hostname === "localhost" || location.hostname === "127.0.0.1";

export const isProduction = (): boolean => Boolean(location.hostname) && !isLocalhost();

export const isMobile = (): boolean => window.innerWidth < 600 || Boolean(navigator.userAgentData?.mobile);

export const savedMessage = (name: string): string =>
  isElectron() ? `${name} is saved` : `${name} is saved. Open "Downloads" screen (CTRL + J) to check`;

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator) || !isProduction() || isElectron()) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(error => {
      console.error("ServiceWorker registration failed: ", error);
    });
  });
}

declare global {
  interface Window {
    electron?: ElectronBridge;
  }
  interface Navigator {
    userAgentData?: { mobile?: boolean };
  }
}
