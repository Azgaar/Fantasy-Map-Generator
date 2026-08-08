import { gauss, getAdjective, ra, rand } from "../utils";

declare global {
  var Zones: ZonesModule;
}

export interface Zone {
  i: number;
  name: string;
  type: string;
  cells: number[];
  color: string;
  hidden?: boolean;
}

type ZoneGenerator = (usedCells: Uint8Array) => void;

interface ZoneConfig {
  quantity: number;
  generate: ZoneGenerator;
}

class ZonesModule {
  private config: Record<string, ZoneConfig>;

  constructor() {
    this.config = {
      fluxRot: { quantity: 1.5, generate: u => this.addFluxRot(u) },
      silentEcho: { quantity: 1.5, generate: u => this.addSilentEcho(u) },
      thermalRage: { quantity: 1.2, generate: u => this.addThermalRage(u) },
      temporalRift: { quantity: 1, generate: u => this.addTemporalRift(u) },
      fecundPlague: { quantity: 1.5, generate: u => this.addFecundPlague(u) },
      absoluteStillness: { quantity: 1.2, generate: u => this.addAbsoluteStillness(u) },
      psychicStatic: { quantity: 1.2, generate: u => this.addPsychicStatic(u) },
      wormCultUprising: { quantity: 2, generate: u => this.addWormCultUprising(u) }
    };
  }

  regenerate(globalModifier = 1): void {
    this.generate(globalModifier);
  }

  generate(globalModifier = 1) {
    TIME && console.time("generateZones");

    const usedCells = new Uint8Array(pack.cells.i.length);
    pack.zones = [];

    Object.values(this.config).forEach(type => {
      const expectedNumber = type.quantity * globalModifier;
      let number = gauss(expectedNumber, expectedNumber / 2, 0, 100);
      while (number > 0) {
        type.generate(usedCells);
        number--;
      }
    });

    TIME && console.timeEnd("generateZones");
  }

  private spreadZone(
    startCell: number,
    usedCells: Uint8Array,
    maxCells: number,
    condition: (neib: number) => boolean
  ): number[] {
    const { cells } = pack;
    const cellsArray: number[] = [];
    const queue = [startCell];
    usedCells[startCell] = 1;

    while (queue.length) {
      const cellId = queue.shift()!;
      cellsArray.push(cellId);
      if (cellsArray.length >= maxCells) break;

      cells.c[cellId].forEach(neibCellId => {
        if (usedCells[neibCellId]) return;
        if (!condition(neibCellId)) return;
        usedCells[neibCellId] = 1;
        queue.push(neibCellId);
      });
    }
    return cellsArray;
  }

  private addFluxRot(usedCells: Uint8Array) {
    const { cells } = pack;
    const validCells = cells.i.filter(i => !usedCells[i] && [5, 6, 7].includes(cells.biome[i]));
    if (!validCells.length) return;

    const startCell = ra(validCells);
    const cellsArray = this.spreadZone(startCell, usedCells, rand(10, 40), neib =>
      [5, 6, 7].includes(cells.biome[neib])
    );

    pack.zones.push({
      i: pack.zones.length,
      name: "Flux-Rot Transmutation",
      type: "Flux-Rot",
      cells: cellsArray,
      color: "url(#hatch8)"
    });
  }

  private addSilentEcho(usedCells: Uint8Array) {
    const { cells } = pack;
    const validCells = cells.i.filter(i => !usedCells[i] && [8, 9].includes(cells.biome[i]));
    if (!validCells.length) return;

    const startCell = ra(validCells);
    const cellsArray = this.spreadZone(
      startCell,
      usedCells,
      rand(15, 50),
      neib => [8, 9].includes(cells.biome[neib]) || cells.h[neib] > 20
    );

    pack.zones.push({
      i: pack.zones.length,
      name: "Silent Echo Vacuum",
      type: "Silent Echo",
      cells: cellsArray,
      color: "url(#hatch12)"
    });
  }

