// Browser-mode test (vitest.browser.config.ts): goods art measured as a browser draws it
import { expect, test } from "vitest";

const files = import.meta.glob<string>("@/assets/icons/goods/*.svg", { query: "?raw", import: "default", eager: true });

test("every goods icon is centred in its frame, as its circle is", () => {
  for (const [path, source] of Object.entries(files)) {
    const host = document.createElement("div");
    host.innerHTML = source;
    document.body.append(host);
    const box = host.querySelector("svg")!.getBBox(); // the drawing in the frame, its scale groups applied
    host.remove();
    const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
    const name = path.split("/").pop();
    expect(Math.abs(x - 50), `${name} horizontal centre`).toBeLessThanOrEqual(4);
    expect(Math.abs(y - 50), `${name} vertical centre`).toBeLessThanOrEqual(4);
  }
});

const SIZE = 1000; // px per 100-unit frame

/** The typical line weight of an icon drawn at a stroke width, in frame units: twice the median distance
 * from the ridge of its dark pixels to their edge */
async function lineWeight(source: string, strokeWidth: number, colour = "#000"): Promise<number> {
  const markup = source
    .replace(
      /<svg([^>]*)>/,
      `<svg$1 width="${SIZE}" height="${SIZE}"><g stroke="${colour}" stroke-width="${strokeWidth}">`
    )
    .replace(/<\/svg>\s*$/, "</g></svg>");
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const context = canvas.getContext("2d")!;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, SIZE, SIZE).data;

  // chamfer distance of every dark pixel to the nearest light one
  const distance = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    const dark = pixels[i * 4 + 3] > 127 && pixels[i * 4] < 90 && pixels[i * 4 + 1] < 90 && pixels[i * 4 + 2] < 90;
    distance[i] = dark ? 1e9 : 0;
  }
  const pass = (i: number, neighbours: number[], diagonal: number[]) => {
    let m = distance[i];
    for (const n of neighbours) if (n >= 0 && n < distance.length) m = Math.min(m, distance[n] + 1);
    for (const n of diagonal) if (n >= 0 && n < distance.length) m = Math.min(m, distance[n] + Math.SQRT2);
    distance[i] = m;
  };
  for (let i = 0; i < SIZE * SIZE; i++) if (distance[i]) pass(i, [i - 1, i - SIZE], [i - SIZE - 1, i - SIZE + 1]);
  for (let i = SIZE * SIZE - 1; i >= 0; i--) if (distance[i]) pass(i, [i + 1, i + SIZE], [i + SIZE + 1, i + SIZE - 1]);

  const ridge: number[] = [];
  for (let y = 1; y < SIZE - 1; y++)
    for (let x = 1; x < SIZE - 1; x++) {
      const i = y * SIZE + x;
      const d = distance[i];
      if (
        d &&
        [-SIZE - 1, -SIZE, -SIZE + 1, -1, 1, SIZE - 1, SIZE, SIZE + 1].every(offset => d >= distance[i + offset])
      )
        ridge.push(d);
    }
  ridge.sort((a, b) => a - b);
  if (!ridge.length) return 0;
  return (2 * ridge[Math.floor(ridge.length / 2)] - 1) / (SIZE / 100);
}

test.each([1, 2, 4])("goods linework follows an inherited stroke width of %s", async width => {
  for (const [path, source] of Object.entries(files)) {
    const weight = await lineWeight(source, width);
    const name = path.split("/").pop();
    expect.soft(weight, `${name} line weight`).toBeGreaterThanOrEqual(width * 0.7);
    expect.soft(weight, `${name} line weight`).toBeLessThanOrEqual(width * 1.2);
  }
});

test("goods have no baked-in black linework when strokes are hidden or recoloured", async () => {
  for (const [path, source] of Object.entries(files)) {
    expect(await lineWeight(source, 0), `${path} zero stroke`).toBe(0);
    expect(await lineWeight(source, 2, "#c2410c"), `${path} recoloured stroke`).toBe(0);
  }
});
