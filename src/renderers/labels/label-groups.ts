import type { LabelGroup, LabelType } from "@/generators/labels-generator";
import type { Styles } from "@/generators/styles-schema";

type LabelGroupStyle = Styles["labels"]["groups"][string];

export function renderLabelGroups(root: ParentNode = document): void {
  const labels = root.querySelector<SVGGElement>("#labels");
  if (!labels) throw new Error("Labels container not found");

  labels.replaceChildren();
  for (const groupOptions of options.labels.groups) {
    renderLabelGroup(labels, groupOptions);
  }
}

export function renderLabelGroup(labels: SVGGElement, groupOptions: LabelGroup): SVGGElement {
  const group = labels.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g");
  group.id = `labels-${groupOptions.name}`;
  group.dataset.group = groupOptions.name;

  writeGroupStyle(group, getGroupStyle(groupOptions));

  labels.appendChild(group);
  return group;
}

export function writeGroupStyle(group: SVGGElement, groupStyle: LabelGroupStyle): void {
  for (const [attribute, value] of Object.entries(groupStyle.attrs)) {
    if (value !== null) {
      group.setAttribute(attribute, String(value));
    } else {
      group.removeAttribute(attribute);
    }
  }
}

const BASE_ATTRS: LabelGroupStyle["attrs"] = {
  opacity: 1,
  fill: "#3e3e4b",
  "fill-opacity": null,
  stroke: "#3a3a3a",
  "stroke-width": 0,
  "stroke-dasharray": null,
  "stroke-linecap": null,
  "letter-spacing": 0,
  "font-size": "18%",
  "font-family": "Almendra SC",
  style: null,
  filter: null
};

const FALLBACK_FONT_SIZES: Record<LabelType, string> = {
  state: "22%",
  burg: "4%",
  province: "10%",
  river: "3%",
  route: "3%",
  added: "18%"
};

export function getGroupStyle(group: { name: string; type: LabelType }): LabelGroupStyle {
  const stored = styles.labels.groups[group.name];
  if (stored) return stored;

  const fontSize = FALLBACK_FONT_SIZES[group.type];
  if (!fontSize) ERROR && console.error(`No fallback style for label group ${group.name} of type ${group.type}`);
  return {
    attrs: { ...BASE_ATTRS, "font-size": fontSize ?? BASE_ATTRS["font-size"] }
  };
}