  private addThermalRage(usedCells: Uint8Array) {
    const { cells } = pack;
    const validCells = cells.i.filter(i => !usedCells[i] && cells.h[i] > 70);
    if (!validCells.length) return;

    const startCell = ra(validCells);
    const cellsArray = this.spreadZone(startCell, usedCells, rand(5, 25), neib => cells.h[neib] > 50);

    pack.zones.push({
      i: pack.zones.length,
      name: "Thermal Rage Firestorm",
      type: "Thermal Rage",
      cells: cellsArray,
      color: "url(#hatch4)"
    });
  }

  private addTemporalRift(usedCells: Uint8Array) {
    const { cells } = pack;
    const validCells = cells.i.filter(i => !usedCells[i] && cells.h[i] >= 20);
    if (!validCells.length) return;

    const startCell = ra(validCells);
    const cellsArray = this.spreadZone(startCell, usedCells, rand(5, 15), neib => cells.h[neib] >= 20);

    pack.zones.push({
      i: pack.zones.length,
      name: "Temporal Bleed",
      type: "Temporal Rift",
      cells: cellsArray,
      color: "url(#hatch11)"
    });
  }

  private addFecundPlague(usedCells: Uint8Array) {
    const { cells } = pack;
    const validCells = cells.i.filter(i => !usedCells[i] && cells.biome[i] === 12);
    if (!validCells.length) return;

    const startCell = ra(validCells);
    const cellsArray = this.spreadZone(
      startCell,
      usedCells,
      rand(10, 30),
      neib => cells.h[neib] >= 20 && cells.h[neib] < 40
    );

    pack.zones.push({
      i: pack.zones.length,
      name: "Fecund Plague",
      type: "Hyper-Mutation",
      cells: cellsArray,
      color: "url(#hatch6)"
    });
  }

  private addAbsoluteStillness(usedCells: Uint8Array) {
    const { cells } = pack;
    const validCells = cells.i.filter(i => !usedCells[i] && [1, 2, 3, 4].includes(cells.biome[i]));
    if (!validCells.length) return;

    const startCell = ra(validCells);
    const cellsArray = this.spreadZone(startCell, usedCells, rand(15, 60), neib =>
      [1, 2, 3, 4, 10, 11].includes(cells.biome[neib])
    );

    pack.zones.push({
      i: pack.zones.length,
      name: "Absolute Stillness",
      type: "Deep Freeze",
      cells: cellsArray,
      color: "url(#hatch9)"
    });
  }

  private addPsychicStatic(usedCells: Uint8Array) {
    const { cells } = pack;
    const validCells = cells.i.filter(i => !usedCells[i] && cells.pop[i] > 10);
    if (!validCells.length) return;

    const startCell = ra(validCells);
    const cellsArray = this.spreadZone(startCell, usedCells, rand(5, 20), neib => cells.pop[neib] > 0);

    pack.zones.push({
      i: pack.zones.length,
      name: "Psychic Static Paranoia",
      type: "Madness",
      cells: cellsArray,
      color: "url(#hatch13)"
    });
  }

  private addWormCultUprising(usedCells: Uint8Array) {
    const { cells, states } = pack;

    const state = ra(states.filter(s => s.i && !s.removed && s.neighbors?.some(Boolean)));
    if (!state) return;

    const neibStateId = ra(state.neighbors!.filter((n: number) => n && !states[n].removed));
    if (!neibStateId) return;

    const borderCellId = cells.i.find(
      i => !usedCells[i] && cells.state[i] === state.i && cells.c[i].some(c => cells.state[c] === neibStateId)
    );
    if (!borderCellId) return;

    const cellsArray = this.spreadZone(borderCellId, usedCells, rand(10, 30), neib => cells.state[neib] === state.i);

    const name = `${getAdjective(states[neibStateId].name)} Cultist Insurgency`;
    pack.zones.push({
      i: pack.zones.length,
      name,
      type: "Worm Cult",
      cells: cellsArray,
      color: "url(#hatch3)"
    });
  }
}

window.Zones = new ZonesModule();
