import {minmax} from "../utils/numberUtils";
import {P} from "../utils/probabilityUtils";
import type {
  TectonicConfig,
  TectonicPlate,
  PlateBoundary,
  TectonicMetadata,
  BoundarySubtype
} from "../types/TectonicMetadata";

interface TectonicResult {
  heights: Uint8Array;
  metadata: TectonicMetadata;
}

interface Grid {
  cells: {
    i: Uint32Array | number[];
    c: number[][];
    b: number[];
    h?: Uint8Array;
  };
  points: [number, number][];
  cellsX: number;
  cellsY: number;
  cellsDesired: number;
  spacing: number;
}

// Icosphere face: 3 vertex indices forming a triangle
type Face = [number, number, number];

// ============================================================
// Icosphere mesh for spherical tectonic simulation
// ============================================================

class IcoSphereMesh {
  vertices: [number, number, number][]; // unit sphere positions
  faces: Face[];
  neighbors: number[][]; // per-face adjacency
  centroids: [number, number, number][]; // per-face centroid on unit sphere

  constructor(subdivisions: number) {
    this.vertices = [];
    this.faces = [];
    this.neighbors = [];
    this.centroids = [];
    this.buildIcosahedron();
    for (let i = 0; i < subdivisions; i++) {
      this.subdivide();
    }
    this.computeFaceData();
  }

  private buildIcosahedron(): void {
    const t = (1 + Math.sqrt(5)) / 2; // golden ratio

    // 12 vertices of icosahedron (normalized to unit sphere)
    const raw: [number, number, number][] = [
      [-1, t, 0],
      [1, t, 0],
      [-1, -t, 0],
      [1, -t, 0],
      [0, -1, t],
      [0, 1, t],
      [0, -1, -t],
      [0, 1, -t],
      [t, 0, -1],
      [t, 0, 1],
      [-t, 0, -1],
      [-t, 0, 1]
    ];

    this.vertices = raw.map(v => this.normalize(v));

    // 20 triangular faces
    this.faces = [
      [0, 11, 5],
      [0, 5, 1],
      [0, 1, 7],
      [0, 7, 10],
      [0, 10, 11],
      [1, 5, 9],
      [5, 11, 4],
      [11, 10, 2],
      [10, 7, 6],
      [7, 1, 8],
      [3, 9, 4],
      [3, 4, 2],
      [3, 2, 6],
      [3, 6, 8],
      [3, 8, 9],
      [4, 9, 5],
      [2, 4, 11],
      [6, 2, 10],
      [8, 6, 7],
      [9, 8, 1]
    ];
  }

  private normalize(v: [number, number, number]): [number, number, number] {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return [v[0] / len, v[1] / len, v[2] / len];
  }

  private midpointCache = new Map<string, number>();

  private getMidpoint(a: number, b: number): number {
    const key = Math.min(a, b) + "-" + Math.max(a, b);
    if (this.midpointCache.has(key)) return this.midpointCache.get(key)!;

    const va = this.vertices[a];
    const vb = this.vertices[b];
    const mid: [number, number, number] = this.normalize([
      (va[0] + vb[0]) / 2,
      (va[1] + vb[1]) / 2,
      (va[2] + vb[2]) / 2
    ]);
    const idx = this.vertices.length;
    this.vertices.push(mid);
    this.midpointCache.set(key, idx);
    return idx;
  }

  private subdivide(): void {
    this.midpointCache.clear();
    const newFaces: Face[] = [];

    for (const [a, b, c] of this.faces) {
      const ab = this.getMidpoint(a, b);
      const bc = this.getMidpoint(b, c);
      const ca = this.getMidpoint(c, a);

      newFaces.push([a, ab, ca]);
      newFaces.push([b, bc, ab]);
      newFaces.push([c, ca, bc]);
      newFaces.push([ab, bc, ca]);
    }

    this.faces = newFaces;
  }

  private computeFaceData(): void {
    const numFaces = this.faces.length;

    // Compute centroids
    this.centroids = this.faces.map(([a, b, c]) => {
      const va = this.vertices[a];
      const vb = this.vertices[b];
      const vc = this.vertices[c];
      return this.normalize([
        (va[0] + vb[0] + vc[0]) / 3,
        (va[1] + vb[1] + vc[1]) / 3,
        (va[2] + vb[2] + vc[2]) / 3
      ]);
    });

    // Build face adjacency: two faces are neighbors if they share an edge (2 vertices)
    const edgeToFace = new Map<string, number[]>();
    for (let f = 0; f < numFaces; f++) {
      const [a, b, c] = this.faces[f];
      const edges = [
        [Math.min(a, b), Math.max(a, b)],
        [Math.min(b, c), Math.max(b, c)],
        [Math.min(a, c), Math.max(a, c)]
      ];
      for (const [e0, e1] of edges) {
        const key = e0 + "-" + e1;
        if (!edgeToFace.has(key)) edgeToFace.set(key, []);
        edgeToFace.get(key)!.push(f);
      }
    }

    this.neighbors = new Array(numFaces).fill(null).map(() => []);
    for (const faces of edgeToFace.values()) {
      if (faces.length === 2) {
        this.neighbors[faces[0]].push(faces[1]);
        this.neighbors[faces[1]].push(faces[0]);
      }
    }
  }

  // Convert unit sphere position to (lon, lat) in radians
  toLonLat(v: [number, number, number]): [number, number] {
    const lat = Math.asin(minmax(v[1], -1, 1));
    const lon = Math.atan2(v[2], v[0]);
    return [lon, lat];
  }
}

// ============================================================
// Spherical tectonic plate generator
// ============================================================

