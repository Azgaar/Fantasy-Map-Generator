import { quadtree } from "d3-quadtree";
import { byId, each, gauss, minmax, normalize, P, rn } from "../utils";

declare global {
  var Burgs: BurgModule;
}
export interface Burg {
  cell: number;
  x: number;
  y: number;
  i?: number;
  state?: number;
  culture?: number;
  name?: string;
  feature?: number;
  capital?: number;
  lock?: boolean;
  port?: number;
  removed?: boolean;
  population?: number;
  type?: string;
  coa?: any;
  citadel?: number;
  plaza?: number;
  walls?: number;
  shanty?: number;
  temple?: number;
  group?: string;
  link?: string;
  MFCG?: string;
}

class BurgModule {
  shift() {
    const { cells, features, burgs } = pack;
    const temp = grid.cells.temp;

    // port is a capital with any harbor OR any burg with a safe harbor
    // safe harbor is a cell having just one adjacent water cell
    const featurePortCandidates: Record<number, Burg[]> = {};
    for (const burg of burgs) {
      if (!burg.i || burg.lock) continue;
      delete burg.port; // reset port status
      const cellId = burg.cell;

      const haven = cells.haven[cellId];
      const harbor = cells.harbor[cellId];
      const featureId = cells.f[haven];
      if (!featureId) continue; // no adjacent water body

      const isMulticell = features[featureId].cells > 1;
      const isHarbor = (harbor && burg.capital) || harbor === 1;
      const isFrozen = temp[cells.g[cellId]] <= 0;

      if (isMulticell && isHarbor && !isFrozen) {
        if (!featurePortCandidates[featureId])
          featurePortCandidates[featureId] = [];
        featurePortCandidates[featureId].push(burg);
      }
    }

    const getCloseToEdgePoint = (cell1: number, cell2: number) => {
      const { cells, vertices } = pack;

      const [x0, y0] = cells.p[cell1];
      const commonVertices = cells.v[cell1].filter((vertex) =>
        vertices.c[vertex].some((cell) => cell === cell2),
      );
      const [x1, y1] = vertices.p[commonVertices[0]];
      const [x2, y2] = vertices.p[commonVertices[1]];
      const xEdge = (x1 + x2) / 2;
      const yEdge = (y1 + y2) / 2;

      const x = rn(x0 + 0.95 * (xEdge - x0), 2);
      const y = rn(y0 + 0.95 * (yEdge - y0), 2);

      return [x, y];
    };

    // shift ports to the edge of the water body
    Object.entries(featurePortCandidates).forEach(([featureId, burgs]) => {
      if (burgs.length < 2) return; // only one port on water body - skip
      burgs.forEach((burg) => {
        burg.port = Number(featureId);
        const haven = cells.haven[burg.cell];
        const [x, y] = getCloseToEdgePoint(burg.cell, haven);
        burg.x = x;
        burg.y = y;
      });
    });

    // shift non-port river burgs a bit
    for (const burg of burgs) {
      if (!burg.i || burg.lock || burg.port || !cells.r[burg.cell]) continue;
      const cellId = burg.cell;
      const shift = Math.min(cells.fl[cellId] / 150, 1);
      burg.x = cellId % 2 ? rn(burg.x + shift, 2) : rn(burg.x - shift, 2);
      burg.y =
        cells.r[cellId] % 2 ? rn(burg.y + shift, 2) : rn(burg.y - shift, 2);
    }
  }

