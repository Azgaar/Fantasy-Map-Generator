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

  const standalone = window.matchMedia("(display-mode: standalone)");
  const cacheOffline = (installed = false): void => {
    if (!installed && !standalone.matches && !navigator.standalone) return;
    if (!navigator.onLine) return;

    navigator.serviceWorker.ready
      .then(({ active }) => active?.postMessage({ type: "CACHE_OFFLINE" }))
      .catch(error => console.error("Offline caching request failed: ", error));
  };

  window.addEventListener("appinstalled", () => cacheOffline(true));
  window.addEventListener("online", () => cacheOffline());
  standalone.addEventListener("change", () => cacheOffline());
  navigator.serviceWorker.addEventListener("controllerchange", () => cacheOffline());

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then(() => cacheOffline())
      .catch(error => console.error("ServiceWorker registration failed: ", error));
  });
}

declare global {
  interface Window {
    electron?: ElectronBridge;
  }
  interface Navigator {
    userAgentData?: { mobile?: boolean };
    standalone?: boolean;
  }
}
