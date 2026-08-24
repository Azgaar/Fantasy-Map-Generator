import { type MapDataSection, serializeMapSections } from "./map-data-serializer";

export function serializeMapSectionsInWorker(sections: MapDataSection[]): Promise<string> {
  if (typeof Worker === "undefined") return Promise.resolve(serializeMapSections(sections));
  const worker = new Worker(new URL("./map-data-serializer-worker.ts", import.meta.url), { type: "module" });
  return new Promise((resolve, reject) => {
    worker.onmessage = ({ data }: MessageEvent<{ error?: string; id: number; mapData?: string }>) => {
      worker.terminate();
      if (data.error) reject(new Error(data.error));
      else if (data.mapData !== undefined) resolve(data.mapData);
      else reject(new Error("Map serializer returned no data"));
    };
    worker.onerror = event => {
      worker.terminate();
      reject(event.error || new Error(event.message));
    };
    worker.postMessage({ id: 1, sections });
  });
}
