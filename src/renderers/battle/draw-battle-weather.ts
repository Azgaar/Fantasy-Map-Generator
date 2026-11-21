// Rain, snow, fog and heat over the battle plan: a WebGL layer of the screen only, drawn every frame while there is weather to show

import { curveBasisClosed, line } from "d3";
import { type Battlefield, Battlefields } from "@/model/political/battle/battlefield";
import type { Weather } from "@/model/political/battle/weather";

const RAIN: Record<Weather, number> = { clear: 0, rain: 0.5, downpour: 1, snow: 0, fog: 0 };
const MAX_PIXEL_RATIO = 1.5; // finer is not seen through rain

const VERTEX = `attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

// rain falls in three depths of thin streaks, slanted by the wind, with faint splashes on the ground and a cool veil;
// fog is slow banks of warped noise, thicker towards the edges of the view
const FRAGMENT = /* glsl */ `precision mediump float;
uniform vec2 size;
uniform float time;
uniform float rain;
uniform float snow;
uniform float fog;
uniform float heat;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

// a column of drops: each cell holds a streak or not, of its own length and place; widths in pixels
float streaks(vec2 uv, float columns, float speed, float density, float slant) {
  uv.x += uv.y * slant;
  float column = floor(uv.x * columns);
  float fall = (uv.y - time * speed * (0.85 + 0.3 * hash(vec2(column, 1.0)))) * columns * 0.06;
  vec2 id = vec2(column, floor(fall));
  if (hash(id) > density) return 0.0;
  float along = fract(fall);
  float tail = 0.15 + 0.3 * hash(id + 3.1);
  float across = abs(fract(uv.x * columns) - 0.5 - (hash(id + 7.7) - 0.5) * 0.6) * size.y / columns;
  return smoothstep(1.1, 0.2, across) * smoothstep(0.0, tail, along) * step(along, tail) * (0.5 + 0.5 * hash(id + 1.3));
}

// a ring that widens and fades where a drop hit the ground
float splashes(vec2 uv, float cells, float density) {
  vec2 g = uv * cells;
  vec2 id = floor(g);
  float seed = hash(id);
  if (seed > density) return 0.0;
  float phase = fract(time * 1.4 + seed * 13.0);
  vec2 centre = vec2(hash(id + 2.3), hash(id + 5.9)) * 0.6 + 0.2;
  vec2 d = (fract(g) - centre) * vec2(1.0, 1.8);
  float ring = abs(length(d) - phase * 0.3) * size.y / cells;
  return smoothstep(0.9, 0.0, ring) * (1.0 - phase);
}

// flakes drifting down and swaying, a few pixels across: the flake, and a soft rim that shows it on pale ground
vec2 flakes(vec2 uv, float cells, float speed, float pixels) {
  vec2 g = uv * cells;
  g.y -= time * speed * cells;
  g.x += sin(time * 0.7 + floor(g.y) * 1.7) * 0.3;
  vec2 id = floor(g);
  if (hash(id + 9.1) > 0.22) return vec2(0.0);
  vec2 offset = vec2(hash(id), hash(id + 4.2)) - 0.5;
  float d = length(fract(g) - 0.5 - offset * 0.5) * size.y / cells;
  float r = pixels * (0.6 + 0.8 * hash(id + 1.7));
  return vec2(smoothstep(r, r * 0.4, d), smoothstep(r + 1.5, r, d));
}

vec4 over(vec4 top, vec4 under) { return top + under * (1.0 - top.a); }

