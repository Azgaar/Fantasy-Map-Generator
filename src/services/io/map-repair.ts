// Fixes the broken links a loaded map can carry, then logs what was fixed and what is still broken

import { Transports } from "@/model/economy/transports-generator";
import { Pack } from "@/model/graph/pack-generator";
import { type IntegrityViolation, MapIntegrity } from "@/model/map-integrity";
import type { Burg } from "@/model/political/burgs-generator";
import { Burgs } from "@/model/political/burgs-generator";
import { last } from "@/utils";

class MapRepairService {
  /** repairs the loaded map in place; returns what was repaired */
  repair(): string[] {
    const { cells, vertices } = pack;
    const cellsMismatch = cells.i.length !== cells.state.length;
    const featureVerticesMismatch = pack.features.some(f => f?.vertices?.some(vertex => !vertices.p[vertex]));
    if (cellsMismatch || featureVerticesMismatch) {
      throw new Error("[Data integrity] Striping issue detected. To fix try to edit the heightmap in ERASE mode");
    }

    return [
      ...this.repairCellOwners(),
      ...this.repairBurgs(),
      ...this.repairCapitals(),
      ...this.repairProvinces(),
      ...this.repairRoutes(),
      ...this.repairMarkers(),
      ...this.findMissingTransports()
    ];
  }

  /** logs the repairs and the rules the map still breaks; a sound map logs nothing */
  report(repairs: string[]): void {
    let broken: IntegrityViolation[] = [];
    try {
      broken = MapIntegrity.check();
    } catch (error) {
      ERROR && console.error("[Data integrity] Check failed", error); // the check must never stop a load
    }
    if (!repairs.length && !broken.length) return;

    const rules = broken.map(({ rule, count, examples }) => `${rule}: ${count} (${examples.join(", ")})`);
    const title = `[Data integrity] ${repairs.length} repaired, ${broken.length} rules broken:`;
    WARN && console.warn([title, ...repairs, ...rules].join("\n"));
  }

  private repairCellOwners(): string[] {
    const { cells } = pack;
    const alive = (list: { i: number; removed?: boolean }[]) => (id: number) => Boolean(list[id] && !list[id].removed);
    const riverIds = new Set(pack.rivers.map(river => river.i));
    const owners = [
      ["state", cells.state, alive(pack.states)],
      ["province", cells.province, alive(pack.provinces)],
      ["culture", cells.culture, alive(pack.cultures)],
      ["religion", cells.religion, alive(pack.religions)],
      ["burg", cells.burg, alive(pack.burgs)],
      ["river", cells.r, (id: number) => riverIds.has(id)]
    ] as const;

    const repairs: string[] = [];
    for (const [name, values, isValid] of owners) {
      const invalid = new Map<number, number>();
      for (let cell = 0; cell < cells.i.length; cell++) {
        const id = values[cell];
        if (!id || isValid(id)) continue;
        values[cell] = 0;
        invalid.set(id, (invalid.get(id) ?? 0) + 1);
      }
      for (const [id, count] of invalid) repairs.push(`Invalid ${name} ${id} unassigned from ${count} cells`);
    }

    const invalidFeatures = [...new Set(cells.f)].filter(f => f && !pack.features[f]);
    for (const f of invalidFeatures) repairs.push(`Invalid feature ${f} is assigned to cells, not fixed`);
    return repairs;
  }

  private repairBurgs(): string[] {
    const { cells } = pack;
    const repairs: string[] = [];

    for (const burg of pack.burgs) {
      if (typeof burg.capital === "boolean") burg.capital = Number(burg.capital);

      if (!burg.i && burg.lock) {
        repairs.push("Burg 0 is marked as locked, removing the status");
        delete burg.lock;
        continue;
      }

      if (burg.removed && burg.lock) {
        repairs.push(`Removed burg ${burg.i} is marked as locked. Unlocking the burg`);
        delete burg.lock;
        continue;
      }

      if (!burg.i || burg.removed) continue;

      if (burg.cell === undefined || burg.x === undefined || burg.y === undefined) {
        repairs.push(`Burg ${burg.i} is missing cell info or coordinates. Removing the burg`);
        burg.removed = true;
      }

      if ((burg.port ?? 0) < 0) {
        repairs.push(`Burg ${burg.i} has invalid port value ${burg.port}`);
        burg.port = 0;
      }

      if (burg.cell >= cells.i.length) {
        repairs.push(`Burg ${burg.i} is linked to invalid cell ${burg.cell}`);
        burg.cell = Pack.findCell(burg.x, burg.y)!;
        for (const i of cells.i) if (cells.burg[i] === burg.i) cells.burg[i] = 0;
        cells.burg[burg.cell] = burg.i;
      }

      if (burg.state && !pack.states[burg.state]) {
        repairs.push(`Burg ${burg.i} is linked to invalid state ${burg.state}`);
        burg.state = 0;
      }

      if (burg.state && pack.states[burg.state].removed) {
        repairs.push(`Burg ${burg.i} is linked to removed state ${burg.state}`);
        burg.state = 0;
      }

      if (burg.state === undefined) {
        repairs.push(`Burg ${burg.i} has no state data`);
        burg.state = 0;
      }
    }

    return repairs;
  }

