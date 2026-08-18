import { select } from "d3";
import type { Ice } from "@/generators/ice-generator";

export const drawIce = (): void => {
  TIME && console.time("drawIce");

  select("#ice").selectAll("*").remove();
  let html = "";

  pack.ice.forEach((ice: Ice) => {
    if (ice.type === "glacier") {
      html += getGlacierHtml(ice);
    } else if (ice.type === "iceberg") {
      html += getIcebergHtml(ice);
    }
  });

  select("#ice").html(html);

  TIME && console.timeEnd("drawIce");
};

export const redrawIceberg = (id: number): void => {
  const iceberg = pack.ice.find((element: Ice) => element.i === id);
  let el = select("#ice").selectAll<SVGPolygonElement, unknown>(`polygon[data-id="${id}"]:not([type="glacier"])`);
  if (!iceberg && !el.empty()) {
    el.remove();
  } else if (iceberg) {
    if (el.empty()) {
      // Create new element if it doesn't exist
      const polygon = getIcebergHtml(iceberg);
      select<SVGGElement, unknown>("#ice").node()?.insertAdjacentHTML("beforeend", polygon);
      el = select("#ice").selectAll<SVGPolygonElement, unknown>(`polygon[data-id="${id}"]:not([type="glacier"])`);
    }
    el.attr("points", iceberg.points.toString());
    el.attr("transform", iceberg.offset ? `translate(${iceberg.offset[0]},${iceberg.offset[1]})` : null);
  }
};

export const redrawGlacier = (id: number): void => {
  const glacier = pack.ice.find((element: Ice) => element.i === id);
  let el = select("#ice").selectAll<SVGPolygonElement, unknown>(`polygon[data-id="${id}"][type="glacier"]`);
  if (!glacier && !el.empty()) {
    el.remove();
  } else if (glacier) {
    if (el.empty()) {
      // Create new element if it doesn't exist
      const polygon = getGlacierHtml(glacier);
      select<SVGGElement, unknown>("#ice").node()?.insertAdjacentHTML("beforeend", polygon);
      el = select("#ice").selectAll<SVGPolygonElement, unknown>(`polygon[data-id="${id}"][type="glacier"]`);
    }
    el.attr("points", glacier.points.toString());
    el.attr("transform", glacier.offset ? `translate(${glacier.offset[0]},${glacier.offset[1]})` : null);
  }
};

function getGlacierHtml(glacier: Ice): string {
  return /*html*/ `<polygon points="${glacier.points.toString()}" type="glacier" data-id="${glacier.i}" ${glacier.offset ? `transform="translate(${glacier.offset[0]},${glacier.offset[1]})"` : ""}/>`;
}

function getIcebergHtml(iceberg: Ice): string {
  return /*html*/ `<polygon points="${iceberg.points.toString()}" data-id="${iceberg.i}" ${iceberg.offset ? `transform="translate(${iceberg.offset[0]},${iceberg.offset[1]})"` : ""}/>`;
}
