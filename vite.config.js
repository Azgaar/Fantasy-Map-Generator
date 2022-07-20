import {nodeResolve} from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import path from "path";
import {rollup} from "rollup";
import {terser} from "rollup-plugin-terser";
import {visualizer} from "rollup-plugin-visualizer";
import {fileURLToPath} from "url";
import {defineConfig} from "vite";
import {createHtmlPlugin} from "vite-plugin-html";

const pathName = path.dirname(fileURLToPath(import.meta.url));

const CompileServiceWorker = () => ({
  name: "compile-service-worker",
  async writeBundle(_options, _outputBundle) {
    const inputOptions = {
      input: "src/sw.js",
      plugins: [
        replace({
          "process.env.NODE_ENV": JSON.stringify("production"),
          preventAssignment: true
        }),
        terser(),
        nodeResolve()
      ]
    };
    const outputOptions = {file: "dist/sw.js", format: "es"};
    const bundle = await rollup(inputOptions);
    await bundle.write(outputOptions);
    await bundle.close();
  }
});

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
      }),
      CompileServiceWorker(),
      visualizer()
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id, {getModuleInfo}) {
            if (id.includes("d3")) return "d3";
            if (id.includes("node_modules")) return "vendor";
            if (getModuleInfo(id).importers.length > 1) return "common";
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
        {find: "dialogs", replacement: path.resolve(pathName, "./src/dialogs")},
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
