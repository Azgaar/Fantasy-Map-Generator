// Legend boxes: the titled color keys editors put on the map. The legend layer draws them
import type { LegendItem } from "@/types/legend";

class LegendsModule {
  initiate(): void {
    pack.legends = [];
  }

  has(name: string): boolean {
    return pack.legends.some(legend => legend.name === name);
  }

  /** Add the named box, or replace the items of the box already there */
  set(name: string, items: LegendItem[]): void {
    const legend = pack.legends.find(legend => legend.name === name);
    if (legend) legend.items = items;
    else pack.legends.push({ name, items });
  }

  remove(name: string): void {
    pack.legends = pack.legends.filter(legend => legend.name !== name);
  }
}

export const Legends = new LegendsModule();
