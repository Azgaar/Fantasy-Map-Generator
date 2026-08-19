import type { LabelType } from "@/generators/labels-generator";
import type { Point } from "@/types/global";
import { rn } from "@/utils";
import { estimateTextWidth } from "./fit-state-label";
import { getGroupStyle } from "./label-groups";

const PATH_USAGE = 0.9; // share of the path length the text is expected to occupy
const ARC_RISE = 0.12; // arc height as a share of the half-length
const MIN_HALF_LENGTH = 5;

type ArcSource = {
  text: string;
  type: LabelType;
  group: string;
  anchor: Point;
  fontSize?: number;
  letterSpacing?: number;
};

/** Gentle arc centered on the label anchor, wide enough to fit the label text */
export function createLabelArc(label: ArcSource): Point[] {
  const groupStyle = getGroupStyle({ name: label.group, type: label.type });
  const baseFontSize = Number.parseFloat(String(groupStyle["font-size"])) || 18;
  const fontSize = baseFontSize * ((label.fontSize ?? 100) / 100);
  const letterSpacing = label.letterSpacing ?? Number(groupStyle["letter-spacing"]) ?? 0;

  const lines = label.text.split("|");
  const textWidth = Math.max(...lines.map(estimateTextWidth), 0) * fontSize;
  const spacingWidth = Math.max(...lines.map(line => Math.max([...line].length - 1, 0)), 0) * letterSpacing;
  const halfLength = Math.max((textWidth + spacingWidth) / 2 / PATH_USAGE, MIN_HALF_LENGTH);

  const [x, y] = label.anchor;
  const rise = (halfLength * ARC_RISE) / 2;
  return [
    [rn(x - halfLength, 2), rn(y + rise, 2)],
    [rn(x, 2), rn(y - rise, 2)],
    [rn(x + halfLength, 2), rn(y + rise, 2)]
  ];
}
