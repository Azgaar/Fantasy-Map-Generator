import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { expect, type Page, test as base } from "@playwright/test";

const worker = readFileSync(path.join(__dirname, "../../public/sw.js"), "utf8");
const revision = (content: string) => createHash("sha256").update(content).digest("hex").slice(0, 8);

interface Site {
  url: string;
  requests: string[];
  failures: Set<string>;
  publish: (version: number, legacy?: boolean) => void;
}

const test = base.extend<{ site: Site }>({
  site: async ({}, use) => {
    const requests: string[] = [];
    const failures = new Set<string>();
    let files = new Map<string, string>();
    let script = "";
    const publish = (version: number, legacy = false) => {
      const legacyScript = `window.legacy = ${version};`;
      files = new Map([
        [
          "index.html",
          `<!doctype html><title>Build ${version}</title>
          <script src="./app-${version}.js"></script><script src="./legacy.js?v=${revision(legacyScript)}"></script>`
        ],
        [`app-${version}.js`, `window.build = ${version};`],
        ["legacy.js", legacyScript],
        [`editor-${version}.js`, `export default ${version};`],
        [`editor-${version}.css`, `body { --editor-version: ${version}; }`],
        ["unchanged.json", "{}"]
      ]);
      const manifest = JSON.stringify(
        [...files].map(([url, content]) => ({
          url,
          revision: revision(content)
        }))
      );
      script = legacy
        ? `importScripts("https://storage.googleapis.com/workbox-cdn/releases/6.2.0/workbox-sw.js");
           self.skipWaiting(); workbox.core.clientsClaim();
           workbox.precaching.precacheAndRoute(${manifest}, {ignoreURLParametersMatching: [/.*/]});`
        : worker.replace("self.__WB_MANIFEST", manifest);
    };
    publish(1);
    const server = createServer((request, response) => {
      const path = new URL(request.url!, "http://localhost").pathname.slice(1) || "index.html";
      requests.push(path);
      response.setHeader("Cache-Control", "no-store");
      response.setHeader(
        "Content-Type",
        path.endsWith(".js")
          ? "text/javascript"
          : path.endsWith(".html")
            ? "text/html"
            : path.endsWith(".css")
              ? "text/css"
              : "application/json"
      );
      if (failures.has(path)) {
        response.writeHead(503).end("Unavailable");
      } else if (path === "sw.js") {
        response.end(script);
      } else if (files.has(path)) {
        response.end(files.get(path));
      } else {
        response.writeHead(404).end();
      }
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test server address");
    try {
      await use({ url: `http://127.0.0.1:${address.port}/`, requests, failures, publish });
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
    }
  }
});

async function register(page: Page, site: Site) {
  await page.goto(site.url);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("./sw.js");
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>(resolve =>
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
          once: true
        })
      );
    }
  });
}

async function update(page: Page) {
  await page.evaluate(async () => {
    const changed = new Promise<void>(resolve =>
      navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
        once: true
      })
    );
    await (await navigator.serviceWorker.ready).update();
    await changed;
  });
}

async function cacheOffline(page: Page, count = 1) {
  return page.evaluate(async count => {
    const { active } = await navigator.serviceWorker.ready;
    return Promise.all(
      Array.from(
        { length: count },
        () =>
          new Promise<boolean>(resolve => {
            const channel = new MessageChannel();
            channel.port1.onmessage = event => {
              channel.port1.close();
              resolve(event.data.ok);
            };
            active!.postMessage({ type: "CACHE_OFFLINE" }, [channel.port2]);
          })
      )
    );
  }, count);
}

async function openEditor(page: Page, version: number) {
  return page.evaluate(async version => (await import(`./editor-${version}.js`)).default, version);
}

test("web visits cache only requested assets, including URLs with version stamps", async ({ page, context, site }) => {
  await register(page, site);
  await page.reload();
  expect(site.requests).not.toContain("editor-1.js");
  expect(site.requests).not.toContain("unchanged.json");
  expect(
    await page.evaluate(async () => {
      const url = "./editor-1.js?v=test";
      return (await import(url)).default;
    })
  ).toBe(1);
  await context.setOffline(true);
  await page.reload();
  expect(await openEditor(page, 1)).toBe(1);
});

test("PWA requests share one download and cache unopened editors", async ({ page, context, site }) => {
  await register(page, site);
  expect(await cacheOffline(page, 2)).toEqual([true, true]);
  expect(site.requests.filter(path => path === "editor-1.js")).toHaveLength(1);
  expect(await cacheOffline(page)).toEqual([true]);
  expect(site.requests.filter(path => path === "editor-1.js")).toHaveLength(1);
  await context.setOffline(true);
  await page.goto(`${site.url}?source=pwa`);
  await expect(page).toHaveTitle("Build 1");
  expect(await page.evaluate("window.legacy")).toBe(1);
  expect(await openEditor(page, 1)).toBe(1);
});

test("retained scripts and styles still load after the server removes the previous build", async ({ page, site }) => {
  await register(page, site);
  expect(await cacheOffline(page)).toEqual([true]);
  site.publish(2);
  await update(page);
  expect((await page.request.get(`${site.url}editor-1.js`)).status()).toBe(404);
  expect((await page.request.get(`${site.url}editor-1.css`)).status()).toBe(404);

  expect(await openEditor(page, 1)).toBe(1);
  await page.addStyleTag({ url: `${site.url}editor-1.css` });
  expect(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue("--editor-version").trim())).toBe(
    "1"
  );
});

test("web updates and failed PWA downloads preserve the last complete offline build", async ({
  page,
  context,
  site
}) => {
  await register(page, site);
  expect(await cacheOffline(page)).toEqual([true]);
  site.publish(2);
  await update(page);
  await page.reload();
  await expect(page).toHaveTitle("Build 2");
  expect(site.requests).not.toContain("editor-2.js");

  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle("Build 1");
  expect(await page.evaluate("window.legacy")).toBe(1);
  expect(await openEditor(page, 1)).toBe(1);
  await context.setOffline(false);
  site.failures.add("editor-2.js");
  expect(await cacheOffline(page)).toEqual([false]);
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle("Build 1");
  expect(await page.evaluate("window.legacy")).toBe(1);
  expect(await openEditor(page, 1)).toBe(1);

  await context.setOffline(false);
  site.failures.clear();
  expect(await cacheOffline(page)).toEqual([true]);
  expect(site.requests.filter(path => path === "unchanged.json")).toHaveLength(1);
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle("Build 2");
  expect(await page.evaluate("window.legacy")).toBe(2);
  expect(await openEditor(page, 2)).toBe(2);
  const cached = await page.evaluate(async () => {
    const names = (await caches.keys()).filter(name => name.includes("-precache-"));
    return (
      await Promise.all(names.map(async name => (await (await caches.open(name)).keys()).map(key => key.url)))
    ).flat();
  });
  expect(cached.some(url => url.includes("editor-1.js"))).toBe(false);
});

test("upgrading the previous precache worker keeps existing PWA files available", async ({ page, context, site }) => {
  site.publish(1, true);
  await register(page, site);
  expect(site.requests).toContain("editor-1.js");
  site.publish(2);
  await update(page);
  await page.reload();
  await expect(page).toHaveTitle("Build 2");
  expect(site.requests).not.toContain("editor-2.js");
  site.failures.add("editor-2.js");
  expect(await cacheOffline(page)).toEqual([false]);
  await context.setOffline(true);
  await page.goto(`${site.url}?source=pwa`);
  await expect(page).toHaveTitle("Build 1");
  expect(await openEditor(page, 1)).toBe(1);
});
