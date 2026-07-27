import { gauss, rn } from "@/utils";

function regenerate(): void {
  rankCells();

  pack.burgs.forEach(burg => {
    if (!burg.i || burg.removed || burg.lock) return;
    const cellId = burg.cell;

    burg.population = rn(Math.max(pack.cells.s[cellId] / 8 + burg.i / 1000 + (cellId % 100) / 1000, 0.1), 3);
    if (burg.capital) burg.population *= 1.3;
    if (burg.port) burg.population *= 1.3;
    burg.population = rn(burg.population * gauss(2, 3, 0.6, 20, 3), 3);
  });
}

export const Population = { regenerate };
