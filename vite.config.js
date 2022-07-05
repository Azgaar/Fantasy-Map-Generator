import {defineConfig} from "vite";
import {createHtmlPlugin} from "vite-plugin-html";
import {fileURLToPath} from "url";
import path from "path";

const pathName = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({mode}) => {
  const APP_VERSION = JSON.stringify(process.env.npm_package_version);
  const PRODUCTION = mode === "production";

  return {
    base: "/Fantasy-Map-Generator/",
    define: {
      APP_VERSION,
      PRODUCTION
    },
    plugins: [
      createHtmlPlugin({
        inject: {
          data: {
            APP_VERSION: APP_VERSION.replaceAll('"', "")
          }
        }
      })
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id, {getModuleInfo}) {
            if (id.includes("d3")) {
              return "d3";
            }
            if (id.includes("node_modules")) {
              return "vendor";
            }
            const importersLen = getModuleInfo(id).importers.length;
            if (importersLen > 1) {
              return "common";
            }
          }
        }
      }
    },
    resolve: {
      alias: [
        {find: "src", replacement: path.resolve(pathName, "./src")},
        {find: "components", replacement: path.resolve(pathName, "./src/components")},
        {find: "config", replacement: path.resolve(pathName, "./src/config")},
        {find: "constants", replacement: path.resolve(pathName, "./src/constants")},
        {find: "layers", replacement: path.resolve(pathName, "./src/layers")},
        {find: "libs", replacement: path.resolve(pathName, "./src/libs")},
        {find: "modules", replacement: path.resolve(pathName, "./src/modules")},
        {find: "modules", replacement: path.resolve(pathName, "./src/modules")},
        {find: "scripts", replacement: path.resolve(pathName, "./src/scripts")},
        {find: "utils", replacement: path.resolve(pathName, "./src/utils")}
      ]
    }
  };
});
