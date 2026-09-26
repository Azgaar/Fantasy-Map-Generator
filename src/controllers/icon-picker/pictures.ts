// Turns a file or a link into a custom icon's picture: its kind, content and a frame fitted to what it shows.
// Stateless; every thrown message is meant for the author
import { CustomIcons, type IconPicture, Icons, IMAGE_FRAME } from "@/components/icons";
import { sanitizeSvgIcon, scopeSvgIcon } from "@/utils/fileUtils";
import { rn } from "@/utils/numberUtils";

const MAX_SVG_BYTES = 200_000;
const MAX_RASTER_BYTES = 2_000_000;
const MAX_RASTER_SIDE = 256;
const PADDING = 0.05; // of the content's longer side, on every side of the fitted frame
const OPAQUE = 8; // the alpha a pixel needs to count as content
const LOAD_TIMEOUT = 15_000;

/** An uploaded svg or raster image as the picture of icon `id`, whose ids and classes it is scoped to */
async function fromFile(file: File, id: string): Promise<IconPicture> {
  const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
  if (isSvg) {
    if (file.size > MAX_SVG_BYTES)
      throw new Error(
        `The SVG file is ${kilobytes(file.size)}, the limit is 200 kB. Simplify it or link to it instead`
      );
    const svg = sanitizeSvgIcon(await file.text());
    if (!svg) throw new Error("The file is not a valid SVG image");
    scopeSvgIcon(svg, id);
    const picture = CustomIcons.fromSvg(svg);
    return { ...picture, viewBox: svgFrame(picture.content, picture.viewBox) };
  }

  if (!file.type.startsWith("image/"))
    throw new Error("The file is not an image: upload an SVG, PNG, JPEG or WebP file");
  if (file.size > MAX_RASTER_BYTES)
    throw new Error(`The image is ${kilobytes(file.size)}, the limit is 2 MB. Make it smaller or link to it instead`);
  const url = URL.createObjectURL(file);
  try {
    const canvas = rasterize(
      await loadImage(url, false).catch(() => {
        throw new Error("The file cannot be read as an image");
      })
    );
    // WebP where the browser can encode it, PNG where it cannot
    return { kind: "image", content: canvas.toDataURL("image/webp", 0.85), viewBox: alphaFrame(canvas) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** A link to an image hosted elsewhere, confirmed to load */
async function fromLink(link: string): Promise<IconPicture> {
  const url = link.trim();
  if (!/^https?:\/\/\S+$/i.test(url)) throw new Error("Paste a link that starts with http:// or https://");
  const viewBox = await imageFrame(url).catch(async () => {
    await loadImage(url, false).catch(() => {
      throw new Error("The link does not open an image, or its site does not allow it");
    });
    return IMAGE_FRAME; // shown, but its pixels cannot be read
  });
  return { kind: "image", content: url, viewBox };
}

/** The frame around what a picture shows: the svg's bounding box, an image's opaque pixels, else the whole box */
async function fit({ kind, content, viewBox }: IconPicture): Promise<string> {
  if (kind === "svg") return svgFrame(content, viewBox);
  return imageFrame(content).catch(() => IMAGE_FRAME);
}

/** a square around the content's box, padded; the box as it was when it cannot be measured */
function svgFrame(content: string, viewBox: string): string {
  const host = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  host.setAttribute("viewBox", viewBox);
  host.style.cssText = "position: absolute; width: 0; height: 0; visibility: hidden";
  host.innerHTML = content;
  document.body.append(host);
  try {
    const group = host.firstElementChild as SVGGraphicsElement | null;
    const box = typeof group?.getBBox === "function" ? group.getBBox() : null;
    return box && box.width > 0 && box.height > 0 ? squareFrame(box.x, box.y, box.width, box.height) : viewBox;
  } finally {
    host.remove();
  }
}

/** the frame of an image's opaque pixels; rejects when the pixels cannot be read */
async function imageFrame(url: string): Promise<string> {
  return alphaFrame(rasterize(await loadImage(url, url.startsWith("http"))));
}

function loadImage(url: string, crossOrigin: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (crossOrigin) image.crossOrigin = "anonymous";
    const timer = window.setTimeout(() => reject(new Error("timeout")), LOAD_TIMEOUT);
    image.onload = () => {
      window.clearTimeout(timer);
      if (image.naturalWidth && image.naturalHeight) resolve(image);
      else reject(new Error("empty image"));
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("not an image"));
    };
    image.src = url;
  });
}

/** the image redrawn with its longer side at most 256 px */
function rasterize(image: HTMLImageElement): HTMLCanvasElement {
  const scale = Math.min(1, MAX_RASTER_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** the opaque pixels' frame in the 0 0 100 100 box the image is letterboxed in; throws on a tainted canvas */
function alphaFrame(canvas: HTMLCanvasElement): string {
  const { width, height } = canvas;
  const { data } = canvas.getContext("2d")!.getImageData(0, 0, width, height);
  let [left, top, right, bottom] = [width, height, -1, -1];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < OPAQUE) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < 0) return IMAGE_FRAME;
  const scale = 100 / Math.max(width, height);
  const offsetX = (100 - width * scale) / 2;
  const offsetY = (100 - height * scale) / 2;
  const x = offsetX + left * scale;
  const y = offsetY + top * scale;
  return squareFrame(x, y, (right + 1 - left) * scale, (bottom + 1 - top) * scale);
}

function squareFrame(x: number, y: number, width: number, height: number): string {
  const side = Math.max(width, height) * (1 + 2 * PADDING);
  return Icons.formatFrame([x + width / 2 - side / 2, y + height / 2 - side / 2, side, side]);
}

function kilobytes(bytes: number): string {
  return bytes >= 1_000_000 ? `${rn(bytes / 1_000_000, 1)} MB` : `${Math.round(bytes / 1000)} kB`;
}

export const IconPictures = { fromFile, fromLink, fit };
