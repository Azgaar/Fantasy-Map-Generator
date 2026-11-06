// One map in the search's pool: runs the game's economy on it for each set of overrides it is sent
import { parentPort, workerData } from "node:worker_threads";

const { loadMap, runEconomy } = await import(workerData.bundle);
const map = loadMap(workerData.file);
parentPort.postMessage({ ready: true });
parentPort.on("message", ({ id, over }) => {
  try {
    parentPort.postMessage({ id, result: runEconomy(map.snapshot, over) });
  } catch (error) {
    parentPort.postMessage({ id, error: String(error?.stack || error) });
  }
});
