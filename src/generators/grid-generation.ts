import { buildGrid, type GeneratedGrid, type GridBuildRequest } from "./grid-builder";

interface GridWorkerResponse {
  id: number;
  grid?: GeneratedGrid;
  error?: string;
}

class GridGenerationModule {
  private worker: Worker | null = null;
  private requestId = 0;

  generate(request: GridBuildRequest): Promise<GeneratedGrid> {
    if (typeof Worker === "undefined") return Promise.resolve(buildGrid(request));
    this.worker?.terminate();
    const worker = new Worker(new URL("./grid-worker.ts", import.meta.url), { type: "module" });
    this.worker = worker;
    const id = ++this.requestId;

    return new Promise((resolve, reject) => {
      worker.onmessage = ({ data }: MessageEvent<GridWorkerResponse>) => {
        if (data.id !== id) return;
        this.worker = null;
        worker.terminate();
        if (data.error) reject(new Error(data.error));
        else if (data.grid) resolve(data.grid);
        else reject(new Error("Grid worker returned no grid"));
      };
      worker.onerror = event => {
        this.worker = null;
        worker.terminate();
        reject(event.error || new Error(event.message));
      };
      worker.postMessage({ id, request });
    });
  }

  cancel(): void {
    this.requestId++;
    this.worker?.terminate();
    this.worker = null;
  }
}

export const GridGeneration = new GridGenerationModule();
window.GridGeneration = GridGeneration;
