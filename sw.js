importScripts("https://storage.googleapis.com/workbox-cdn/releases/6.2.0/workbox-sw.js");

const {Route, registerRoute} = workbox.routing;
const {CacheFirst, StaleWhileRevalidate} = workbox.strategies;
const {CacheableResponsePlugin} = workbox.cacheableResponse;
const {ExpirationPlugin} = workbox.expiration;

const DAY = 24 * 60 * 60;
const THIRTY_DAYS = DAY * 30;

registerRoute(
  ({request, url}) => request.destination === "script" && !url.pathname.endsWith("min.js"),
  new StaleWhileRevalidate({
    cacheName: "fmg-scripts",
    plugins: [new CacheableResponsePlugin({statuses: [200]}), new ExpirationPlugin({maxEntries: 100, maxAgeSeconds: THIRTY_DAYS})]
  })
);

registerRoute(
  ({request}) => request.destination === "style",
  new StaleWhileRevalidate({
    cacheName: "fmg-stylesheets",
    plugins: [new CacheableResponsePlugin({statuses: [200]}), new ExpirationPlugin({maxEntries: 100, maxAgeSeconds: THIRTY_DAYS})]
  })
);

registerRoute(
  ({request, url}) => request.destination === "script" && url.pathname.endsWith("min.js"),
  new CacheFirst({
    cacheName: "fmg-libs",
    plugins: [new CacheableResponsePlugin({statuses: [200]}), new ExpirationPlugin({maxEntries: 100, maxAgeSeconds: THIRTY_DAYS})]
  })
);

registerRoute(
  new RegExp(".json$"),
  new CacheFirst({
    cacheName: "fmg-json",
    plugins: [new CacheableResponsePlugin({statuses: [200]}), new ExpirationPlugin({maxEntries: 100, maxAgeSeconds: THIRTY_DAYS})]
  })
);

registerRoute(
  ({request}) => request.destination === "image",
  new CacheFirst({
    cacheName: "fmg-images",
    plugins: [new CacheableResponsePlugin({statuses: [200]}), new ExpirationPlugin({maxEntries: 1000, maxAgeSeconds: THIRTY_DAYS})]
  })
);

registerRoute(
  new RegExp(".svg$"),
  new CacheFirst({
    cacheName: "fmg-charges",
    plugins: [new CacheableResponsePlugin({statuses: [200]}), new ExpirationPlugin({maxEntries: 1000, maxAgeSeconds: THIRTY_DAYS})]
  })
);

registerRoute(
  ({request}) => request.destination === "font",
  new CacheFirst({
    cacheName: "fmg-fonts",
    plugins: [new CacheableResponsePlugin({statuses: [200]}), new ExpirationPlugin({maxEntries: 200, maxAgeSeconds: THIRTY_DAYS})]
  })
);
