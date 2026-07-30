import type { Label, LabelType } from "@/generators/labels";
import { getLabelGroupStyle } from "./label-groups";

export interface Label3dStyle {
  font: string;
  size: number;
  color: string;
  letterSpacing: number;
}

export function getLabel3dStyle(type: LabelType, requestedGroup?: string, label?: Label, sizeScale = 1): Label3dStyle {
  const groupStyle = getLabelGroupStyle(requestedGroup, type);
  const baseSize =
    Number.parseFloat(String(groupStyle["font-size"] ?? groupStyle["data-size"] ?? "")) || (type === "state" ? 20 : 10);
  const relativeSize = (label?.fontSize ?? 100) / 100;

  return {
    font: String(groupStyle["font-family"] || "Arial"),
    size: baseSize * relativeSize * sizeScale,
    color: String(groupStyle.fill || "#000"),
    letterSpacing: Number(label?.letterSpacing ?? groupStyle["letter-spacing"]) || 0
  };
}
