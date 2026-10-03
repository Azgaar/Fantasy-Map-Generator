import { downloadFile } from "@/utils/fileUtils";

export type SaveOutcome = { type: "saved"; filename: string } | { type: "downloaded-fallback" } | { type: "cancelled" };

let destination: FileSystemFileHandle | undefined;
let mapRevision = 0;
let saving = false;

window.addEventListener("map:generated", () => {
  destination = undefined;
  mapRevision++;
});

export async function saveToFileSystem(
  prepareData: () => string,
  suggestedName: string,
  saveAs = false
): Promise<SaveOutcome> {
  if (saving) return { type: "cancelled" };
  saving = true;
  try {
    return await writeMapFile(prepareData, suggestedName, saveAs);
  } finally {
    saving = false;
  }
}

async function writeMapFile(prepareData: () => string, suggestedName: string, saveAs: boolean): Promise<SaveOutcome> {
  if (typeof window.showSaveFilePicker !== "function") {
    downloadFile(prepareData(), suggestedName);
    return { type: "downloaded-fallback" };
  }

  const revision = mapRevision;
  let handle = saveAs ? undefined : destination;
  if (!handle) {
    // Pick before serializing: a large map can outlive the browser's user activation.
    try {
      handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description: "Fantasy Map Generator map", accept: { "application/octet-stream": [".map"] } }]
      });
    } catch (error) {
      if ((error as { name?: string } | null)?.name === "AbortError") return { type: "cancelled" };
      throw error;
    }
  }
  if (revision !== mapRevision) return { type: "cancelled" };

  let writable: FileSystemWritableFileStream | undefined;
  try {
    // Permission renewal, if needed, must also precede serialization.
    writable = await handle.createWritable();
    if (revision !== mapRevision) {
      await writable.abort();
      return { type: "cancelled" };
    }
    await writable.write(prepareData());
    await writable.close();
  } catch (error) {
    if (destination === handle) destination = undefined;
    await writable?.abort().catch(() => {});
    throw error;
  }
  if (revision === mapRevision) destination = handle;
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
