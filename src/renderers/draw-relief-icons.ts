import {extent, polygonContains} from "d3";
import * as THREE from "three";
import {minmax, rand, rn} from "../utils";

interface ReliefIcon {
  i: string; // e.g. "#relief-mount-1"
  x: number;
  y: number;
  s: number; // size (width = height in map units)
}

declare global {
  var drawReliefIcons: () => void;
  var terrain: import("d3").Selection<SVGGElement, unknown, null, undefined>;
  var getPackPolygon: (i: number) => [number, number][];
  var graphWidth: number;
  var graphHeight: number;
  var poissonDiscSampler: (x0: number, y0: number, x1: number, y1: number, r: number) => Iterable<[number, number]>;

  var renderReliefIcons: () => void;
  var enterReliefSvgEditMode: () => void;
  var exitReliefSvgEditMode: () => void;
  var prepareReliefForSave: () => void;
  var restoreReliefAfterSave: () => void;
  var migrateReliefFromSvg: () => void;
}

// Module state
let reliefIconData: ReliefIcon[] = [];
let svgEditMode = false;
let fo: SVGForeignObjectElement | null = null;
let renderer: any = null; // THREE.WebGLRenderer
let camera: any = null; // THREE.OrthographicCamera
let scene: any = null; // THREE.Scene

const textureCache = new Map<string, any>(); // set name → THREE.Texture

const RELIEF_SYMBOLS: Record<string, string[]> = {
  simple: [
    "relief-mount-1",
    "relief-hill-1",
    "relief-conifer-1",
    "relief-deciduous-1",
    "relief-acacia-1",
    "relief-palm-1",
    "relief-grass-1",
    "relief-swamp-1",
    "relief-dune-1"
  ],
  gray: [
    "relief-mount-2-bw",
    "relief-mount-3-bw",
    "relief-mount-4-bw",
    "relief-mount-5-bw",
    "relief-mount-6-bw",
    "relief-mount-7-bw",
    "relief-mountSnow-1-bw",
    "relief-mountSnow-2-bw",
    "relief-mountSnow-3-bw",
    "relief-mountSnow-4-bw",
    "relief-mountSnow-5-bw",
    "relief-mountSnow-6-bw",
    "relief-hill-2-bw",
    "relief-hill-3-bw",
    "relief-hill-4-bw",
    "relief-hill-5-bw",
    "relief-conifer-2-bw",
    "relief-coniferSnow-1-bw",
    "relief-swamp-2-bw",
    "relief-swamp-3-bw",
    "relief-cactus-1-bw",
    "relief-cactus-2-bw",
    "relief-cactus-3-bw",
    "relief-deadTree-1-bw",
    "relief-deadTree-2-bw",
    "relief-vulcan-1-bw",
    "relief-vulcan-2-bw",
    "relief-vulcan-3-bw",
    "relief-dune-2-bw",
    "relief-grass-2-bw",
    "relief-acacia-2-bw",
    "relief-palm-2-bw",
    "relief-deciduous-2-bw",
    "relief-deciduous-3-bw"
  ],
  colored: [
    "relief-mount-2",
    "relief-mount-3",
    "relief-mount-4",
    "relief-mount-5",
    "relief-mount-6",
    "relief-mount-7",
    "relief-mountSnow-1",
    "relief-mountSnow-2",
    "relief-mountSnow-3",
    "relief-mountSnow-4",
    "relief-mountSnow-5",
    "relief-mountSnow-6",
    "relief-hill-2",
    "relief-hill-3",
    "relief-hill-4",
    "relief-hill-5",
    "relief-conifer-2",
    "relief-coniferSnow-1",
    "relief-swamp-2",
    "relief-swamp-3",
    "relief-cactus-1",
    "relief-cactus-2",
    "relief-cactus-3",
    "relief-deadTree-1",
    "relief-deadTree-2",
    "relief-vulcan-1",
    "relief-vulcan-2",
    "relief-vulcan-3",
    "relief-dune-2",
    "relief-grass-2",
    "relief-acacia-2",
    "relief-palm-2",
    "relief-deciduous-2",
    "relief-deciduous-3"
  ]
};

