#!/usr/bin/env node

/**
 * The desktop app: one entry point for every Electron task.
 *
 *   npm run electron          run the app against the Vite dev server, with hot reload
 *   npm run electron build    compile the main process and the renderer into dist-electron/
 *   npm run electron dist     build, then package installers for this OS into release/
 *
 * Anything after `--` goes to electron-builder: `npm run electron -- dist --win --publish never`
 */

import { spawn } from "node:child_process";
import { build as viteBuild, createServer } from "vite";

const TSC = "node_modules/typescript/bin/tsc";
const ELECTRON = "node_modules/electron/cli.js";
const ELECTRON_BUILDER = "node_modules/electron-builder/cli.js";

const [task = "dev", ...builderArgs] = process.argv.slice(2);

function run(script, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { stdio: "inherit", env: { ...process.env, ...env } });
    child.on("close", code => (code ? reject(new Error(`${script} exited with code ${code}`)) : resolve()));
  });
}

/** Main process and preload: typechecked by tsc, bundled to CommonJS by Vite */
async function buildMain() {
  await run(TSC, ["-p", "electron"]);
  await viteBuild({ configFile: "electron/vite.config.ts" });
}

/** The renderer is the same code the web build ships, and `vite build` alone would not typecheck it */
async function buildRenderer() {
  await run(TSC, ["--noEmit"]);
  await viteBuild({ mode: "electron" });
}

async function dev() {
  await buildMain();

  const server = await createServer({ mode: "electron" });
  await server.listen();

  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error("Vite dev server did not report a local URL");
  console.log(`Electron renderer: ${url}`);

  await run(ELECTRON, ["."], { VITE_DEV_SERVER_URL: url });
  await server.close();
}

if (task === "dev") {
  await dev();
} else if (task === "build" || task === "dist") {
  await buildMain();
  await buildRenderer();
  if (task === "dist") await run(ELECTRON_BUILDER, builderArgs);
} else {
  console.error(`Unknown task "${task}". Expected: dev, build or dist`);
  process.exit(1);
}
