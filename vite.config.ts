import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";

const indexPath = fileURLToPath(new URL("./src/index.html", import.meta.url));
const definitionsPattern = /<svg id="defElements"[\s\S]*?<\/svg>/;

function externalizeSvgDefinitions(): Plugin {
  const indexSource = readFileSync(indexPath, "utf8");
  const definitions = indexSource.match(definitionsPattern)?.[0];
  if (!definitions) throw new Error("Cannot find #defElements in src/index.html");

  return {
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url?.split("?")[0].endsWith("/def-elements.svg")) return next();
        response.statusCode = 200;
        response.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
        response.end(definitions);
      });
    },
    generateBundle() {
      this.emitFile({ fileName: "def-elements.svg", source: definitions, type: "asset" });
    },
    name: "externalize-svg-definitions",
    transformIndexHtml: {
      order: "pre",
      handler: html => html.replace(definitionsPattern, '<div id="defElementsMount" hidden></div>')
    }
  };
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/Fantasy-Map-Generator/",
  build: {
    assetsDir: "./",
    emptyOutDir: true,
    outDir: "../dist"
  },
  plugins: [externalizeSvgDefinitions()],
  publicDir: "../public",
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  root: "./src"
});
