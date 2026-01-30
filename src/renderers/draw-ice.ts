declare global {
  var drawIce: () => void;
  var redrawIceberg: (id: number) => void;
  var redrawGlacier: (id: number) => void;
}

interface IceElement {
  i: number;
  points: string | [number, number][];
  type: "glacier" | "iceberg";
  offset?: [number, number];
}

const iceRenderer = (): void => {
  TIME && console.time("drawIce");

  // Clear existing ice SVG
  ice.selectAll("*").remove();

  let html = "";

  // Draw all ice elements
  pack.ice.forEach((iceElement: IceElement) => {
    if (iceElement.type === "glacier") {
      html += getGlacierHtml(iceElement);
    } else if (iceElement.type === "iceberg") {
      html += getIcebergHtml(iceElement);
    }
  });

  ice.html(html);

  TIME && console.timeEnd("drawIce");
};

const redrawIcebergRenderer = (id: number): void => {
  TIME && console.time("redrawIceberg");
  const iceberg = pack.ice.find((element: IceElement) => element.i === id);
  let el = ice.selectAll<SVGPolygonElement, unknown>(
    `polygon[data-id="${id}"]:not([type="glacier"])`,
  );
  if (!iceberg && !el.empty()) {
    el.remove();
  } else if (iceberg) {
    if (el.empty()) {
      // Create new element if it doesn't exist
      const polygon = getIcebergHtml(iceberg);
      (ice.node() as SVGGElement).insertAdjacentHTML("beforeend", polygon);
      el = ice.selectAll<SVGPolygonElement, unknown>(
        `polygon[data-id="${id}"]:not([type="glacier"])`,
      );
    }
    el.attr("points", iceberg.points as string);
    el.attr(
      "transform",
      iceberg.offset
        ? `translate(${iceberg.offset[0]},${iceberg.offset[1]})`
        : null,
    );
  }
  TIME && console.timeEnd("redrawIceberg");
};

const redrawGlacierRenderer = (id: number): void => {
  TIME && console.time("redrawGlacier");
  const glacier = pack.ice.find((element: IceElement) => element.i === id);
  let el = ice.selectAll<SVGPolygonElement, unknown>(
    `polygon[data-id="${id}"][type="glacier"]`,
  );
  if (!glacier && !el.empty()) {
    el.remove();
  } else if (glacier) {
    if (el.empty()) {
      // Create new element if it doesn't exist
      const polygon = getGlacierHtml(glacier);
      (ice.node() as SVGGElement).insertAdjacentHTML("beforeend", polygon);
      el = ice.selectAll<SVGPolygonElement, unknown>(
        `polygon[data-id="${id}"][type="glacier"]`,
      );
    }
    el.attr("points", glacier.points as string);
    el.attr(
      "transform",
      glacier.offset
        ? `translate(${glacier.offset[0]},${glacier.offset[1]})`
        : null,
    );
  }
  TIME && console.timeEnd("redrawGlacier");
};

function getGlacierHtml(glacier: IceElement): string {
  return `<polygon points="${glacier.points}" type="glacier" data-id="${glacier.i}" ${glacier.offset ? `transform="translate(${glacier.offset[0]},${glacier.offset[1]})"` : ""}/>`;
}

function getIcebergHtml(iceberg: IceElement): string {
  return `<polygon points="${iceberg.points}" data-id="${iceberg.i}" ${iceberg.offset ? `transform="translate(${iceberg.offset[0]},${iceberg.offset[1]})"` : ""}/>`;
}

window.drawIce = iceRenderer;
window.redrawIceberg = redrawIcebergRenderer;
window.redrawGlacier = redrawGlacierRenderer;