function resolveSprite(symbolHref: string) {
  const id = symbolHref.startsWith("#") ? symbolHref.slice(1) : symbolHref;
  for (const [set, ids] of Object.entries(RELIEF_SYMBOLS)) {
    const idx = ids.indexOf(id);
    if (idx !== -1) return {set, tileIndex: idx};
  }

  throw new Error(`Relief: unknown symbol href "${symbolHref}"`);
}

function loadTexture(set: string): Promise<any> {
  if (textureCache.has(set)) return Promise.resolve(textureCache.get(set));
  return new Promise(resolve => {
    const loader = new THREE.TextureLoader();
    loader.load(
      `images/relief/${set}.png`,
      texture => {
        texture.flipY = false;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        textureCache.set(set, texture);
        resolve(texture);
      },
      undefined,
      () => {
        console.warn(`Relief: atlas not found for "${set}". Run: npm run generate-atlases`);
        resolve(null);
      }
    );
  });
}

function ensureRenderer(): boolean {
  if (renderer) {
    // Recover from WebGL context loss (can happen when canvas is detached from DOM)
    if (renderer.getContext().isContextLost()) {
      renderer.forceContextRestore();
      renderer.dispose();
      renderer = null;
      camera = null;
      scene = null;
      disposeTextureCache();
      // fall through to recreate
    } else {
      if (fo && !fo.isConnected) terrain.node()!.appendChild(fo);
      return true;
    }
  }

  // foreignObject hosts the WebGL canvas inside the SVG.
  // Dimensions are set here so the browser can start compositing before renderFrame runs.
  fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject") as unknown as SVGForeignObjectElement;
  fo.id = "terrainFo";
  fo.setAttribute("x", "0");
  fo.setAttribute("y", "0");
  fo.setAttribute("width", String(graphWidth));
  fo.setAttribute("height", String(graphHeight));

  // IMPORTANT: use document.createElement, not createElementNS.
  // createElementNS with XHTML namespace can produce an Element without getContext().
  const canvas = document.createElement("canvas");
  canvas.id = "terrainGlCanvas";
  (fo as unknown as Element).appendChild(canvas);
  terrain.node()!.appendChild(fo);

  try {
    renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: false, preserveDrawingBuffer: true});
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    // setSize sets canvas.width/height (physical) and canvas.style.width/height (CSS px).
    // We override the CSS size to 100% so the canvas always fills the foreignObject.
    renderer.setSize(graphWidth, graphHeight);
    canvas.style.cssText = "display:block;pointer-events:none;position:absolute;top:0;left:0;width:100%;height:100%;";
  } catch (e) {
    console.error("Relief: WebGL init failed", e);
    return false;
  }

  // Camera in SVG coordinate space: (left, right, top, bottom, near, far).
  // top=0, bottom=H puts map y=0 at screen-top and map y=H at screen-bottom.
  camera = new THREE.OrthographicCamera(0, graphWidth, 0, graphHeight, -1, 1);
  scene = new THREE.Scene();
  return true;
}

// ─── Scene / geometry ─────────────────────────────────────────────────────────

/**
 * Build a single BufferGeometry with all icon quads for one atlas set.
 * Geometry order matches the painter's-order sort of reliefIconData,
 * so depth is correct within the set without needing depth testing.
 *
 * UV layout (texture.flipY = false means v=0 is top of image):
 *   u = col/cols … (col+1)/cols
 *   v = row/rows … (row+1)/rows
 */
function buildSetMesh(icons: ReliefIcon[], set: string, texture: any): any {
  const ids = RELIEF_SYMBOLS[set] ?? [];
  const n = ids.length || 1;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);

  const positions = new Float32Array(icons.length * 4 * 3);
  const uvs = new Float32Array(icons.length * 4 * 2);
  const indices = new Uint32Array(icons.length * 6);

  let vi = 0,
    ii = 0;
  for (const r of icons) {
    const {tileIndex} = resolveSprite(r.i);
    const col = tileIndex % cols;
    const row = Math.floor(tileIndex / cols);
    const u0 = col / cols,
      u1 = (col + 1) / cols;
    const v0 = row / rows,
      v1 = (row + 1) / rows;
    const x0 = r.x,
      x1 = r.x + r.s;
    const y0 = r.y,
      y1 = r.y + r.s;

    const base = vi;
    // TL
    positions.set([x0, y0, 0], vi * 3);
    uvs.set([u0, v0], vi * 2);
    vi++;
    // TR
    positions.set([x1, y0, 0], vi * 3);
    uvs.set([u1, v0], vi * 2);
    vi++;
    // BL
    positions.set([x0, y1, 0], vi * 3);
    uvs.set([u0, v1], vi * 2);
    vi++;
    // BR
    positions.set([x1, y1, 0], vi * 3);
    uvs.set([u1, v1], vi * 2);
    vi++;

    // Two CCW triangles (winding doesn't matter with DoubleSide, but consistent)
    indices.set([base, base + 1, base + 3, base, base + 3, base + 2], ii);
    ii += 6;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));

  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false
  });

  return new THREE.Mesh(geo, mat);
}