void main() {
  vec2 uv = vec2(gl_FragCoord.x, size.y - gl_FragCoord.y) / size.y;
  vec2 screen = gl_FragCoord.xy / size;
  float edge = length(screen - 0.5) * 1.4; // 0 in the middle, about 1 in the corners
  vec4 color = vec4(0.0);
  if (rain > 0.0) {
    float veil = (0.01 + 0.03 * rain) * (0.6 + 0.8 * edge);
    color = vec4(vec3(0.42, 0.48, 0.56) * veil, veil);
    float far = streaks(uv + 1.7, 160.0, 0.45, 0.02 + 0.05 * rain, 0.16) * 0.2;
    float mid = streaks(uv + 4.3, 95.0, 0.65, 0.015 + 0.04 * rain, 0.18) * 0.28;
    float near = streaks(uv + 8.9, 55.0, 0.9, 0.008 + 0.025 * rain, 0.2) * 0.35;
    float splash = splashes(uv, 22.0, 0.15 + 0.3 * rain) * 0.15;
    float a = clamp(far + mid + near + splash, 0.0, 1.0) * (0.4 + 0.35 * rain);
    color = over(vec4(vec3(0.46, 0.54, 0.63) * a, a), color);
  }
  if (snow > 0.0) {
    float veil = 0.03 + 0.03 * edge;
    color = over(vec4(vec3(0.97, 0.98, 1.0) * veil, veil), color);
    vec2 far = flakes(uv + 2.3, 34.0, 0.05, 1.0);
    vec2 near = flakes(uv + 6.1, 16.0, 0.08, 1.8);
    float rim = max(far.y * 0.4, near.y) * 0.14;
    float flake = max(far.x * 0.6, near.x) * 0.85;
    color = over(vec4(vec3(0.5, 0.56, 0.64) * rim, rim), color);
    color = over(vec4(vec3(1.0) * flake, flake), color);
  }
  if (heat > 0.0) {
    // a warm haze that shimmers slowly, heavier towards the edges of the view
    float shimmer = fbm(uv * 3.0 + vec2(0.0, time * 0.15)) * 0.5 + fbm(uv * 7.0 - vec2(time * 0.05, time * 0.3)) * 0.5;
    float a = (0.025 + 0.035 * shimmer + 0.05 * edge) * heat;
    color = over(vec4(vec3(1.0, 0.82, 0.52) * a, a), color);
  }
  if (fog > 0.0) {
    // banks roll with the wind and change shape as they go; thin wisps stream faster over them
    vec2 drift = vec2(time * 0.035, time * 0.012);
    vec2 warp = vec2(fbm(uv * 1.6 + drift + time * 0.02), fbm(uv * 1.6 - drift.yx + 4.2 - time * 0.015));
    float banks = fbm(uv * 2.2 + warp * 1.6 + drift);
    float wisps = fbm(uv * 5.0 + warp - drift * 2.5);
    float swell = 0.04 * sin(time * 0.35); // the fog thickens and thins
    float a = clamp(0.05 + 0.3 * smoothstep(0.38 - swell, 0.8, banks) + 0.1 * wisps + 0.16 * edge, 0.0, 0.55) * fog;
    color = over(vec4(vec3(0.95, 0.96, 0.96) * a, a), color);
  }
  gl_FragColor = color;
}`;

const SKY = ["rain", "snow", "fog", "heat"] as const;
type SkyShares = Record<(typeof SKY)[number], number>; // how much of each there is to show, 0 to 1

interface Layer {
  gl: WebGLRenderingContext;
  uniforms: Record<"size" | "time" | (typeof SKY)[number], WebGLUniformLocation | null>;
  sky: SkyShares;
  running: boolean; // a frame is asked for: one loop a canvas
}

const PUDDLES = 0.15; // share of the open level nodes holding a puddle where the ground is wettest
const PATCH = 9; // nodes across a wet patch
const LEVEL = 0.06; // grade past which water runs off
const BLOTCH = 3; // nodes between the blotches of darker wet earth

const blob = line().curve(curveBasisClosed);

class BattleWeatherRenderer {
  private readonly layers = new WeakMap<HTMLCanvasElement, Layer | null>();

  private isEmpty(sky: SkyShares): boolean {
    return SKY.every(name => !sky[name]);
  }

  /** Show the weather on the canvas, or hide it; the canvas keeps the size of its box */
  draw(canvas: HTMLCanvasElement, weather: Weather, heat: boolean, shown: boolean): void {
    const sky: SkyShares = {
      rain: shown ? RAIN[weather] : 0,
      snow: +(shown && weather === "snow"),
      fog: +(shown && weather === "fog"),
      heat: +(shown && heat)
    };
    canvas.hidden = this.isEmpty(sky);
    if (canvas.hidden && !this.layers.has(canvas)) return; // clear skies take no WebGL context
    const layer = this.getLayer(canvas);
    if (!layer) return;
    layer.sky = sky;
    if (layer.running || canvas.hidden) return;
    layer.running = true;
    requestAnimationFrame(time => this.render(canvas, layer, time));
  }

  /** Give the canvas's WebGL context back: browsers keep only a few */
  release(canvas: HTMLCanvasElement): void {
    this.layers.get(canvas)?.gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.layers.delete(canvas);
  }

  private getLayer(canvas: HTMLCanvasElement): Layer | null {
    if (this.layers.has(canvas)) return this.layers.get(canvas)!;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, antialias: false });
    const program = gl && this.compile(gl);
    const layer = gl && program ? this.createLayer(gl, program) : null; // no WebGL: no weather to see
    if (gl && !layer) gl.getExtension("WEBGL_lose_context")?.loseContext(); // not kept for nothing
    this.layers.set(canvas, layer);
    return layer;
  }

  private createLayer(gl: WebGLRenderingContext, program: WebGLProgram): Layer {
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // a triangle over the screen
    const position = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const uniforms = Object.fromEntries(
      ["size", "time", ...SKY].map(name => [name, uniform(name)])
    ) as Layer["uniforms"];
    return { gl, uniforms, sky: { rain: 0, snow: 0, fog: 0, heat: 0 }, running: false };
  }

  private compile(gl: WebGLRenderingContext): WebGLProgram | null {
    const program = gl.createProgram()!;
    for (const [type, source] of [
      [gl.VERTEX_SHADER, VERTEX],
      [gl.FRAGMENT_SHADER, FRAGMENT]
    ] as const) {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
  }

  /** A frame, and the next one while the canvas is on the screen and there is weather to show */
  private render(canvas: HTMLCanvasElement, layer: Layer, time: number): void {
    if (!canvas.isConnected || this.isEmpty(layer.sky)) {
      layer.running = false;
      return;
    }
    const { gl, uniforms } = layer;
    const ratio = Math.min(devicePixelRatio, MAX_PIXEL_RATIO);
    const [width, height] = [Math.round(canvas.clientWidth * ratio), Math.round(canvas.clientHeight * ratio)];
    if (canvas.width !== width || canvas.height !== height) Object.assign(canvas, { width, height });
    gl.viewport(0, 0, width, height);
    gl.uniform2f(uniforms.size, width, height);
    gl.uniform1f(uniforms.time, time / 1000);
    for (const name of SKY) gl.uniform1f(uniforms[name], layer.sky[name]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(next => this.render(canvas, layer, next));
  }

  /**
   * Soaked ground: blotches of darker wet earth where the ground lies wet, puddles in them on the open level field,
   * each a halo of wet earth, the water and a glint along it. Placed by the node, so the same field is always soaked alike
   */
  getMudMarkup(field: Battlefield): string {
    const { cell, cols, rows } = field;
    const [wide, narrow, halos, waters, glints]: string[][] = [[], [], [], [], []];
    for (let node = 0; node < cols * rows; node++) {
      if (field.water[node] || field.burg[node] || field.walled[node]) continue;
      const [col, row] = [node % cols, Math.floor(node / cols)];
      const patch = this.smooth(this.patchNoise(col, row), 0.45, 0.85);
      const [cx, cy] = Battlefields.nodeCentre(field, node);
      if (patch && col % BLOTCH === row % 2 && row % BLOTCH === 0) {
        wide.push(this.lobes(cx, cy, cell * (1.6 + 1.2 * this.random(node + 0.7)), node, 0.7));
        narrow.push(this.lobes(cx, cy, cell * (0.8 + 0.8 * this.random(node + 0.8)) * patch, node + 0.5, 0.7));
      }
      if (field.wood[node] || this.random(node) > PUDDLES * patch * (0.6 + 0.8 * (1 - field.elevation[node]))) continue;
      const [x, y] = [cx + (this.random(node + 0.1) - 0.5) * cell, cy + (this.random(node + 0.2) - 0.5) * cell];
      if (Battlefields.getGrade(field, x, y) > LEVEL) continue;
      const radius = cell * (0.3 + 0.55 * this.random(node + 0.3));
      halos.push(this.lobes(x, y, radius * 1.25, node, 0.55));
      waters.push(this.lobes(x, y, radius, node, 0.55));
      glints.push(this.lobes(x, y - radius * 0.2, radius * 0.45, node, 0.15, false));
    }
    return /* html */ `<path d="${wide.join("")}" fill="#5e4630" fill-opacity="0.035"/>
      <path d="${narrow.join("")}" fill="#5e4630" fill-opacity="0.04"/>
      <path d="${halos.join("")}" fill="#6f5232" fill-opacity="0.08"/>
      <path d="${waters.join("")}" fill="#9db2bd" fill-opacity="0.35"/>
      <path d="${glints.join("")}" fill="#f2f7f9" fill-opacity="0.4"/>`;
  }

  /** A lobed outline about a point: an ellipse bent by two waves round it, turned by the seed */
  private lobes(x: number, y: number, radius: number, seed: number, aspect: number, bent = true): string {
    const [turn, a, b] = [
      this.random(seed + 0.4) * Math.PI,
      this.random(seed + 0.5) * 6.3,
      this.random(seed + 0.6) * 6.3
    ];
    const [cos, sin] = [Math.cos(turn), Math.sin(turn)];
    const points = Array.from({ length: 12 }, (_, i): [number, number] => {
      const angle = (i / 12) * Math.PI * 2;
      const r = radius * (bent ? 1 + 0.22 * Math.sin(2 * angle + a) + 0.12 * Math.sin(3 * angle + b) : 1);
      const [u, v] = [Math.cos(angle) * r, Math.sin(angle) * r * aspect];
      return [x + u * cos - v * sin, y + u * sin + v * cos];
    });
    return blob(points)!;
  }

  /** How wet the ground lies about a node: value noise over patches of a few nodes */
  private patchNoise(col: number, row: number): number {
    const [x, y] = [col / PATCH, row / PATCH];
    const [ix, iy] = [Math.floor(x), Math.floor(y)];
    const [fx, fy] = [this.smooth(x - ix, 0, 1), this.smooth(y - iy, 0, 1)];
    const at = (i: number, j: number): number => this.random(1e5 + (iy + j) * 1000 + ix + i);
    const top = at(0, 0) + (at(1, 0) - at(0, 0)) * fx;
    return top + (at(0, 1) + (at(1, 1) - at(0, 1)) * fx - top) * fy;
  }

  private smooth(value: number, from: number, to: number): number {
    const t = Math.min(Math.max((value - from) / (to - from), 0), 1);
    return t * t * (3 - 2 * t);
  }

  /** A number in [0, 1) that is always the same for the same seed */
  private random(seed: number): number {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }
}

export const BattleWeatherView = new BattleWeatherRenderer();
