import type { LabelType } from "@/model/annotations/labels-generator";
import type { Point } from "@/types/global";
import { rn } from "@/utils/number-utils";
import { applyTextTransform, estimateTextWidth } from "./fit-state-label";
import { getGroupStyle } from "./label-groups";

const PATH_USAGE = 0.9; // share of the path length the text is expected to occupy
const ARC_RISE = 0.12; // arc height as a share of the half-length
const MIN_HALF_LENGTH = 5;

type TextSource = {
  text: string;
  type: LabelType;
  group: string;
  fontSize?: number;
  letterSpacing?: number;
};

/** The length a label's text is expected to run, in map units; an estimate that knows nothing of the typeface */
export function estimateLabelLength(label: TextSource): number {
  const groupStyle = getGroupStyle({ name: label.group, type: label.type });
  const baseFontSize = Number.parseFloat(groupStyle.attrs["font-size"]) || 18;
  const fontSize = baseFontSize * ((label.fontSize ?? 100) / 100);
  const letterSpacing = label.letterSpacing ?? groupStyle.attrs["letter-spacing"] ?? 0;
  const displayed = applyTextTransform(groupStyle.attrs.style);

  const lines = label.text.split("|");
  const textWidth = Math.max(...lines.map(line => estimateTextWidth(displayed(line))), 0) * fontSize;
  const spacingWidth = Math.max(...lines.map(line => Math.max([...line].length - 1, 0)), 0) * letterSpacing;
  return textWidth + spacingWidth;
}

/** Gentle arc centered on the label anchor, wide enough to fit the label text */
export function createLabelArc(label: TextSource & { anchor: Point }): Point[] {
  const halfLength = Math.max(estimateLabelLength(label) / 2 / PATH_USAGE, MIN_HALF_LENGTH);

  const [x, y] = label.anchor;
  const rise = (halfLength * ARC_RISE) / 2;
  return [
    [rn(x - halfLength, 2), rn(y + rise, 2)],
    [rn(x, 2), rn(y - rise, 2)],
    [rn(x + halfLength, 2), rn(y + rise, 2)]
  ];
}