  private repairCapitals(): string[] {
    const repairs: string[] = [];
    const demote = (burg: Burg) => {
      burg.capital = 0;
      Burgs.changeGroup(burg, null);
    };

    for (const state of pack.states) {
      if (state.removed) continue;

      const stateBurgs = pack.burgs.filter(b => b.state === state.i && !b.removed);
      const capitalBurgs = stateBurgs.filter(b => b.capital);
      const ids = capitalBurgs.map(b => b.i).join(", ");

      if (!state.i && capitalBurgs.length) {
        repairs.push(`Neutral burgs (${ids}) marked as capitals`);
        capitalBurgs.forEach(demote);
      } else if (capitalBurgs.length > 1) {
        repairs.push(`State ${state.i} has multiple capitals (${ids}). Keeping the first as capital`);
        capitalBurgs.slice(1).forEach(demote);
      } else if (state.i && stateBurgs.length && !capitalBurgs.length) {
        repairs.push(`State ${state.i} has no capital. Making the first burg capital`);
        stateBurgs[0].capital = 1;
        Burgs.changeGroup(stateBurgs[0], null);
      }
    }

    return repairs;
  }

  private repairProvinces(): string[] {
    const repairs: string[] = [];
    for (const province of pack.provinces) {
      if (!province?.i || province.removed) continue;
      const state = pack.states[province.state];
      if (state && !state.removed) continue;
      repairs.push(`Province ${province.i} is linked to removed state ${province.state}. Removing the province`);
      province.removed = true;
    }
    return repairs;
  }

  private repairRoutes(): string[] {
    const { cells } = pack;
    const repairs: string[] = [];

    // drop the broken route object only: a valid route may share its id. Its cell links are cleaned below
    pack.routes = pack.routes.filter(route => {
      if (route.points?.length >= 2) return true;
      repairs.push(`Route ${route.i} has less than 2 points. Removing the route`);
      return false;
    });

    const routeIds = new Set(pack.routes.map(route => route.i));
    for (const from in cells.routes) {
      const links = cells.routes[+from];
      if (!links) continue;
      if (!Object.keys(links).length) {
        delete cells.routes[+from];
        continue;
      }
      for (const to in links) {
        if (routeIds.has(links[+to])) continue;
        repairs.push(`Route ${links[+to]} from ${from} to ${to} is missing. Removing the link`);
        delete links[+to];
      }
    }

    return repairs;
  }

  private repairMarkers(): string[] {
    const repairs: string[] = [];
    const markerIds = new Set<number>();
    let nextId = (last(pack.markers)?.i ?? -1) + 1 || 0;

    for (const marker of pack.markers) {
      if (!markerIds.has(marker.i)) {
        markerIds.add(marker.i);
        continue;
      }
      repairs.push(`Marker ${marker.i} has non-unique id. Changing to ${nextId}`);
      marker.i = nextId++;
    }
    pack.markers.sort((a, b) => a.i - b.i);

    return repairs;
  }

  // segment transports with no transport type behind them fall back to air rules
  private findMissingTransports(): string[] {
    const transportNames = new Set(Transports.all.map(transport => transport.name));
    const missing = new Set<string>();
    for (const journey of pack.journeys) {
      for (const segment of journey.segments) {
        if (!transportNames.has(segment.transport)) missing.add(segment.transport);
      }
    }
    return missing.size ? [`Journey transports missing, not fixed: ${[...missing].join(", ")}`] : [];
  }
}

export const MapRepair = new MapRepairService();
