import { DEFAULT_PROVINCE_LABEL_GROUP } from "@/generators/labels";
import type { LabelNameMode } from "@/types/labels";
import { getLabelPathMarkup, getLabelTextMarkup } from "./draw-label-utils";
import { getLabelGroup, getLabelGroupOptions } from "./label-groups";
import { createRegionLabel, getEffectiveCharacterWidth, type LabelTypography } from "./region-label-layout";

export function drawProvinceLabels(): void {
  removeProvinceLabels();
  let paths = "";
  const texts = new Map<string, string>();
  const cellsByProvince = getProvinceCellCounts();
  const typographyByGroup = new Map<string, LabelTypography>();

  for (const province of pack.provinces) {
    if (!province.i || province.removed) continue;
    const groupName = province.label?.group || DEFAULT_PROVINCE_LABEL_GROUP;
    const mode = (getLabelGroupOptions(groupName)?.mode || "auto") as LabelNameMode;
    const groupTypography = typographyByGroup.get(groupName) ?? getLabelTypography(groupName, typographyByGroup);
    const label = createRegionLabel({
      id: province.i,
      prefix: "province",
      name: province.name || "",
      fullName: province.fullName || province.name || "",
      pole: province.pole || pack.cells.p[province.center],
      cellsNumber: cellsByProvince[province.i] || 0,
      regionIds: pack.cells.province,
      mode,
      averageCharacterWidth: getEffectiveCharacterWidth(groupTypography, province.label),
      override: province.label
    });
    if (!label.pathPoints?.length) continue;
    paths += getLabelPathMarkup(label);
    texts.set(groupName, (texts.get(groupName) || "") + getLabelTextMarkup(label));
  }

  document.getElementById("textPaths")!.insertAdjacentHTML("beforeend", paths);
  for (const [group, markup] of texts) getLabelGroup(group, "province").insertAdjacentHTML("beforeend", markup);
}

export function drawProvinceLabel(provinceId: number): void {
  removeProvinceLabel(provinceId);
  const province = pack.provinces[provinceId];
  if (!province?.i || province.removed) return;
  const groupName = province.label?.group || DEFAULT_PROVINCE_LABEL_GROUP;
  const mode = (getLabelGroupOptions(groupName)?.mode || "auto") as LabelNameMode;
  const label = createRegionLabel({
    id: province.i,
    prefix: "province",
    name: province.name || "",
    fullName: province.fullName || province.name || "",
    pole: province.pole || pack.cells.p[province.center],
    cellsNumber: pack.cells.i.filter(cell => pack.cells.province[cell] === province.i).length,
    regionIds: pack.cells.province,
    mode,
    averageCharacterWidth: getEffectiveCharacterWidth(getLabelTypography(groupName), province.label),
    override: province.label
  });
  if (!label.pathPoints?.length) return;
  document.getElementById("textPaths")!.insertAdjacentHTML("beforeend", getLabelPathMarkup(label));
  getLabelGroup(groupName, "province").insertAdjacentHTML("beforeend", getLabelTextMarkup(label));
}

export function removeProvinceLabels(): void {
  document.querySelectorAll("#labels > g > [data-label-type='province']").forEach(label => {
    label.remove();
  });
  document.querySelectorAll("#textPaths > path[id^='textPath_provinceLabel']").forEach(path => {
    path.remove();
  });
}

export function removeProvinceLabel(provinceId: number): void {
  document.getElementById(`provinceLabel${provinceId}`)?.remove();
  document.getElementById(`textPath_provinceLabel${provinceId}`)?.remove();
}

function getProvinceCellCounts(): Uint32Array {
  const counts = new Uint32Array(pack.provinces.length);
  for (const cell of pack.cells.i) {
    const provinceId = pack.cells.province[cell];
    if (provinceId < counts.length) counts[provinceId]++;
  }
  return counts;
}

function getLabelTypography(groupName: string, cache?: Map<string, LabelTypography>): LabelTypography {
  const group = getLabelGroup(groupName, "province");
  const groupStyle = getComputedStyle(group);
  const sandbox = document.createElementNS("http://www.w3.org/2000/svg", "text");
  sandbox.style.visibility = "hidden";
  sandbox.setAttribute("font-family", groupStyle.fontFamily);
  sandbox.setAttribute("font-size", groupStyle.fontSize);
  sandbox.setAttribute("letter-spacing", groupStyle.letterSpacing);
  sandbox.textContent = "Example";
  document.getElementById("viewbox")!.appendChild(sandbox);
  const averageCharacterWidth = sandbox.getComputedTextLength() / 7 || 4;
  const letterSpacing = Number.parseFloat(groupStyle.letterSpacing) || 0;
  sandbox.remove();
  const typography = { averageCharacterWidth, letterSpacing };
  cache?.set(groupName, typography);
  return typography;
}
