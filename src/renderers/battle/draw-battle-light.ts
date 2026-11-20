// The light over a battle: the ground shaded by the sun of the hour and the sky of the weather, with the shadows of the
// heights, and the whole plan tinted by the time of day. The shade is baked by WebGL into an image the scene and its
// exports carry; without WebGL2 the relief keeps its own soft shadow. See docs/domain/battles.md#time

import type { Battle } from "@/model/political/battle/battle";
import type { Battlefield } from "@/model/political/battle/battlefield";
import { BattleTime } from "@/model/political/battle/time";
import type { Weather } from "@/model/political/battle/weather";
import { BattleReliefView, type Surface } from "@/renderers/battle/draw-battle-relief";

type Color = [number, number, number];

// how much of the sun the sky hides: none of it is direct light under a full cloud
const OVERCAST: Record<Weather, number> = { clear: 0, rain: 0.75, downpour: 0.95, snow: 0.85, fog: 0.9 };
const DAY: Color = [1, 1, 1];
const NIGHT: Color = [0.4, 0.45, 0.6];
const GREY: Color = [0.93, 0.94, 0.96]; // a full cloud dulls the day
const GOLD: Color = [1, 0.88, 0.74]; // the low sun
const ROSE: Color = [1, 0.86, 0.92]; // the glow of the sky while the sun is below the horizon
const SHADOW: Color = [0.5, 0.56, 0.7]; // the darkest shade: lit by the blue sky alone
const DARKEST = 0.5; // share of the way to it the darkest shade goes at full strength
const GOLDEN = 0.26; // radians: under this the sun is low and golden
const NIGHT_RELIEF = 0.6; // the relief shows fainter by the sky's light alone
const SHADOW_HEIGHT = 3; // the heights cast shadows steepened by no more than this
const RESOLUTION = 2; // pixels of the shade a sample of the surface
// the glow of a battalion's torches at night from its middle out, as gradient stops: a soft lift of the dark, faintly warm, gentle where many overlap
export const LAMP = {
  stops: [
    [0, "#fff3df", 0.3],
    [0.35, "#ffefd6", 0.2],
    [0.7, "#ffefd6", 0.07],
    [1, "#ffefd6", 0]
  ] as [number, string, number][]
};
const QUALITY = 0.85; // of the JPEG the shade is kept in

export interface Lighting {
  time: number; // of day, hours
  sky: string; // all else the shade depends on: the same for the same sky
  tint: Color; // the whole ground is multiplied by
  sun: [number, number, number]; // towards the sun, east, south, up
  direct: number; // share of the light from the sun, 0 to 1
  relief: number; // how strongly the relief shows, 0 to 1
}

const VERTEX = `#version 300 es
in vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

// the surface holds metres above the lowest point and the slopes east and south, read on each side of a cliff
const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D surface;
uniform vec2 size; // of the image, pixels
uniform vec2 extent; // of the field, metres
uniform vec3 sun;
uniform float direct;
uniform float exaggeration; // of the slopes
uniform float rise; // of the heights casting shadows
uniform float strength;
uniform vec3 shadow;
out vec4 color;

const vec3 SKY = vec3(-0.5, -0.5, 0.70710678); // the cartographer's light from the north-west, high
const int MARCH = 72;

void main() {
  vec2 uv = vec2(gl_FragCoord.x / size.x, 1.0 - gl_FragCoord.y / size.y);
  vec4 here = texture(surface, uv);
  vec3 normal = normalize(vec3(-here.y * exaggeration, -here.z * exaggeration, 1.0));

  // the shadow: marched over the surface towards the sun, softened by how near the ray passes over the ground
  float lit = 1.0;
  if (direct > 0.0) {
    vec2 toward = normalize(sun.xy);
    float climb = sun.z / length(sun.xy); // metres up for a metre along
    float texel = extent.x / float(textureSize(surface, 0).x);
    float start = here.x * rise;
    for (int i = 1; i <= MARCH; i++) {
      float along = texel * float(i) * (1.0 + float(i) / 24.0);
      vec2 at = uv + toward * along / extent;
      if (at.x < 0.0 || at.y < 0.0 || at.x > 1.0 || at.y > 1.0) break;
      float clearance = start + along * climb - texture(surface, at).x * rise;
      lit = min(lit, clamp(8.0 * clearance / along, 0.0, 1.0));
      if (lit <= 0.0) break;
    }
  }

  float ambient = 0.25 + 0.75 * (1.0 - direct);
  float level = direct * sun.z + ambient * SKY.z; // what level ground gets: it keeps its colour
  float shaded = direct * max(dot(normal, sun), 0.0) * lit + ambient * max(dot(normal, SKY), 0.0);
  float darkness = (1.0 - clamp(shaded / level, 0.0, 1.0)) * strength;
  color = vec4(mix(vec3(1.0), shadow, darkness), 1.0);
}`;

interface Baker {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  texture: WebGLTexture;
}

class BattleLightRenderer {
  private baker: Baker | null | undefined; // undefined: not tried yet
  private readonly surfaces = new WeakMap<Battlefield, ReturnType<typeof BattleReliefView.getLitSurface>>();

