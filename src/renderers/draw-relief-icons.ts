import * as THREE from "three";
import type { ReliefIcon } from "../modules/relief-generator";
import {
  generateRelief,
  RELIEF_SYMBOLS,
  resolveSprite,
} from "../modules/relief-generator";
import { byId } from "../utils";

// ── Module state ───────────────────────────────────────────────────────────────
let fo: SVGForeignObjectElement | null = null;
let renderer: any = null; // THREE.WebGLRenderer
let camera: any = null; // THREE.OrthographicCamera
let scene: any = null; // THREE.Scene

const textureCache = new Map<string, any>(); // set name → THREE.Texture

// ── Texture ────────────────────────────────────────────────────────────────────

function loadTexture(set: string): Promise<any> {
  if (textureCache.has(set)) return Promise.resolve(textureCache.get(set));
  return new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      `images/relief/${set}.png`,
      (texture) => {
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
        ERROR && console.error(`Relief: failed to load atlas for "${set}"`);
        resolve(null);
      },
    );
  });
}

// ── WebGL bootstrap ────────────────────────────────────────────────────────────

function ensureRenderer(): boolean {
  const terrainEl = byId("terrain");
  if (!terrainEl) return false;

  if (renderer) {
    if (renderer.getContext().isContextLost()) {
      // Recover from WebGL context loss
      renderer.forceContextRestore();
      renderer.dispose();
      renderer = null;
      camera = null;
      scene = null;
      disposeTextureCache();
      // fall through to recreate
    } else {
      if (fo && !fo.isConnected) terrainEl.appendChild(fo);
      return true;
    }
  }

  // foreignObject hosts the WebGL canvas inside the SVG.
  fo = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "foreignObject",
  ) as unknown as SVGForeignObjectElement;
  fo.id = "terrainFo";
  fo.setAttribute("x", "0");
  fo.setAttribute("y", "0");
  fo.setAttribute("width", String(graphWidth));
  fo.setAttribute("height", String(graphHeight));

  // IMPORTANT: use document.createElement, not createElementNS.
  const canvas = document.createElement("canvas");
  canvas.id = "terrainGlCanvas";
  fo.appendChild(canvas);
  terrainEl.appendChild(fo);

  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(graphWidth, graphHeight);
    canvas.style.cssText =
      "display:block;pointer-events:none;position:absolute;top:0;left:0;width:100%;height:100%;";
  } catch (e) {
    console.error("Relief: WebGL init failed", e);
    return false;
  }

  // Camera in SVG coordinate space: top=0, bottom=H puts map y=0 at screen-top.
  camera = new THREE.OrthographicCamera(0, graphWidth, 0, graphHeight, -1, 1);
  scene = new THREE.Scene();
  return true;
}

// ── Scene / geometry ───────────────────────────────────────────────────────────

