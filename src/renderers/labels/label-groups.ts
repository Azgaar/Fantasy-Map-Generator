import type { LabelType } from "@/generators/labels-generator";
import type { LabelGroupStyle } from "@/types/style";

const BASE_STYLE: LabelGroupStyle = {
  fill: "#3e3e4b",
  opacity: 1,
  stroke: "#3a3a3a",
  "stroke-width": 0,
  "font-family": "Almendra SC",
  "font-size": "18%",
  "letter-spacing": 0,
  style: null,
  filter: null
};

const FALLBACK_STYLES: Record<LabelType, LabelGroupStyle> = {
  state: { ...BASE_STYLE, "font-size": "22%" },
  burg: { ...BASE_STYLE, "font-size": "4%" },
  province: { ...BASE_STYLE, "font-size": "10%" },
  river: { ...BASE_STYLE, "font-size": "3%" },
  route: { ...BASE_STYLE, "font-size": "3%" },
  added: { ...BASE_STYLE, "font-size": "18%" }
};

export function getGroupStyle(group: { name: string; type: LabelType }): LabelGroupStyle {
  const typeStyle = FALLBACK_STYLES[group.type];
  if (!typeStyle) ERROR && console.error(`No fallback style for label group ${group.name} of type ${group.type}`);

  const baseStyle = typeStyle ?? BASE_STYLE;
  const groupStyle = style.labels.groups[group.name] || {};
  return { ...baseStyle, ...groupStyle };
}