// Simple seeded PRNG (mulberry32) for deterministic regeneration
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class TectonicPlateGenerator {
  private grid: Grid;
  private config: TectonicConfig;
  private numGridCells: number;

  // Sphere mesh
  private sphere!: IcoSphereMesh;
  private numSphereFaces!: number;

  // Per-sphere-face data
  private plateAssignment!: Int8Array;
  private elevations!: Float32Array;
  private boundaryFlags!: Uint8Array;
  private boundaryConvergence!: Float32Array;

  private plates: TectonicPlate[] = [];
  private boundaries: PlateBoundary[] = [];

  // Seeded PRNG for deterministic elevation pipeline
  private elevationSeed: number = 0;
  private rng: () => number = Math.random;

  constructor(grid: Grid, config: TectonicConfig) {
    this.grid = grid;
    this.config = config;
    this.numGridCells = grid.points.length;
  }

  generate(): TectonicResult {
    // Choose icosphere subdivision level to roughly match grid resolution
    // Sub 4 = 5120 faces, Sub 5 = 20480 faces, Sub 6 = 81920 faces
    const targetFaces = this.numGridCells * 2; // oversample sphere for quality
    let subdivisions = 4;
    if (targetFaces > 10000) subdivisions = 5;
    if (targetFaces > 40000) subdivisions = 6;

    this.sphere = new IcoSphereMesh(subdivisions);
    this.numSphereFaces = this.sphere.faces.length;

    this.plateAssignment = new Int8Array(this.numSphereFaces).fill(-1);
    this.elevations = new Float32Array(this.numSphereFaces);
    this.boundaryFlags = new Uint8Array(this.numSphereFaces);
    this.boundaryConvergence = new Float32Array(this.numSphereFaces);

    // Run tectonic simulation on sphere
    this.seedPlates();
    this.growPlates();
    this.perturbBoundaries();
    this.classifyPlates();
    this.assignVelocities();

    // Save a seed for the elevation pipeline so regeneration is deterministic
    this.elevationSeed = Math.floor(Math.random() * 2147483647);
    this.runElevationPipeline();

    // Project sphere onto flat grid
    return this.projectAndFinalize();
  }

  // Run the elevation pipeline with a deterministic PRNG
  private runElevationPipeline(): void {
    this.rng = mulberry32(this.elevationSeed);
    this.assignBaseElevations();
    this.detectBoundaries();
    this.computeBoundaryElevations();
    this.diffuseElevations();
    this.generateContinentalShelves();
    this.addHotspots();
    this.applyErosion();
    this.applyNoise();
  }

  // Regenerate terrain from edited plate state (skips plate growth, re-runs elevation pipeline)
  // Call after modifying plates[].isOceanic or plates[].velocity externally
  regenerate(): TectonicResult {
    // Reset elevation data but keep plate assignments and sphere mesh
    this.elevations = new Float32Array(this.numSphereFaces);
    this.boundaryFlags = new Uint8Array(this.numSphereFaces);
    this.boundaryConvergence = new Float32Array(this.numSphereFaces);
    this.boundaries = [];

    // Re-run with same seed so noise/hotspots/erosion are deterministic
    // Only plate-driven effects (base elevation, boundary types) change
    this.runElevationPipeline();

    return this.projectAndFinalize();
  }

  // Get current plates for editor access
  getPlates(): TectonicPlate[] {
    return this.plates;
  }

  // Get grid-level plate IDs for visualization (from last projectAndFinalize)
  getGridPlateIds(): Uint8Array | null {
    return window.tectonicMetadata?.plateIds ?? null;
  }


  // ---- Step 1: Seed plates on sphere ----
  private seedPlates(): void {
    const {plateCount} = this.config;
    const effectivePlateCount = Math.min(plateCount, Math.floor(Math.sqrt(this.numSphereFaces) / 5));

    // Minimum angular separation between seeds
    const minAngularSep = Math.PI / Math.sqrt(effectivePlateCount) * 0.6;
    const seeds: number[] = [];

    let attempts = 0;
    while (seeds.length < effectivePlateCount && attempts < effectivePlateCount * 200) {
      const candidate = Math.floor(Math.random() * this.numSphereFaces);
      attempts++;

      // Check angular distance to existing seeds
      let tooClose = false;
      const cC = this.sphere.centroids[candidate];
      for (const s of seeds) {
        const cS = this.sphere.centroids[s];
        const dot = cC[0] * cS[0] + cC[1] * cS[1] + cC[2] * cS[2];
        const angle = Math.acos(minmax(dot, -1, 1));
        if (angle < minAngularSep) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      seeds.push(candidate);
    }

    // Fallback: fill remaining with random faces
    while (seeds.length < effectivePlateCount) {
      const candidate = Math.floor(Math.random() * this.numSphereFaces);
      if (!seeds.includes(candidate)) seeds.push(candidate);
    }

    for (let i = 0; i < seeds.length; i++) {
      this.plates.push({
        id: i,
        cells: new Set([seeds[i]]),
        isOceanic: false,
        velocity: [0, 0, 0],
        baseElevation: 0,
        seedCell: seeds[i]
      });
      this.plateAssignment[seeds[i]] = i;
    }
  }

  // ---- Step 2: Grow plates via randomized frontier BFS on sphere ----
  private growPlates(): void {
    const plateGrowthRate = this.plates.map(() => 0.3 + Math.random() * 0.7);
    const frontier: number[][] = this.plates.map(() => []);

    for (const plate of this.plates) {
      for (const neighbor of this.sphere.neighbors[plate.seedCell]) {
        if (this.plateAssignment[neighbor] === -1) {
          frontier[plate.id].push(neighbor);
        }
      }
    }

    let unassigned = this.numSphereFaces - this.plates.length;
    let maxIterations = this.numSphereFaces * 3;

    while (unassigned > 0 && maxIterations-- > 0) {
      let anyGrew = false;

      for (const plate of this.plates) {
        const pid = plate.id;
        if (frontier[pid].length === 0) continue;

        const claimCount = Math.max(1, Math.floor(frontier[pid].length * plateGrowthRate[pid] * (0.3 + Math.random() * 0.4)));
        this.shuffleArray(frontier[pid]);

        let claimed = 0;
        const newFrontier: number[] = [];

        for (const cell of frontier[pid]) {
          if (this.plateAssignment[cell] !== -1) continue;
          if (claimed >= claimCount) {
            newFrontier.push(cell);
            continue;
          }

          if (Math.random() > 0.7 + plateGrowthRate[pid] * 0.3) {
            newFrontier.push(cell);
            continue;
          }

          this.plateAssignment[cell] = pid;
          plate.cells.add(cell);
          claimed++;
          unassigned--;
          anyGrew = true;

          for (const neighbor of this.sphere.neighbors[cell]) {
            if (this.plateAssignment[neighbor] === -1) {
              newFrontier.push(neighbor);
            }
          }
        }

        frontier[pid] = newFrontier;
      }

      if (!anyGrew) break;
    }

    // Assign any remaining
    for (let i = 0; i < this.numSphereFaces; i++) {
      if (this.plateAssignment[i] === -1) {
        for (const neighbor of this.sphere.neighbors[i]) {
          if (this.plateAssignment[neighbor] !== -1) {
            this.plateAssignment[i] = this.plateAssignment[neighbor];
            this.plates[this.plateAssignment[neighbor]].cells.add(i);
            break;
          }
        }
      }
    }
  }

  // ---- Step 3: Perturb boundaries ----
  private perturbBoundaries(): void {
    const passes = 3;

    for (let pass = 0; pass < passes; pass++) {
      for (let i = 0; i < this.numSphereFaces; i++) {
        const myPlate = this.plateAssignment[i];
        if (myPlate === -1) continue;

        const adjacentPlates: number[] = [];
        let samePlateNeighborCount = 0;

        for (const n of this.sphere.neighbors[i]) {
          const np = this.plateAssignment[n];
          if (np !== myPlate && np !== -1) {
            adjacentPlates.push(np);
          } else {
            samePlateNeighborCount++;
          }
        }

        if (adjacentPlates.length === 0) continue;
        if (samePlateNeighborCount < 2) continue;
        if (Math.random() > 0.25) continue;

        const targetPlate = adjacentPlates[Math.floor(Math.random() * adjacentPlates.length)];
        this.plates[myPlate].cells.delete(i);
        this.plateAssignment[i] = targetPlate;
        this.plates[targetPlate].cells.add(i);
      }
    }
  }

  private shuffleArray<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
  }

  // ---- Step 4: Classify plates ----
  private classifyPlates(): void {
    const {continentalRatio} = this.config;
    const targetContinental = Math.max(1, Math.round(this.plates.length * continentalRatio));

    // Shuffle plates for random classification order
    const plateOrder = [...this.plates];
    this.shuffleArray(plateOrder);

    let continentalCount = 0;
    let oceanicCount = 0;

    for (const plate of plateOrder) {
      const needMoreContinental = continentalCount < targetContinental;
      const needMoreOceanic = oceanicCount < (this.plates.length - targetContinental);

      if (needMoreContinental && !needMoreOceanic) {
        plate.isOceanic = false;
      } else if (!needMoreContinental && needMoreOceanic) {
        plate.isOceanic = true;
      } else {
        plate.isOceanic = P(1 - continentalRatio);
      }

      if (plate.isOceanic) oceanicCount++;
      else continentalCount++;
    }

    // Guarantee at least 1 of each
    if (continentalCount === 0) {
      const largest = this.plates.reduce((a, b) => a.cells.size > b.cells.size ? a : b);
      largest.isOceanic = false;
    }
    if (oceanicCount === 0) {
      const smallest = this.plates.reduce((a, b) => a.cells.size < b.cells.size ? a : b);
      smallest.isOceanic = true;
    }
  }

  // ---- Step 5: Assign velocities as 3D tangent vectors on sphere ----
  private assignVelocities(): void {
    for (const plate of this.plates) {
      // Pick a random rotation axis and speed
      // The velocity is a tangent vector at the plate centroid
      const centroid = this.computePlateCentroid(plate);
      const magnitude = 0.3 + Math.random() * 0.7;

      // Random tangent direction: cross centroid with a random vector
      const randomVec: [number, number, number] = this.normalize3([
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ]);

      // Tangent = cross(centroid, randomVec), normalized and scaled
      const tangent = this.cross(centroid, randomVec);
      const tanLen = this.length3(tangent);
      if (tanLen > 0.001) {
        plate.velocity = [
          (tangent[0] / tanLen) * magnitude,
          (tangent[1] / tanLen) * magnitude,
          (tangent[2] / tanLen) * magnitude
        ];
      } else {
        plate.velocity = [magnitude, 0, 0];
      }
    }
  }

  // ---- Step 6: Set base elevations ----
  private assignBaseElevations(): void {
    for (const plate of this.plates) {
      // Continental base: 28-45 (closer to sea level = more varied coastlines)
      // Oceanic base: 0-8 (deep ocean)
      plate.baseElevation = plate.isOceanic
        ? Math.floor(this.rng() * 9)          // 0-8
        : 28 + Math.floor(this.rng() * 18);   // 28-45

      for (const cell of plate.cells) {
        // Add per-cell variation for more interesting interior terrain
        const variation = plate.isOceanic
          ? (this.rng() - 0.5) * 4
          : (this.rng() - 0.5) * 14;
        this.elevations[cell] = plate.baseElevation + variation;
      }
    }

    // Add inland depressions on continental plates (future inland seas)
    this.addInlandDepressions();
  }

  // Create random low-elevation depressions on continental plates
  // These can dip below sea level, forming inland seas like Caspian, Mediterranean, Hudson Bay
  private addInlandDepressions(): void {
    for (const plate of this.plates) {
      if (plate.isOceanic) continue;

      // 1-3 depressions per continental plate, proportional to plate size
      const numDepressions = Math.max(1, Math.floor(plate.cells.size / 3000) + (this.rng() < 0.5 ? 1 : 0));

      const cellArray = [...plate.cells];

      for (let d = 0; d < numDepressions; d++) {
        // Pick a random cell not near plate edge as depression center
        const center = cellArray[Math.floor(this.rng() * cellArray.length)];

        // Depression depth: some just create lowlands, some breach sea level
        const depth = 10 + this.rng() * 25; // 10-35 reduction
        const radius = 3 + Math.floor(this.rng() * 4); // BFS hops

        // BFS spread with decay
        const visited = new Set<number>();
        visited.add(center);
        const queue: [number, number][] = [[center, 0]];

        while (queue.length > 0) {
          const [cell, dist] = queue.shift()!;
          if (dist > radius) continue;

          const factor = 1 - (dist / (radius + 1));
          this.elevations[cell] -= depth * factor * factor; // quadratic falloff

          for (const n of this.sphere.neighbors[cell]) {
            if (!visited.has(n) && this.plateAssignment[n] === plate.id) {
              visited.add(n);
              queue.push([n, dist + 1]);
            }
          }
        }
      }
    }
  }

  // ---- Step 7: Detect boundaries and classify ----
  private detectBoundaries(): void {
    const pairMap = new Map<string, {plateA: number; plateB: number; cells: number[]}>();

    for (let i = 0; i < this.numSphereFaces; i++) {
      const myPlate = this.plateAssignment[i];
      if (myPlate === -1) continue;

      for (const neighbor of this.sphere.neighbors[i]) {
        const neighborPlate = this.plateAssignment[neighbor];
        if (neighborPlate === -1 || neighborPlate === myPlate) continue;

        this.boundaryFlags[i] = 1;

        const a = Math.min(myPlate, neighborPlate);
        const b = Math.max(myPlate, neighborPlate);
        const key = a + "-" + b;

        if (!pairMap.has(key)) {
          pairMap.set(key, {plateA: a, plateB: b, cells: []});
        }
        const pair = pairMap.get(key)!;
        if (!pair.cells.includes(i)) {
          pair.cells.push(i);
        }
        break;
      }
    }

    // Compute convergence for each plate pair
    for (const [, pair] of pairMap) {
      const centroidA = this.computePlateCentroid(this.plates[pair.plateA]);
      const centroidB = this.computePlateCentroid(this.plates[pair.plateB]);

      const convergence = this.computeConvergence(
        this.plates[pair.plateA],
        this.plates[pair.plateB],
        centroidA,
        centroidB
      );

      const plateA = this.plates[pair.plateA];
      const plateB = this.plates[pair.plateB];

      let subtype: BoundarySubtype;
      const isConvergent = convergence > 0.3;
      const isDivergent = convergence < -0.3;

      if (isConvergent) {
        if (!plateA.isOceanic && !plateB.isOceanic) subtype = "cont-cont";
        else if (plateA.isOceanic && plateB.isOceanic) subtype = "ocean-ocean";
        else subtype = "ocean-cont";
      } else if (isDivergent) {
        if (plateA.isOceanic && plateB.isOceanic) subtype = "ocean-rift";
        else if (!plateA.isOceanic && !plateB.isOceanic) subtype = "cont-rift";
        else subtype = "ocean-rift";
      } else {
        subtype = "transform";
      }

      this.boundaries.push({
        plateA: pair.plateA,
        plateB: pair.plateB,
        cells: pair.cells,
        convergence,
        subtype
      });

      for (const cell of pair.cells) {
        this.boundaryConvergence[cell] = convergence;
      }
    }
  }

  private computePlateCentroid(plate: TectonicPlate): [number, number, number] {
    let sx = 0, sy = 0, sz = 0;
    for (const cell of plate.cells) {
      const c = this.sphere.centroids[cell];
      sx += c[0];
      sy += c[1];
      sz += c[2];
    }
    const n = plate.cells.size || 1;
    return this.normalize3([sx / n, sy / n, sz / n]);
  }

  private computeConvergence(
    plateA: TectonicPlate,
    plateB: TectonicPlate,
    centroidA: [number, number, number],
    centroidB: [number, number, number]
  ): number {
    // Great circle direction from A to B
    const dx = centroidB[0] - centroidA[0];
    const dy = centroidB[1] - centroidA[1];
    const dz = centroidB[2] - centroidA[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist === 0) return 0;

    const dirX = dx / dist;
    const dirY = dy / dist;
    const dirZ = dz / dist;

    // How much A moves toward B + how much B moves toward A
    const convA = plateA.velocity[0] * dirX + plateA.velocity[1] * dirY + plateA.velocity[2] * dirZ;
    const convB = -(plateB.velocity[0] * dirX + plateB.velocity[1] * dirY + plateB.velocity[2] * dirZ);

    return (convA + convB) * this.config.collisionIntensity;
  }

  // ---- Step 8: Boundary elevations ----
  private computeBoundaryElevations(): void {
    for (const boundary of this.boundaries) {
      const absConv = Math.abs(boundary.convergence);

      for (const cell of boundary.cells) {
        const cellPlate = this.plates[this.plateAssignment[cell]];
        let delta = 0;

        switch (boundary.subtype) {
          case "cont-cont":
            // Himalayas-scale fold mountains — tallest features
            delta = (40 + this.rng() * 40) * Math.max(absConv, 0.5);
            break;
          case "ocean-cont":
            if (cellPlate.isOceanic) {
              // Deep ocean trench (Mariana-style)
              delta = -(12 + this.rng() * 10) * Math.max(absConv, 0.4);
            } else {
              // Andes-scale volcanic arc
              delta = (30 + this.rng() * 35) * Math.max(absConv, 0.4);
            }
            break;
          case "ocean-ocean":
            // Island arc (Japan-style) — peaks should breach sea level
            delta = (20 + this.rng() * 20) * Math.max(absConv, 0.4);
            break;
          case "ocean-rift":
            // Mid-ocean ridge
            delta = (5 + this.rng() * 5) * Math.max(absConv, 0.3);
            break;
          case "cont-rift":
            // Continental rift — deep inland depressions that can form seas
            delta = -(18 + this.rng() * 15) * Math.max(absConv, 0.4);
            break;
          case "transform":
            delta = (this.rng() - 0.5) * 10;
            break;
        }

        this.elevations[cell] += delta;
      }
    }
  }

  // ---- Step 9: Diffuse elevations ----
  private diffuseElevations(): void {
    const {smoothingPasses} = this.config;

    for (let pass = 0; pass < smoothingPasses; pass++) {
      const newElevations = new Float32Array(this.elevations);

      for (let i = 0; i < this.numSphereFaces; i++) {
        const neighbors = this.sphere.neighbors[i];
        if (!neighbors || neighbors.length === 0) continue;

        let sum = 0;
        for (const n of neighbors) {
          sum += this.elevations[n];
        }
        const neighborAvg = sum / neighbors.length;

        if (this.boundaryFlags[i]) {
          newElevations[i] = this.elevations[i] * 0.92 + neighborAvg * 0.08;
        } else {
          newElevations[i] = this.elevations[i] * 0.6 + neighborAvg * 0.4;
        }
      }

      this.elevations = newElevations;
    }
  }

  // ---- Step 10: Continental shelves ----
  private generateContinentalShelves(): void {
    const maxShelfHops = 3;
    const shelfTarget = 18;

    const coastCells: number[] = [];
    for (let i = 0; i < this.numSphereFaces; i++) {
      if (this.elevations[i] >= 20) {
        for (const n of this.sphere.neighbors[i]) {
          if (this.elevations[n] < 20) {
            coastCells.push(i);
            break;
          }
        }
      }
    }

    const distance = new Int8Array(this.numSphereFaces).fill(-1);
    const queue: number[] = [];

    for (const coast of coastCells) {
      for (const n of this.sphere.neighbors[coast]) {
        if (this.elevations[n] < 20 && distance[n] === -1) {
          distance[n] = 1;
          queue.push(n);
        }
      }
    }

    let idx = 0;
    while (idx < queue.length) {
      const cell = queue[idx++];
      const d = distance[cell];
      if (d >= maxShelfHops) continue;

      for (const n of this.sphere.neighbors[cell]) {
        if (this.elevations[n] < 20 && distance[n] === -1) {
          distance[n] = d + 1;
          queue.push(n);
        }
      }
    }

    for (let i = 0; i < this.numSphereFaces; i++) {
      if (distance[i] > 0 && distance[i] <= maxShelfHops) {
        const factor = 1.0 - distance[i] / (maxShelfHops + 1);
        this.elevations[i] = this.elevations[i] + (shelfTarget - this.elevations[i]) * factor * 0.4;
      }
    }
  }

  // ---- Step 11: Hotspot volcanoes ----
  private addHotspots(): void {
    const {hotspotCount} = this.config;

    for (let h = 0; h < hotspotCount; h++) {
      let center = -1;
      let attempts = 0;
      while (attempts < 100) {
        const candidate = Math.floor(this.rng() * this.numSphereFaces);
        if (!this.boundaryFlags[candidate]) {
          center = candidate;
          break;
        }
        attempts++;
      }
      if (center === -1) continue;

      const peakHeight = 25 + Math.floor(this.rng() * 21); // 25-45
      const change = new Float32Array(this.numSphereFaces);
      change[center] = peakHeight;

      const visited = new Uint8Array(this.numSphereFaces);
      visited[center] = 1;
      const queue = [center];

      while (queue.length > 0) {
        const cell = queue.shift()!;
        for (const neighbor of this.sphere.neighbors[cell]) {
          if (visited[neighbor]) continue;
          visited[neighbor] = 1;
          change[neighbor] = change[cell] * (0.7 + this.rng() * 0.15);
          if (change[neighbor] > 1) queue.push(neighbor);
        }
      }

      for (let i = 0; i < this.numSphereFaces; i++) {
        this.elevations[i] += change[i];
      }
    }
  }

  // ---- Step 12: Erosion ----
  private applyErosion(): void {
    const {erosionPasses} = this.config;
    if (erosionPasses === 0) return;

    const particleCount = Math.floor(this.numSphereFaces * 0.3);

    for (let pass = 0; pass < erosionPasses; pass++) {
      const erosion = new Float32Array(this.numSphereFaces);
      const deposition = new Float32Array(this.numSphereFaces);

      for (let p = 0; p < particleCount; p++) {
        let cell = Math.floor(this.rng() * this.numSphereFaces);
        if (this.elevations[cell] < 20) continue;

        let sediment = 0;
        const maxSteps = 30;

        for (let step = 0; step < maxSteps; step++) {
          let minNeighbor = -1;
          let minHeight = this.elevations[cell];

          for (const n of this.sphere.neighbors[cell]) {
            const h = this.elevations[n] - erosion[n] + deposition[n];
            if (h < minHeight) {
              minHeight = h;
              minNeighbor = n;
            }
          }

          if (minNeighbor === -1) break;

          const currentH = this.elevations[cell] - erosion[cell] + deposition[cell];
          const slope = currentH - minHeight;

          const erodeAmount = Math.min(slope * 0.15, 2);
          erosion[cell] += erodeAmount;
          sediment += erodeAmount;

          if (slope < 2 && sediment > 0) {
            const depositAmount = Math.min(sediment * 0.3, 1);
            deposition[minNeighbor] += depositAmount;
            sediment -= depositAmount;
          }

          cell = minNeighbor;

          if (this.elevations[cell] < 20) {
            deposition[cell] += sediment * 0.5;
            break;
          }
        }
      }

      for (let i = 0; i < this.numSphereFaces; i++) {
        this.elevations[i] = this.elevations[i] - erosion[i] * 0.5 + deposition[i] * 0.3;
      }
    }
  }

  // ---- Step 13: Noise ----
  private applyNoise(): void {
    const {noiseLevel} = this.config;
    if (noiseLevel === 0) return;

    const rawNoise = new Float32Array(this.numSphereFaces);
    for (let i = 0; i < this.numSphereFaces; i++) {
      rawNoise[i] = this.rng() * 2 - 1;
    }

    for (let pass = 0; pass < 3; pass++) {
      const smoothed = new Float32Array(this.numSphereFaces);
      for (let i = 0; i < this.numSphereFaces; i++) {
        const neighbors = this.sphere.neighbors[i];
        let sum = rawNoise[i];
        for (const n of neighbors) {
          sum += rawNoise[n];
        }
        smoothed[i] = sum / (neighbors.length + 1);
      }
      rawNoise.set(smoothed);
    }

    for (let i = 0; i < this.numSphereFaces; i++) {
      const isLand = this.elevations[i] >= 20;
      const amplitude = isLand ? noiseLevel * 8 : noiseLevel * 3;
      this.elevations[i] += rawNoise[i] * amplitude;
    }
  }

  // ============================================================
  // Post-projection grid-level enhancements
  // ============================================================

  // Add fractal noise near coastlines to create irregular, realistic edges
  // This pushes some coastal land below sea level (creating bays/inlets)
  // and some shallow ocean above sea level (creating peninsulas/headlands)
  private applyCoastalFractal(elevations: Float32Array): void {
    const seaLevel = 20;
    const perturbRange = 5; // BFS hops from coast to apply fractal noise

    // Find cells near coastline (both land and ocean side)
    const coastDist = new Int8Array(this.numGridCells).fill(-1);
    const queue: number[] = [];

    for (let i = 0; i < this.numGridCells; i++) {
      const isLand = elevations[i] >= seaLevel;
      for (const n of this.grid.cells.c[i]) {
        const nIsLand = elevations[n] >= seaLevel;
        if (isLand !== nIsLand) {
          if (coastDist[i] === -1) {
            coastDist[i] = 0;
            queue.push(i);
          }
          break;
        }
      }
    }

    let idx = 0;
    while (idx < queue.length) {
      const cell = queue[idx++];
      const d = coastDist[cell];
      if (d >= perturbRange) continue;
      for (const n of this.grid.cells.c[cell]) {
        if (coastDist[n] === -1) {
          coastDist[n] = d + 1;
          queue.push(n);
        }
      }
    }

    // Generate spatially coherent noise (smooth random values on grid)
    const noise = new Float32Array(this.numGridCells);
    for (let i = 0; i < this.numGridCells; i++) {
      noise[i] = this.rng() * 2 - 1;
    }
    // Smooth twice for spatial coherence (not too smooth — we want fractal detail)
    for (let pass = 0; pass < 2; pass++) {
      const smoothed = new Float32Array(this.numGridCells);
      for (let i = 0; i < this.numGridCells; i++) {
        const neighbors = this.grid.cells.c[i];
        let sum = noise[i];
        for (const n of neighbors) sum += noise[n];
        smoothed[i] = sum / (neighbors.length + 1);
      }
      noise.set(smoothed);
    }

    // Apply noise near coastlines — strongest right at the coast, fading inland/seaward
    for (let i = 0; i < this.numGridCells; i++) {
      if (coastDist[i] < 0 || coastDist[i] > perturbRange) continue;

      const t = coastDist[i] / perturbRange; // 0 at coast, 1 at edge of influence
      const strength = (1 - t * t) * 10; // quadratic falloff, max ±10 at coastline

      elevations[i] += noise[i] * strength;
    }
  }

  // ============================================================
  // Projection: sphere → flat grid (equirectangular)
  // ============================================================

  private projectAndFinalize(): TectonicResult {
    // Build spatial lookup for sphere faces: bin by (lon, lat)
    const faceLonLat = this.sphere.centroids.map(c => this.sphere.toLonLat(c));

    // For each grid cell, find the nearest sphere face and sample its elevation
    const gridWidth = this.grid.cellsX * this.grid.spacing;
    const gridHeight = this.grid.cellsY * this.grid.spacing;

    // Grid cell (x, y) → (lon, lat) via equirectangular projection
    // x: 0..gridWidth → lon: -π..π
    // y: 0..gridHeight → lat: π/2..-π/2 (top = north pole, bottom = south pole)
    const gridElevations = new Float32Array(this.numGridCells);
    const gridPlateIds = new Int8Array(this.numGridCells).fill(-1);

    // Build a bucketed spatial index for fast nearest-face lookup
    const lonBuckets = 72; // 5° per bucket
    const latBuckets = 36;
    const buckets: number[][] = new Array(lonBuckets * latBuckets).fill(null).map(() => []);

    for (let f = 0; f < this.numSphereFaces; f++) {
      const [lon, lat] = faceLonLat[f];
      const bLon = Math.floor(((lon + Math.PI) / (2 * Math.PI)) * lonBuckets) % lonBuckets;
      const bLat = minmax(Math.floor(((lat + Math.PI / 2) / Math.PI) * latBuckets), 0, latBuckets - 1);
      buckets[bLat * lonBuckets + bLon].push(f);
    }

    for (let gi = 0; gi < this.numGridCells; gi++) {
      const [gx, gy] = this.grid.points[gi];

      // Map grid position to lon/lat
      const lon = (gx / gridWidth) * 2 * Math.PI - Math.PI;
      const lat = (1 - gy / gridHeight) * Math.PI - Math.PI / 2;

      // Find nearest sphere face via bucket search
      const bLon = Math.floor(((lon + Math.PI) / (2 * Math.PI)) * lonBuckets) % lonBuckets;
      const bLat = minmax(Math.floor(((lat + Math.PI / 2) / Math.PI) * latBuckets), 0, latBuckets - 1);

      let bestFace = -1;
      let bestDist = Infinity;

      // Search nearby buckets (3x3 neighborhood)
      for (let dlat = -1; dlat <= 1; dlat++) {
        for (let dlon = -1; dlon <= 1; dlon++) {
          const bl = bLat + dlat;
          if (bl < 0 || bl >= latBuckets) continue;
          const bln = ((bLon + dlon) % lonBuckets + lonBuckets) % lonBuckets;
          const bucket = buckets[bl * lonBuckets + bln];

          for (const f of bucket) {
            const [fLon, fLat] = faceLonLat[f];
            // Angular distance with longitude wrapping
            let dLon = lon - fLon;
            if (dLon > Math.PI) dLon -= 2 * Math.PI;
            else if (dLon < -Math.PI) dLon += 2 * Math.PI;
            const dLat = lat - fLat;
            const dist = dLon * dLon + dLat * dLat;
            if (dist < bestDist) {
              bestDist = dist;
              bestFace = f;
            }
          }
        }
      }

      if (bestFace === -1) {
        // Fallback: brute force search (shouldn't happen with proper bucketing)
        for (let f = 0; f < this.numSphereFaces; f++) {
          const [fLon, fLat] = faceLonLat[f];
          let dLon = lon - fLon;
          if (dLon > Math.PI) dLon -= 2 * Math.PI;
          else if (dLon < -Math.PI) dLon += 2 * Math.PI;
          const dLat = lat - fLat;
          const dist = dLon * dLon + dLat * dLat;
          if (dist < bestDist) {
            bestDist = dist;
            bestFace = f;
          }
        }
      }

      gridElevations[gi] = this.elevations[bestFace];
      gridPlateIds[gi] = this.plateAssignment[bestFace];
    }

    // Light smoothing to remove pixelation from sphere→grid sampling
    // Only 1 pass with gentle blend to preserve peaks and valleys
    {
      const smoothed = new Float32Array(gridElevations);
      for (let i = 0; i < this.numGridCells; i++) {
        const neighbors = this.grid.cells.c[i];
        if (!neighbors || neighbors.length === 0) continue;
        let sum = 0;
        for (const n of neighbors) sum += gridElevations[n];
        smoothed[i] = gridElevations[i] * 0.8 + (sum / neighbors.length) * 0.2;
      }
      gridElevations.set(smoothed);
    }

    // Force top/bottom border cells to deep ocean (poles)
    // Left/right edges are the projection seam — they should match naturally
    const {cellsX, cellsY} = this.grid;
    for (let i = 0; i < this.numGridCells; i++) {
      if (!this.grid.cells.b[i]) continue;
      const row = Math.floor(i / cellsX);
      const isTopBottom = row === 0 || row === cellsY - 1;
      if (isTopBottom) {
        gridElevations[i] = Math.min(gridElevations[i], Math.floor(this.rng() * 6));
      }
    }

    // Ensure left/right edge cells have matching elevations (same longitude on sphere)
    for (let row = 0; row < cellsY; row++) {
      const leftCell = row * cellsX;
      const rightCell = row * cellsX + (cellsX - 1);
      const avg = (gridElevations[leftCell] + gridElevations[rightCell]) / 2;
      gridElevations[leftCell] = avg;
      gridElevations[rightCell] = avg;
    }

    // ---- Sea level adjustment ----
    // Shift elevations to control land/water balance
    // Positive seaLevel = more water, negative = more land
    const seaLevelShift = this.config.seaLevel;
    if (seaLevelShift !== 0) {
      for (let i = 0; i < this.numGridCells; i++) {
        gridElevations[i] -= seaLevelShift;
      }
    }

    // ---- Fractal coastline perturbation ----
    // Add noise near coastlines to create irregular, fractal-like edges
    this.applyCoastalFractal(gridElevations);

    // Clamp and quantize to final heightmap
    const heights = new Uint8Array(this.numGridCells);
    for (let i = 0; i < this.numGridCells; i++) {
      heights[i] = minmax(Math.round(gridElevations[i]), 0, 100);
    }

    // Compute metadata on the grid
    const roughness = new Float32Array(this.numGridCells);
    const boundaryType = new Int8Array(this.numGridCells);
    const isOceanicArr = new Uint8Array(this.numGridCells);

    // Detect grid-level boundaries by checking plate assignment changes
    const gridBoundaryFlags = new Uint8Array(this.numGridCells);
    const gridBoundaryConv = new Float32Array(this.numGridCells);

    for (let i = 0; i < this.numGridCells; i++) {
      const pid = gridPlateIds[i];
      if (pid >= 0) {
        isOceanicArr[i] = this.plates[pid].isOceanic ? 1 : 0;
      }
      for (const n of this.grid.cells.c[i]) {
        if (gridPlateIds[n] !== pid && gridPlateIds[n] >= 0 && pid >= 0) {
          gridBoundaryFlags[i] = 1;
          // Find the boundary convergence for this pair
          const a = Math.min(pid, gridPlateIds[n]);
          const b = Math.max(pid, gridPlateIds[n]);
          for (const boundary of this.boundaries) {
            if (boundary.plateA === a && boundary.plateB === b) {
              gridBoundaryConv[i] = boundary.convergence;
              break;
            }
          }
          break;
        }
      }
    }

    // BFS distance from boundaries for roughness
    const distFromBoundary = new Float32Array(this.numGridCells).fill(Infinity);
    const bfsQueue: number[] = [];

    for (let i = 0; i < this.numGridCells; i++) {
      if (gridBoundaryFlags[i]) {
        distFromBoundary[i] = 0;
        bfsQueue.push(i);
        const conv = gridBoundaryConv[i];
        if (conv > 0.3) boundaryType[i] = 1;
        else if (conv < -0.3) boundaryType[i] = -1;
        else boundaryType[i] = 2;
      }
    }

    let bfsIdx = 0;
    while (bfsIdx < bfsQueue.length) {
      const cell = bfsQueue[bfsIdx++];
      for (const n of this.grid.cells.c[cell]) {
        const newDist = distFromBoundary[cell] + 1;
        if (newDist < distFromBoundary[n]) {
          distFromBoundary[n] = newDist;
          bfsQueue.push(n);
        }
      }
    }

    const maxDecayDist = 10;
    for (let i = 0; i < this.numGridCells; i++) {
      if (distFromBoundary[i] === 0) {
        const absConv = Math.abs(gridBoundaryConv[i]);
        roughness[i] = minmax(0.5 + absConv * 0.5, 0.1, 1.0);
      } else if (distFromBoundary[i] < maxDecayDist) {
        const factor = 1.0 - distFromBoundary[i] / maxDecayDist;
        roughness[i] = 0.1 + factor * 0.5;
      } else {
        roughness[i] = 0.1 + this.rng() * 0.1;
      }
    }

    const metadata: TectonicMetadata = {
      plateIds: new Uint8Array(gridPlateIds.buffer.slice(0)),
      boundaryType,
      roughness,
      isOceanic: isOceanicArr,
      plates: this.plates,
      boundaries: this.boundaries
    };

    this.logDiagnostics(heights);

    return {heights, metadata};
  }

  private logDiagnostics(heights: Uint8Array): void {
    const n = heights.length;

    // Basic stats
    let min = 100, max = 0, sum = 0;
    const histogram = new Array(10).fill(0); // 10 buckets of 10
    let waterCount = 0, landCount = 0;

    for (let i = 0; i < n; i++) {
      const h = heights[i];
      if (h < min) min = h;
      if (h > max) max = h;
      sum += h;
      histogram[Math.min(Math.floor(h / 10), 9)]++;
      if (h < 20) waterCount++;
      else landCount++;
    }

    // Sphere-level stats (pre-projection)
    let sphereMin = Infinity, sphereMax = -Infinity;
    for (let i = 0; i < this.numSphereFaces; i++) {
      if (this.elevations[i] < sphereMin) sphereMin = this.elevations[i];
      if (this.elevations[i] > sphereMax) sphereMax = this.elevations[i];
    }

    // Plate breakdown
    const plateStats: string[] = [];
    for (const plate of this.plates) {
      const type = plate.isOceanic ? "oceanic" : "continental";
      plateStats.push(`  Plate ${plate.id}: ${type}, ${plate.cells.size} faces, base=${plate.baseElevation.toFixed(1)}`);
    }

    // Boundary breakdown
    const boundaryStats: string[] = [];
    const subtypeCounts: Record<string, number> = {};
    for (const b of this.boundaries) {
      subtypeCounts[b.subtype] = (subtypeCounts[b.subtype] || 0) + 1;
    }
    for (const [subtype, count] of Object.entries(subtypeCounts)) {
      boundaryStats.push(`  ${subtype}: ${count} boundaries`);
    }

    console.log(`
╔══════════════════════════════════════════════════════╗
║         TECTONIC HEIGHTMAP DIAGNOSTICS               ║
╠══════════════════════════════════════════════════════╣
║ SPHERE                                               ║
║   Faces: ${this.numSphereFaces.toString().padEnd(43)}║
║   Elevation range: ${sphereMin.toFixed(1)} — ${sphereMax.toFixed(1)}${" ".repeat(Math.max(0, 30 - `${sphereMin.toFixed(1)} — ${sphereMax.toFixed(1)}`.length))}║
║                                                      ║
║ GRID OUTPUT (0-100 scale, sea level = 20)            ║
║   Cells: ${n.toString().padEnd(43)}║
║   Height range: ${min} — ${max}${" ".repeat(Math.max(0, 35 - `${min} — ${max}`.length))}║
║   Mean height: ${(sum / n).toFixed(1).padEnd(37)}║
║   Water cells: ${waterCount} (${(waterCount / n * 100).toFixed(1)}%)${" ".repeat(Math.max(0, 30 - `${waterCount} (${(waterCount / n * 100).toFixed(1)}%)`.length))}║
║   Land cells:  ${landCount} (${(landCount / n * 100).toFixed(1)}%)${" ".repeat(Math.max(0, 30 - `${landCount} (${(landCount / n * 100).toFixed(1)}%)`.length))}║
║                                                      ║
║ HEIGHT DISTRIBUTION                                  ║
║   0-9:   ${histogram[0].toString().padStart(6)} ${"█".repeat(Math.round(histogram[0] / n * 50)).padEnd(30)}║
║   10-19: ${histogram[1].toString().padStart(6)} ${"█".repeat(Math.round(histogram[1] / n * 50)).padEnd(30)}║
║   20-29: ${histogram[2].toString().padStart(6)} ${"█".repeat(Math.round(histogram[2] / n * 50)).padEnd(30)}║
║   30-39: ${histogram[3].toString().padStart(6)} ${"█".repeat(Math.round(histogram[3] / n * 50)).padEnd(30)}║
║   40-49: ${histogram[4].toString().padStart(6)} ${"█".repeat(Math.round(histogram[4] / n * 50)).padEnd(30)}║
║   50-59: ${histogram[5].toString().padStart(6)} ${"█".repeat(Math.round(histogram[5] / n * 50)).padEnd(30)}║
║   60-69: ${histogram[6].toString().padStart(6)} ${"█".repeat(Math.round(histogram[6] / n * 50)).padEnd(30)}║
║   70-79: ${histogram[7].toString().padStart(6)} ${"█".repeat(Math.round(histogram[7] / n * 50)).padEnd(30)}║
║   80-89: ${histogram[8].toString().padStart(6)} ${"█".repeat(Math.round(histogram[8] / n * 50)).padEnd(30)}║
║   90-100:${histogram[9].toString().padStart(6)} ${"█".repeat(Math.round(histogram[9] / n * 50)).padEnd(30)}║
║                                                      ║
║ PLATES (${this.plates.length})                                          ║
${plateStats.map(s => `║${s.padEnd(54)}║`).join("\n")}
║                                                      ║
║ BOUNDARIES                                           ║
${boundaryStats.map(s => `║${s.padEnd(54)}║`).join("\n")}
╚══════════════════════════════════════════════════════╝
`);
  }

  // ---- Vector math utilities ----

  private normalize3(v: [number, number, number]): [number, number, number] {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    if (len === 0) return [0, 1, 0];
    return [v[0] / len, v[1] / len, v[2] / len];
  }

  private cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }

  private length3(v: [number, number, number]): number {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  }
}
