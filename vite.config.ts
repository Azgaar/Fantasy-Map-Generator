import { fileURLToPath, URL } from "node:url";

/**
 * The desktop app ships the same renderer, minus the parts that only make sense on the web:
 * Google Analytics (a program that phones home on launch is a different bargain than a web page),
 * and the PWA plumbing, which `public/main.js` already skips under Electron
 */
const stripWebOnlyTags = {
  name: "strip-web-only-tags",
  transformIndexHtml: (html: string) =>
    html
      .replace(/<script async src="https:\/\/www\.googletagmanager\.com[^>]*><\/script>\s*/, "")
      .replace(/<script>\s*window\.dataLayer[\s\S]*?<\/script>\s*/, "")
      .replace(/<link rel="manifest"[^>]*>\s*/, "")
};

export default ({ mode }: { mode: string }) => ({
  root: "./src",
  base: mode === "electron" ? "./" : process.env.NETLIFY ? "/" : "/Fantasy-Map-Generator/",
  plugins: mode === "electron" ? [stripWebOnlyTags] : [],
  build: {
    outDir: mode === "electron" ? "../dist-electron/renderer" : "../dist",
    assetsDir: "./",
    emptyOutDir: mode === "electron"
  },
  publicDir: "../public",
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  }
});
