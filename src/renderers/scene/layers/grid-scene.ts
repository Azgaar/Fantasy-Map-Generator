import type { LineBatchPrimitive, LinePathPrimitive, SceneRevision } from "../primitives";

export const GRID_PATTERN_TYPES = [
  "pointyHex",
  "flatHex",
  "square",
  "square45deg",
  "squareTruncated",
  "squareTetrakis",
  "triangleHorizontal",
  "triangleVertical",
  "trihexagonal",
  "rhombille"
] as const;

export type GridPatternType = (typeof GRID_PATTERN_TYPES)[number];

export interface GridSceneStyle {
  dx: number;
  dy: number;
  scale: number;
  type: GridPatternType;
}

export interface GridSceneBounds {
  height: number;
  width: number;
}

type Point = readonly [number, number];
type Segment = readonly [Point, Point];
type PatternTemplate = { height: number; segments: readonly Segment[]; width: number };

export function buildGridScene(
  bounds: GridSceneBounds,
  style: GridSceneStyle,
  revision: SceneRevision = 0
): LineBatchPrimitive {
  if (!Number.isFinite(bounds.width) || bounds.width <= 0 || !Number.isFinite(bounds.height) || bounds.height <= 0) {
    throw new Error(`Invalid grid bounds: ${bounds.width}x${bounds.height}`);
  }
  const template = PATTERNS[style.type] ?? PATTERNS.pointyHex;
  const scale = Number.isFinite(style.scale) && style.scale > 0 ? style.scale : 1;
  const tileWidth = template.width * scale;
  const tileHeight = template.height * scale;
  const shiftX = (Number.isFinite(style.dx) ? style.dx : 0) * scale;
  const shiftY = (Number.isFinite(style.dy) ? style.dy : 0) * scale;
  const minColumn = Math.floor(-shiftX / tileWidth) - 1;
  const maxColumn = Math.ceil((bounds.width - shiftX) / tileWidth) + 1;
  const minRow = Math.floor(-shiftY / tileHeight) - 1;
  const maxRow = Math.ceil((bounds.height - shiftY) / tileHeight) + 1;
  const edgeKeys = new Set<string>();
  const paths: LinePathPrimitive[] = [];

  for (let row = minRow; row <= maxRow; row++) {
    for (let column = minColumn; column <= maxColumn; column++) {
      const originX = shiftX + column * tileWidth;
      const originY = shiftY + row * tileHeight;
      for (let segmentIndex = 0; segmentIndex < template.segments.length; segmentIndex++) {
        const [from, to] = template.segments[segmentIndex];
        const clipped = clipSegment(
          [originX + from[0] * scale, originY + from[1] * scale],
          [originX + to[0] * scale, originY + to[1] * scale],
          bounds
        );
        if (!clipped) continue;
        const edgeKey = getEdgeKey(clipped);
        if (edgeKeys.has(edgeKey)) continue;
        edgeKeys.add(edgeKey);
        paths.push({ domainId: `${style.type}:${column}:${row}:${segmentIndex}`, points: clipped });
      }
    }
  }

  return {
    bounds: { maxX: bounds.width, maxY: bounds.height, minX: 0, minY: 0 },
    domainIds: paths.map(path => path.domainId),
    kind: "line-batch",
    layer: "grid",
    paths,
    revision
  };
}

