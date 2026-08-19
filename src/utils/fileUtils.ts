// Reading and writing local files, plus naming downloads and exports.

import { ensureEl } from "./nodeUtils";

/** Build a filename from the map name, optional type and current time */
export function getFileName(dataType?: string): string {
  const pad = (value: number) => String(value).padStart(2, "0");

  const date = new Date();
  const dateString = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes())
  ].join("-");

  const type = dataType ? `${dataType} ` : "";
  return `${ensureEl<HTMLInputElement>("mapName").value} ${type}${dateString}`;
}

/** Download data as a file */
export function downloadFile(data: BlobPart, name: string, type = "text/plain"): void {
  const url = window.URL.createObjectURL(new Blob([data], { type }));

  const link = document.createElement("a");
  link.download = name;
  link.href = url;
  link.click();

  window.setTimeout(() => window.URL.revokeObjectURL(url), 2000);
}

/** Read the selected file as text and pass its content to the callback */
export function uploadFile(input: HTMLInputElement, callback: (data: string) => void): void {
  const file = input.files?.[0];
  if (!file) return;

  const fileReader = new FileReader();
  fileReader.readAsText(file, "UTF-8");
  input.value = "";
  fileReader.onload = loaded => callback(loaded.target?.result as string);
}
