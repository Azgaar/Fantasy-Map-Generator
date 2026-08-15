import { buildGrid, type GridBuildRequest } from "./grid-builder";

interface GridWorkerRequest {
  id: number;
  request: GridBuildRequest;
}

interface WorkerScope {
  onmessage: ((event: MessageEvent<GridWorkerRequest>) => void) | null;
  postMessage: (message: unknown, transfer: Transferable[]) => void;
}

const worker = self as unknown as WorkerScope;

worker.onmessage = ({ data }: MessageEvent<GridWorkerRequest>) => {
  const { id, request } = data;
  try {
    const grid = buildGrid(request);
    worker.postMessage({ id, grid }, [grid.cells.i.buffer as ArrayBuffer]);
  } catch (error) {
    worker.postMessage({ id, error: error instanceof Error ? error.message : String(error) }, []);
  }
};