  generate() {
    TIME && console.time("generateBurgs");
    const { cells } = pack;

    let burgs: Burg[] = [0 as any]; // burgs array
    cells.burg = new Uint16Array(cells.i.length);

    const populatedCells = cells.i.filter(
      (i) => cells.s[i] > 0 && cells.culture[i],
    );
    if (!populatedCells.length) {
      ERROR &&
        console.error(
          "There is no populated cells with culture assigned. Cannot generate states",
        );
      return burgs;
    }

    let burgsQuadtree = quadtree();

    const generateCapitals = () => {
      const randomize = (score: number) => score * (0.5 + Math.random() * 0.5);
      const score = new Int16Array(cells.s.map(randomize));
      const sorted = populatedCells.sort((a, b) => score[b] - score[a]);

      const capitalsNumber = getCapitalsNumber();
      let spacing = (graphWidth + graphHeight) / 2 / capitalsNumber; // min distance between capitals

      for (let i = 0; burgs.length <= capitalsNumber; i++) {
        const cell = sorted[i];
        const [x, y] = cells.p[cell];

        if (burgsQuadtree.find(x, y, spacing) === undefined) {
          burgs.push({ cell, x, y });
          burgsQuadtree.add([x, y]);
        }

        // reset if all cells were checked
        if (i === sorted.length - 1) {
          WARN &&
            console.warn(
              "Cannot place capitals with current spacing. Trying again with reduced spacing",
            );
          burgsQuadtree = quadtree();
          i = -1;
          burgs = [0 as any];
          spacing /= 1.2;
        }
      }

      burgs.forEach((burg, burgId) => {
        if (!burgId) return;
        burg.i = burgId;
        burg.state = burgId;
        burg.culture = cells.culture[burg.cell];
        burg.name = Names.getCultureShort(burg.culture);
        burg.feature = cells.f[burg.cell];
        burg.capital = 1;
        cells.burg[burg.cell] = burgId;
      });
    };

    const generateTowns = () => {
      const randomize = (score: number) => score * gauss(1, 3, 0, 20, 3);
      const score = new Int16Array(cells.s.map(randomize));
      const sorted = populatedCells.sort((a, b) => score[b] - score[a]);

      const burgsNumber = getTownsNumber();
      let spacing =
        (graphWidth + graphHeight) / 150 / (burgsNumber ** 0.7 / 66); // min distance between town

      for (let added = 0; added < burgsNumber && spacing > 1; ) {
        for (let i = 0; added < burgsNumber && i < sorted.length; i++) {
          if (cells.burg[sorted[i]]) continue;
          const cell = sorted[i];
          const [x, y] = cells.p[cell];

          const minSpacing = spacing * gauss(1, 0.3, 0.2, 2, 2); // randomize to make placement not uniform
          if (burgsQuadtree.find(x, y, minSpacing) !== undefined) continue; // to close to existing burg

          const burgId = burgs.length;
          const culture = cells.culture[cell];
          const name = Names.getCulture(culture);
          const feature = cells.f[cell];
          burgs.push({
            cell,
            x,
            y,
            i: burgId,
            state: 0,
            culture,
            name,
            feature,
            capital: 0,
          });
          added++;
          cells.burg[cell] = burgId;
        }

        spacing *= 0.5;
      }
    };

    generateCapitals();
    generateTowns();

    pack.burgs = burgs;
    this.shift();

    TIME && console.timeEnd("generateBurgs");

    function getCapitalsNumber() {
      let number = (byId("statesNumber") as HTMLInputElement).valueAsNumber;

      if (populatedCells.length < number * 10) {
        number = Math.floor(populatedCells.length / 10);
        WARN &&
          console.warn(
            `Not enough populated cells. Generating only ${number} capitals/states`,
          );
      }

      return number;
    }

    function getTownsNumber() {
      const manorsInput = byId("manorsInput") as HTMLInputElement;
      const isAuto = manorsInput.value === "1000"; // '1000' is considered as auto
      if (isAuto)
        return rn(
          populatedCells.length / 5 / (grid.points.length / 10000) ** 0.8,
        );

      return Math.min(manorsInput.valueAsNumber, populatedCells.length);
    }
  }

  getType(cellId: number, port?: number) {
    const { cells, features } = pack;

    if (port) return "Naval";

    const haven = cells.haven[cellId];
    if (haven !== undefined && features[cells.f[haven]].type === "lake")
      return "Lake";

    if (cells.h[cellId] > 60) return "Highland";

    if (cells.r[cellId] && cells.fl[cellId] >= 100) return "River";

    const biome = cells.biome[cellId];
    const population = cells.pop[cellId];
    if (!cells.burg[cellId] || population <= 5) {
      if (population < 5 && [1, 2, 3, 4].includes(biome)) return "Nomadic";
      if (biome > 4 && biome < 10) return "Hunting";
    }

    return "Generic";
  }

  private definePopulation(burg: Burg) {
    const cellId = burg.cell;
    let population = pack.cells.s[cellId] / 5;
    if (burg.capital) population *= 1.5;
    const connectivityRate = Routes.getConnectivityRate(cellId);
    if (connectivityRate) population *= connectivityRate;
    population *= gauss(1, 1, 0.25, 4, 5); // randomize
    population += (((burg.i as number) % 100) - (cellId % 100)) / 1000; // unround
    burg.population = rn(Math.max(population, 0.01), 3);
  }

