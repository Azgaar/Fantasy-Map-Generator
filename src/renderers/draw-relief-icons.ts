import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  type Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
} from "three";
import { RELIEF_SYMBOLS } from "../config/relief-config";
import type { ReliefIcon } from "../modules/relief-generator";
import { generateRelief } from "../modules/relief-generator";
import { byId } from "../utils";

const textureCache = new Map<string, Texture>(); // set name → Texture
let terrainGroup: Group | null = null;
let lastBuiltIcons: ReliefIcon[] | null = null;
let lastBuiltSet: string | null = null;

WebGLLayer.register({
  id: "terrain",
  setup(group: Group): void {
    terrainGroup = group;
    preloadTextures();
  },
  render(_group: Group): void {
    // no-op: relief geometry is static between drawRelief() calls
  },
  dispose(group: Group): void {
    group.traverse((obj) => {
      if (obj instanceof Mesh) {
        obj.geometry.dispose();
        (obj.material as MeshBasicMaterial).map?.dispose();
        (obj.material as MeshBasicMaterial).dispose();
      }
    });
    disposeTextureCache();
  },
});

function preloadTextures(): void {
  for (const set of Object.keys(RELIEF_SYMBOLS)) loadTexture(set);
}

function loadTexture(set: string): Promise<Texture | null> {
  if (textureCache.has(set))
    return Promise.resolve(textureCache.get(set) ?? null);

  return new Promise((resolve) => {
    const loader = new TextureLoader();
    loader.load(
      `images/relief/${set}.png`,
      (texture) => {
        texture.flipY = false;
        texture.colorSpace = SRGBColorSpace;
        texture.needsUpdate = true;
        texture.minFilter = LinearMipmapLinearFilter;
        texture.magFilter = LinearFilter;
        texture.generateMipmaps = true;
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

// map a symbol href to its atlas set and tile index
function resolveSprite(symbolHref: string): {
  set: string;
  tileIndex: number;
} {
  const id = symbolHref.startsWith("#") ? symbolHref.slice(1) : symbolHref;
  for (const [set, ids] of Object.entries(RELIEF_SYMBOLS)) {
    const idx = ids.indexOf(id);
    if (idx !== -1) return { set, tileIndex: idx };
  }
  throw new Error(`Relief: unknown symbol href "${symbolHref}"`);
}

// Build a Mesh with all icon quads for one atlas set.
function buildSetMesh(
  entries: Array<{ icon: ReliefIcon; tileIndex: number }>,
  set: string,
  texture: Texture,
): Mesh {
  const ids = RELIEF_SYMBOLS[set] ?? [];
  const n = ids.length || 1;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);

  const positions = new Float32Array(entries.length * 4 * 3);
  const uvs = new Float32Array(entries.length * 4 * 2);
  const indices = new Uint32Array(entries.length * 6);

  let vi = 0,
    ii = 0;
  for (const { icon: r, tileIndex } of entries) {
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

  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(positions, 3));
  geo.setAttribute("uv", new BufferAttribute(uvs, 2));
  geo.setIndex(new BufferAttribute(indices, 1));

  const mat = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: DoubleSide,
    depthTest: false,
    depthWrite: false,
  });

  return new Mesh(geo, mat);
}

function disposeTextureCache(): void {
  for (const tex of textureCache.values()) tex?.dispose();
  textureCache.clear();
}

function buildReliefScene(icons: ReliefIcon[]): void {
  if (!terrainGroup) return;
  terrainGroup.traverse((obj) => {
    if (obj instanceof Mesh) {
      obj.geometry.dispose();
      (obj.material as MeshBasicMaterial).dispose();
    }
  });
  terrainGroup.clear();

  const bySet = new Map<
    string,
    Array<{ icon: ReliefIcon; tileIndex: number }>
  >();
  for (const r of icons) {
    const { set, tileIndex } = resolveSprite(r.href);
    let arr = bySet.get(set);
    if (!arr) {
      arr = [];
      bySet.set(set, arr);
    }
    arr.push({ icon: r, tileIndex });
  }

  for (const [set, setEntries] of bySet) {
    const texture = textureCache.get(set);
    if (!texture) continue;
    terrainGroup.add(buildSetMesh(setEntries, set, texture));
  }
}

function drawSvg(icons: ReliefIcon[], parentEl: HTMLElement): void {
  parentEl.innerHTML = icons
    .map(
      (r) =>
        `<use href="${r.href}" data-id="${r.i}" x="${r.x}" y="${r.y}" width="${r.s}" height="${r.s}"/>`,
    )
    .join("");
}

window.drawRelief = (
  type: "svg" | "webGL" = "webGL",
  parentEl: HTMLElement | undefined = byId("terrain"),
) => {
  if (!parentEl) throw new Error("Relief: parent element not found");

  parentEl.innerHTML = "";
  parentEl.dataset.mode = type;

  const icons = pack.relief?.length ? pack.relief : generateRelief();
  if (!icons.length) return;

  if (type === "svg") {
    drawSvg(icons, parentEl);
  } else {
    const set = parentEl.getAttribute("set") || "simple";
    loadTexture(set).then(() => {
      if (icons !== lastBuiltIcons || set !== lastBuiltSet) {
        buildReliefScene(icons);
        lastBuiltIcons = icons;
        lastBuiltSet = set;
      }
      WebGLLayer.requestRender();
    });
  }
};

window.undrawRelief = () => {
  WebGLLayer.clearLayer("terrain");
  lastBuiltIcons = null;
  lastBuiltSet = null;
  const terrainEl = byId("terrain");
  if (terrainEl) terrainEl.innerHTML = "";
};

window.rerenderReliefIcons = () => {
  WebGLLayer.requestRender();
};

declare global {
  var drawRelief: (type?: "svg" | "webGL", parentEl?: HTMLElement) => void;
  var undrawRelief: () => void;
  var rerenderReliefIcons: () => void;
}
