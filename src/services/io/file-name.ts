/** Build a filename from the map name, optional type and current time */
export function getFileName(dataType?: string): string {
  const type = dataType ? `${dataType} ` : "";
  return `${options.map.lore.name} ${type}${formatTimestamp(new Date())}`;
}

/** YYYY-MM-DD-HH-mm */
export function formatTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes())
  ].join("-");
}
