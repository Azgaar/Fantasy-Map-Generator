import { decodeMapFile } from "./map-file-decoder";

interface DecodeRequest {
  buffer: ArrayBuffer;
  id: number;
}

self.onmessage = async ({ data }: MessageEvent<DecodeRequest>) => {
  try {
    const mapData = await decodeMapFile(data.buffer);
    self.postMessage({ id: data.id, mapData });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error), id: data.id });
  }
};