function getEdgeKey([from, to]: Segment): string {
  const a = `${roundCoordinate(from[0])},${roundCoordinate(from[1])}`;
  const b = `${roundCoordinate(to[0])},${roundCoordinate(to[1])}`;
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function roundCoordinate(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function clipSegment(from: Point, to: Point, bounds: GridSceneBounds): Segment | null {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  let start = 0;
  let end = 1;
  for (const [p, q] of [
    [-dx, from[0]],
    [dx, bounds.width - from[0]],
    [-dy, from[1]],
    [dy, bounds.height - from[1]]
  ] as const) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const ratio = q / p;
    if (p < 0) start = Math.max(start, ratio);
    else end = Math.min(end, ratio);
    if (start > end) return null;
  }
  const clippedFrom: Point = [from[0] + start * dx, from[1] + start * dy];
  const clippedTo: Point = [from[0] + end * dx, from[1] + end * dy];
  if (Math.abs(clippedFrom[0] - clippedTo[0]) < 1e-6 && Math.abs(clippedFrom[1] - clippedTo[1]) < 1e-6) {
    return null;
  }
  return [clippedFrom, clippedTo];
}

function segments(...polylines: readonly Point[][]): Segment[] {
  return polylines.flatMap(points => points.slice(1).map((point, index) => [points[index], point] as Segment));
}

const PATTERNS: Record<GridPatternType, PatternTemplate> = {
  square: {
    height: 25,
    segments: segments([
      [25, 0],
      [0, 0],
      [0, 25]
    ]),
    width: 25
  },
  pointyHex: {
    height: 43.4,
    segments: segments(
      [
        [0, 0],
        [12.5, 7.2],
        [25, 0]
      ],
      [
        [12.5, 21.7],
        [12.5, 7.2]
      ],
      [
        [0, 43.4],
        [0, 28.9],
        [12.5, 21.7],
        [25, 28.9],
        [25, 43.4]
      ]
    ),
    width: 25
  },
  flatHex: {
    height: 25,
    segments: segments(
      [
        [43.4, 0],
        [36.2, 12.5],
        [43.4, 25]
      ],
      [
        [21.7, 12.5],
        [36.2, 12.5]
      ],
      [
        [0, 0],
        [14.5, 0],
        [21.7, 12.5],
        [14.5, 25],
        [0, 25]
      ]
    ),
    width: 43.4
  },
  square45deg: {
    height: 35.355,
    segments: segments(
      [
        [0, 0],
        [35.355, 35.355]
      ],
      [
        [0, 35.355],
        [35.355, 0]
      ]
    ),
    width: 35.355
  },
  squareTruncated: {
    height: 25,
    segments: segments(
      [
        [8.33, 25],
        [0, 16.66],
        [0, 8.33],
        [8.33, 0],
        [16.66, 0],
        [25, 8.33]
      ],
      [
        [16.66, 25],
        [25, 16.66],
        [25, 8.33]
      ],
      [
        [8.33, 25],
        [16.66, 25]
      ]
    ),
    width: 25
  },
  squareTetrakis: {
    height: 25,
    segments: segments(
      [
        [25, 0],
        [0, 0],
        [0, 25]
      ],
      [
        [0, 0],
        [25, 25]
      ],
      [
        [0, 25],
        [25, 0]
      ],
      [
        [12.5, 0],
        [12.5, 25]
      ],
      [
        [0, 12.5],
        [25, 12.5]
      ],
      [
        [0, 25],
        [25, 25],
        [25, 0]
      ]
    ),
    width: 25
  },
  triangleHorizontal: {
    height: 72.33,
    segments: segments(
      [
        [41.76, 36.165],
        [0, 36.165],
        [20.88, 0],
        [41.76, 36.165],
        [20.88, 72.33],
        [0, 36.165]
      ],
      [
        [0, 0],
        [41.76, 0]
      ],
      [
        [0, 72.33],
        [41.76, 72.33]
      ]
    ),
    width: 41.76
  },
  triangleVertical: {
    height: 41.76,
    segments: segments(
      [
        [36.165, 0],
        [0, 20.88],
        [36.165, 41.76],
        [72.33, 20.88],
        [36.165, 0],
        [36.165, 41.76]
      ],
      [
        [0, 0],
        [0, 41.76]
      ],
      [
        [72.33, 0],
        [72.33, 41.76]
      ]
    ),
    width: 72.33
  },
  trihexagonal: {
    height: 43.4,
    segments: segments([
      [25, 10.85],
      [0, 10.85],
      [18.85, 43.4],
      [25, 32.55],
      [0, 32.55],
      [18.85, 0],
      [25, 10.85]
    ]),
    width: 25
  },
  rhombille: {
    height: 50,
    segments: segments(
      [
        [13.8, 50],
        [0, 25],
        [13.8, 0],
        [41.2, 0],
        [27.5, 25],
        [41.2, 50],
        [55, 25],
        [41.2, 0],
        [68.8, 0],
        [82.5, 25],
        [68.8, 50]
      ],
      [
        [0, 25],
        [27.5, 25]
      ],
      [
        [55, 25],
        [82.5, 25]
      ],
      [
        [13.8, 50],
        [41.2, 50],
        [68.8, 50]
      ]
    ),
    width: 82.5
  }
};
