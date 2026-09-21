importScripts("https://storage.googleapis.com/workbox-cdn/releases/6.2.0/workbox-sw.js");

const {registerRoute, setCatchHandler} = workbox.routing;
const {CacheFirst, NetworkFirst, StaleWhileRevalidate} = workbox.strategies;
const {CacheableResponsePlugin} = workbox.cacheableResponse;
const {ExpirationPlugin} = workbox.expiration;
const {PrecacheController, PrecacheRoute, cleanupOutdatedCaches} = workbox.precaching;

self.skipWaiting();
workbox.core.clientsClaim();

const DAY = 24 * 60 * 60; // in seconds
const precache = new PrecacheController();
precache.addToCacheList(self.__WB_MANIFEST || []);
const assets = new CacheFirst({
  cacheName: precache.strategy.cacheName,
  plugins: [...precache.strategy.plugins, new CacheableResponsePlugin({statuses: [200]})]
});
const runtimeAssets = new CacheFirst({
  cacheName: "fmg-assets",
  plugins: [...assets.plugins, new ExpirationPlugin({maxEntries: 100, maxAgeSeconds: 30 * DAY})]
});
const indexURL = new URL("index.html", self.location.href).href;
const offlineCacheName = `fmg-offline-${self.registration.scope}`;
let offlineDownload;

registerRoute(
  ({request}) => request.mode === "navigate",
  new NetworkFirst({
    networkTimeoutSeconds: 15,
    cacheName: "fmg-html",
    plugins: [
      new CacheableResponsePlugin({statuses: [0, 200]}),
      {cachedResponseWillBeUsed: async ({cachedResponse}) => (await offlinePage()) || cachedResponse}
    ]
  })
);

cleanupOutdatedCaches();
const assetRoute = new PrecacheRoute(precache, {ignoreURLParametersMatching: [/.*/]});
registerRoute(assetRoute.match, async options => {
  const stamp = options.url.searchParams.get("v");
  if (/^[a-f0-9]{8}$/.test(stamp)) {
    // Keep content-hash stamps from stamp-assets.js tied to their original revision.
    const key = new URL(options.params.cacheKey);
    key.searchParams.set("__WB_REVISION__", stamp);
    options.params.cacheKey = key.href;
  }
  return (await caches.match(options.params.cacheKey, {cacheName: assets.cacheName})) || runtimeAssets.handle(options);
});

self.addEventListener("message", event => {
  if (event.data?.type !== "CACHE_OFFLINE") return;
  offlineDownload ||= cacheOffline(event).finally(() => { offlineDownload = undefined; });
  event.waitUntil(offlineDownload.then(
    () => event.ports[0]?.postMessage({type: "CACHE_OFFLINE", ok: true}),
    error => {
      console.warn("Offline caching failed: ", error);
      event.ports[0]?.postMessage({type: "CACHE_OFFLINE", ok: false});
    }
  ));
});

async function cacheOffline(event) {
  const offlineCache = await caches.open(offlineCacheName);
  const previous = await offlinePage();
  if (previous) await offlineCache.put(indexURL, previous);

  // Commit the offline page and remove old assets only after the whole download succeeds.
  const urls = precache.getCachedURLs().filter(url => url !== indexURL);
  urls.push(indexURL);
  for (const url of urls) {
    const request = new Request(url, {cache: "reload", credentials: "same-origin"});
    const [response] = await Promise.all(assets.handleAll({event, request}));
    if (response.status !== 200) throw new Error(`Cannot cache ${url}: ${response.status}`);
  }
  await offlineCache.put(indexURL, await precache.matchPrecache(indexURL));
  await precache.activate(event);
}

async function offlinePage() {
  const offlineCache = await caches.open(offlineCacheName);
  const cache = await caches.open(assets.cacheName);
  return (await offlineCache.match(indexURL)) || cache.match(indexURL, {ignoreSearch: true});
}

setCatchHandler(async ({request}) => {
  if (request.mode === "navigate") return (await offlinePage()) || Response.error();
  const cache = await caches.open(assets.cacheName);
  return (await cache.match(request, {ignoreSearch: true})) || Response.error();
});

const retainedAssets = {
  cachedResponseWillBeUsed: async ({request, cachedResponse}) =>
    cachedResponse || caches.match(request, {cacheName: assets.cacheName, ignoreSearch: true})
};

// Google-hosted scripts (analytics) are left to the browser: with a blocker installed the
// request never gets a response, and a worker strategy would surface that as an uncaught error
registerRoute(
  ({request, url}) =>
    request.destination === "script" &&
    !url.pathname.endsWith("min.js") &&
    !url.hostname.includes("google"),
  new StaleWhileRevalidate({
    cacheName: "fmg-scripts",
    plugins: [
      new CacheableResponsePlugin({statuses: [0, 200]}),
      new ExpirationPlugin({maxEntries: 100, maxAgeSeconds: 30 * DAY}),
      retainedAssets
    ]
  })
);

registerRoute(
  ({request}) => request.destination === "style",
  new CacheFirst({
    cacheName: "fmg-stylesheets",
    plugins: [
      new CacheableResponsePlugin({statuses: [0, 200]}),
      new ExpirationPlugin({maxEntries: 100, maxAgeSeconds: 30 * DAY}),
      retainedAssets
    ]
  })
);

registerRoute(
  ({request, url}) => request.destination === "script" && url.pathname.endsWith("min.js"),
  new CacheFirst({
    cacheName: "fmg-libs",
    plugins: [
      new CacheableResponsePlugin({statuses: [0, 200]}),
      new ExpirationPlugin({maxEntries: 100, maxAgeSeconds: 30 * DAY}),
      retainedAssets
    ]
  })
);

registerRoute(
  new RegExp(".json$"),
  new CacheFirst({
    cacheName: "fmg-json",
    plugins: [
      new CacheableResponsePlugin({statuses: [0, 200]}),
      new ExpirationPlugin({maxEntries: 100, maxAgeSeconds: 30 * DAY}),
      retainedAssets
    ]
  })
);

registerRoute(
  ({request}) => request.destination === "image",
  new CacheFirst({
    cacheName: "fmg-images",
    plugins: [
      new CacheableResponsePlugin({statuses: [0, 200]}),
      new ExpirationPlugin({maxEntries: 100, maxAgeSeconds: 60 * DAY}),
      retainedAssets
    ]
  })
);

registerRoute(
  new RegExp(".svg$"),
  new CacheFirst({
    cacheName: "fmg-charges",
    plugins: [
      new CacheableResponsePlugin({statuses: [0, 200]}),
      new ExpirationPlugin({maxEntries: 100, maxAgeSeconds: 60 * DAY}),
      retainedAssets
    ]
  })
);

registerRoute(
  ({request}) => request.destination === "font",
  new CacheFirst({
    cacheName: "fmg-fonts",
    plugins: [
      new CacheableResponsePlugin({statuses: [0, 200]}),
      new ExpirationPlugin({maxEntries: 100, maxAgeSeconds: 60 * DAY}),
      retainedAssets
    ]
  })
);
