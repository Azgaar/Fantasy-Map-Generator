import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import type { Plugin, ViteDevServer } from "vite";

/**
 * The desktop app ships the same renderer, minus the parts that only make sense on the web:
 * Google Analytics (a program that phones home on launch is a different bargain than a web page),
 * and the PWA plumbing, which `services/platform.ts` already skips under Electron
 */
const stripWebOnlyTags = {
  name: "strip-web-only-tags",
  transformIndexHtml: (html: string) =>
    html
      .replace(/<script async src="https:\/\/www\.googletagmanager\.com[^>]*><\/script>\s*/, "")
      .replace(/<script>\s*window\.dataLayer[\s\S]*?<\/script>\s*/, "")
      .replace(/<link rel="manifest"[^>]*>\s*/, "")
};

/**
 * `virtual:latest-update`: the newest note in docs/updates (`v1.155.0/v1.155.0 - Translations.md`), the same text
 * as the latest Patreon post. Its header image is the folder's `header.jpg` (or .png, .webp), else the note's first
 * image. Only this one image is bundled, so the update window shows it offline too
 */
const UPDATES = "docs/updates";
const LATEST_UPDATE = "virtual:latest-update";
const latestUpdate = {
  name: "latest-update",
  resolveId: (id: string) => (id === LATEST_UPDATE ? `\0${LATEST_UPDATE}` : undefined),
  load(id: string) {
    if (id !== `\0${LATEST_UPDATE}`) return undefined;

    const [folder] = readdirSync(UPDATES, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && /^v\d+\.\d+\.\d+$/.test(entry.name))
      .map(entry => entry.name)
      .sort((a, b) => b.localeCompare(a, "en", { numeric: true }));
    const dir = join(UPDATES, folder!);
    const files = readdirSync(dir);
    const note = files.find(file => file.endsWith(".md"))!;
    const header =
      files.find(file => /^header\.(jpe?g|png|webp)$/.test(file)) ??
      readFileSync(join(dir, note), "utf8").match(/!\[[^\]]*\]\(([^)\s]+)\)/)?.[1];
    if (!header) throw new Error(`${dir} has no header image`);

    const title = note.replace(/^v[\d.]+ - /, "").replace(/\.md$/, "");
    return `import image from ${JSON.stringify(`${resolve(dir, header)}?url`)};
export default { version: ${JSON.stringify(folder!.slice(1))}, title: ${JSON.stringify(title)}, image };`;
  },
  // the dev server keeps a loaded module: drop it when a note or image is added, so the next load reads the folder again
  configureServer(server: ViteDevServer) {
    const updates = resolve(UPDATES);
    const refresh = (file: string) => {
      if (!file.startsWith(updates)) return;
      const module = server.moduleGraph.getModuleById(`\0${LATEST_UPDATE}`);
      if (module) server.moduleGraph.invalidateModule(module);
    };
    server.watcher.add(updates);
    server.watcher.on("add", refresh).on("unlink", refresh).on("change", refresh);
  }
};

/** en.json keys every string by its English text and `t()` falls back to the key: ship only the entries that differ */
const slimEnglish: Plugin = {
  name: "slim-english",
  enforce: "pre",
  transform(code, id) {
    if (!id.endsWith("/locales/en.json")) return undefined;
    const entries = Object.entries(JSON.parse(code)).filter(([key, text]) => key !== text);
    return { code: JSON.stringify(Object.fromEntries(entries)), map: null };
  }
};

/** main.ts imports the app once the interface strings are in: these links let its chunks download meanwhile */
const preloadApp = (): Plugin => {
  let base = "/";
  return {
    name: "preload-app",
    configResolved: config => void (base = config.base),
    transformIndexHtml: {
      order: "post",
      handler(html, { bundle }) {
        const chunks = Object.values(bundle ?? {}).filter(file => file.type === "chunk");
        const app = chunks.find(chunk => chunk.facadeModuleId?.endsWith("/src/app/index.ts"));
        const files = new Set(app ? [app.fileName] : []);
        for (const file of files) chunks.find(chunk => chunk.fileName === file)?.imports.forEach(name => files.add(name));
        const fresh = [...files].filter(file => !html.includes(file)); // Vite links the entry's own imports itself
        return fresh.map(file => ({
          tag: "link",
          attrs: { rel: "modulepreload", crossorigin: true, href: base + file },
          injectTo: "head" as const
        }));
      }
    }
  };
};

export default ({ mode }: { mode: string }) => ({
  root: "./src",
  base: mode === "electron" ? "./" : process.env.NETLIFY ? "/" : "/Fantasy-Map-Generator/",
  plugins: [slimEnglish, preloadApp(), latestUpdate, ...(mode === "electron" ? [stripWebOnlyTags] : [])],
  build: {
    outDir: mode === "electron" ? "../dist-electron/renderer" : "../dist",
    assetsDir: "./",
    emptyOutDir: true, // outDir sits outside root, so Vite would otherwise keep every past build's chunks
    rollupOptions: {
      output: {
        // icon-sets.ts loads each set's SVGs on demand; one chunk per set: relief sets and charge categories are subdirectories
        manualChunks(id: string) {
          const path = id.match(/src\/assets\/icons\/(.+)\/[^/]+\.svg/)?.[1];
          if (!path) return undefined;
          const [family, set] = path.split("/");
          return family === "relief" || family === "charges" ? `icons-${family}-${set}` : `icons-${family}`;
        }
      }
    }
  },
  publicDir: "../public",
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  }
});
