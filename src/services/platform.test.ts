import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "./platform";

describe("service worker registration", () => {
  let page: EventTarget & { electron?: { isElectron: boolean } };
  let displayMode: EventTarget & { matches: boolean };
  let serviceWorker: EventTarget & {
    register: ReturnType<typeof vi.fn>;
    ready: Promise<{ active: { postMessage: ReturnType<typeof vi.fn> } }>;
  };
  let browser: { serviceWorker?: typeof serviceWorker; onLine: boolean; standalone?: boolean };
  let postMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    displayMode = Object.assign(new EventTarget(), { matches: false });
    page = Object.assign(new EventTarget(), { matchMedia: vi.fn(() => displayMode) });
    postMessage = vi.fn();
    serviceWorker = Object.assign(new EventTarget(), {
      register: vi.fn().mockResolvedValue({}),
      ready: Promise.resolve({ active: { postMessage } })
    });
    browser = { serviceWorker, onLine: true };
    vi.stubGlobal("window", page);
    vi.stubGlobal("navigator", browser);
    vi.stubGlobal("location", { hostname: "azgaar.github.io", search: "?source=pwa" });
  });

  afterEach(() => vi.unstubAllGlobals());

  async function dispatch(target: EventTarget, type: string) {
    target.dispatchEvent(new Event(type));
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  it("registers in a browser tab without requesting offline downloads, even with a PWA query parameter", async () => {
    registerServiceWorker();
    await dispatch(page, "load");
    await dispatch(page, "online");
    await dispatch(serviceWorker, "controllerchange");

    expect(serviceWorker.register).toHaveBeenCalledWith("./sw.js");
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("requests the full download when launched standalone", async () => {
    displayMode.matches = true;
    registerServiceWorker();
    await dispatch(page, "load");
    expect(postMessage).toHaveBeenCalledWith({ type: "CACHE_OFFLINE" });
  });

  it("recognizes Safari home-screen apps", async () => {
    browser.standalone = true;
    registerServiceWorker();
    await dispatch(page, "load");
    expect(postMessage).toHaveBeenCalledWith({ type: "CACHE_OFFLINE" });
  });

  it("starts a download on installation without opting later browser visits into prefetch", async () => {
    registerServiceWorker();
    await dispatch(page, "load");
    await dispatch(page, "appinstalled");
    expect(postMessage).toHaveBeenCalledTimes(1);
    await dispatch(page, "online");
    await dispatch(serviceWorker, "controllerchange");
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it("detects transfer into and out of the installed app", async () => {
    registerServiceWorker();
    await dispatch(page, "load");
    displayMode.matches = true;
    await dispatch(displayMode, "change");
    expect(postMessage).toHaveBeenCalledTimes(1);
    displayMode.matches = false;
    await dispatch(displayMode, "change");
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it("retries in the PWA when connectivity returns and when the worker updates", async () => {
    displayMode.matches = true;
    browser.onLine = false;
    registerServiceWorker();
    await dispatch(page, "load");
    expect(postMessage).not.toHaveBeenCalled();
    browser.onLine = true;
    await dispatch(page, "online");
    await dispatch(serviceWorker, "controllerchange");
    expect(postMessage).toHaveBeenCalledTimes(2);
  });

  it("waits until a worker is active", async () => {
    displayMode.matches = true;
    let activate!: () => void;
    serviceWorker.ready = new Promise(resolve => {
      activate = () => resolve({ active: { postMessage } });
    });
    registerServiceWorker();
    await dispatch(page, "load");
    expect(postMessage).not.toHaveBeenCalled();
    activate();
    await serviceWorker.ready;
    expect(postMessage).toHaveBeenCalledWith({ type: "CACHE_OFFLINE" });
  });

  it.each(["localhost", "127.0.0.1", ""])("skips registration on %s", async hostname => {
    vi.stubGlobal("location", { hostname });
    registerServiceWorker();
    await dispatch(page, "load");
    expect(serviceWorker.register).not.toHaveBeenCalled();
  });

  it("skips Electron", async () => {
    page.electron = { isElectron: true };
    registerServiceWorker();
    await dispatch(page, "load");
    expect(serviceWorker.register).not.toHaveBeenCalled();
  });

  it("supports browsers without service workers", () => {
    delete browser.serviceWorker;
    expect(registerServiceWorker).not.toThrow();
  });
});
