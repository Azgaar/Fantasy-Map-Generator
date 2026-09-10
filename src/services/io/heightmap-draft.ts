// Fork-only heightmap draft format: lets a user save in-progress heightmap
// painting and resume later without running map generation. Not a .map file —
// stores only the grid identity (seed + dimensions) and painted heights.

const DRAFT_VERSION = 1;

export type HeightmapDraft = {
  seed: string;
  graphWidth: number;
  graphHeight: number;
  cellsDesired: number;
  heights: Uint8Array;
};

export function serializeHeightmapDraft(draft: HeightmapDraft): string {
  const { seed, graphWidth, graphHeight, cellsDesired, heights } = draft;
  return JSON.stringify({
    type: "fmgHeightmapDraft",
    version: DRAFT_VERSION,
    seed,
    graphWidth,
    graphHeight,
    cellsDesired,
    heights: bytesToBase64(heights)
  });
}

export function parseHeightmapDraft(text: string): HeightmapDraft {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("File is not a valid heightmap draft");
  }

  if (data?.type !== "fmgHeightmapDraft") throw new Error("File is not a valid heightmap draft");
  if (data.version !== DRAFT_VERSION) throw new Error(`Unsupported heightmap draft version: ${data.version}`);

  const { seed, graphWidth, graphHeight, cellsDesired, heights } = data;
  const valid =
    typeof seed === "string" &&
    typeof graphWidth === "number" &&
    typeof graphHeight === "number" &&
    typeof cellsDesired === "number" &&
    typeof heights === "string";
  if (!valid) throw new Error("Heightmap draft is missing required fields");

  return { seed, graphWidth, graphHeight, cellsDesired, heights: base64ToBytes(heights) };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