function disposeTextureCache(): void {
  for (const tex of textureCache.values()) tex?.dispose();
  textureCache.clear();
}

function disposeScene(): void {
  if (!scene) return;
  while (scene.children.length) {
    const mesh = scene.children[0];
    scene.remove(mesh);
    mesh.geometry?.dispose();
    // dispose material but NOT the texture (shared in textureCache, explicitly cleared separately)
    if (mesh.material) {
      mesh.material.map = null;
      mesh.material.dispose();
    }
  }
}

function buildScene(): void {
  if (!scene) return;
  disposeScene();

  // Group icons by set (normally all icons belong to the same set)
  const bySet = new Map<string, ReliefIcon[]>();
  for (const r of reliefIconData) {
    const {set} = resolveSprite(r.i);
    let arr = bySet.get(set);
    if (!arr) {
      arr = [];
      bySet.set(set, arr);
    }
    arr.push(r);
  }

  for (const [set, icons] of bySet) {
    const texture = textureCache.get(set);
    if (!texture) continue;
    scene.add(buildSetMesh(icons, set, texture));
  }
}

function renderFrame(): void {
  if (!renderer || !camera || !scene || !fo) return;

  const x = -viewX / scale;
  const y = -viewY / scale;
  const w = graphWidth / scale;
  const h = graphHeight / scale;

  // Position the foreignObject to cancel the D3 zoom transform applied to #viewbox.
  fo.setAttribute("x", String(x));
  fo.setAttribute("y", String(y));
  fo.setAttribute("width", String(w));
  fo.setAttribute("height", String(h));

  // Camera frustum = the map region currently visible through the fo aperture
  camera.left = x;
  camera.right = x + w;
  camera.top = y;
  camera.bottom = y + h;
  camera.updateProjectionMatrix();

  renderer.render(scene, camera);
}

function enterSvgEditMode(): void {
  if (svgEditMode) return;
  svgEditMode = true;
  terrain
    .node()!
    .insertAdjacentHTML(
      "afterbegin",
      reliefIconData.map(r => `<use href="${r.i}" x="${r.x}" y="${r.y}" width="${r.s}" height="${r.s}"/>`).join("")
    );
}

function exitSvgEditMode(): void {
  if (!svgEditMode) return;
  reliefIconData = [];
  terrain.selectAll<SVGUseElement, unknown>("use").each(function () {
    const href = this.getAttribute("href") || (this as any).getAttribute("xlink:href") || "";
    reliefIconData.push({
      i: href,
      x: +this.getAttribute("x")!,
      y: +this.getAttribute("y")!,
      s: +this.getAttribute("width")!
    });
  });
  terrain.selectAll("use").remove();
  svgEditMode = false;
  loadTexture(terrain.attr("set")).then(() => {
    buildScene();
    renderFrame();
  });
}

function prepareReliefForSave(): void {
  if (svgEditMode) return;
  terrain
    .node()!
    .insertAdjacentHTML(
      "afterbegin",
      reliefIconData.map(r => `<use href="${r.i}" x="${r.x}" y="${r.y}" width="${r.s}" height="${r.s}"/>`).join("")
    );
}

function restoreReliefAfterSave(): void {
  if (!svgEditMode) terrain.selectAll("use").remove();
}

