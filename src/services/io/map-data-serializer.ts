export type MapDataSection =
  | { kind: "csv"; value: ArrayLike<number> }
  | { kind: "json"; value: unknown }
  | { kind: "rounded-csv"; value: ArrayLike<number> }
  | { kind: "text"; value: string };

export function serializeMapSections(sections: readonly MapDataSection[]): string {
  return sections.map(serializeSection).join("\r\n");
}

function serializeSection(section: MapDataSection): string {
  if (section.kind === "text") return section.value;
  if (section.kind === "json") return JSON.stringify(section.value) ?? "";
  const values = new Array<string>(section.value.length);
  for (let index = 0; index < section.value.length; index++) {
    const value = Number(section.value[index]);
    values[index] = String(section.kind === "rounded-csv" ? round(value, 4) : value);
  }
  return values.join(",");
}

function round(value: number, digits: number): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}
