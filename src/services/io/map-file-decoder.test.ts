import { describe, expect, it } from "vitest";
import { decodeMapFile } from "./map-file-decoder";

const map = '1.0|license\r\nsettings\r\n<svg id="map"><text>line\nvalue</text></svg>';

describe("decodeMapFile", () => {
  it("decodes plain and base64 legacy map payloads", async () => {
    expect(await decodeMapFile(new TextEncoder().encode(map))).toEqual([
      "1.0|license",
      "settings",
      '<svg id="map"><text>line\nvalue</text></svg>'
    ]);
    expect(await decodeMapFile(new TextEncoder().encode(btoa(map)))).toEqual(
      await decodeMapFile(new TextEncoder().encode(map))
    );
  });

  it("detects and decodes gzip before attempting text decoding", async () => {
    const stream = new Blob([map]).stream().pipeThrough(new CompressionStream("gzip"));
    const compressed = await new Response(stream).arrayBuffer();
    expect(await decodeMapFile(compressed)).toEqual(await decodeMapFile(new TextEncoder().encode(map)));
  });
});
