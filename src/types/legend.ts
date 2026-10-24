export type LegendItem = [id: string | number, color: string, label: string];

export interface Legend {
  name: string; // the box title, unique among the boxes
  items: LegendItem[];
}
