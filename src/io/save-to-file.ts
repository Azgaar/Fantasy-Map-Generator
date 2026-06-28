// File writer for the .map "Save to Machine" path.
//
// Encapsulates the File System Access API (Chromium-only): every save opens the
// OS Save-Location Picker so the user chooses the folder and filename each time,
// then writes the map there. Where the API is unavailable (Firefox/Safari) it
// falls back to a Downloads write. The caller owns all user messaging — this
// module just reports a discriminated outcome.

export type SaveOutcome =
  | { type: "saved"; filename: string }
  | { type: "downloaded-fallback"; filename: string }
  | { type: "cancelled" };

function isFilePickerSupported(): boolean {
  return typeof window.showSaveFilePicker === "function";
}

// Restrict the picker to .map files so the chosen name defaults to the right
// extension.
const MAP_FILE_TYPES = [{ description: "Fantasy Map Generator map", accept: { "application/octet-stream": [".map"] } }];

async function writeToHandle(handle: FileSystemFileHandle, mapData: string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(mapData);
  await writable.close();
}

export async function saveToFileSystem(mapData: string, suggestedName: string): Promise<SaveOutcome> {
  if (!isFilePickerSupported()) {
    // No File System Access API — reuse the app's shared download helper.
    downloadFile(mapData, suggestedName);
    return { type: "downloaded-fallback", filename: suggestedName };
  }

  let handle: FileSystemFileHandle;
  try {
    handle = await window.showSaveFilePicker({ suggestedName, types: MAP_FILE_TYPES });
  } catch (error) {
    // The picker rejects with a DOMException named AbortError when the user
    // dismisses the dialog — not a failure, just nothing to save. (DOMException
    // isn't reliably `instanceof Error` across engines, so check the name only.)
    if ((error as { name?: string } | null)?.name === "AbortError") {
      return { type: "cancelled" };
    }
    throw error;
  }

  await writeToHandle(handle, mapData);
  return { type: "saved", filename: handle.name };
}