/**
 * Build a BufferGeometry with all icon quads for one atlas set.
 * Geometry is painter's-order sorted so depth is correct without depth testing.
 *
 * UV layout (texture.flipY = false — v=0 is top of image):
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
    const { tileIndex } = resolveSprite(r.href);
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
    positions.set([x0, y0, 0], vi * 3);
    uvs.set([u0, v0], vi * 2);
    vi++;
    positions.set([x1, y0, 0], vi * 3);
    uvs.set([u1, v0], vi * 2);
    vi++;
    positions.set([x0, y1, 0], vi * 3);
    uvs.set([u0, v1], vi * 2);
    vi++;
    positions.set([x1, y1, 0], vi * 3);
    uvs.set([u1, v1], vi * 2);
    vi++;
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
    depthWrite: false,
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
    if (mesh.material) {
      mesh.material.map = null;
      mesh.material.dispose();
    }
  }
}

function buildScene(icons: ReliefIcon[]): void {
  if (!scene) return;
  disposeScene();

  const bySet = new Map<string, ReliefIcon[]>();
  for (const r of icons) {
    const { set } = resolveSprite(r.href);
    let arr = bySet.get(set);
    if (!arr) {
      arr = [];
      bySet.set(set, arr);
    }
    arr.push(r);
  }

  for (const [set, setIcons] of bySet) {
    const texture = textureCache.get(set);
    if (!texture) continue;
    scene.add(buildSetMesh(setIcons, set, texture));
  }
}

function renderFrame(): void {
  if (!renderer || !camera || !scene || !fo) return;

  const x = -viewX / scale;
  const y = -viewY / scale;
  const w = graphWidth / scale;
  const h = graphHeight / scale;

  fo.setAttribute("x", String(x));
  fo.setAttribute("y", String(y));
  fo.setAttribute("width", String(w));
  fo.setAttribute("height", String(h));

  camera.left = x;
  camera.right = x + w;
  camera.top = y;
  camera.bottom = y + h;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}

// ── Private draw / clear ───────────────────────────────────────────────────────

function drawWebGl(icons: ReliefIcon[]): void {
  const terrainEl = byId("terrain");
  if (!terrainEl) return;
  if (!icons.length) return;

  terrainEl.innerHTML = "";
  terrainEl.dataset.mode = "webGL";
  const set = terrainEl.getAttribute("set") || "simple";

  if (ensureRenderer()) {
    loadTexture(set).then(() => {
      buildScene(icons);
      renderFrame();
    });
  } else {
    WARN && console.warn("Relief: WebGL renderer failed");
  }
}

function drawSvg(icons: ReliefIcon[]): void {
  const terrainEl = byId("terrain");
  if (!terrainEl) return;
  terrainEl.innerHTML = "";

  const html = icons.map(
    (r) =>
      `<use href="${r.href}" data-id="${r.i}" x="${r.x}" y="${r.y}" width="${r.s}" height="${r.s}"/>`,
  );
  terrainEl.innerHTML = html.join("");
  terrainEl.dataset.mode = "svg";
}

window.drawRelief = (type: "svg" | "webGL" = "webGL") => {
  const icons = pack.relief?.length ? pack.relief : generateRelief();
  if (type === "svg") drawSvg(icons);
  else drawWebGl(icons);
};

window.undrawRelief = () => {
  const terrainEl = byId("terrain");
  const mode = terrainEl?.dataset.mode || "webGL";
  if (mode === "webGL") {
    disposeScene();
    disposeTextureCache();
    if (renderer) {
      renderer.dispose();
      renderer = null;
    }
    if (fo) {
      if (fo.isConnected) fo.remove();
      fo = null;
    }
    camera = null;
    scene = null;
  }

  if (terrainEl) terrainEl.innerHTML = "";
};

// re-render the current WebGL frame (called on pan/zoom)
window.rerenderReliefIcons = renderFrame;

// Migrate legacy saves: read <use> elements from the terrain SVG into pack.relief, remove them from the DOM, then render via WebGL.
window.migrateReliefFromSvg = () => {
  const terrainEl = byId("terrain");
  if (!terrainEl) return;
  const relief: ReliefIcon[] = [];

  terrainEl.querySelectorAll<SVGUseElement>("use").forEach((u) => {
    const href = u.getAttribute("href") || u.getAttribute("xlink:href") || "";
    if (!href) return;
    relief.push({
      i: relief.length,
      href,
      x: +u.getAttribute("x")!,
      y: +u.getAttribute("y")!,
      s: +u.getAttribute("width")!,
    });
  });
  terrainEl.innerHTML = "";
  pack.relief = relief;
  drawWebGl(relief);
};

let _reliefSvgInjectedForSave = false;

/**
 * Before SVG serialization: ensure <use> elements are in the terrain group.
 * In WebGL mode, temporarily injects them from pack.relief.
 * In SVG edit mode, elements are already live in the DOM.
 */
window.prepareReliefForSave = () => {
  const terrainEl = byId("terrain");
  if (!terrainEl) return;
  if (terrainEl.querySelectorAll("use").length > 0) {
    _reliefSvgInjectedForSave = false;
  } else {
    terrainEl.insertAdjacentHTML(
      "afterbegin",
      (pack.relief || [])
        .map(
          (r) =>
            `<use href="${r.href}" x="${r.x}" y="${r.y}" width="${r.s}" height="${r.s}"/>`,
        )
        .join(""),
    );
    _reliefSvgInjectedForSave = true;
  }
};

/** Remove temporarily injected <use> elements after serialization. */
window.restoreReliefAfterSave = () => {
  if (_reliefSvgInjectedForSave) {
    for (const el of byId("terrain")?.querySelectorAll("use") ?? [])
      el.remove();
    _reliefSvgInjectedForSave = false;
  }
};

declare global {
  var drawRelief: (type?: "svg" | "webGL") => void;
  var undrawRelief: () => void;
  var rerenderReliefIcons: () => void;
  var migrateReliefFromSvg: () => void;
  var prepareReliefForSave: () => void;
  var restoreReliefAfterSave: () => void;
}
