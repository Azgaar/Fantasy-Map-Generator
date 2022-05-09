importScripts("https://storage.googleapis.com/workbox-cdn/releases/6.2.0/workbox-sw.js");

const {Route, registerRoute} = workbox.routing;
const {CacheFirst} = workbox.strategies;
const {CacheableResponsePlugin} = workbox.cacheableResponse;
const {ExpirationPlugin} = workbox.expiration;

const DAY = 24 * 60 * 60;

const getPolitics = ({entries, days}) => {
  return [new CacheableResponsePlugin({statuses: [200]}), new ExpirationPlugin({maxEntries: entries, maxAgeSeconds: days * DAY})];
};

registerRoute(
  ({request, url}) => request.destination === "script" && !url.pathname.endsWith("min.js") && !url.pathname.includes("versioning.js"),
  new CacheFirst({
    cacheName: "fmg-scripts",
    plugins: getPolitics({entries: 100, days: 30})
  })
);

registerRoute(
  ({request}) => request.destination === "style",
  new CacheFirst({
    cacheName: "fmg-stylesheets",
    plugins: getPolitics({entries: 100, days: 30})
  })
);

registerRoute(
  ({request, url}) => request.destination === "script" && url.pathname.endsWith("min.js"),
  new CacheFirst({
    cacheName: "fmg-libs",
    plugins: getPolitics({entries: 100, days: 30})
  })
);

registerRoute(
  new RegExp(".json$"),
  new CacheFirst({
    cacheName: "fmg-json",
    plugins: getPolitics({entries: 100, days: 30})
  })
);

registerRoute(
  ({request}) => request.destination === "image",
  new CacheFirst({
    cacheName: "fmg-images",
    plugins: getPolitics({entries: 1000, days: 30})
  })
);

registerRoute(
  new RegExp(".svg$"),
  new CacheFirst({
    cacheName: "fmg-charges",
    plugins: getPolitics({entries: 1000, days: 30})
  })
);

registerRoute(
  ({request}) => request.destination === "font",
  new CacheFirst({
    cacheName: "fmg-fonts",
    plugins: getPolitics({entries: 200, days: 30})
  })
);
