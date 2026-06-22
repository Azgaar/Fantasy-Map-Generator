import { color as parseColor } from "d3";
import type * as THREEType from "three";
import { type ErosionBakeResult, heightAt } from "./erosion-bake";

let renderTarget: THREEType.WebGLRenderTarget | null = null;

// biome id -> satellite albedo and vegetation density
const BIOME_SATELLITE: Array<{ color: [number, number, number]; density: number }> = [
  { color: [0.24, 0.58, 0.71], density: 0 }, // 0 Marine (only near data edges)
  { color: [0.89, 0.78, 0.57], density: 0.02 }, // 1 Hot desert
  { color: [0.75, 0.68, 0.54], density: 0.05 }, // 2 Cold desert
  { color: [0.62, 0.61, 0.34], density: 0.35 }, // 3 Savanna
  { color: [0.45, 0.59, 0.25], density: 0.45 }, // 4 Grassland
  { color: [0.25, 0.48, 0.18], density: 0.85 }, // 5 Tropical seasonal forest
  { color: [0.17, 0.4, 0.15], density: 0.9 }, // 6 Temperate deciduous forest
  { color: [0.11, 0.36, 0.13], density: 1 }, // 7 Tropical rainforest
  { color: [0.13, 0.38, 0.15], density: 1 }, // 8 Temperate rainforest
  { color: [0.15, 0.3, 0.18], density: 0.85 }, // 9 Taiga
  { color: [0.6, 0.57, 0.46], density: 0.12 }, // 10 Tundra
  { color: [0.93, 0.95, 0.97], density: 0 }, // 11 Glacier
  { color: [0.26, 0.4, 0.23], density: 0.65 } // 12 Wetland
];

export function getSatelliteBiomeData(biomeId: number, fallbackBiomeId: number) {
  const fallback = BIOME_SATELLITE[fallbackBiomeId] || BIOME_SATELLITE[0];
  const builtIn = BIOME_SATELLITE[biomeId];
  if (builtIn) return builtIn;

  const customColor = parseColor(biomesData.color[biomeId])?.rgb();
  if (!customColor) return fallback;

  return {
    color: [customColor.r / 255, customColor.g / 255, customColor.b / 255] as [number, number, number],
    density: fallback.density
  };
}

