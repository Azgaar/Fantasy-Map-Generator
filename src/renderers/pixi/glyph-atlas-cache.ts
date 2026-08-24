import type { BitmapFontInstallOptions } from "pixi.js";
import type { RendererResourceTracker } from "../core/resource-budget";
import { RendererResourceCache, type RendererResourceHandle } from "../core/resource-cache";
import type { LabelSceneGroup, ResolvedLabelGroupStyle } from "../scene/layers/label-scene";

export interface BitmapFontInstaller {
  install(options: BitmapFontInstallOptions): unknown;
  uninstall(name: string): void;
}

export interface GlyphAtlasDescriptor {
  bytes: number;
  installOptions: BitmapFontInstallOptions & { name: string };
  key: string;
  name: string;
}

export interface GlyphAtlasHandle extends RendererResourceHandle<GlyphAtlasDescriptor> {}

export interface GlyphAtlasCacheOptions {
  budgetBytes: number;
  installer: BitmapFontInstaller;
  tracker?: RendererResourceTracker;
}

export interface LabelAtlasResolutionRequest {
  budgetBytes: number;
  cameraScale: number;
  groups: readonly LabelSceneGroup[];
  rendererResolution: number;
  resizeOnZoom: boolean;
}

const MAX_LABEL_ATLAS_RESOLUTION = 8;
const LABEL_ATLAS_RESOLUTION_MULTIPLIERS = [1, 1.5, 2, 3, 4, 6, 8] as const;

export class GlyphAtlasCache {
  private readonly cache: RendererResourceCache<GlyphAtlasDescriptor>;

  constructor(private readonly options: GlyphAtlasCacheOptions) {
    this.cache = new RendererResourceCache<GlyphAtlasDescriptor>({
      budgetBytes: options.budgetBytes,
      destroy: atlas => options.installer.uninstall(atlas.name),
      estimateBytes: atlas => atlas.bytes,
      kind: "glyph",
      tracker: options.tracker
    });
  }

  acquire(group: LabelSceneGroup, resolution: number, resolvedFontFamily: string): Promise<GlyphAtlasHandle> {
    return this.acquireCharacters(collectGlyphCharacters(group), group.style, resolution, resolvedFontFamily);
  }

  acquireCharacters(
    characters: string,
    style: ResolvedLabelGroupStyle,
    resolution: number,
    resolvedFontFamily: string
  ): Promise<GlyphAtlasHandle> {
    const descriptor = createGlyphAtlasDescriptorFromCharacters(characters, style, resolution, resolvedFontFamily);
    return this.cache.acquire(descriptor.key, async () => {
      this.options.installer.install(descriptor.installOptions);
      return descriptor;
    });
  }

  clear(): void {
    this.cache.clear();
  }

  getSnapshot(): { bytes: number; entries: number; referenced: number } {
    return this.cache.getSnapshot();
  }
}

export function createGlyphAtlasDescriptor(
  group: LabelSceneGroup,
  resolution: number,
  resolvedFontFamily: string
): GlyphAtlasDescriptor {
  const characters = collectGlyphCharacters(group);
  return createGlyphAtlasDescriptorFromCharacters(characters, group.style, resolution, resolvedFontFamily);
}

export function createGlyphAtlasDescriptorFromCharacters(
  characters: string,
  style: ResolvedLabelGroupStyle,
  resolution: number,
  resolvedFontFamily: string
): GlyphAtlasDescriptor {
  const normalizedResolution = Math.max(1, Math.round(resolution * 100) / 100);
  const bitmapStyle = toBitmapFontStyle(style, resolvedFontFamily);
  const key = JSON.stringify({
    characters,
    resolution: normalizedResolution,
    style: bitmapStyle
  });
  const name = `fm-label-${hashString(key)}`;
  return {
    bytes: estimateGlyphAtlasBytes([...characters].length, style, normalizedResolution),
    installOptions: {
      chars: characters,
      dynamicFill: false,
      name,
      padding: 4,
      resolution: normalizedResolution,
      skipKerning: false,
      style: bitmapStyle,
      textureStyle: { scaleMode: "linear" }
    },
    key,
    name
  };
}

export function collectGlyphCharacters(group: LabelSceneGroup): string {
  const characters = new Set<string>([" ", "?"]);
  for (const label of group.labels) {
    for (const character of label.text) {
      if (character !== "\n" && character !== "\r") characters.add(character);
    }
    for (const glyph of label.curvedGlyphs ?? []) characters.add(glyph.character);
  }
  return [...characters].sort((left, right) => (left.codePointAt(0) ?? 0) - (right.codePointAt(0) ?? 0)).join("");
}

export function estimateGlyphAtlasBytes(
  characterCount: number,
  style: ResolvedLabelGroupStyle,
  resolution: number
): number {
  const shadowPadding = style.shadow ? style.shadow.blur * 2 + style.shadow.distance : 0;
  const effectPadding = 4 + style.strokeWidth + shadowPadding;
  const glyphSide = Math.max(1, Math.ceil((style.fontSize + effectPadding * 2) * resolution));
  const glyphPixels = Math.max(1, characterCount) * glyphSide * glyphSide;
  const pagePixels = Math.ceil(512 * resolution) ** 2;
  return Math.max(1, Math.ceil(glyphPixels / pagePixels)) * pagePixels * 4;
}

export function selectLabelAtlasResolution(request: LabelAtlasResolutionRequest): number {
  const rendererResolution = Math.max(1, request.rendererResolution);
  const cameraScale = Math.max(1, request.cameraScale);
  const renderedScale = request.resizeOnZoom ? (cameraScale + 1) / 2 : cameraScale;
  const desiredResolution = Math.min(rendererResolution * renderedScale, MAX_LABEL_ATLAS_RESOLUTION);
  const candidates = [
    ...new Set(
      LABEL_ATLAS_RESOLUTION_MULTIPLIERS.map(multiplier =>
        Math.min(Math.round(rendererResolution * multiplier * 100) / 100, MAX_LABEL_ATLAS_RESOLUTION)
      )
    )
  ].sort((left, right) => left - right);
  const desiredCandidate = candidates.find(candidate => candidate >= desiredResolution) ?? MAX_LABEL_ATLAS_RESOLUTION;
  const groups = request.groups.filter(group => group.labels.length);
  const affordable = candidates.filter(
    candidate =>
      candidate <= desiredCandidate &&
      groups.reduce(
        (bytes, group) =>
          bytes + estimateGlyphAtlasBytes([...collectGlyphCharacters(group)].length, group.style, candidate),
        0
      ) <= request.budgetBytes
  );
  return affordable.at(-1) ?? rendererResolution;
}

function toBitmapFontStyle(style: ResolvedLabelGroupStyle, fontFamily: string): BitmapFontInstallOptions["style"] {
  return {
    align: "center",
    dropShadow: style.shadow
      ? {
          alpha: 1,
          angle: Math.atan2(style.shadow.offsetY, style.shadow.offsetX),
          blur: style.shadow.blur,
          color: style.shadow.color,
          distance: style.shadow.distance
        }
      : undefined,
    fill: style.fill,
    fontFamily,
    fontSize: Math.max(1, style.fontSize),
    stroke: style.strokeWidth > 0 ? { color: style.stroke, width: style.strokeWidth } : undefined
  };
}

function hashString(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${(first >>> 0).toString(36)}-${(second >>> 0).toString(36)}`;
}
