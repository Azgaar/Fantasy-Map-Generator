import { type MapDataSection, serializeMapSections } from "./map-data-serializer";

interface SerializeRequest {
  id: number;
  sections: MapDataSection[];
}

self.onmessage = ({ data }: MessageEvent<SerializeRequest>) => {
  try {
    self.postMessage({ id: data.id, mapData: serializeMapSections(data.sections) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error), id: data.id });
  }
};
