// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { IconPictures } from "./pictures";

const svgFile = (markup: string, name = "icon.svg") => new File([markup], name, { type: "image/svg+xml" });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("an uploaded svg keeps its root paint, is scoped to the icon and loses its scripts", async () => {
  const picture = await IconPictures.fromFile(
    svgFile(
      '<svg viewBox="0 0 20 20" fill="navy" stroke="#000"><style>.a{fill:red}</style><script>x()</script><path id="leaf" class="a" onclick="y()"/></svg>'
    ),
    "custom-1a2b3c4d"
  );
  expect(picture.kind).toBe("svg");
  expect(picture.viewBox).toBe("0 0 20 20"); // nothing to measure in jsdom: the file's own frame
  expect(picture.content).toMatch(/^<g fill="navy" stroke="#000">/);
  expect(picture.content).toContain('id="custom-1a2b3c4d-leaf"');
  expect(picture.content).toContain(".custom-1a2b3c4d-a{fill:red}");
  expect(picture.content).not.toContain("script");
  expect(picture.content).not.toContain("onclick");
});

test("the fitted frame is a padded square around the visible content", async () => {
  const getBBox = vi.fn(() => ({ x: 10, y: 20, width: 40, height: 20 }));
  Object.defineProperty(SVGElement.prototype, "getBBox", { value: getBBox, configurable: true });
  try {
    const picture = await IconPictures.fromFile(svgFile('<svg viewBox="0 0 100 100"><path/></svg>'), "custom-a");
    expect(picture.viewBox).toBe("8 8 44 44");
    expect(await IconPictures.fit(picture)).toBe("8 8 44 44");
  } finally {
    delete (SVGElement.prototype as { getBBox?: unknown }).getBBox;
  }
});

test("oversize files and files that are not images are refused with a message for the author", async () => {
  await expect(IconPictures.fromFile(svgFile(`<svg>${" ".repeat(200_001)}</svg>`), "custom-a")).rejects.toThrow(
    "limit is 200 kB"
  );
  await expect(IconPictures.fromFile(svgFile("not markup"), "custom-a")).rejects.toThrow("not a valid SVG");
  const text = new File(["hello"], "notes.txt", { type: "text/plain" });
  await expect(IconPictures.fromFile(text, "custom-a")).rejects.toThrow("not an image");
  const huge = new File([new Uint8Array(2_000_001)], "photo.png", { type: "image/png" });
  await expect(IconPictures.fromFile(huge, "custom-a")).rejects.toThrow("limit is 2 MB");
});

test("a link must be a web address that opens an image; unreadable pixels keep the whole box", async () => {
  await expect(IconPictures.fromLink("javascript:alert(1)")).rejects.toThrow("http:// or https://");
  await expect(IconPictures.fromLink("ftp://a.b/c.png")).rejects.toThrow("http:// or https://");

  // an image that loads, from a site that does not share its pixels
  class LoadingImage {
    naturalWidth = 64;
    naturalHeight = 32;
    crossOrigin = "";
    onload: (() => void) | null = null;
    set src(_url: string) {
      queueMicrotask(() => this.onload?.());
    }
  }
  vi.stubGlobal("Image", LoadingImage);
  expect(await IconPictures.fromLink(" https://a.b/c.png ")).toEqual({
    kind: "image",
    content: "https://a.b/c.png",
    viewBox: "0 0 100 100"
  });

  class FailingImage {
    onerror: (() => void) | null = null;
    set src(_url: string) {
      queueMicrotask(() => this.onerror?.());
    }
  }
  vi.stubGlobal("Image", FailingImage);
  await expect(IconPictures.fromLink("https://a.b/page.html")).rejects.toThrow("does not open an image");
});

test("a raster upload is redrawn at 256 px as WebP, framed around its opaque pixels", async () => {
  // a 1024×512 image with content only in its right half's middle: pixels 192–255 × 32–95 once redrawn
  class DecodedImage {
    naturalWidth = 1024;
    naturalHeight = 512;
    onload: (() => void) | null = null;
    set src(_url: string) {
      queueMicrotask(() => this.onload?.());
    }
  }
  const drawn: number[][] = [];
  const context = {
    drawImage: (_image: unknown, _x: number, _y: number, width: number, height: number) => drawn.push([width, height]),
    getImageData: (_x: number, _y: number, width: number, height: number) => {
      const data = new Uint8ClampedArray(width * height * 4);
      for (let y = 32; y < 96; y++) for (let x = 192; x < 256; x++) data[(y * width + x) * 4 + 3] = 255;
      return { data };
    }
  };
  vi.stubGlobal("Image", DecodedImage);
  vi.stubGlobal("URL", { createObjectURL: () => "blob:upload", revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as never);
  const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/webp;base64,AA");

  const picture = await IconPictures.fromFile(new File([new Uint8Array(10)], "photo.png", { type: "image/png" }), "c");
  expect(drawn).toEqual([[256, 128]]);
  expect(toDataURL).toHaveBeenCalledWith("image/webp", 0.85);
  // 256×128 letterboxed in 0 0 100 100: 64 px of content is 25 units, from 75 across and 37.5 down
  expect(picture).toEqual({ kind: "image", content: "data:image/webp;base64,AA", viewBox: "73.75 36.25 27.5 27.5" });
});
