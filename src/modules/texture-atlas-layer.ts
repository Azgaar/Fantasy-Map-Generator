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

export interface AtlasConfig {
  url: string;
  ids: string[];
  cols: number;
  rows: number;
}

export interface AtlasItem {
  icon: string;
  x: number;
  y: number;
  s: number;
}

export class TextureAtlasLayer {
  private group: Group | null = null;
  private readonly textureCache = new Map<string, Texture>();
  private readonly atlases: Record<string, AtlasConfig>;

  constructor(id: string, atlases: Record<string, AtlasConfig>) {
    this.atlases = atlases;
    for (const [atlasId, config] of Object.entries(atlases)) {
      this.preloadTexture(atlasId, config.url);
    }
    WebGLLayer.register({
      id,
      setup: (group) => {
        this.group = group;
      },
      dispose: () => {
        this.disposeAll();
      },
    });
  }

  draw(items: AtlasItem[]) {
    if (!this.group) return;
    this.disposeGroup();

    const byAtlas = new Map<string, { item: AtlasItem; tileIndex: number }[]>();
    for (const item of items) {
      for (const [atlasId, config] of Object.entries(this.atlases)) {
        const tileIndex = config.ids.indexOf(item.icon);
        if (tileIndex === -1) continue;
        let arr = byAtlas.get(atlasId);
        if (!arr) {
          arr = [];
          byAtlas.set(atlasId, arr);
        }
        arr.push({ item, tileIndex });
        break;
      }
    }

    for (const [atlasId, entries] of byAtlas) {
      const texture = this.textureCache.get(atlasId);
      const config = this.atlases[atlasId];
      if (!texture || !config) continue;
      this.group.add(buildMesh(entries, config, texture));
    }
    WebGLLayer.rerender();
  }

  clear() {
    this.disposeGroup();
    WebGLLayer.rerender();
  }

  private preloadTexture(atlasId: string, url: string) {
    new TextureLoader().load(
      url,
      (texture) => {
        texture.flipY = false;
        texture.colorSpace = SRGBColorSpace;
        texture.needsUpdate = true;
        texture.minFilter = LinearMipmapLinearFilter;
        texture.magFilter = LinearFilter;
        texture.generateMipmaps = true;
        this.textureCache.set(atlasId, texture);
      },
      undefined,
      () => {
        ERROR && console.error(`TextureAtlasLayer: failed to load "${url}"`);
      },
    );
  }

  private disposeGroup() {
    if (!this.group) return;
    this.group.traverse((obj) => {
      if (obj instanceof Mesh) {
        obj.geometry.dispose();
        (obj.material as MeshBasicMaterial).dispose();
      }
    });
    this.group.clear();
  }

  private disposeAll() {
    this.disposeGroup();
    for (const tex of this.textureCache.values()) tex.dispose();
    this.textureCache.clear();
  }
}

function buildMesh(
  entries: Array<{ item: AtlasItem; tileIndex: number }>,
  atlas: AtlasConfig,
  texture: Texture,
): Mesh {
  const { cols, rows } = atlas;
  const positions = new Float32Array(entries.length * 4 * 3);
  const uvs = new Float32Array(entries.length * 4 * 2);
  const indices = new Uint32Array(entries.length * 6);

  let vi = 0,
    ii = 0;
  for (const { item: q, tileIndex } of entries) {
    const col = tileIndex % cols;
    const row = Math.floor(tileIndex / cols);
    const u0 = col / cols,
      u1 = (col + 1) / cols;
    const v0 = row / rows,
      v1 = (row + 1) / rows;
    const x1 = q.x + q.s,
      y1 = q.y + q.s;
    const base = vi;
    positions.set([q.x, q.y, 0], vi * 3);
    uvs.set([u0, v0], vi * 2);
    vi++;
    positions.set([x1, q.y, 0], vi * 3);
    uvs.set([u1, v0], vi * 2);
    vi++;
    positions.set([q.x, y1, 0], vi * 3);
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

  return new Mesh(
    geo,
    new MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: DoubleSide,
      depthTest: false,
      depthWrite: false,
    }),
  );
}
