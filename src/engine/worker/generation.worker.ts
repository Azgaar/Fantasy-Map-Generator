import Alea from "alea";
import type { WorkerInitMessage } from "../types";

// Simple interpolated noise
class Noise {
  private prng: any;
  private map: Float32Array;
  private size: number;

  constructor(seed: string, size: number = 256) {
    this.prng = Alea(seed);
    this.size = size;
    this.map = new Float32Array(size * size);
    for (let i = 0; i < this.map.length; i++) {
      this.map[i] = this.prng();
    }
  }

  get(x: number, y: number): number {
    // Wrap coordinates
    const X = Math.floor(x) & (this.size - 1);
    const Y = Math.floor(y) & (this.size - 1);

    // Relative x, y in the cell
    const rx = x - Math.floor(x);
    const ry = y - Math.floor(y);

    // Smoothstep
    const sx = rx * rx * (3 - 2 * rx);
    const sy = ry * ry * (3 - 2 * ry);

    // Neighbors
    const n00 = this.map[X + Y * this.size];
    const n10 = this.map[((X + 1) & (this.size - 1)) + Y * this.size];
    const n01 = this.map[X + ((Y + 1) & (this.size - 1)) * this.size];
    const n11 =
      this.map[
        ((X + 1) & (this.size - 1)) + ((Y + 1) & (this.size - 1)) * this.size
      ];

    // Interpolate
    const lx0 = n00 + sx * (n10 - n00);
    const lx1 = n01 + sx * (n11 - n01);

    return lx0 + sy * (lx1 - lx0);
  }

  // Fractal Brownian Motion
  fbm(x: number, y: number, octaves: number): number {
    let val = 0;
    let amp = 0.5;
    let freq = 1;
    let max = 0;

    for (let i = 0; i < octaves; i++) {
      val += this.get(x * freq, y * freq) * amp;
      max += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return val / max; // Normalize
  }
}

self.onmessage = (e: MessageEvent<WorkerInitMessage>) => {
  const { type } = e.data;
  if (type === "init") {
    const { buffer, width, height, seed } = e.data;
    const view = new Uint8ClampedArray(buffer); // RGBA format
    const noise = new Noise(seed);

    console.log(`Worker: Generating ${width}x${height} map with seed ${seed}`);

    // Simple generation loop
    // TODO: Optimize this or chunk it if it blocks too long, but in a worker it's fine.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;

        // Scale coordinates for noise
        const nx = (x / width) * 4; // 4 periods across the map
        const ny = (y / height) * 4;

        const h = noise.fbm(nx, ny, 6); // Height (Red)
        const m = noise.fbm(nx + 17.1, ny + 31.4, 6); // Moisture (Green) - random offset

        view[i] = Math.floor(h * 255); // R: Height
        view[i + 1] = Math.floor(m * 255); // G: Moisture
        view[i + 2] = 0; // B: Biome ID (placeholder)
        view[i + 3] = 255; // A: Alpha
      }
    }

    self.postMessage({ type: "complete" });
  }
};