  private defineEmblem(burg: Burg) {
    burg.type = this.getType(burg.cell, burg.port);

    const state = pack.states[burg.state as number];
    const stateCOA = state.coa;

    let kinship = 0.25;
    if (burg.capital) kinship += 0.1;
    else if (burg.port) kinship -= 0.1;
    if (burg.culture !== state.culture) kinship -= 0.25;

    const type =
      burg.capital && P(0.2)
        ? "Capital"
        : burg.type === "Generic"
          ? "City"
          : burg.type;
    burg.coa = COA.generate(stateCOA, kinship, null, type);
    burg.coa.shield = COA.getShield(burg.culture, burg.state);
  }

  private defineFeatures(burg: Burg) {
    const pop = burg.population as number;
    burg.citadel = Number(
      burg.capital || (pop > 50 && P(0.75)) || (pop > 15 && P(0.5)) || P(0.1),
    );
    burg.plaza = Number(
      Routes.isCrossroad(burg.cell) ||
        (Routes.hasRoad(burg.cell) && P(0.7)) ||
        pop > 20 ||
        (pop > 10 && P(0.8)),
    );
    burg.walls = Number(
      burg.capital ||
        pop > 30 ||
        (pop > 20 && P(0.75)) ||
        (pop > 10 && P(0.5)) ||
        P(0.1),
    );
    burg.shanty = Number(
      pop > 60 || (pop > 40 && P(0.75)) || (pop > 20 && burg.walls && P(0.4)),
    );
    const religion = pack.cells.religion[burg.cell] as number;
    const theocracy = pack.states[burg.state as number].form === "Theocracy";
    burg.temple = Number(
      (religion && theocracy && P(0.5)) ||
        pop > 50 ||
        (pop > 35 && P(0.75)) ||
        (pop > 20 && P(0.5)),
    );
  }

  getDefaultGroups() {
    return [
      {
        name: "capital",
        active: true,
        order: 9,
        features: { capital: true },
        preview: "watabou-city",
      },
      {
        name: "city",
        active: true,
        order: 8,
        percentile: 90,
        min: 5,
        preview: "watabou-city",
      },
      {
        name: "fort",
        active: true,
        features: { citadel: true, walls: false, plaza: false, port: false },
        order: 6,
        max: 1,
      },
      {
        name: "monastery",
        active: true,
        features: { temple: true, walls: false, plaza: false, port: false },
        order: 5,
        max: 0.8,
      },
      {
        name: "caravanserai",
        active: true,
        features: { port: false, plaza: true },
        order: 4,
        max: 0.8,
        biomes: [1, 2, 3],
      },
      {
        name: "trading_post",
        active: true,
        order: 3,
        features: { plaza: true },
        max: 0.8,
        biomes: [5, 6, 7, 8, 9, 10, 11, 12],
      },
      {
        name: "village",
        active: true,
        order: 2,
        min: 0.1,
        max: 2,
        preview: "watabou-village",
      },
      {
        name: "hamlet",
        active: true,
        order: 1,
        features: { plaza: false },
        max: 0.1,
        preview: "watabou-village",
      },
      {
        name: "town",
        active: true,
        order: 7,
        isDefault: true,
        preview: "watabou-city",
      },
    ];
  }

  defineGroup(burg: Burg, populations: number[]) {
    if (burg.lock && burg.group) {
      // locked burgs: don't change group if it still exists
      const group = options.burgs.groups.find(
        (g: any) => g.name === burg.group,
      );
      if (group) return;
    }

    const defaultGroup = options.burgs.groups.find((g: any) => g.isDefault);
    if (!defaultGroup) {
      ERROR && console.error("No default group defined");
      return;
    }
    burg.group = defaultGroup.name;

    for (const group of options.burgs.groups) {
      if (!group.active) continue;

      if (group.min) {
        const isFit = (burg.population as number) >= group.min;
        if (!isFit) continue;
      }

      if (group.max) {
        const isFit = (burg.population as number) <= group.max;
        if (!isFit) continue;
      }

      if (group.features) {
        const isFit = Object.entries(
          group.features as Record<string, boolean>,
        ).every(
          ([feature, value]) => Boolean(burg[feature as keyof Burg]) === value,
        );
        if (!isFit) continue;
      }

      if (group.biomes) {
        const isFit = group.biomes.includes(pack.cells.biome[burg.cell]);
        if (!isFit) continue;
      }

      if (group.percentile) {
        const index = populations.indexOf(burg.population as number);
        const isFit =
          index >= Math.floor((populations.length * group.percentile) / 100);
        if (!isFit) continue;
      }

      burg.group = group.name; // apply fitting group
      return;
    }
  }

