import {defineConfig} from "vite";
import {fileURLToPath} from "url";
import path from "path";

const pathName = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "/Fantasy-Map-Generator/",
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
});
