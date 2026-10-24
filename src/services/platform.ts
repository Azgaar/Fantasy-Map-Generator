import { isElectron, isProduction } from "@/utils/environment";
import { sentences, t } from "@/utils/i18n";

export const savedMessage = (name: string): string =>
  isElectron()
    ? t("{{file}} is saved", { file: name })
    : sentences(t("{{file}} is saved", { file: name }), t("Open “Downloads” screen (CTRL + J) to check"));

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

  const register = () =>
    navigator.serviceWorker
      .register("./sw.js")
      .then(() => cacheOffline())
      .catch(error => console.error("ServiceWorker registration failed: ", error));
  // the app boots after the interface strings load, which may be after the page's load event
  if (document.readyState === "complete") void register();
  else window.addEventListener("load", () => void register());
}
