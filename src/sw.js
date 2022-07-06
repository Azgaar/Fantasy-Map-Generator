import {registerRoute} from "workbox-routing";
import {CacheFirst, NetworkFirst} from "workbox-strategies";
import {CacheableResponsePlugin} from "workbox-cacheable-response";
import {ExpirationPlugin} from "workbox-expiration";

const DAY = 24 * 60 * 60;

const getPolitics = ({entries, days}) => {
  return [
    new CacheableResponsePlugin({statuses: [0, 200]}),
    new ExpirationPlugin({maxEntries: entries, maxAgeSeconds: days * DAY})
  ];
};

registerRoute(
  ({request}) => request.mode === "navigate",
  new NetworkFirst({
    networkTimeoutSeconds: 3,
    cacheName: "fmg-html",
    plugins: [new CacheableResponsePlugin({statuses: [0, 200]})]
  })
);

registerRoute(
  ({request, url}) =>
    request.destination === "script" && !url.pathname.endsWith("min.js") && !url.pathname.includes("versioning.js"),
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
