import { fileURLToPath, URL } from "node:url";

export default {
  base: "./",
  build: {
    assetsDir: "./",
    outDir: "../dist/viewer",
    rollupOptions: { input: "./viewer.html" }
  },
  publicDir: false,
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }
  },
  root: "./src"
};
