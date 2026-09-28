import { downloadFile } from "@/utils/fileUtils";

export type SaveOutcome = { type: "saved"; filename: string } | { type: "downloaded-fallback" } | { type: "cancelled" };

export async function saveToFileSystem(prepareData: () => string, suggestedName: string): Promise<SaveOutcome> {
  if (typeof window.showSaveFilePicker !== "function") {
    downloadFile(prepareData(), suggestedName);
    return { type: "downloaded-fallback" };
  }

  let handle: FileSystemFileHandle;
  try {
    // Pick before serializing: a large map can outlive the browser's user activation.
    handle = await window.showSaveFilePicker({
      suggestedName,
      types: [{ description: "Fantasy Map Generator map", accept: { "application/octet-stream": [".map"] } }]
    });
  } catch (error) {
    if ((error as { name?: string } | null)?.name === "AbortError") return { type: "cancelled" };
    throw error;
  }

  const mapData = prepareData();
  const writable = await handle.createWritable();
  try {
    await writable.write(mapData);
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => {});
    throw error;
  }
  return { type: "saved", filename: handle.name };
}

declare global {
  interface Window {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: { description?: string; accept: Record<string, string[]> }[];
    }) => Promise<FileSystemFileHandle>;
  }
}
