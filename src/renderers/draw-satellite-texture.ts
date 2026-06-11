import type * as THREEType from "three";
import type { ErosionBakeResult } from "../modules/erosion-bake";

let renderTarget: THREEType.WebGLRenderTarget | null = null;

// biome id -> satellite albedo and vegetation density
const BIOME_SATELLITE: Array<{ color: [number, number, number]; density: number }> = [
  { color: [0.24, 0.58, 0.71], density: 0 }, // 0 Marine (only near data edges)
  { color: [0.91, 0.81, 0.56], density: 0.02 }, // 1 Hot desert
  { color: [0.76, 0.7, 0.54], density: 0.05 }, // 2 Cold desert
  { color: [0.64, 0.67, 0.3], density: 0.35 }, // 3 Savanna
  { color: [0.44, 0.65, 0.23], density: 0.45 }, // 4 Grassland
  { color: [0.23, 0.52, 0.16], density: 0.85 }, // 5 Tropical seasonal forest
  { color: [0.15, 0.43, 0.13], density: 0.9 }, // 6 Temperate deciduous forest
  { color: [0.09, 0.38, 0.11], density: 1 }, // 7 Tropical rainforest
  { color: [0.11, 0.4, 0.14], density: 1 }, // 8 Temperate rainforest
  { color: [0.13, 0.31, 0.17], density: 0.85 }, // 9 Taiga
  { color: [0.6, 0.57, 0.45], density: 0.12 }, // 10 Tundra
  { color: [0.93, 0.95, 0.97], density: 0 }, // 11 Glacier
  { color: [0.24, 0.42, 0.21], density: 0.65 } // 12 Wetland
];

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
    let biomeId = biomeOfGrid[i];
    if (!assigned[i]) biomeId = Biomes.getId(prec[i] + 4, temp[i], h[i], false);
    const { color, density } = BIOME_SATELLITE[biomeId] || BIOME_SATELLITE[0];
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
  uniform sampler2D uCoast;   // R: blurred land mask (0.5 = true coastline), G: water surface byte 0-100, B: river mask
  uniform sampler2D uClimate; // R: temperature C + 128, G: moisture (prec capped at 30), B: grid height (bathymetry)
  uniform sampler2D uBiome;   // RGB: biome satellite albedo, A: vegetation density
  uniform vec2 uResolution;   // output = bake size in px
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

  float heightAt(vec2 uv) {
    vec4 t = texture2D(uField, uv);
    return (t.r * 65280.0 + t.g * 255.0) / 65535.0;
  }

  void main() {
    vec2 fragUv = gl_FragCoord.xy / uResolution;
    vec2 uv = vec2(fragUv.x, 1.0 - fragUv.y); // baked-field space: row 0 = map top
    vec2 texel = 1.0 / uResolution;

    float h = heightAt(uv);
    vec4 field = texture2D(uField, uv);
    vec4 coast = texture2D(uCoast, uv);
    float landFactor = coast.r;
    float waterSurface = coast.g * 2.55;

    // ridge(+)/gully(-) signal: packed as detail / 0.4 + 0.5, typical |detail|
    // well under 0.1, so amplify into a usable 0..1 ridge/gully pair
    float relief = (field.b - 0.5) * 2.0;
    float ridge = clamp(relief * 4.0, 0.0, 1.0);
    float gully = clamp(-relief * 4.0, 0.0, 1.0);
    float drainage = field.a;

    // per-texel slope (tan of the steepest angle) from central differences;
    // single-texel taps on purpose: the baked gullies and ridge walls must
    // register as steep so rock streaks follow the erosion pattern
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

    // final grade: saturate and lift the mids for a sunlit, vivid look
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(lum), color, 1.25);
    color = pow(clamp(color, 0.0, 1.0), vec3(0.9));

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
    vec3 lagoonColor = mix(LAGOON_COLD, LAGOON_WARM, warm) * (1.0 + breakup * 0.1);
    waterColor = mix(waterColor, lagoonColor, (1.0 - smoothstep(0.02, 0.25, shore)) * 0.95);
    waterColor = mix(waterColor, beachColor * 1.05, (1.0 - smoothstep(0.0, 0.07, shore)) * 0.45);
    float foam = (1.0 - smoothstep(0.008, 0.04, shore - breakup * 0.02))
      * smoothstep(0.25, 0.85, 0.5 + breakup + patch * 0.3);
    waterColor = mix(waterColor, FOAM_COLOR, foam * 0.6);

    // the land ramp spans ~2 bake texels: soft enough to antialias the
    // waterline, tight enough that the beach still meets the water
    float land = smoothstep(0.5, 0.54, landFactor);
    vec3 finalColor = mix(waterColor, color, land);

    // baked river courses are real water: a deep teal channel that reads
    // against the land greens, damp sediment banks on the flats. Width is
    // shaped by flux (drainage) and an inland-length proxy (height above local
    // sea surface): sources stay narrow and channels widen downstream toward
    // the mouth while coastline masking keeps flow off open water
    float riverMask = coast.b;
    float drainageNorm = smoothstep(0.0, 1.0, drainage);
    float sourceWidth = mix(0.08, 1.25, drainageNorm);
    float fluxWidth = mix(0.4, 0.95, smoothstep(0.12, 0.98, drainage));
    float riverWidth = sourceWidth * fluxWidth;
    float riverSpread = clamp(riverMask * riverWidth, 0.0, 1.0);
    float coastRiverMask = smoothstep(0.30, 0.70, landFactor);
    float river = smoothstep(0.56, 0.68, riverSpread) * coastRiverMask;
    float bank = smoothstep(0.24, 0.40, riverSpread) * (1.0 - river) * coastRiverMask;
    finalColor = mix(finalColor, SEDIMENT * (1.05 + breakup * 0.2), bank * 0.5 * flatGround);
    vec3 riverColor = mix(OCEAN_BLUE, lagoonColor, 0.35) * (0.9 + breakup * 0.1);
    finalColor = mix(finalColor, riverColor, river);

    // alpha packs land coverage for the mesh material's water animation:
    // land and rivers 1, open water 0 with a shore-proximity hint (up to
    // 0.3 at the coastline) that drives the animated surf
    float shoreHint = (1.0 - smoothstep(0.0, 0.25, shore)) * 0.3;
    float alpha = mix(shoreHint, 1.0, max(land, river));
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
  { scale }: { scale: number }
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

    // mipmaps need WebGL2 for the non-power-of-two bake size
    const isWebGL2 = renderer.capabilities.isWebGL2;
    const target = new THREE.WebGLRenderTarget(cols, rows, {
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
        uResolution: { value: new THREE.Vector2(cols, rows) },
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