// R: temperature °C packed as t + 128
// G: moisture (precipitation) capped at 30
// B: grid height 0-100
function buildClimateTexture() {
  const { cellsX, cellsY } = grid;
  const { temp, prec, h, c: neighbors } = grid.cells;
  const n = temp.length;

  // grid depths are noisy cell-to-cell; smoothing passes over water cells
  let bathy = Float32Array.from(h);
  for (let pass = 0; pass < 3; pass++) {
    const next = Float32Array.from(bathy);
    for (let i = 0; i < n; i++) {
      if (h[i] >= 20) continue;
      let sum = bathy[i];
      let count = 1;
      for (const c of neighbors[i]) {
        if (h[c] < 20) {
          sum += bathy[c];
          count++;
        }
      }
      next[i] = sum / count;
    }
    bathy = next;
  }

  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    data[i * 4] = Math.max(0, Math.min(255, temp[i] + 128));
    data[i * 4 + 1] = Math.min(prec[i] / 30, 1) * 255;
    data[i * 4 + 2] = Math.min(h[i] >= 20 ? h[i] : bathy[i], 100) * 2.55;
    data[i * 4 + 3] = 255;
  }

  const texture = new THREE.DataTexture(data, cellsX, cellsY, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

// RGB: satellite albedo of the cell's biome
function buildBiomeTexture() {
  const { cellsX, cellsY } = grid;
  const { temp, prec, h } = grid.cells;
  const n = temp.length;

  const biomeOfGrid = new Uint8Array(n);
  const assigned = new Uint8Array(n);
  const gridIds = pack.cells.g;
  const biomes = pack.cells.biome;
  for (let p = 0; p < gridIds.length; p++) {
    const gridId = gridIds[p];
    if (!assigned[gridId]) {
      biomeOfGrid[gridId] = biomes[p];
      assigned[gridId] = 1;
    }
  }

  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const fallbackBiomeId = Biomes.getId(prec[i] + 4, temp[i], h[i], false);
    const biomeId = assigned[i] ? biomeOfGrid[i] : fallbackBiomeId;
    const { color, density } = getSatelliteBiomeData(biomeId, fallbackBiomeId);
    data[i * 4] = color[0] * 255;
    data[i * 4 + 1] = color[1] * 255;
    data[i * 4 + 2] = color[2] * 255;
    data[i * 4 + 3] = density * 255;
  }

  const texture = new THREE.DataTexture(data, cellsX, cellsY, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

const vertexShader = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Output rows run bottom-up (map bottom at gl_FragCoord.y = 0) so the
// render-target texture drapes onto the mesh uvs like a regular image
// texture; the baked fields store the map top in row 0, hence the y flip
const fragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uField;   // R/G: height 16-bit hi/lo, B: ridge(+)/gully(-) packed, A: drainage
  uniform sampler2D uCoast;   // R: blurred land mask (0.5 = true coastline), G: water surface byte 0-100,
                              // B: river mask, A: lake group code * 40
  uniform sampler2D uClimate; // R: temperature C + 128, G: moisture (prec capped at 30), B: grid height (bathymetry)
  uniform sampler2D uBiome;   // RGB: biome satellite albedo, A: vegetation density
  uniform vec2 uResolution;   // output size in px (>= field size when supersampling)
  uniform vec2 uFieldSize;    // baked field size in px (uField/uCoast texels)
  uniform vec2 uGridSize;     // (cellsX, cellsY), for half-texel climate alignment
  uniform vec2 uSlopeScale;   // height gradient per texel -> world-space tan(slope), per axis
  uniform float uAspect;      // graphHeight / graphWidth
  uniform float uSeed;

  // accents over the biome albedo
  const vec3 GOLD      = vec3(0.72, 0.66, 0.35); // sun-dried grass patches
  const vec3 SEDIMENT  = vec3(0.45, 0.44, 0.38); // wet stream-bed soil

  // material palette
  const vec3 ROCK_COLOR  = vec3(0.55, 0.50, 0.45); // brown-gray mountain rock
  const vec3 ROCK_DRY    = vec3(0.69, 0.52, 0.36); // sun-baked red-brown rock
  const vec3 CLIFF_COLOR = vec3(0.37, 0.34, 0.32);
  const vec3 DIRT_COLOR  = vec3(0.58, 0.47, 0.34);
  const vec3 GRAVEL      = vec3(0.72, 0.70, 0.64); // cold-shore beaches
  const vec3 SAND_COLOR  = vec3(0.94, 0.87, 0.66);
  const vec3 SNOW_COLOR  = vec3(0.99, 1.00, 1.00);

  // water palette: saturated teal ocean, bright turquoise shallows
  const vec3 LAGOON_WARM = vec3(0.45, 0.86, 0.84); // tropical turquoise shallows
  const vec3 LAGOON_COLD = vec3(0.42, 0.70, 0.72); // steel-green northern shallows
  const vec3 SHELF_BLUE  = vec3(0.24, 0.58, 0.71); // sunlit continental shelf
  const vec3 OCEAN_BLUE  = vec3(0.15, 0.44, 0.62); // open sea
  const vec3 ABYSS_BLUE  = vec3(0.10, 0.31, 0.48); // deepest ocean
  const vec3 FOAM_COLOR  = vec3(0.97, 1.00, 1.00); // breaking surf

  // lake group palette (hues follow the 2D default style)
  // freshwater reads LIGHTER than the ocean (the 2D style is a pale
  // periwinkle), not a darker basin
  const vec3 FRESH_DEEP    = vec3(0.3, 0.58, 0.86); // freshwater basin
  const vec3 FRESH_RIM     = vec3(0.65, 0.76, 0.97); // #a6c1fd shallow rim
  const vec3 SALT_WATER    = vec3(0.27, 0.60, 0.54); // #409b8a mineral teal
  const vec3 SALT_CRUST    = vec3(0.93, 0.91, 0.85); // evaporite shore rim
  const vec3 SINKHOLE_RIM  = vec3(0.36, 0.79, 0.99); // #5bc9fd cenote cyan
  const vec3 SINKHOLE_DEEP = vec3(0.12, 0.34, 0.60);
  const vec3 DRY_BED       = vec3(0.79, 0.75, 0.65); // #c9bfa7 clay pan
  const vec3 DRY_RIM       = vec3(0.61, 0.56, 0.47); // damp fringe
  const vec3 LAVA_CRUST    = vec3(0.14, 0.10, 0.09); // cooled basalt
  const vec3 LAVA_RED      = vec3(0.56, 0.15, 0.05); // #90270d dull crust red
  const vec3 LAVA_GLOW     = vec3(0.98, 0.36, 0.08); // #f93e0c crack glow
  const vec3 ICE_COLOR     = vec3(0.80, 0.83, 0.91); // #cdd4e7 frozen lid

  const float ROCK_SLOPE_LO = 0.65;  // tan(slope) where bare rock starts breaking through
  const float ROCK_SLOPE_HI = 1.35;  // tan(slope) of solid rock cover
  const float CLIFF_SLOPE   = 2.2;   // near-vertical faces darken further
  const float SAND_BAND     = 0.022; // beach thickness above the water surface, height units

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  // ~[-0.5, 0.5]
  float fbm(vec2 p) {
    float value = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
      value += (vnoise(p) - 0.5) * amp;
      amp *= 0.55;
      p = p * 2.13 + 17.7;
    }
    return value;
  }

  float decodeHeight(vec4 t) {
    return (t.r * 65280.0 + t.g * 255.0) / 65535.0;
  }

  // uField is NearestFilter (the packed 16-bit height must not be hardware-
  // interpolated), so when the output is supersampled past the field size the
  // four neighboring texels are decoded first and mixed after.
  // Returns (height, ridge/gully packed, drainage)
  vec3 fieldAt(vec2 uv) {
    vec2 p = uv * uFieldSize - 0.5;
    vec2 base = floor(p);
    vec2 f = p - base;
    vec2 t0 = (base + 0.5) / uFieldSize;
    vec2 t1 = (base + 1.5) / uFieldSize;
    vec4 s00 = texture2D(uField, t0);
    vec4 s10 = texture2D(uField, vec2(t1.x, t0.y));
    vec4 s01 = texture2D(uField, vec2(t0.x, t1.y));
    vec4 s11 = texture2D(uField, t1);
    vec3 d00 = vec3(decodeHeight(s00), s00.ba);
    vec3 d10 = vec3(decodeHeight(s10), s10.ba);
    vec3 d01 = vec3(decodeHeight(s01), s01.ba);
    vec3 d11 = vec3(decodeHeight(s11), s11.ba);
    return mix(mix(d00, d10, f.x), mix(d01, d11, f.x), f.y);
  }

  float heightAt(vec2 uv) {
    return fieldAt(uv).x;
  }

  void main() {
    vec2 fragUv = gl_FragCoord.xy / uResolution;
    vec2 uv = vec2(fragUv.x, 1.0 - fragUv.y); // baked-field space: row 0 = map top
    vec2 texel = 1.0 / uFieldSize;

    vec3 fieldSample = fieldAt(uv);
    float h = fieldSample.x;
    vec4 coast = texture2D(uCoast, uv);
    float landFactor = coast.r;
    float waterSurface = coast.g * 2.55;

    // ridge(+)/gully(-) signal: packed as detail / 0.4 + 0.5, typical |detail|
    // well under 0.1, so amplify into a usable 0..1 ridge/gully pair
    float relief = (fieldSample.y - 0.5) * 2.0;
    float ridge = clamp(relief * 4.0, 0.0, 1.0);
    float gully = clamp(-relief * 4.0, 0.0, 1.0);
    float drainage = fieldSample.z;

    // per-texel slope (tan of the steepest angle) from central differences;
    // single FIELD-texel taps on purpose: the baked gullies and ridge walls
    // must register as steep so rock streaks follow the erosion pattern, and
    // sub-field-texel taps on bilinear data would stair-step
    float hL = heightAt(uv - vec2(texel.x, 0.0));
    float hR = heightAt(uv + vec2(texel.x, 0.0));
    float hU = heightAt(uv - vec2(0.0, texel.y));
    float hD = heightAt(uv + vec2(0.0, texel.y));
    vec2 grad = vec2((hR - hL) * 0.5 * uSlopeScale.x, (hD - hU) * 0.5 * uSlopeScale.y);
    float slope = length(grad);

    // breakup noise dithers every material threshold so blend edges read as
    // natural patchiness instead of contour lines; macro adds large-scale
    // tonal variation; patch clusters vegetation into woods and clearings
    vec2 np = vec2(uv.x, uv.y * uAspect);
    float breakup = fbm(np * 220.0 + uSeed * 37.0);
    float macro = fbm(np * 9.0 + uSeed * 53.0);
    float patch = fbm(np * 38.0 + uSeed * 71.0);

    // climate, sampled at cell centers like the bake's heightmap
    vec2 cuv = uv * (1.0 - 1.0 / uGridSize) + 0.5 / uGridSize;
    vec3 climate = texture2D(uClimate, cuv).rgb;
    float tempC = climate.r * 255.0 - 128.0 + macro * 6.0 + breakup * 2.0;
    float moisture = clamp(climate.g + macro * 0.08 + breakup * 0.05, 0.0, 1.0);

    float warm = smoothstep(2.0, 14.0, tempC);    // shore/lagoon character
    float scorch = smoothstep(20.0, 28.0, tempC); // hot rock bakes red

    // biome albedo, sampled with a noise-wobbled uv so zone borders wander
    // off the cell lattice; density = vegetation cover for clumping
    vec2 wobble = vec2(macro, patch) * (1.6 / uGridSize);
    vec4 biome = texture2D(uBiome, cuv + wobble);
    vec3 color = biome.rgb;
    float density = biome.a;

    // canopy clumping: dense cover breaks into sunlit and shadowed woods;
    // sparse grassland gets sun-dried golden patches
    float clump = patch * 0.6 + breakup * 0.4;
    color *= 1.0 + clump * 0.3 * density;
    float grassy = smoothstep(0.05, 0.3, density) * (1.0 - smoothstep(0.5, 0.8, density));
    color = mix(color, GOLD * (1.0 + breakup * 0.2), smoothstep(0.15, 0.4, patch) * grassy * 0.4);
    color *= 1.0 + macro * 0.12 + breakup * 0.1;

    // drainage lines read as damp ground: a touch darker and greener, and
    // only the strongest streams pick up a hint of wet sediment; kept off
    // steep walls so carved canyons still show rock
    float riparian = smoothstep(0.1, 0.7, drainage);
    float flatGround = 1.0 - smoothstep(ROCK_SLOPE_LO, ROCK_SLOPE_HI, slope);
    color = mix(color, color * vec3(0.78, 0.95, 0.72), riparian * 0.5 * flatGround);
    float stream = smoothstep(0.8, 0.97, drainage);
    color = mix(color, SEDIMENT * (1.0 + breakup * 0.2), stream * 0.25 * flatGround);

    // dirt breaks through on moderate slopes and collects in eroded gullies
    float dirtBlend = smoothstep(ROCK_SLOPE_LO - 0.35, ROCK_SLOPE_LO + 0.15, slope + breakup * 0.5);
    dirtBlend = max(dirtBlend, gully * smoothstep(0.25, 0.6, slope));
    color = mix(color, DIRT_COLOR * (1.0 + breakup * 0.35), dirtBlend);

    // bare rock on steep faces: strata bands keyed to elevation, crests
    // bleached, near-vertical walls darkening toward cliff, arid rock baked
    // red-brown. The albedo is a top-down projection, so high-frequency
    // detail smears into streaks on steep walls; fade it out with slope
    float stretchFade = 1.0 - smoothstep(1.2, 2.2, slope) * 0.7;
    float strata = 0.5 + 0.5 * sin(h * 70.0 + breakup * 9.0);
    vec3 rockBase = mix(ROCK_COLOR, ROCK_DRY, scorch * (1.0 - moisture));
    vec3 rockColor = mix(rockBase, CLIFF_COLOR, smoothstep(ROCK_SLOPE_HI, CLIFF_SLOPE, slope + breakup * 0.3));
    rockColor *= (1.0 + (strata - 0.5) * 0.22 * stretchFade) * (1.0 + ridge * 0.15) * (1.0 + macro * 0.18);
    float rockBlend = smoothstep(ROCK_SLOPE_LO, ROCK_SLOPE_HI, slope + breakup * 0.45);
    color = mix(color, rockColor, rockBlend);

    // beaches on flat ground within a thin band above the water surface:
    // warm shores get sand, cold ones gravel; riparian floors stay green
    vec3 beachColor = mix(GRAVEL, SAND_COLOR, warm);
    float sandBlend = smoothstep(SAND_BAND, SAND_BAND * 0.4, h - waterSurface + breakup * 0.012)
      * (1.0 - smoothstep(0.5, 1.0, slope))
      * (1.0 - riparian);
    color = mix(color, beachColor * (1.0 + breakup * 0.2), sandBlend);

    // permanent snow only where truly cold (FMG treats < -5 C as permafrost;
    // grid temperature already accounts for altitude). The band is narrow
    // and dithered at two scales so the snow limit is a patchy fringe, not
    // fog; snow collects in gullies (white streaks down the couloirs),
    // near-vertical faces shed it and tree canopies poke through
    float snow = (1.0 - smoothstep(-5.5, -3.5, tempC - gully * 2.5 + breakup * 3.0 + patch * 2.0))
      * (1.0 - smoothstep(1.4, 2.4, slope));
    snow *= 1.0 - density * 0.45;
    color = mix(color, SNOW_COLOR, snow);

    // cavity shading baked into the albedo: gullies dim, crests catch light
    color *= 1.0 - gully * 0.28 + ridge * 0.16;

    // baked hillshade, Swiss-relief style: warm afternoon sun from the
    // north-west, cool blue sky-light in the shade. The 3D scene light is
    // monochrome, so this tint contrast is what makes the relief glow
    vec3 nrm = normalize(vec3(-grad.x, -grad.y, 1.0));
    vec3 sunDir = normalize(vec3(-0.55, -0.55, 0.85));
    float shade = clamp((dot(nrm, sunDir) - sunDir.z) * 2.0, -1.0, 1.0) * 0.5 + 0.5;
    color *= mix(vec3(0.84, 0.88, 1.03), vec3(1.16, 1.10, 0.97), shade);

    // aerial perspective: the high country pales toward the sky
    color = mix(color, vec3(0.93, 0.96, 1.00), smoothstep(0.45, 0.95, h) * 0.16);

    // final grade: a restrained saturation and mid lift — keep the land
    // closer to true aerial color than to a postcard
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(lum), color, 1.1);
    color = pow(clamp(color, 0.0, 1.0), vec3(0.94));

    // water is fully procedural. Bathymetry from the grid heightmap drives a
    // sunlit shelf-to-abyss gradient; near the shore a sandy seabed glow, a
    // climate-tinted lagoon and a frayed foam line breaking on the true
    // vector coastline
    float seabed = climate.b * 100.0;
    float bathy = clamp((20.0 - seabed) / 18.0 + macro * 0.12, 0.0, 1.0);
    vec3 waterColor = mix(SHELF_BLUE, OCEAN_BLUE, smoothstep(0.05, 0.55, bathy));
    waterColor = mix(waterColor, ABYSS_BLUE, smoothstep(0.55, 1.0, bathy));
    waterColor *= 1.0 + macro * 0.08 + breakup * 0.03;

    // shore: 0 at the true coastline, growing seaward over the mask taper
    float shore = clamp((0.5 - landFactor) * 2.0, 0.0, 1.0);
    // baked river channel (true 2D widths); estuary water keeps the lagoon
    // tint but sheds the sand glow and the breaking surf line
    float riverMask = coast.b;
    float riverWater = smoothstep(0.2, 0.6, riverMask);
    vec3 lagoonColor = mix(LAGOON_COLD, LAGOON_WARM, warm) * (1.0 + breakup * 0.1);
    waterColor = mix(waterColor, lagoonColor, (1.0 - smoothstep(0.02, 0.25, shore)) * 0.95);
    waterColor = mix(waterColor, beachColor * 1.05,
      (1.0 - smoothstep(0.0, 0.07, shore)) * 0.45 * (1.0 - riverWater * 0.7));
    float foam = (1.0 - smoothstep(0.008, 0.04, shore - breakup * 0.02))
      * smoothstep(0.25, 0.85, 0.5 + breakup + patch * 0.3)
      * (1.0 - riverWater);
    waterColor = mix(waterColor, FOAM_COLOR, foam * 0.6);

    // lake groups override the generic ocean recipe (code baked in coast.a,
    // dilated past the shore so the decode is stable wherever water shows).
    // Fresh/salt/sinkhole stay water (calm-lake animation band, no ocean
    // surf), dry/lava/frozen turn into static beds via the alpha below
    float lakeCode = floor(coast.a * 6.375 + 0.5); // byte / 40
    float lakeRim = 1.0 - smoothstep(0.0, 0.14, shore + breakup * 0.06);
    if (lakeCode > 0.5 && lakeCode < 1.5) {
      // freshwater: still periwinkle-blue water, paler over the shallow rim
      waterColor = mix(FRESH_DEEP, FRESH_RIM, clamp(lakeRim * 0.85 + breakup * 0.08, 0.0, 1.0));
      waterColor *= 1.0 + macro * 0.06 + breakup * 0.04;
    } else if (lakeCode > 1.5 && lakeCode < 2.5) {
      // salt: milky mineral teal with an evaporite crust ring at the shore
      vec3 saltWater = mix(SALT_WATER, vec3(1.0), 0.12 + breakup * 0.08);
      waterColor = mix(saltWater, SALT_CRUST * (1.0 + breakup * 0.08), lakeRim * 0.85);
    } else if (lakeCode > 2.5 && lakeCode < 3.5) {
      // sinkhole: bright cenote cyan rim dropping into a deep blue eye
      waterColor = mix(SINKHOLE_DEEP, SINKHOLE_RIM, clamp(lakeRim * 0.9 + breakup * 0.1, 0.0, 1.0));
    } else if (lakeCode > 3.5 && lakeCode < 4.5) {
      // dry: cracked clay pan with a damp fringe
      waterColor = DRY_BED * (1.0 + breakup * 0.15 + macro * 0.08);
      float cracks = 1.0 - smoothstep(0.0, 0.05, abs(breakup));
      waterColor *= 1.0 - cracks * 0.18;
      waterColor = mix(waterColor, DRY_RIM, lakeRim * 0.5);
    } else if (lakeCode > 4.5 && lakeCode < 5.5) {
      // lava: cooled basalt crust veined with glowing cracks
      vec3 lava = mix(LAVA_CRUST * (1.0 + breakup * 0.3), LAVA_RED, smoothstep(0.1, 0.45, macro + patch * 0.3) * 0.5);
      float veins = 1.0 - smoothstep(0.0, 0.045, abs(breakup));
      waterColor = mix(lava, LAVA_GLOW, veins * clamp(0.55 + patch, 0.0, 1.0));
    } else if (lakeCode > 5.5) {
      // frozen: pale ice lid with brighter pressure-crack veins
      waterColor = ICE_COLOR * (1.0 + breakup * 0.06 + macro * 0.05);
      float iceVeins = 1.0 - smoothstep(0.0, 0.04, abs(breakup));
      waterColor = mix(waterColor, vec3(0.97, 0.98, 1.0), iceVeins * 0.5 + lakeRim * 0.25);
    }

    // the land ramp spans ~2 bake texels: soft enough to antialias the
    // waterline, tight enough that the beach still meets the water
    float land = smoothstep(0.5, 0.54, landFactor);
    vec3 finalColor = mix(waterColor, color, land);

    // baked river courses are real water: a deep teal channel that reads
    // against the land greens, damp sediment banks on the flats. The mask
    // carries the true 2D river widths (hairline at the source, flux-widened
    // downstream), so only antialias the bank line here and hand the channel
    // off to the ocean/lake water at the coastline, which the land-mask
    // mouth cut bends around the river entrance
    float river = smoothstep(0.35, 0.65, riverMask) * smoothstep(0.42, 0.52, landFactor);
    // rivers freeze over in extreme cold: same band as the permafrost snow
    // line (tempC already carries the breakup jitter, so the freeze edge is
    // a dithered fringe, not a contour); frozen courses also lose their
    // sediment banks (buried with the rest of the snowed-in floodplain) and
    // their flow animation via the alpha below
    float riverIce = 1.0 - smoothstep(-5.5, -3.0, tempC + patch * 1.5);
    float bank = smoothstep(0.12, 0.32, riverMask) * (1.0 - river) * smoothstep(0.45, 0.55, landFactor);
    finalColor = mix(finalColor, SEDIMENT * (1.05 + breakup * 0.2), bank * 0.5 * flatGround * (1.0 - riverIce));
    vec3 riverColor = mix(OCEAN_BLUE, lagoonColor, 0.25) * (0.88 + breakup * 0.1);
    // white water: only genuinely steep runs aerate into rapids and falls
    // (slope at the channel centerline is the along-course gradient; the
    // animated churn in the mesh material uses the same steepness signal).
    // The foam is clumpy — noise-textured white, not a flat wash
    float rapids = smoothstep(0.55, 1.5, slope + breakup * 0.2) * (1.0 - riverIce);
    vec3 foamTex = FOAM_COLOR * clamp(0.78 + breakup * 0.55 + patch * 0.2, 0.6, 1.05);
    riverColor = mix(riverColor, foamTex, min(rapids * 0.95, 0.8));
    riverColor = mix(riverColor, ICE_COLOR * (1.02 + breakup * 0.06), riverIce);
    finalColor = mix(finalColor, riverColor, river);

    // alpha packs land coverage for the mesh material's water animation:
    // land 1, rivers 0.45 (course-flow band; frozen rivers read as land),
    // enclosed lakes 0.7 (calm-ripple band), open water 0 with a shore-
    // proximity hint (up to 0.3 at the coastline) that drives the animated
    // surf; dry/lava/frozen lake beds read as static land
    float shoreHint = (1.0 - smoothstep(0.0, 0.25, shore)) * 0.3;
    float alpha = mix(shoreHint, 1.0, land);
    if (lakeCode > 0.5 && lakeCode < 3.5) alpha = mix(0.7, 1.0, land);
    alpha = mix(alpha, mix(0.45, 1.0, riverIce), river);
    if (lakeCode > 3.5) alpha = 1.0;
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// bakeResult = the cached object returned by erosion-bake's bake() (pixels,
// coast, cols, rows). Returns a THREE.Texture to use directly as
// material.map, or null on failure. The texture is regenerated on every
// mesh rebuild and on height-scale changes (slope thresholds depend on it)
export function generateSatelliteTexture(
  renderer: THREEType.WebGLRenderer,
  bakeResult: ErosionBakeResult,
  { scale, maxOutput }: { scale: number; maxOutput: number }
): THREEType.Texture | null {
  if (!bakeResult?.pixels || !bakeResult?.coast) return null;
  disposeSatelliteTexture();

  let fieldTexture!: THREEType.DataTexture;
  let coastTexture!: THREEType.DataTexture;
  let climateTexture!: THREEType.DataTexture;
  let biomeTexture!: THREEType.DataTexture;
  let material!: THREEType.RawShaderMaterial;
  let geometry!: THREEType.BufferGeometry;

  try {
    const { cols, rows } = bakeResult;

    fieldTexture = new THREE.DataTexture(bakeResult.pixels, cols, rows, THREE.RGBAFormat, THREE.UnsignedByteType);
    fieldTexture.minFilter = fieldTexture.magFilter = THREE.NearestFilter; // packed 16-bit height must not be hardware-interpolated
    fieldTexture.needsUpdate = true;

    coastTexture = new THREE.DataTexture(bakeResult.coast, cols, rows, THREE.RGBAFormat, THREE.UnsignedByteType);
    coastTexture.minFilter = coastTexture.magFilter = THREE.LinearFilter;
    coastTexture.needsUpdate = true;

    climateTexture = buildClimateTexture();
    biomeTexture = buildBiomeTexture();

    // supersample the output past the field size (up to 2x): the procedural
    // detail (breakup/dither noise, strata, biome edges) is generated per
    // fragment, so a larger render target genuinely sharpens it. Field-driven
    // signals interpolate via the shader's bilinear decode. Never downsample:
    // a 1x output stays bit-identical to rendering at field size
    const longSide = Math.max(cols, rows);
    const maxSide = Math.min(maxOutput, renderer.capabilities.maxTextureSize, longSide * 2);
    const outputScale = Math.max(maxSide / longSide, 1);
    const outputW = Math.round(cols * outputScale);
    const outputH = Math.round(rows * outputScale);

    // mipmaps need WebGL2 for the non-power-of-two bake size
    const isWebGL2 = renderer.capabilities.isWebGL2;
    const target = new THREE.WebGLRenderTarget(outputW, outputH, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      generateMipmaps: isWebGL2,
      minFilter: isWebGL2 ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false
    });
    renderTarget = target;
    target.texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    // normalized-height gradient per texel -> world-space tan(slope):
    // d(world y)/d(height) = scale * 100 / 82 (the LOWER_BY_WATER divider),
    // texel size in world units = map extent / bake size
    const worldPerHeight = (scale * 100) / 82;
    material = new THREE.RawShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uField: { value: fieldTexture },
        uCoast: { value: coastTexture },
        uClimate: { value: climateTexture },
        uBiome: { value: biomeTexture },
        uResolution: { value: new THREE.Vector2(outputW, outputH) },
        uFieldSize: { value: new THREE.Vector2(cols, rows) },
        uGridSize: { value: new THREE.Vector2(grid.cellsX, grid.cellsY) },
        uSlopeScale: {
          value: new THREE.Vector2(worldPerHeight / (graphWidth / cols), worldPerHeight / (graphHeight / rows))
        },
        uAspect: { value: graphHeight / graphWidth },
        uSeed: { value: (Number.parseInt(seed, 10) % 1e5 || 1) / 1e5 + 1 }
      },
      depthTest: false,
      depthWrite: false
    });

    // fullscreen triangle
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const quad = new THREE.Mesh(geometry, material);
    quad.frustumCulled = false;
    const bakeScene = new THREE.Scene();
    bakeScene.add(quad);
    const bakeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const previousTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    renderer.render(bakeScene, bakeCamera);
    renderer.setRenderTarget(previousTarget);

    return target.texture;
  } catch (error) {
    console.error("Satellite texture generation failed:", error);
    disposeSatelliteTexture();
    return null;
  } finally {
    material?.dispose();
    geometry?.dispose();
    fieldTexture?.dispose();
    coastTexture?.dispose();
    climateTexture?.dispose();
    biomeTexture?.dispose();
  }
}