  specify() {
    TIME && console.time("specifyBurgs");

    pack.burgs.forEach((burg) => {
      if (!burg.i || burg.removed || burg.lock) return;
      this.definePopulation(burg);
      this.defineEmblem(burg);
      this.defineFeatures(burg);
    });

    const populations = pack.burgs
      .filter((b) => b.i && !b.removed)
      .map((b) => b.population as number)
      .sort((a: number, b: number) => a - b); // ascending

    pack.burgs.forEach((burg) => {
      if (!burg.i || burg.removed) return;
      this.defineGroup(burg, populations);
    });

    TIME && console.timeEnd("specifyBurgs");
  }

  private createWatabouCityLinks(burg: Burg) {
    const cells = pack.cells;
    const { i, name, population: burgPopulation, cell } = burg;
    const burgSeed = burg.MFCG || seed + String(burg.i).padStart(4, "0");

    const sizeRaw =
      2.13 * ((burgPopulation! * populationRate) / urbanDensity) ** 0.385;
    const size = minmax(Math.ceil(sizeRaw), 6, 100);
    const population = rn(burgPopulation! * populationRate * urbanization);

    const river = cells.r[cell] ? 1 : 0;
    const coast = Number((burg.port || 0) > 0);
    const sea = (() => {
      if (!coast || !cells.haven[cell]) return null;

      // calculate see direction: 0 = east, 0.5 = north, 1 = west, 1.5 = south
      const [x1, y1] = cells.p[cell];
      const [x2, y2] = cells.p[cells.haven[cell]];
      const deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;

      if (deg <= 0) return rn(normalize(Math.abs(deg), 0, 180), 2);
      return rn(2 - normalize(deg, 0, 180), 2);
    })();

    const arableBiomes = river ? [1, 2, 3, 4, 5, 6, 7, 8] : [5, 6, 7, 8];
    const farms = +arableBiomes.includes(cells.biome[cell]);

    const citadel = +(burg.citadel as number);
    const urban_castle = +(citadel && each(2)(i as number));

    const hub = Routes.isCrossroad(cell);
    const walls = +(burg.walls as number);
    const plaza = +(burg.plaza as number);
    const temple = +(burg.temple as number);
    const shantytown = +(burg.shanty as number);

    const style = "natural";

    const url = new URL("https://watabou.github.io/city-generator/");
    url.search = new URLSearchParams({
      name: name || "",
      population: population.toString(),
      size: size.toString(),
      seed: burgSeed,
      river: river.toString(),
      coast: coast.toString(),
      farms: farms.toString(),
      citadel: citadel.toString(),
      urban_castle: urban_castle.toString(),
      hub: hub.toString(),
      plaza: plaza.toString(),
      temple: temple.toString(),
      walls: walls.toString(),
      shantytown: shantytown.toString(),
      gates: (-1).toString(),
      style,
    }).toString();
    if (sea) url.searchParams.append("sea", sea.toString());

    const link = url.toString();
    return { link, preview: `${link}&preview=1` };
  }

  private createWatabouVillageLinks(burg: Burg) {
    const { cells, features } = pack;
    const { i, population, cell } = burg;

    const burgSeed = seed + String(i).padStart(4, "0");
    const pop = rn(population! * populationRate * urbanization);
    const tags = [];

    if (cells.r[cell] && cells.haven[cell]) tags.push("estuary");
    else if (cells.haven[cell] && features[cells.f[cell]].cells === 1)
      tags.push("island,district");
    else if (burg.port) tags.push("coast");
    else if (cells.conf[cell]) tags.push("confluence");
    else if (cells.r[cell]) tags.push("river");
    else if (pop < 200 && each(4)(cell)) tags.push("pond");

    const connectivityRate = Routes.getConnectivityRate(cell);
    tags.push(
      connectivityRate > 1
        ? "highway"
        : connectivityRate === 1
          ? "dead end"
          : "isolated",
    );

    const biome = cells.biome[cell];
    const arableBiomes = cells.r[cell]
      ? [1, 2, 3, 4, 5, 6, 7, 8]
      : [5, 6, 7, 8];
    if (!arableBiomes.includes(biome)) tags.push("uncultivated");
    else if (each(6)(cell)) tags.push("farmland");

    const temp = grid.cells.temp[cells.g[cell]];
    if (temp <= 0 || temp > 28 || (temp > 25 && each(3)(cell)))
      tags.push("no orchards");

    if (!burg.plaza) tags.push("no square");
    if (burg.walls) tags.push("palisade");

    if (pop < 100) tags.push("sparse");
    else if (pop > 300) tags.push("dense");

    const width = (() => {
      if (pop > 1500) return 1600;
      if (pop > 1000) return 1400;
      if (pop > 500) return 1000;
      if (pop > 200) return 800;
      if (pop > 100) return 600;
      return 400;
    })();
    const height = rn(width / 2.05);

    const style = (() => {
      if ([1, 2].includes(biome)) return "sand";
      if (temp <= 5 || [9, 10, 11].includes(biome)) return "snow";
      return "default";
    })();

    const url = new URL("https://watabou.github.io/village-generator/");
    url.search = new URLSearchParams({
      pop: pop.toString(),
      name: burg.name || "",
      seed: burgSeed,
      width: width.toString(),
      height: height.toString(),
      style,
      tags: tags.join(","),
    }).toString();

    const link = url.toString();
    return { link, preview: `${link}&preview=1` };
  }