const reliefIconsRenderer = (): void => {
  TIME && console.time("drawRelief");

  terrain.selectAll("*").remove();
  disposeTextureCache();
  disposeScene();
  reliefIconData = [];
  svgEditMode = false;

  const cells = pack.cells;
  const density = Number(terrain.attr("density")) || 0.4;
  const size = 2 * (Number(terrain.attr("size")) || 1);
  const mod = 0.2 * size;
  const relief: ReliefIcon[] = [];

  for (const i of cells.i) {
    const height = cells.h[i];
    if (height < 20 || cells.r[i]) continue;
    const biome = cells.biome[i];
    if (height < 50 && biomesData.iconsDensity[biome] === 0) continue;

    const polygon = getPackPolygon(i);
    const [minX, maxX] = extent(polygon, p => p[0]) as [number, number];
    const [minY, maxY] = extent(polygon, p => p[1]) as [number, number];

    if (height < 50) placeBiomeIcons();
    else placeReliefIcons();

    function placeBiomeIcons(): void {
      const iconsDensity = biomesData.iconsDensity[biome] / 100;
      const radius = 2 / iconsDensity / density;
      if (Math.random() > iconsDensity * 10) return;
      for (const [cx, cy] of window.poissonDiscSampler(minX, minY, maxX, maxY, radius)) {
        if (!polygonContains(polygon, [cx, cy])) continue;
        let h = (4 + Math.random()) * size;
        const icon = getBiomeIcon(i, biomesData.icons[biome]);
        if (icon === "#relief-grass-1") h *= 1.2;
        relief.push({i: icon, x: rn(cx - h, 2), y: rn(cy - h, 2), s: rn(h * 2, 2)});
      }
    }

    function placeReliefIcons(): void {
      const radius = 2 / density;
      const [icon, h] = getReliefIcon(i, height);
      for (const [cx, cy] of window.poissonDiscSampler(minX, minY, maxX, maxY, radius)) {
        if (!polygonContains(polygon, [cx, cy])) continue;
        relief.push({i: icon, x: rn(cx - h, 2), y: rn(cy - h, 2), s: rn(h * 2, 2)});
      }
    }

    function getReliefIcon(cellIndex: number, h: number): [string, number] {
      const temp = grid.cells.temp[pack.cells.g[cellIndex]];
      const type = h > 70 && temp < 0 ? "mountSnow" : h > 70 ? "mount" : "hill";
      const iconSize = h > 70 ? (h - 45) * mod : minmax((h - 40) * mod, 3, 6);
      return [getIcon(type), iconSize];
    }
  }

  relief.sort((a, b) => a.y + a.s - (b.y + b.s));
  reliefIconData = relief;

  TIME && console.timeEnd("drawRelief");

  if (reliefIconData.length) {
    if (ensureRenderer()) {
      loadTexture(terrain.attr("set")).then(() => {
        buildScene();
        renderFrame();
      });
    } else {
      WARN && console.warn("Relief: WebGL renderer failed");
    }
  }

  function getBiomeIcon(cellIndex: number, b: string[]): string {
    let type = b[Math.floor(Math.random() * b.length)];
    const temp = grid.cells.temp[pack.cells.g[cellIndex]];
    if (type === "conifer" && temp < 0) type = "coniferSnow";
    return getIcon(type);
  }

  function getVariant(type: string): number {
    switch (type) {
      case "mount":
        return rand(2, 7);
      case "mountSnow":
        return rand(1, 6);
      case "hill":
        return rand(2, 5);
      case "conifer":
        return 2;
      case "coniferSnow":
        return 1;
      case "swamp":
        return rand(2, 3);
      case "cactus":
        return rand(1, 3);
      case "deadTree":
        return rand(1, 2);
      case "vulcan":
        return rand(1, 3);
      case "deciduous":
        return rand(2, 3);
      default:
        return 2;
    }
  }

  function getOldIcon(type: string): string {
    const map: Record<string, string> = {
      mountSnow: "mount",
      vulcan: "mount",
      coniferSnow: "conifer",
      cactus: "dune",
      deadTree: "dune"
    };
    return map[type] ?? type;
  }

  function getIcon(type: string): string {
    const set = terrain.attr("set") || "simple";
    if (set === "colored") return `#relief-${type}-${getVariant(type)}`;
    if (set === "gray") return `#relief-${type}-${getVariant(type)}-bw`;
    return `#relief-${getOldIcon(type)}-1`;
  }
};

window.renderReliefIcons = renderFrame;
window.drawReliefIcons = reliefIconsRenderer;
window.enterReliefSvgEditMode = enterSvgEditMode;
window.exitReliefSvgEditMode = exitSvgEditMode;
window.prepareReliefForSave = prepareReliefForSave;
window.restoreReliefAfterSave = restoreReliefAfterSave;