export function disposeSatelliteTexture(): void {
  if (renderTarget) {
    renderTarget.dispose();
    renderTarget = null;
  }
}

const FLOW_WAVELENGTH = 10; // map units per flow animation cycle
let flowTexture: THREEType.Texture | null = null;

// Flow phase field for the mesh material's river animation: each course is
// stroked with per-channel linear gradients encoding sin/cos of the arc
// length from the source in R/G (so the phase survives bilinear filtering
// with no sawtooth wrap). B packs coverage AND the along-course steepness
// (byte 40 = flat course .. 255 = sheer fall, 0 = no river), sampled from
// the baked height field: the animation speeds up and churns white with
// steepness so steep drops read as waterfalls. Strokes are wider than the
// rendered river — the satellite alpha band gates where the animation
// shows — so a low resolution is fine. CanvasTexture default flipY puts
// canvas row 0 (map top) at v=1, matching how the satellite render target
// drapes onto the mesh uvs
export function generateRiverFlowTexture(): THREEType.Texture {
  disposeRiverFlowTexture();

  const scale = 1024 / Math.max(graphWidth, graphHeight);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(64, Math.round(graphWidth * scale));
  canvas.height = Math.max(64, Math.round(graphHeight * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.lineJoin = ctx.lineCap = "round";

  const k = (Math.PI * 2) / FLOW_WAVELENGTH;
  const minWidth = 4 / scale; // keep narrow courses covered at flow-texture resolution
  const encode = (d: number, steep: number) =>
    `rgb(${Math.round(127.5 + 127.5 * Math.sin(d * k))},${Math.round(127.5 + 127.5 * Math.cos(d * k))},${Math.round(
      40 + steep * 215
    )})`;
  // along-course drop (height units 0-100 per map unit) -> steepness 0..1:
  // rapids start around 0.6, a sheer fall saturates at 3.0 — deliberately
  // rare, only genuinely steep runs churn. heightAt with scale = DIVIDER
  // returns raw height units up to a constant offset that cancels in the
  // difference (0 without a bake cache -> flat, no falls)
  const steepness = (drop: number) => Math.min(Math.max((drop - 0.6) / 2.4, 0), 1);

  for (const river of pack.rivers || []) {
    if (!river.cells || river.cells.length < 2) continue;
    const points = river.points && river.points.length === river.cells.length ? river.points : null;
    try {
      const meandered = Rivers.addMeandering(river.cells, points);
      let dist = 0;
      let flux = meandered[0][2];
      let steep = 0;
      for (let pointIndex = 1; pointIndex < meandered.length; pointIndex++) {
        const [x0, y0] = meandered[pointIndex - 1];
        const [x1, y1] = meandered[pointIndex];
        const length = Math.hypot(x1 - x0, y1 - y0);
        if (length < 0.01) continue;
        if (meandered[pointIndex][2] > flux) flux = meandered[pointIndex][2];
        const offset = Rivers.getOffset({
          flux,
          pointIndex,
          widthFactor: river.widthFactor,
          startingWidth: river.sourceWidth
        });
        ctx.lineWidth = Math.max(2 * offset, minWidth);
        // sub-segments short against the wavelength: the linear gradient
        // then tracks the circular sin/cos phase closely
        const subs = Math.max(1, Math.ceil(length / (FLOW_WAVELENGTH / 5)));
        const subLen = length / subs;
        for (let s = 0; s < subs; s++) {
          const t0 = s / subs;
          const t1 = (s + 1) / subs;
          const ax = x0 + (x1 - x0) * t0;
          const ay = y0 + (y1 - y0) * t0;
          const bx = x0 + (x1 - x0) * t1;
          const by = y0 + (y1 - y0) * t1;
          // steepness rises instantly at a drop but decays slowly while
          // walking downstream: the churn trails past the fall's base like
          // the foam apron under a real waterfall
          const drop = Math.max(0, heightAt(ax, ay, 82) - heightAt(bx, by, 82)) / subLen;
          steep = Math.max(steepness(drop), steep * 0.55);
          const gradient = ctx.createLinearGradient(ax, ay, bx, by);
          gradient.addColorStop(0, encode(dist + length * t0, steep));
          gradient.addColorStop(1, encode(dist + length * t1, steep));
          ctx.strokeStyle = gradient;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
        dist += length;
      }
    } catch {
      // a malformed river just goes missing from the animation
    }
  }
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  flowTexture = texture;
  return texture;
}

export function disposeRiverFlowTexture(): void {
  if (flowTexture) {
    flowTexture.dispose();
    flowTexture = null;
  }
}