  /** Whether the shade can be baked here: else the relief draws its own */
  isSupported(): boolean {
    return Boolean(this.getBaker());
  }

  /** The light at the battle's moment; off, the plain light of a cartographer's plan: the sky's from the north-west */
  getLighting(battle: Pick<Battle, "hour" | "tick" | "latitude" | "weather">, on = true): Lighting {
    if (!on) return { time: 12, sky: "off", tint: DAY, sun: [0, 0, 1], direct: 0, relief: 1 };
    const time = BattleTime.getTime(battle.hour, battle.tick);
    const daylight = BattleTime.getDaylight(time);
    const { azimuth, altitude } = BattleTime.getSun(time, battle.latitude);
    const overcast = OVERCAST[battle.weather];
    const up = Math.max(altitude, 0);
    const direct = (1 - overcast) * Math.min(up / 0.05, 1);
    // golden while the sun is low, rosy in the glow of dusk and dawn; dulled by cloud
    const set = altitude <= 0;
    const glow = set ? Math.sqrt(daylight) : 1 - Math.min(up / GOLDEN, 1);
    const hue = set ? this.mix(ROSE, GOLD, daylight ** 4) : GOLD;
    const base = this.mix(NIGHT, this.mix(DAY, GREY, overcast), daylight);
    const tint = this.mix(base, this.multiply(base, hue), glow * (1 - overcast));
    return {
      time,
      sky: `${Math.round(battle.latitude)}|${battle.weather}`,
      tint,
      sun: [Math.cos(altitude) * Math.sin(azimuth), -Math.cos(altitude) * Math.cos(azimuth), Math.sin(altitude)],
      direct,
      relief: NIGHT_RELIEF + (1 - NIGHT_RELIEF) * daylight
    };
  }

  /** How much a battalion's light shows: none by day, all at night, growing through dusk */
  getNight(battle: Pick<Battle, "hour" | "tick">, on = true): number {
    return on ? 1 - BattleTime.getDaylight(BattleTime.getTime(battle.hour, battle.tick)) : 0;
  }

  /** The ground's shade under this light: an image and its size in metres; null where it cannot be baked */
  bake(field: Battlefield, lighting: Lighting): { href: string; width: number; height: number } | null {
    const baker = this.getBaker();
    if (!baker || !field.relief) return null;
    if (!this.surfaces.has(field)) this.surfaces.set(field, BattleReliefView.getLitSurface(field));
    const { surface, exaggeration, strength } = this.surfaces.get(field)!;
    const { gl, program, texture } = baker;
    const canvas = gl.canvas as HTMLCanvasElement;
    [canvas.width, canvas.height] = [surface.cols * RESOLUTION, surface.rows * RESOLUTION];
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, surface.cols, surface.rows, 0, gl.RGBA, gl.FLOAT, this.pack(surface));
    const uniform = (name: string) => gl.getUniformLocation(program, name);
    gl.uniform2f(uniform("size"), canvas.width, canvas.height);
    gl.uniform2f(uniform("extent"), surface.cols * surface.step, surface.rows * surface.step);
    gl.uniform3f(uniform("sun"), ...lighting.sun);
    gl.uniform1f(uniform("direct"), lighting.direct);
    gl.uniform1f(uniform("exaggeration"), exaggeration);
    gl.uniform1f(uniform("rise"), Math.min(exaggeration, SHADOW_HEIGHT));
    gl.uniform1f(uniform("strength"), strength * DARKEST * lighting.relief);
    gl.uniform3f(uniform("shadow"), ...SHADOW);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const href = canvas.toDataURL("image/jpeg", QUALITY);
    return { href, width: surface.cols * surface.step, height: surface.rows * surface.step };
  }

  /** The tint as a CSS colour */
  toColor([r, g, b]: Color): string {
    return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;
  }

  // heights and slopes, four to a sample
  private pack({ z, gx, gy }: Surface): Float32Array {
    const data = new Float32Array(z.length * 4);
    for (let i = 0; i < z.length; i++) data.set([z[i], gx[i], gy[i], 0], i * 4);
    return data;
  }

  private getBaker(): Baker | null {
    if (this.baker !== undefined && !this.baker?.gl.isContextLost()) return this.baker; // a lost context is made anew
    const canvas = typeof document === "undefined" ? null : document.createElement("canvas");
    const gl = canvas?.getContext?.("webgl2", { preserveDrawingBuffer: true, antialias: false }) ?? null;
    const program = gl && this.compile(gl);
    this.baker = gl && program ? this.createBaker(gl, program) : null;
    return this.baker;
  }

  private createBaker(gl: WebGL2RenderingContext, program: WebGLProgram): Baker {
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // a triangle over the image
    const position = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(program, "surface"), 0);
    return { gl, program, texture };
  }

  private compile(gl: WebGL2RenderingContext): WebGLProgram | null {
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

  private mix(a: Color, b: Color, t: number): Color {
    return a.map((value, i) => value + (b[i] - value) * t) as Color;
  }

  private multiply(a: Color, b: Color): Color {
    return a.map((value, i) => value * b[i]) as Color;
  }
}

export const BattleLightView = new BattleLightRenderer();