  private createWatabouDwellingLinks(burg: Burg) {
    const burgSeed = seed + String(burg.i).padStart(4, "0");
    const pop = rn(burg.population! * populationRate * urbanization);

    const tags = (() => {
      if (pop > 200) return ["large", "tall"];
      if (pop > 100) return ["large"];
      if (pop > 50) return ["tall"];
      if (pop > 20) return ["low"];
      return ["small"];
    })();

    const url = new URL("https://watabou.github.io/dwellings/");
    url.search = new URLSearchParams({
      pop: pop.toString(),
      name: "",
      seed: burgSeed,
      tags: tags.join(","),
    }).toString();

    const link = url.toString();
    return { link, preview: `${link}&preview=1` };
  }

  getPreview(burg: Burg): { link: string | null; preview: string | null } {
    const previewGeneratorsMap: Record<
      string,
      (burg: Burg) => { link: string | null; preview: string | null }
    > = {
      "watabou-city": (burg: Burg) => this.createWatabouCityLinks(burg),
      "watabou-village": (burg: Burg) => this.createWatabouVillageLinks(burg),
      "watabou-dwelling": (burg: Burg) => this.createWatabouDwellingLinks(burg),
    };
    if (burg.link) return { link: burg.link, preview: burg.link };

    const group = options.burgs.groups.find((g: any) => g.name === burg.group);
    if (!group?.preview || !previewGeneratorsMap[group.preview])
      return { link: null, preview: null };

    return previewGeneratorsMap[group.preview](burg);
  }

  add([x, y]: [number, number]) {
    const { cells } = pack;

    const burgId = pack.burgs.length;
    const cellId = window.findCell(x, y, undefined, pack);
    const culture = cells.culture[cellId as number];
    const name = Names.getCulture(culture);
    const state = cells.state[cellId as number];
    const feature = cells.f[cellId as number];

    const burg: Burg = {
      cell: cellId as number,
      x,
      y,
      i: burgId,
      state,
      culture,
      name,
      feature,
      capital: 0,
      port: 0,
    };
    this.definePopulation(burg);
    this.defineEmblem(burg);
    this.defineFeatures(burg);

    const populations = pack.burgs
      .filter((b) => b.i && !b.removed)
      .map((b) => b.population as number)
      .sort((a: number, b: number) => a - b); // ascending
    this.defineGroup(burg, populations);

    pack.burgs.push(burg);
    cells.burg[cellId as number] = burgId;

    const newRoute = Routes.connect(cellId as number);
    if (newRoute && layerIsOn("toggleRoutes")) drawRoute(newRoute);

    drawBurgIcon(burg);
    drawBurgLabel(burg);

    return burgId;
  }

  changeGroup(burg: Burg, group: string | null) {
    if (group) {
      burg.group = group;
    } else {
      const validBurgs = pack.burgs.filter((b) => b.i && !b.removed);
      const populations = validBurgs
        .map((b) => b.population as number)
        .sort((a, b) => a - b);
      this.defineGroup(burg, populations);
    }

    drawBurgIcon(burg);
    drawBurgLabel(burg);
  }

  remove(burgId: number) {
    const burg = pack.burgs[burgId];
    if (!burg) return tip(`Burg ${burgId} not found`, false, "error");

    pack.cells.burg[burg.cell] = 0;
    burg.removed = true;

    const noteId = notes.findIndex((note) => note.id === `burg${burgId}`);
    if (noteId !== -1) notes.splice(noteId, 1);

    if (burg.coa) {
      byId(`burgCOA${burgId}`)?.remove();
      emblems.select(`#burgEmblems > use[data-i='${burgId}']`).remove();
      delete burg.coa;
    }

    removeBurgIcon(burg.i!);
    removeBurgLabel(burg.i!);
  }
}
window.Burgs = new BurgModule();
